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
        private SurvivalMapProfile _mapProfile;
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
        private float _bossWarningRemaining;

        public int CurrentWave { get { return _currentWave; } }
        public int AdaptivePerformanceTier { get { return _adaptiveTier; } }

        public void Initialize(PlayerController player)
        {
            _player = player;
            _isMobile = SystemInfo.deviceType == DeviceType.Handheld || Screen.width < 900;
            _hordeProfile = SurvivalHordeCatalog.GetProfile(_isMobile);
            _mapProfile = GameContentCatalog.GetMap(GameSession.Current != null
                ? GameSession.Current.SelectedMap : WarehouseMapId.WarehouseB4);
            _currentWave = 1;
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
            {
                EnemyKind kind = EnemyArchetypeCatalog.ChooseSurvivalSpawnType(
                    _currentWave, elapsed, Random.value);
                SpawnEnemy(kind, profile, Random.value * Mathf.PI * 2f, Random.Range(11.5f, 15.5f));
            }

            _spawnTimer = profile.SpawnIntervalSeconds;
        }

        private void UpdateHordeDirector(float elapsed)
        {
            if (_hordeElapsed <= 0f && elapsed >= _nextHordeAt)
            {
                _hordeElapsed = 0.001f;
                _hordeSpawnQueue = _hordeProfile.EnemyCount;
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
                SurvivalDifficultyProfile difficulty = GetDifficultyProfile(_currentWave);
                EnemyKind kind = EnemyArchetypeCatalog.ChooseSurvivalSpawnType(_currentWave, elapsed, Random.value);
                float angle = Random.value * Mathf.PI * 2f;
                SpawnEnemy(kind, difficulty, angle, radius + Random.Range(-0.45f, 0.45f));
                _hordeSpawnQueue--;
                _hordeSpawnTimer = _hordeProfile.SpawnIntervalSeconds;
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
                    _pendingBossWave = 0;
                    _lastBossWave = wave;
                    SpawnMajorBoss(wave);
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

        private void SpawnMajorBoss(int majorBossWave)
        {
            EnemyKind kind = GetBossKind(majorBossWave);
            SurvivalDifficultyProfile difficulty = GetDifficultyProfile(_currentWave);
            Vector3 spawn = GetSpawnPosition(Random.value * Mathf.PI * 2f, 16f);
            EnemyAgent boss = WarehouseWorldFactory.SpawnSurvivalEnemy(
                _player, kind, spawn,
                difficulty.EnemyHealthMultiplier,
                difficulty.EnemySpeedMultiplier,
                difficulty.EnemyAbilityRateMultiplier);
            if (boss == null) return;

            boss.name = majorBossWave == 5
                ? "Inwentaryzacja Gigant • Nadzorca Zero"
                : GetBossName(majorBossWave);
            FindFirstObjectByType<HudController>()?.SetStatus("BOSS NA HALI • " + boss.name);
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
            EnemyAgent[] enemies = FindObjectsByType<EnemyAgent>(FindObjectsSortMode.None);
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
            EnemyAgent[] enemies = FindObjectsByType<EnemyAgent>(FindObjectsSortMode.None);
            int count = 0;
            foreach (EnemyAgent enemy in enemies)
                if (enemy != null && !enemy.IsDefeated) count++;
            return count;
        }

        private SurvivalDifficultyProfile GetDifficultyProfile(int wave)
        {
            SurvivalDifficultyProfile profile = SurvivalDifficultyCatalog.GetProfile(wave);
            if (_mapProfile != null)
            {
                profile.EnemyHealthMultiplier *= _mapProfile.EnemyHealthMultiplier;
                profile.EnemySpeedMultiplier *= _mapProfile.EnemySpeedMultiplier;
            }
            return profile;
        }

        private void SpawnEnemy(EnemyKind kind, SurvivalDifficultyProfile difficulty, float angle, float radius)
        {
            Vector3 position = GetSpawnPosition(angle, radius);
            WarehouseWorldFactory.SpawnSurvivalEnemy(
                _player,
                kind,
                position,
                difficulty.EnemyHealthMultiplier,
                difficulty.EnemySpeedMultiplier,
                difficulty.EnemyAbilityRateMultiplier);
        }

        private Vector3 GetSpawnPosition(float angle, float radius)
        {
            Vector3 center = _player.transform.position;
            for (int attempt = 0; attempt < 16; attempt++)
            {
                float adjustedAngle = angle + attempt * 0.3926991f;
                float adjustedRadius = radius + (attempt % 3) * 0.7f;
                Vector3 candidate = center + new Vector3(Mathf.Cos(adjustedAngle), 0f, Mathf.Sin(adjustedAngle)) * adjustedRadius;
                candidate.y = 0.05f;
                Vector3 checkCenter = candidate + Vector3.up * 0.88f;
                if (!Physics.CheckSphere(checkCenter, 0.48f, Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore))
                    return candidate;
            }

            Vector3 fallback = center + new Vector3(Mathf.Cos(angle), 0f, Mathf.Sin(angle)) * Mathf.Max(9f, radius);
            fallback.y = 0.05f;
            return fallback;
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
                _ringMaterial = new Material(shader) { enableInstancing = true };
            }
            _hordeRing.sharedMaterial = _ringMaterial;
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
