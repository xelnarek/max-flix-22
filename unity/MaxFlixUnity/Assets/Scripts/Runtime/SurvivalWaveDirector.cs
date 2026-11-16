using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    /// <summary>
    /// Survival wave loop: 60 s waves, weighted roster, map/difficulty modifiers,
    /// device-aware live caps, 90 s horde rings and 5-minute major-boss warnings.
    /// Weapon firing and level-up progression are hosted by sibling components.
    /// </summary>
    public sealed class SurvivalWaveDirector : MonoBehaviour
    {
        private const float WaveDurationSeconds = 60f;
        private const float FirstHordeAtSeconds = 90f;
        private const float HordeCadenceSeconds = 90f;
        private const float BossCadenceSeconds = 300f;

        private static Material _ringMaterial;
        private PlayerController _player;
        private LineRenderer _hordeRing;
        private SurvivalHordeProfile _hordeProfile;
        private bool _isMobile;
        private int _adaptiveTier;
        private int _currentWave = 1;
        private int _lastBossWave;
        private int _pendingBossWave;
        private float _spawnTimer = 1.5f;
        private float _nextHordeAt = FirstHordeAtSeconds;
        private float _hordeElapsed;
        private float _hordeSpawnTimer;
        private int _hordeSpawnQueue;
        private int _hordeSpawned;
        private float _hordeStartAngle;
        private EnemyAgent _trackedRareSebix;
        private EnemyAgent _trackedRareBosman;
        private float _bossWarningRemaining;

        public int CurrentWave { get { return _currentWave; } }
        public int AdaptivePerformanceTier { get { return _adaptiveTier; } }

        public void Initialize(PlayerController player)
        {
            _player = player;
            _isMobile = SystemInfo.deviceType == DeviceType.Handheld || Screen.width < 900;
            _hordeProfile = SurvivalHordeCatalog.GetProfile(_isMobile);
            _currentWave = 1;
            _trackedRareSebix = null;
            _trackedRareBosman = null;
            _lastBossWave = 0;
            _nextHordeAt = FirstHordeAtSeconds;
            _spawnTimer = 1.5f;
            EnsureHordeRing();
            UpdateWaveHud();
        }

        public void SetAdaptivePerformanceTier(int tier)
        {
            _adaptiveTier = Mathf.Clamp(tier, 0, 2);
        }

        private void Update()
        {
            if (_player == null || _player.IsDefeated || GameSession.Current == null
                || GameSession.Current.Mode != GameMode.Survival
                || GameSession.Current.State != GameFlowState.Playing)
                return;

            float elapsed = GameSession.Current.ElapsedSeconds;
            int nextWave = 1 + Mathf.FloorToInt(elapsed / WaveDurationSeconds);
            if (nextWave != _currentWave)
            {
                _currentWave = nextWave;
                GameSession.Current.HighestWave = Mathf.Max(GameSession.Current.HighestWave, _currentWave);
                UpdateWaveHud();
            }

            UpdateBossDirector(elapsed);
            UpdateHordeDirector(elapsed);
            UpdateRegularWaveDirector(elapsed);
        }

        private void UpdateRegularWaveDirector(float elapsed)
        {
            if (_hordeElapsed > 0f) return;
            _spawnTimer -= Time.deltaTime;
            if (_spawnTimer > 0f) return;

            int cap = SurvivalDifficultyCatalog.GetLiveEnemyCap(_isMobile, _adaptiveTier);
            int alive = CountAliveEnemies();
            SurvivalDifficultyProfile profile = GetDifficultyProfile(_currentWave);
            int groupSize = SurvivalDifficultyCatalog.GetGroupSize(
                _currentWave, profile, _isMobile, _adaptiveTier, cap - alive);

            if (groupSize <= 0)
            {
                _spawnTimer = 0.35f;
                return;
            }

            for (int i = 0; i < groupSize; i++)
                SpawnRegularSurvivalEnemy(elapsed);

            _spawnTimer = profile.SpawnIntervalSeconds;
        }

        private void UpdateHordeDirector(float elapsed)
        {
            if (_hordeElapsed <= 0f && elapsed >= _nextHordeAt)
            {
                _hordeElapsed = 0.001f;
                _hordeSpawnQueue = _hordeProfile.EnemyCount;
                _hordeSpawned = 0;
                _hordeStartAngle = Random.value * Mathf.PI * 2f;
                _hordeSpawnTimer = 0f;
                _nextHordeAt += HordeCadenceSeconds;
                if (_player != null)
                    FindFirstObjectByType<HudController>()?.SetStatus("FALOWA SZARŻA • " + _hordeProfile.EnemyCount + " JEDNOSTEK");
            }

            if (_hordeElapsed <= 0f) return;
            _hordeElapsed += Time.deltaTime;
            _hordeSpawnTimer -= Time.deltaTime;

            float radius = SurvivalHordeCatalog.GetContractingRadius(_hordeElapsed, _hordeProfile);
            DrawHordeRing(radius, _hordeElapsed / _hordeProfile.DurationSeconds);

            int baseCap = SurvivalDifficultyCatalog.GetLiveEnemyCap(_isMobile, _adaptiveTier);
            int extraCap = _isMobile ? (_adaptiveTier >= 2 ? 2 : _adaptiveTier == 1 ? 3 : 4) : 6;
            int cap = baseCap + extraCap;
            int alive = CountAliveEnemies();

            if (_hordeSpawnQueue > 0 && _hordeSpawnTimer <= 0f && alive < cap)
            {
                EnemyKind kind = EnemyArchetypeCatalog.ChooseSurvivalSpawnType(_currentWave, elapsed, Random.value);
                float angle = _hordeStartAngle + (_hordeSpawned / (float)Mathf.Max(1, _hordeProfile.EnemyCount)) * Mathf.PI * 2f;
                if (SpawnEnemy(kind, angle, radius))
                {
                    _hordeSpawned++;
                    _hordeSpawnQueue--;
                    _hordeSpawnTimer = _hordeProfile.SpawnIntervalSeconds;
                }
                else
                {
                    _hordeSpawnTimer = 0.20f;
                }
            }
            else if (_hordeSpawnQueue > 0 && alive >= cap)
            {
                _hordeSpawnTimer = 0.10f;
            }

            if (_hordeElapsed < _hordeProfile.DurationSeconds) return;
            _hordeElapsed = 0f;
            _hordeSpawnQueue = 0;
            if (_hordeRing != null) _hordeRing.enabled = false;
            _spawnTimer = Mathf.Max(_spawnTimer, 1.8f);
            FindFirstObjectByType<HudController>()?.SetStatus("FALOWA SZARŻA ODPARTA");
        }

        private void UpdateBossDirector(float elapsed)
        {
            if (_bossWarningRemaining > 0f)
            {
                _bossWarningRemaining = Mathf.Max(0f, _bossWarningRemaining - Time.deltaTime);
                if (_bossWarningRemaining <= 0f && _pendingBossWave > 0)
                {
                    int wave = _pendingBossWave;
                    if (SpawnMajorBoss(wave))
                    {
                        _pendingBossWave = 0;
                        _lastBossWave = wave;
                    }
                    else
                    {
                        // Do not consume the boss event when every safe spawn
                        // lane is temporarily blocked by geometry or the horde.
                        _bossWarningRemaining = 2f;
                        FindFirstObjectByType<HudController>()?.SetStatus("BOSS CZEKA NA WOLNE MIEJSCE DO WEJŚCIA");
                    }
                }
                return;
            }

            if (elapsed < BossCadenceSeconds) return;
            int majorBossWave = Mathf.FloorToInt(elapsed / BossCadenceSeconds) * 5;
            if (majorBossWave <= _lastBossWave || HasActiveMajorBoss()) return;

            _pendingBossWave = majorBossWave;
            _bossWarningRemaining = 6f;
            string bossName = GetBossName(majorBossWave);
            FindFirstObjectByType<HudController>()?.SetStatus("UWAGA • " + bossName.ToUpperInvariant() + " ZA 6 SEKUND");
        }

        private bool SpawnMajorBoss(int majorBossWave)
        {
            EnemyKind kind = GetBossKind(majorBossWave);
            if (!TryGetSpawnPosition(Random.value * Mathf.PI * 2f, 16f, out Vector3 spawn))
                return false;

            SurvivalDifficultyProfile difficulty = GetDifficultyProfile(_currentWave, spawn);
            EnemyAgent boss = WarehouseWorldFactory.SpawnSurvivalEnemy(
                _player, kind, spawn,
                difficulty.EnemyHealthMultiplier,
                difficulty.EnemySpeedMultiplier,
                difficulty.EnemyAbilityRateMultiplier);
            if (boss == null) return false;

            boss.name = majorBossWave == 5
                ? "Inwentaryzacja Gigant • Nadzorca Zero"
                : GetBossName(majorBossWave);
            FindFirstObjectByType<HudController>()?.SetStatus("BOSS NA HALI • " + boss.name);
            return true;
        }

        private EnemyKind GetBossKind(int majorBossWave)
        {
            int cycle = Mathf.Max(0, Mathf.FloorToInt(majorBossWave / 5f) - 1) % 3;
            if (cycle == 1) return EnemyKind.KingLeto;
            if (cycle == 2) return EnemyKind.BosmanKrakow;
            return EnemyKind.Walczak;
        }

        private string GetBossName(int majorBossWave)
        {
            switch (GetBossKind(majorBossWave))
            {
                case EnemyKind.KingLeto: return "Dyrektor Widmo";
                case EnemyKind.BosmanKrakow: return "Bosman Kraków";
                default: return "Nadzorca Zero";
            }
        }

        private bool HasActiveMajorBoss()
        {
            EnemyAgent[] enemies = EnemyAgent.GetCachedAgents();
            foreach (EnemyAgent enemy in enemies)
            {
                if (enemy == null || enemy.IsDefeated) continue;
                if (enemy.Kind == EnemyKind.Walczak || enemy.Kind == EnemyKind.KingLeto
                    || enemy.Kind == EnemyKind.BosmanKrakow || enemy.Kind == EnemyKind.Sebix)
                    return true;
            }
            return false;
        }

        private int CountAliveEnemies()
        {
            EnemyAgent[] enemies = EnemyAgent.GetCachedAgents();
            int count = 0;
            foreach (EnemyAgent enemy in enemies)
                if (enemy != null && !enemy.IsDefeated) count++;
            return count;
        }

        private void SpawnRegularSurvivalEnemy(float elapsed)
        {
            float angle = Random.value * Mathf.PI * 2f;
            float radius = Random.Range(11.5f, 15.5f);
            if (!TryGetSpawnPosition(angle, radius, out Vector3 spawn)) return;
            SurvivalDifficultyProfile localDifficulty = GetDifficultyProfile(_currentWave, spawn);

            bool sebixAlreadyActive = (_trackedRareSebix != null && !_trackedRareSebix.IsDefeated)
                || HasActiveEnemyKind(EnemyKind.Sebix);
            if (_currentWave >= 8 && !sebixAlreadyActive && Random.value < 0.065f)
            {
                EnemyAgent sebix = WarehouseWorldFactory.SpawnSurvivalEnemy(
                    _player, EnemyKind.Sebix, spawn,
                    localDifficulty.EnemyHealthMultiplier,
                    localDifficulty.EnemySpeedMultiplier,
                    localDifficulty.EnemyAbilityRateMultiplier);
                if (sebix != null)
                {
                    _trackedRareSebix = sebix;
                    sebix.name = "Sebix M • Rzadki operator turbo";
                    FindFirstObjectByType<HudController>()?.SetStatus("RZADKIE SPOTKANIE • SEBIX M");
                    return;
                }
            }

            bool bosmanAlreadyActive = (_trackedRareBosman != null && !_trackedRareBosman.IsDefeated)
                || HasActiveEnemyKind(EnemyKind.BosmanKrakow);
            if (_currentWave >= 6 && !bosmanAlreadyActive && Random.value < 0.04f)
            {
                EnemyAgent bosman = WarehouseWorldFactory.SpawnSurvivalEnemy(
                    _player, EnemyKind.BosmanKrakow, spawn,
                    localDifficulty.EnemyHealthMultiplier,
                    localDifficulty.EnemySpeedMultiplier,
                    localDifficulty.EnemyAbilityRateMultiplier);
                if (bosman != null)
                {
                    _trackedRareBosman = bosman;
                    bosman.name = "Bosman Kraków • Rzadki patrol rampy";
                    FindFirstObjectByType<HudController>()?.SetStatus("RZADKIE SPOTKANIE • BOSMAN KRAKÓW");
                    return;
                }
            }

            EnemyKind kind = EnemyArchetypeCatalog.ChooseSurvivalSpawnType(
                _currentWave, elapsed, Random.value);
            WarehouseWorldFactory.SpawnSurvivalEnemy(
                _player, kind, spawn,
                localDifficulty.EnemyHealthMultiplier,
                localDifficulty.EnemySpeedMultiplier,
                localDifficulty.EnemyAbilityRateMultiplier);
        }

        private bool HasActiveEnemyKind(EnemyKind kind)
        {
            EnemyAgent[] enemies = EnemyAgent.GetCachedAgents();
            foreach (EnemyAgent enemy in enemies)
                if (enemy != null && !enemy.IsDefeated && enemy.Kind == kind) return true;
            return false;
        }

        private SurvivalDifficultyProfile GetDifficultyProfile(int wave)
        {
            // Spawn cadence and group composition remain global. Biome modifiers
            // are applied per actor at the actual spawn coordinate.
            return SurvivalDifficultyCatalog.GetProfile(wave);
        }

        private SurvivalDifficultyProfile GetDifficultyProfile(int wave, Vector3 position)
        {
            SurvivalDifficultyProfile profile = SurvivalDifficultyCatalog.GetProfile(wave);
            profile.EnemyHealthMultiplier *= GameContentCatalog.GetBlendedEnemyHealthMultiplier(position.x, position.z);
            profile.EnemySpeedMultiplier *= GameContentCatalog.GetBlendedEnemySpeedMultiplier(position.x, position.z);
            return profile;
        }

        private bool SpawnEnemy(EnemyKind kind, float angle, float radius)
        {
            if (!TryGetSpawnPosition(angle, radius, out Vector3 position)) return false;
            SurvivalDifficultyProfile localDifficulty = GetDifficultyProfile(_currentWave, position);
            return WarehouseWorldFactory.SpawnSurvivalEnemy(
                _player,
                kind,
                position,
                localDifficulty.EnemyHealthMultiplier,
                localDifficulty.EnemySpeedMultiplier,
                localDifficulty.EnemyAbilityRateMultiplier) != null;
        }

        private bool TryGetSpawnPosition(float angle, float radius, out Vector3 safePosition)
        {
            safePosition = Vector3.zero;
            if (_player == null) return false;

            Vector3 center = _player.transform.position;
            const float clearanceFromPlayer = 4.2f;
            const float collisionRadius = 0.48f;
            const float edgeInset = 2.0f;

            // First scan the intended ring, rotating the requested angle and
            // gently widening its radius to find a clear tile corridor.
            for (int attempt = 0; attempt < 24; attempt++)
            {
                float adjustedAngle = angle + attempt * 0.2617994f;
                float adjustedRadius = Mathf.Max(7f, radius) + (attempt % 4) * 0.85f;
                Vector3 candidate = center + new Vector3(
                    Mathf.Cos(adjustedAngle), 0f, Mathf.Sin(adjustedAngle)) * adjustedRadius;
                candidate = SurvivalWorldLayout.ClampInside(candidate, edgeInset);
                if (IsSpawnPositionClear(candidate, center, clearanceFromPlayer, collisionRadius))
                {
                    safePosition = candidate;
                    return true;
                }
            }

            // Crowded seams can block a whole side of the ring. Search several
            // nearby radii before skipping the spawn; never fall back on top of
            // the player or inside a rack/container collider.
            float[] radii = { 8f, 11f, 14f, 17f, 20f };
            for (int ring = 0; ring < radii.Length; ring++)
            {
                for (int spoke = 0; spoke < 16; spoke++)
                {
                    float candidateAngle = angle + spoke * 0.3926991f;
                    Vector3 candidate = center + new Vector3(
                        Mathf.Cos(candidateAngle), 0f, Mathf.Sin(candidateAngle)) * radii[ring];
                    candidate = SurvivalWorldLayout.ClampInside(candidate, edgeInset);
                    if (IsSpawnPositionClear(candidate, center, clearanceFromPlayer, collisionRadius))
                    {
                        safePosition = candidate;
                        return true;
                    }
                }
            }

            return false;
        }

        private static bool IsSpawnPositionClear(
            Vector3 candidate,
            Vector3 playerPosition,
            float clearanceFromPlayer,
            float collisionRadius)
        {
            Vector3 flatOffset = candidate - playerPosition;
            flatOffset.y = 0f;
            if (flatOffset.sqrMagnitude < clearanceFromPlayer * clearanceFromPlayer)
                return false;

            Vector3 checkCenter = candidate + Vector3.up * 0.88f;
            return !Physics.CheckSphere(
                checkCenter,
                collisionRadius,
                Physics.DefaultRaycastLayers,
                QueryTriggerInteraction.Ignore);
        }

        private void EnsureHordeRing()
        {
            if (_hordeRing != null) return;
            GameObject ringObject = new GameObject("Survival horde warning ring");
            ringObject.transform.SetParent(_player.transform, false);
            ringObject.transform.localPosition = new Vector3(0f, 0.06f, 0f);
            _hordeRing = ringObject.AddComponent<LineRenderer>();
            _hordeRing.useWorldSpace = false;
            _hordeRing.loop = true;
            _hordeRing.positionCount = 65;
            _hordeRing.widthMultiplier = 0.11f;
            _hordeRing.numCapVertices = 2;
            _hordeRing.enabled = false;

            if (_ringMaterial == null)
            {
                Shader shader = Shader.Find("Universal Render Pipeline/Unlit");
                if (shader == null) shader = Shader.Find("Sprites/Default");
                if (shader != null)
                    _ringMaterial = new Material(shader) { enableInstancing = true };
            }
            if (_ringMaterial != null)
                _hordeRing.sharedMaterial = _ringMaterial;
            else
            {
                _hordeRing.enabled = false;
                Debug.LogError("No compatible unlit shader is available for the Survival horde warning ring.");
            }
        }

        private void DrawHordeRing(float radius, float progress)
        {
            if (_hordeRing == null) return;
            _hordeRing.enabled = true;
            Color color = Color.Lerp(new Color(1f, 0.72f, 0.16f, 0.9f), new Color(1f, 0.20f, 0.12f, 0.95f), Mathf.Clamp01(progress));
            _hordeRing.startColor = color;
            _hordeRing.endColor = color;
            for (int i = 0; i < _hordeRing.positionCount; i++)
            {
                float angle = (i / 64f) * Mathf.PI * 2f;
                _hordeRing.SetPosition(i, new Vector3(Mathf.Cos(angle) * radius, 0f, Mathf.Sin(angle) * radius));
            }
        }

        private void UpdateWaveHud()
        {
            if (GameSession.Current != null)
                GameSession.Current.HighestWave = Mathf.Max(GameSession.Current.HighestWave, _currentWave);
            FindFirstObjectByType<HudController>()?.SetStatus("SURVIVAL • FALA " + _currentWave + " • ZMIANA CO 60 S");
        }

        private void OnDestroy()
        {
            if (_hordeRing != null) Destroy(_hordeRing.gameObject);
        }
    }
}
