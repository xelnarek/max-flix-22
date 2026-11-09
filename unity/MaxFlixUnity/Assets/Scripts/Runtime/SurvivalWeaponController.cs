using System;
using System.Collections.Generic;
using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    /// <summary>
    /// First executable port of the twelve-weapon Survival arsenal.
    /// Reloads progress independently; a 1.05 s dispatch gate prevents
    /// simultaneous volleys. Primitive projectiles are pooled by shape.
    /// </summary>
    public sealed class SurvivalWeaponController : MonoBehaviour
    {
        [Serializable]
        public sealed class WeaponState
        {
            public SurvivalWeaponKind Id;
            public int Level;
            public float Cooldown;
            public bool Evolved;
        }

        private sealed class ShotState
        {
            public GameObject Root;
            public PrimitiveType Shape;
            public Vector3 Velocity;
            public Vector3 PreviousPosition;
            public float Damage;
            public float RemainingLife;
            public float MaximumLife;
            public float Speed;
            public float HitRadius;
            public float AoeRadius;
            public float SlowSeconds;
            public float SlowMultiplier = 1f;
            public float StunSeconds;
            public float Knockback;
            public int PierceRemaining;
            public int RicochetsRemaining;
            public bool Homing;
            public bool Boomerang;
            public bool Returning;
            public bool Orbiting;
            public bool Ignites;
            public bool IsPulse;
            public float OrbitAngle;
            public float OrbitRadius;
            public float OrbitSpeed;
            public float SpinSpeed;
            public float PulseAge;
            public float PulseDuration;
            public Vector3 PulseBaseScale;
            public SurvivalWeaponKind WeaponId;
            public readonly HashSet<int> HitTargets = new HashSet<int>();
        }

        private const int PoolPerShapeLimit = 28;
        private const float AutoAimBaseRange = 22f;
        private const float PlayerShotOriginHeight = 0.90f;

        private static Material _sharedMaterial;
        private static readonly int BaseColorId = Shader.PropertyToID("_BaseColor");
        private static readonly int ColorId = Shader.PropertyToID("_Color");
        private static readonly int EmissionColorId = Shader.PropertyToID("_EmissionColor");

        private readonly List<WeaponState> _weapons = new List<WeaponState>();
        private readonly List<ShotState> _activeShots = new List<ShotState>();
        private readonly Dictionary<PrimitiveType, List<GameObject>> _pool = new Dictionary<PrimitiveType, List<GameObject>>();
        private readonly MaterialPropertyBlock _propertyBlock = new MaterialPropertyBlock();
        private EnemyAgent[] _enemyCache = new EnemyAgent[0];
        private PlayerController _player;
        private HudController _hud;
        private SurvivalProgressionController _progression;
        private float _enemyRefreshRemaining;
        private float _dispatchRemaining;
        private float _damageMultiplier = 1f;
        private float _reloadMultiplier = 1f;
        private float _rangeMultiplier = 1f;
        private float _criticalChance = 0.05f;
        private float _criticalDamageMultiplier = 1.75f;
        private float _overdriveRemaining;
        private float _overdriveDamageMultiplier = 1f;
        private float _overdriveReloadMultiplier = 1f;
        private int _dispatchCursor;
        private bool _initialized;

        public IReadOnlyList<WeaponState> Weapons { get { return _weapons; } }
        public int WeaponCount { get { return _weapons.Count; } }

        public void Initialize(PlayerController player, HudController hud, SurvivalProgressionController progression)
        {
            _player = player;
            _hud = hud;
            _progression = progression;
            _weapons.Clear();
            _activeShots.Clear();
            _dispatchRemaining = 0f;
            _enemyRefreshRemaining = 0f;
            _initialized = true;
            UpdateHudSummary();
        }

        public void SetProgression(SurvivalProgressionController progression)
        {
            _progression = progression;
        }

        public bool HasWeapon(SurvivalWeaponKind id)
        {
            return _weapons.Exists(w => w.Id == id);
        }

        public WeaponState GetWeapon(SurvivalWeaponKind id)
        {
            return _weapons.Find(w => w.Id == id);
        }

        public bool UnlockWeapon(SurvivalWeaponKind id, int initialLevel)
        {
            if (HasWeapon(id) || _weapons.Count >= SurvivalWeaponCatalog.GetAll().Length) return false;
            int level = Mathf.Clamp(initialLevel, 1, 5);
            _weapons.Add(new WeaponState
            {
                Id = id,
                Level = level,
                Evolved = false,
                Cooldown = SurvivalWeaponCatalog.GetReloadSeconds(id, level, false, _reloadMultiplier) * 0.75f
            });
            UpdateHudSummary();
            return true;
        }

        public bool UpgradeWeapon(SurvivalWeaponKind id, int steps)
        {
            WeaponState weapon = GetWeapon(id);
            if (weapon == null || weapon.Level >= 5) return false;
            int nextLevel = Mathf.Min(5, weapon.Level + Mathf.Max(1, steps));
            float nextReload = SurvivalWeaponCatalog.GetReloadSeconds(id, nextLevel, weapon.Evolved, _reloadMultiplier);
            weapon.Level = nextLevel;
            weapon.Cooldown = Mathf.Max(weapon.Cooldown, nextReload * 0.35f);
            UpdateHudSummary();
            return true;
        }

        public bool EvolveWeapon(SurvivalWeaponKind id)
        {
            WeaponState weapon = GetWeapon(id);
            if (weapon == null || weapon.Level < 5 || weapon.Evolved) return false;
            weapon.Evolved = true;
            float reload = SurvivalWeaponCatalog.GetReloadSeconds(id, weapon.Level, true, _reloadMultiplier);
            weapon.Cooldown = Mathf.Max(weapon.Cooldown, reload * 0.35f);
            UpdateHudSummary();
            return true;
        }

        public void GrantOverdrive(float duration, float damageMultiplier, float reloadMultiplier)
        {
            _overdriveRemaining = Mathf.Max(_overdriveRemaining, Mathf.Clamp(duration, 1f, 30f));
            _overdriveDamageMultiplier = Mathf.Max(_overdriveDamageMultiplier, Mathf.Clamp(damageMultiplier, 1f, 1.6f));
            _overdriveReloadMultiplier = Mathf.Min(_overdriveReloadMultiplier, Mathf.Clamp(reloadMultiplier, 0.65f, 1f));
            _hud?.SetStatus("OVERDRIVE • " + _overdriveRemaining.ToString("0") + " S");
        }

        public void ApplyPassive(string id, float strength)
        {
            float safeStrength = Mathf.Clamp(strength, 0.5f, 1.75f);
            switch (id)
            {
                case "damage":
                    _damageMultiplier = Mathf.Min(2.05f, _damageMultiplier * (1f + 0.12f * safeStrength));
                    break;
                case "rapid":
                    _reloadMultiplier = Mathf.Max(0.72f, _reloadMultiplier * (1f - 0.03f * safeStrength));
                    break;
                case "critical":
                    _criticalChance = Mathf.Min(0.30f, _criticalChance + 0.04f * safeStrength);
                    break;
                case "critical_damage":
                    _criticalDamageMultiplier = Mathf.Min(2.85f, _criticalDamageMultiplier + 0.20f * safeStrength);
                    break;
                case "range":
                    _rangeMultiplier = Mathf.Min(1.75f, _rangeMultiplier * (1f + 0.08f * safeStrength));
                    break;
            }
        }

        public bool HasReadyTarget()
        {
            return FindTarget() != null;
        }

        public string GetWeaponSummary()
        {
            if (_weapons.Count == 0) return "ARSENAŁ: brak broni — wybierz pierwszy moduł";
            System.Text.StringBuilder result = new System.Text.StringBuilder("ARSENAŁ ");
            for (int i = 0; i < _weapons.Count; i++)
            {
                WeaponState weapon = _weapons[i];
                SurvivalWeaponProfile profile = SurvivalWeaponCatalog.Get(weapon.Id);
                if (i > 0) result.Append("  •  ");
                result.Append(profile.Icon).Append(' ').Append(profile.DisplayName).Append(' ')
                    .Append(weapon.Level).Append("/5");
                if (weapon.Evolved) result.Append(" ✦");
            }
            return result.ToString();
        }

        private void Update()
        {
            if (!_initialized || _player == null || _player.IsDefeated
                || GameSession.Current == null
                || GameSession.Current.Mode != GameMode.Survival
                || GameSession.Current.State != GameFlowState.Playing)
                return;

            float deltaTime = Time.deltaTime;
            _enemyCache = EnemyAgent.GetCachedAgents();

            _dispatchRemaining = Mathf.Max(0f, _dispatchRemaining - deltaTime);
            _overdriveRemaining = Mathf.Max(0f, _overdriveRemaining - deltaTime);
            if (_overdriveRemaining <= 0f)
            {
                _overdriveDamageMultiplier = 1f;
                _overdriveReloadMultiplier = 1f;
            }
            for (int i = 0; i < _weapons.Count; i++)
                _weapons[i].Cooldown = Mathf.Max(0f, _weapons[i].Cooldown - deltaTime);

            UpdateActiveShots(deltaTime);
            if (_weapons.Count == 0 || _dispatchRemaining > 0f) return;

            EnemyAgent target = FindTarget();
            if (target == null) return;

            int readyIndex = FindNextReadyWeapon();
            if (readyIndex < 0) return;

            WeaponState ready = _weapons[readyIndex];
            Fire(ready, target);
            ready.Cooldown = SurvivalWeaponCatalog.GetReloadSeconds(
                ready.Id, ready.Level, ready.Evolved, _reloadMultiplier * _overdriveReloadMultiplier);
            _dispatchCursor = (readyIndex + 1) % Mathf.Max(1, _weapons.Count);
            _dispatchRemaining = SurvivalWeaponCatalog.GetDispatchInterval();
        }

        private EnemyAgent FindTarget()
        {
            if (_player == null) return null;
            float maxRange = AutoAimBaseRange * _rangeMultiplier;
            float bestDistance = maxRange * maxRange;
            EnemyAgent closest = null;
            Vector3 playerPosition = _player.transform.position;
            foreach (EnemyAgent enemy in _enemyCache)
            {
                if (enemy == null || enemy.IsDefeated) continue;
                Vector3 offset = enemy.transform.position - playerPosition;
                offset.y = 0f;
                float distance = offset.sqrMagnitude;
                if (distance >= bestDistance) continue;
                bestDistance = distance;
                closest = enemy;
            }
            return closest;
        }

        private int FindNextReadyWeapon()
        {
            if (_weapons.Count == 0) return -1;
            for (int i = 0; i < _weapons.Count; i++)
            {
                int index = (_dispatchCursor + i) % _weapons.Count;
                if (_weapons[index].Cooldown <= 0.001f) return index;
            }
            return -1;
        }

        private void Fire(WeaponState weapon, EnemyAgent target)
        {
            SurvivalWeaponProfile profile = SurvivalWeaponCatalog.Get(weapon.Id);
            Vector3 origin = _player.transform.position + Vector3.up * PlayerShotOriginHeight;
            Vector3 forward = target.transform.position - origin;
            forward.y = 0f;
            if (forward.sqrMagnitude < 0.001f) forward = _player.transform.forward;
            forward.Normalize();

            float baseDamage = weapon.Id == SurvivalWeaponKind.OrbitBlades
                ? 1f + (weapon.Level >= 3 ? 1f : 0f) + (weapon.Evolved ? 1f : 0f)
                : 1f + Mathf.Floor((weapon.Level - 1) / 3f) + (weapon.Evolved ? 1f : 0f);
            float damage = Mathf.Max(1f, Mathf.Round(baseDamage * _damageMultiplier * _overdriveDamageMultiplier));
            bool critical = UnityEngine.Random.value < _criticalChance;
            if (critical) damage = Mathf.Max(1f, Mathf.Round(damage * _criticalDamageMultiplier));

            if (weapon.Id == SurvivalWeaponKind.ForkliftHorn)
            {
                float radius = weapon.Evolved ? 10f : 7f;
                ApplyAreaDamage(origin, radius, damage, 1.1f, 0f, 1f, 3.4f, null, weapon.Id);
                SpawnPulse(origin, profile.Color, radius);
                _hud?.SetStatus("KLAKSON SZTAPLARKI • FALA UDERZENIOWA");
                return;
            }

            if (weapon.Id == SurvivalWeaponKind.OrbitBlades)
            {
                int count = weapon.Evolved ? 5 : weapon.Level >= 4 ? 4 : 3;
                for (int i = 0; i < count; i++)
                {
                    SpawnShot(PrimitiveType.Cylinder, origin, Vector3.zero, 0f,
                        weapon.Evolved ? 5.8f : 4.8f, damage, 40, 0f, 0f, 1f, 0f,
                        false, false, false, true, 1.55f, (i / (float)count) * Mathf.PI * 2f,
                        weapon.Evolved ? 1.9f : 1.55f, weapon.Evolved ? 3f : 2.55f, profile.Color, weapon.Id);
                }
                return;
            }

            if (weapon.Id == SurvivalWeaponKind.CalacattaShards)
            {
                float[] spread = weapon.Evolved
                    ? new[] { -0.44f, -0.22f, 0f, 0.22f, 0.44f }
                    : new[] { -0.20f, 0f, 0.20f };
                foreach (float angle in spread)
                {
                    Vector3 direction = Quaternion.Euler(0f, angle * Mathf.Rad2Deg, 0f) * forward;
                    SpawnShot(PrimitiveType.Capsule, origin + direction * 0.85f, direction,
                        weapon.Evolved ? 15.8f : 13.4f, weapon.Evolved ? 2.6f : 2.2f,
                        damage, weapon.Evolved ? 3 : 1, 0f, 0f, 1f, 0.35f,
                        false, false, false, false, 0f, 0f, 0f, 0f, profile.Color, weapon.Id);
                }
                _hud?.SetStatus("ODŁAMKI CALACATTY • SALWA " + spread.Length);
                return;
            }

            PrimitiveType shape = PrimitiveType.Sphere;
            float speed = 10.5f;
            float life = 2.8f;
            int pierce = 0;
            float aoe = 0f;
            float slow = 0f;
            float slowMultiplier = 1f;
            float stun = 0f;
            float knockback = 0.25f;
            bool homing = false;
            bool returning = false;
            bool ricochet = false;
            bool ignites = false;

            switch (weapon.Id)
            {
                case SurvivalWeaponKind.PalletCannon:
                    shape = PrimitiveType.Cube;
                    speed = weapon.Evolved ? 11.2f : 10f;
                    aoe = weapon.Evolved ? 2.15f : weapon.Level >= 3 ? 1.45f : 1.05f;
                    pierce = weapon.Evolved ? 2 : weapon.Level >= 5 ? 1 : 0;
                    break;
                case SurvivalWeaponKind.DiamondSaw:
                    shape = PrimitiveType.Cylinder;
                    speed = weapon.Evolved ? 14.8f : 13.2f;
                    life = weapon.Evolved ? 2.8f : 2.2f;
                    pierce = 1 + (weapon.Level >= 4 ? 1 : 0) + (weapon.Evolved ? 3 : 0);
                    ricochet = weapon.Evolved;
                    knockback = 0.65f;
                    break;
                case SurvivalWeaponKind.GlueMine:
                    shape = PrimitiveType.Cylinder;
                    speed = 7.2f;
                    life = 3.4f;
                    aoe = weapon.Evolved ? 2.85f : weapon.Level >= 4 ? 2.1f : 1.65f;
                    slow = 2.0f;
                    slowMultiplier = 0.48f;
                    pierce = weapon.Evolved ? 2 : 0;
                    break;
                case SurvivalWeaponKind.KfcBomber:
                    shape = PrimitiveType.Sphere;
                    speed = 8.4f;
                    life = 3.1f;
                    aoe = weapon.Evolved ? 3.35f : weapon.Level >= 4 ? 2.65f : 2.05f;
                    ignites = weapon.Level >= 3 || weapon.Evolved;
                    pierce = weapon.Evolved ? 1 : 0;
                    break;
                case SurvivalWeaponKind.PiorunDrone:
                    shape = PrimitiveType.Sphere;
                    speed = 8.8f;
                    life = weapon.Evolved ? 4.8f : 4.2f;
                    homing = true;
                    pierce = weapon.Evolved ? 3 : 0;
                    break;
                case SurvivalWeaponKind.ForkliftBolter:
                    shape = PrimitiveType.Cylinder;
                    speed = weapon.Evolved ? 21.5f : 18.5f;
                    life = 1.75f;
                    pierce = weapon.Evolved ? 4 : weapon.Level >= 3 ? 2 : 1;
                    knockback = 0.15f;
                    break;
                case SurvivalWeaponKind.ScannerPulse:
                    shape = PrimitiveType.Cube;
                    speed = weapon.Evolved ? 16.8f : 14.8f;
                    life = 2f;
                    homing = true;
                    pierce = weapon.Evolved ? 5 : weapon.Level >= 4 ? 3 : 2;
                    break;
                case SurvivalWeaponKind.SteamBomb:
                    shape = PrimitiveType.Sphere;
                    speed = weapon.Evolved ? 8.6f : 7f;
                    life = 3.3f;
                    aoe = weapon.Evolved ? 3.8f : 2.5f;
                    slow = 2.3f;
                    slowMultiplier = 0.38f;
                    pierce = weapon.Evolved ? 1 : 0;
                    break;
                case SurvivalWeaponKind.WzBoomerang:
                    shape = PrimitiveType.Cylinder;
                    speed = weapon.Evolved ? 13.8f : 11f;
                    life = weapon.Evolved ? 4.2f : 3.2f;
                    returning = true;
                    pierce = weapon.Evolved ? 3 : 1;
                    knockback = 0.55f;
                    break;
            }

            SpawnShot(shape, origin + forward * 0.90f, forward, speed, life, damage,
                pierce, aoe, slow, slowMultiplier, stun, homing, returning, ricochet,
                false, 0f, 0f, 0f, 0f, profile.Color, weapon.Id, knockback, ignites);
            _hud?.SetStatus(critical
                ? profile.DisplayName.ToUpperInvariant() + " • TRAFIENIE KRYTYCZNE"
                : profile.DisplayName.ToUpperInvariant() + " • POZIOM " + weapon.Level + (weapon.Evolved ? " ✦" : string.Empty));
        }

        private void SpawnShot(
            PrimitiveType shape, Vector3 position, Vector3 direction, float speed, float life,
            float damage, int pierce, float aoe, float slowSeconds, float slowMultiplier,
            float stunSeconds, bool homing, bool boomerang, bool ricochet, bool orbiting,
            float orbitAngle, float orbitStartAngle, float orbitRadius, float orbitSpeed,
            Color color, SurvivalWeaponKind weaponId, float knockback = 0.25f, bool ignites = false)
        {
            GameObject root = AcquireObject(shape);
            if (root == null) return;
            root.name = SurvivalWeaponCatalog.Get(weaponId).DisplayName + " • projectile";
            root.transform.position = position;
            root.transform.rotation = direction.sqrMagnitude > 0.001f
                ? Quaternion.LookRotation(direction.normalized, Vector3.up)
                : Quaternion.identity;
            root.transform.localScale = GetProjectileScale(shape, weaponId);
            ApplyProjectileColor(root, color);
            root.SetActive(true);

            Vector3 velocity = direction.sqrMagnitude > 0.001f
                ? direction.normalized * Mathf.Max(0f, speed)
                : Vector3.zero;
            float maxRange = Mathf.Max(1f, speed * life * 0.48f);
            _activeShots.Add(new ShotState
            {
                Root = root,
                Shape = shape,
                Velocity = velocity,
                PreviousPosition = position,
                Damage = damage,
                RemainingLife = Mathf.Max(0.1f, life),
                MaximumLife = Mathf.Max(0.1f, life),
                Speed = Mathf.Max(0.1f, speed),
                HitRadius = weaponId == SurvivalWeaponKind.ForkliftBolter ? 0.72f : 0.95f,
                AoeRadius = aoe,
                SlowSeconds = slowSeconds,
                SlowMultiplier = slowMultiplier,
                StunSeconds = stunSeconds,
                Knockback = knockback,
                PierceRemaining = Mathf.Max(0, pierce),
                RicochetsRemaining = ricochet ? 1 : 0,
                Homing = homing,
                Boomerang = boomerang,
                Orbiting = orbiting,
                OrbitAngle = orbitStartAngle,
                OrbitRadius = orbitRadius,
                OrbitSpeed = orbitSpeed,
                SpinSpeed = weaponId == SurvivalWeaponKind.DiamondSaw ? 12f : 7f,
                Ignites = ignites,
                WeaponId = weaponId
            });
        }

        private void UpdateActiveShots(float deltaTime)
        {
            for (int i = _activeShots.Count - 1; i >= 0; i--)
            {
                ShotState shot = _activeShots[i];
                if (shot.Root == null || !shot.Root.activeSelf)
                {
                    _activeShots.RemoveAt(i);
                    continue;
                }

                shot.RemainingLife -= deltaTime;
                if (shot.RemainingLife <= 0f)
                {
                    ReleaseShotAt(i);
                    continue;
                }

                Vector3 position = shot.Root.transform.position;
                if (shot.IsPulse)
                {
                    shot.PulseAge += deltaTime;
                    float pulseProgress = Mathf.Clamp01(shot.PulseAge / Mathf.Max(0.01f, shot.PulseDuration));
                    shot.Root.transform.localScale = Vector3.Lerp(Vector3.one * 0.12f, shot.PulseBaseScale, pulseProgress);
                    continue;
                }

                if (shot.Boomerang && !shot.Returning && shot.RemainingLife < shot.MaximumLife * 0.52f)
                {
                    shot.Returning = true;
                    shot.HitTargets.Clear();
                }

                if (shot.Returning)
                {
                    Vector3 toPlayer = _player.transform.position + Vector3.up * 0.8f - position;
                    if (toPlayer.sqrMagnitude < 0.85f * 0.85f)
                    {
                        ReleaseShotAt(i);
                        continue;
                    }
                    shot.Velocity = Vector3.Lerp(shot.Velocity, toPlayer.normalized * 17.5f, Mathf.Clamp01(deltaTime * 9f));
                }
                else if (shot.Homing)
                {
                    EnemyAgent target = FindNearestEnemy(position, 13f);
                    if (target != null)
                    {
                        Vector3 toTarget = target.transform.position + Vector3.up * 0.65f - position;
                        if (toTarget.sqrMagnitude > 0.001f)
                            shot.Velocity = Vector3.Lerp(shot.Velocity, toTarget.normalized * shot.Speed, Mathf.Clamp01(deltaTime * 8.5f));
                    }
                }

                shot.PreviousPosition = position;
                if (shot.Orbiting)
                {
                    shot.OrbitAngle += shot.OrbitSpeed * deltaTime;
                    Vector3 playerPosition = _player.transform.position;
                    position = playerPosition + new Vector3(Mathf.Cos(shot.OrbitAngle) * shot.OrbitRadius,
                        0.78f + Mathf.Sin(shot.OrbitAngle * 2f) * 0.08f,
                        Mathf.Sin(shot.OrbitAngle) * shot.OrbitRadius);
                    shot.Root.transform.position = position;
                    shot.Root.transform.Rotate(Vector3.up, shot.SpinSpeed * deltaTime * 45f, Space.Self);
                }
                else
                {
                    position += shot.Velocity * deltaTime;
                    shot.Root.transform.position = position;
                    if (shot.SpinSpeed > 0f)
                        shot.Root.transform.Rotate(Vector3.up, shot.SpinSpeed * deltaTime * 45f, Space.Self);
                }

                if (shot.RicochetsRemaining > 0 && Mathf.Abs(position.z) > 17.5f)
                {
                    shot.Velocity.z *= -1f;
                    position.z = Mathf.Sign(position.z) * 17.4f;
                    shot.Root.transform.position = position;
                    shot.RicochetsRemaining--;
                }

                if (shot.Returning || shot.Orbiting)
                {
                    CheckShotCollisions(shot, position, position);
                    continue;
                }

                CheckShotCollisions(shot, shot.PreviousPosition, position);
            }
        }

        private void CheckShotCollisions(ShotState shot, Vector3 from, Vector3 to)
        {
            Vector3 segment = to - from;
            float segmentLengthSquared = segment.sqrMagnitude;
            for (int i = 0; i < _enemyCache.Length; i++)
            {
                EnemyAgent enemy = _enemyCache[i];
                if (enemy == null || enemy.IsDefeated || shot.HitTargets.Contains(enemy.GetInstanceID())) continue;
                Vector3 enemyPosition = enemy.transform.position + Vector3.up * 0.75f;
                float projection = segmentLengthSquared > 0.0001f
                    ? Mathf.Clamp01(Vector3.Dot(enemyPosition - from, segment) / segmentLengthSquared)
                    : 0f;
                Vector3 closest = from + segment * projection;
                if ((enemyPosition - closest).sqrMagnitude > shot.HitRadius * shot.HitRadius) continue;

                if (shot.AoeRadius > 0.05f)
                {
                    ApplyAreaDamage(enemy.transform.position, shot.AoeRadius, shot.Damage,
                        shot.StunSeconds, shot.SlowSeconds, shot.SlowMultiplier, shot.Knockback, null, shot.WeaponId);
                    if (shot.Ignites && !enemy.IsDefeated)
                        enemy.ApplyWeaponHit(0.35f, 0f, 1.4f, 0.78f, Vector3.zero, shot.WeaponId);
                }
                else
                    ApplyHit(enemy, shot);

                shot.HitTargets.Add(enemy.GetInstanceID());
                if (shot.PierceRemaining > 0)
                {
                    shot.PierceRemaining--;
                    if (shot.Boomerang) shot.PierceRemaining = Mathf.Max(shot.PierceRemaining, 0);
                    continue;
                }

                if (shot.Boomerang && !shot.Returning)
                {
                    shot.Returning = true;
                    shot.HitTargets.Clear();
                    return;
                }

                shot.RemainingLife = 0f;
                DeactivateShot(shot);
                return;
            }
        }

        private void ApplyHit(EnemyAgent enemy, ShotState shot)
        {
            if (enemy == null || enemy.IsDefeated) return;
            Vector3 direction = shot.Velocity.sqrMagnitude > 0.001f ? shot.Velocity.normalized : transform.forward;
            enemy.ApplyWeaponHit(shot.Damage, shot.StunSeconds, shot.SlowSeconds,
                shot.SlowMultiplier, direction * shot.Knockback, shot.WeaponId);
            if (shot.Ignites && !enemy.IsDefeated)
                enemy.ApplyWeaponHit(0.35f, 0f, 1.4f, 0.78f, Vector3.zero, shot.WeaponId);
            if (shot.AoeRadius > 0.05f)
                ApplyAreaDamage(enemy.transform.position, shot.AoeRadius, shot.Damage,
                    shot.StunSeconds, shot.SlowSeconds, shot.SlowMultiplier, shot.Knockback, enemy, shot.WeaponId);
        }

        private void ApplyAreaDamage(Vector3 center, float radius, float damage, float stun,
            float slow, float slowMultiplier, float knockback, EnemyAgent excluded = null,
            SurvivalWeaponKind? weaponSource = null)
        {
            float radiusSquared = radius * radius;
            foreach (EnemyAgent enemy in _enemyCache)
            {
                if (enemy == null || enemy.IsDefeated || enemy == excluded) continue;
                Vector3 offset = enemy.transform.position - center;
                offset.y = 0f;
                if (offset.sqrMagnitude > radiusSquared) continue;
                Vector3 direction = offset.sqrMagnitude > 0.001f ? offset.normalized : transform.forward;
                if (weaponSource.HasValue)
                    enemy.ApplyWeaponHit(damage, stun, slow, slowMultiplier, direction * knockback, weaponSource.Value);
                else
                    enemy.ApplyCombatHit(damage, stun, slow, slowMultiplier, direction * knockback);
            }
        }

        private EnemyAgent FindNearestEnemy(Vector3 from, float range)
        {
            EnemyAgent nearest = null;
            float best = range * range;
            foreach (EnemyAgent enemy in _enemyCache)
            {
                if (enemy == null || enemy.IsDefeated) continue;
                Vector3 offset = enemy.transform.position - from;
                float sqr = offset.sqrMagnitude;
                if (sqr >= best) continue;
                best = sqr;
                nearest = enemy;
            }
            return nearest;
        }

        private GameObject AcquireObject(PrimitiveType shape)
        {
            if (!_pool.TryGetValue(shape, out List<GameObject> items))
            {
                items = new List<GameObject>();
                _pool.Add(shape, items);
            }

            for (int i = 0; i < items.Count; i++)
                if (items[i] != null && !items[i].activeSelf) return items[i];

            if (items.Count >= PoolPerShapeLimit) return null;
            GameObject created = GameObject.CreatePrimitive(shape);
            created.name = "Survival pooled " + shape;
            created.transform.SetParent(transform, false);
            Collider collider = created.GetComponent<Collider>();
            if (collider != null) collider.enabled = false;
            Renderer renderer = created.GetComponent<Renderer>();
            if (renderer != null)
            {
                if (_sharedMaterial == null)
                {
                    Shader shader = Shader.Find("Universal Render Pipeline/Lit");
                    if (shader == null) shader = Shader.Find("Standard");
                    _sharedMaterial = new Material(shader) { enableInstancing = true };
                    if (_sharedMaterial.HasProperty(EmissionColorId)) _sharedMaterial.EnableKeyword("_EMISSION");
                }
                renderer.sharedMaterial = _sharedMaterial;
            }
            created.SetActive(false);
            items.Add(created);
            return created;
        }

        private void ApplyProjectileColor(GameObject root, Color color)
        {
            Renderer renderer = root.GetComponent<Renderer>();
            if (renderer == null) return;
            renderer.GetPropertyBlock(_propertyBlock);
            _propertyBlock.SetColor(BaseColorId, color);
            _propertyBlock.SetColor(ColorId, color);
            _propertyBlock.SetColor(EmissionColorId, color * 1.2f);
            renderer.SetPropertyBlock(_propertyBlock);
        }

        private static Vector3 GetProjectileScale(PrimitiveType shape, SurvivalWeaponKind id)
        {
            switch (id)
            {
                case SurvivalWeaponKind.PalletCannon: return new Vector3(0.42f, 0.22f, 0.28f);
                case SurvivalWeaponKind.DiamondSaw: return new Vector3(0.52f, 0.12f, 0.52f);
                case SurvivalWeaponKind.GlueMine: return Vector3.one * 0.48f;
                case SurvivalWeaponKind.KfcBomber: return Vector3.one * 0.46f;
                case SurvivalWeaponKind.PiorunDrone: return Vector3.one * 0.34f;
                case SurvivalWeaponKind.ForkliftBolter: return new Vector3(0.11f, 0.11f, 0.44f);
                case SurvivalWeaponKind.ScannerPulse: return new Vector3(0.18f, 0.16f, 0.62f);
                case SurvivalWeaponKind.OrbitBlades: return new Vector3(0.36f, 0.13f, 0.36f);
                case SurvivalWeaponKind.CalacattaShards: return new Vector3(0.30f, 0.48f, 0.22f);
                case SurvivalWeaponKind.SteamBomb: return Vector3.one * 0.54f;
                case SurvivalWeaponKind.WzBoomerang: return new Vector3(0.48f, 0.14f, 0.48f);
                default: return Vector3.one * 0.38f;
            }
        }

        private void SpawnPulse(Vector3 position, Color color, float radius)
        {
            GameObject pulse = AcquireObject(PrimitiveType.Sphere);
            if (pulse == null) return;
            pulse.transform.position = position;
            pulse.transform.localScale = Vector3.one * 0.12f;
            ApplyProjectileColor(pulse, color);
            pulse.SetActive(true);
            _activeShots.Add(new ShotState
            {
                Root = pulse,
                Shape = PrimitiveType.Sphere,
                IsPulse = true,
                PulseAge = 0f,
                PulseDuration = 0.26f,
                PulseBaseScale = Vector3.one * radius * 2f,
                RemainingLife = 0.26f,
                MaximumLife = 0.26f,
                Damage = 0f
            });
        }

        private void ReleaseShotAt(int index)
        {
            DeactivateShot(_activeShots[index]);
            _activeShots.RemoveAt(index);
        }

        private static void DeactivateShot(ShotState shot)
        {
            if (shot == null || shot.Root == null) return;
            shot.Root.SetActive(false);
        }

        private void UpdateHudSummary()
        {
            _hud?.SetWeaponsSummary(GetWeaponSummary());
        }

        private void OnDestroy()
        {
            for (int i = 0; i < _activeShots.Count; i++)
                if (_activeShots[i].Root != null) _activeShots[i].Root.SetActive(false);
            _activeShots.Clear();
            _pool.Clear();
        }
    }
}
