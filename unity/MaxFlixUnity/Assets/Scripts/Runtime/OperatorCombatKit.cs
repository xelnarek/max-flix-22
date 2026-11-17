using System.Collections.Generic;
using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    /// <summary>
    /// Operator-specific combat rules for the Unity migration slice.
    /// Legacy IDs and cooldowns stay in OperatorCatalog; this class supplies
    /// distinct attacks, passives and special abilities instead of one generic shot.
    /// </summary>
    public sealed class OperatorCombatKit : MonoBehaviour
    {
        private enum SupportStyle { Tank, Capybara }

        private sealed class SupportUnit
        {
            public GameObject Root;
            public SupportStyle Style;
            public int Index;
            public float ExpiresAt;
            public float NextAttackAt;
        }

        private readonly List<SupportUnit> _supportUnits = new List<SupportUnit>();
        private readonly MaterialPropertyBlock _propertyBlock = new MaterialPropertyBlock();
        private static readonly Dictionary<int, Material> SupportMaterials = new Dictionary<int, Material>();
        private EnemyAgent[] _enemyCache = new EnemyAgent[0];
        private static readonly int BaseColorId = Shader.PropertyToID("_BaseColor");
        private static readonly int ColorId = Shader.PropertyToID("_Color");
        private static readonly int EmissionColorId = Shader.PropertyToID("_EmissionColor");

        private PlayerController _player;
        private HudController _hud;
        private OperatorProfile _profile;
        private int _primaryCount;
        private int _mateuszHitCount;
        private float _abilityCooldownRemaining;
        private float _abilityCooldownDuration;
        private float _sprintRemaining;
        private float _invulnerabilityRemaining;
        private float _shieldRemaining;
        private float _ramRemaining;
        private float _ramDamageCooldown;
        private GameObject _grzesiekArmRoot;
        private float _grzesiekArmRemaining;
        private bool _grzesiekArmImpactDone;
        private Transform _grzesiekElbowPivot;
        private Transform _grzesiekFistPivot;
        private Transform _grzesiekBicep;
        private GameObject _contractEffectRoot;
        private readonly List<Transform> _contractFragments = new List<Transform>(6);
        private readonly List<Vector3> _contractFragmentDirections = new List<Vector3>(6);
        private Transform _contractLeft;
        private Transform _contractRight;
        private float _contractEffectRemaining;

        public float MovementMultiplier { get { return _sprintRemaining > 0f ? 1.28f : (_ramRemaining > 0f ? 1.18f : 1f); } }
        public bool IsInvulnerable { get { return _invulnerabilityRemaining > 0f; } }
        public float DamageTakenMultiplier { get { return _profile == null ? 1f : _profile.DamageTakenMultiplier * (_shieldRemaining > 0f ? 0.62f : 1f); } }
        public float AbilityCooldownRemaining { get { return _abilityCooldownRemaining; } }

        public void Initialize(PlayerController player, HudController hud, OperatorProfile profile)
        {
            _player = player;
            _hud = hud;
            _profile = profile;
            _abilityCooldownRemaining = 0f;
            _abilityCooldownDuration = 0f;
            UpdateAbilityHud();
        }

        public void Tick(float deltaTime)
        {
            if (_profile == null || _player == null || _player.IsDefeated) return;

            _abilityCooldownRemaining = Mathf.Max(0f, _abilityCooldownRemaining - deltaTime);
            _enemyCache = EnemyAgent.GetCachedAgents();
            _sprintRemaining = Mathf.Max(0f, _sprintRemaining - deltaTime);
            _invulnerabilityRemaining = Mathf.Max(0f, _invulnerabilityRemaining - deltaTime);
            _shieldRemaining = Mathf.Max(0f, _shieldRemaining - deltaTime);
            _ramRemaining = Mathf.Max(0f, _ramRemaining - deltaTime);
            _ramDamageCooldown = Mathf.Max(0f, _ramDamageCooldown - deltaTime);
            TickGrzesiekArm(deltaTime);
            TickContractEffect(deltaTime);

            if (_ramRemaining > 0f && _ramDamageCooldown <= 0f)
            {
                DamageNearbyEnemies(1.35f, 1.05f, 1.7f, 1.4f);
                _ramDamageCooldown = 0.42f;
            }

            TickSupportUnits();
            UpdateAbilityHud();
        }

        public void FirePrimaryAttack()
        {
            if (_profile == null || _player == null) return;
            _primaryCount++;
            Vector3 origin = transform.position + Vector3.up * 1.0f + transform.forward * 0.72f;

            switch (_profile.Id)
            {
                case OperatorId.Marcin:
                {
                    bool auditSeal = _primaryCount % 3 == 0;
                    SpawnProjectile(origin, transform.forward, auditSeal ? PrimitiveType.Sphere : PrimitiveType.Cube,
                        _profile.SecondaryColor, CombatBalanceCatalog.ScaleCharacterBasicAttackDamage(1f, _profile.BasicAttackDamageMultiplier) * (auditSeal ? 2.1f : 1f),
                        17f, auditSeal ? 1 : 0, 0.34f, 0f, 1f, 0f, false, 2.8f);
                    _hud?.SetStatus(auditSeal ? "PIECZĘĆ AUDYTU • WZMOCNIONY ATAK" : "ZAKLĘCIE ERP • CEL OZNACZONY");
                    break;
                }
                case OperatorId.Grzesiek:
                {
                    bool heavyThrow = _primaryCount % 3 == 0;
                    SpawnProjectile(origin, transform.forward, PrimitiveType.Cylinder,
                        _profile.SecondaryColor, CombatBalanceCatalog.ScaleCharacterBasicAttackDamage(1f, _profile.BasicAttackDamageMultiplier) * (heavyThrow ? 1.8f : 1f),
                        14f, heavyThrow ? 4 : 0, 0f, 0f, 1f, heavyThrow ? 4.2f : 1.5f, false, 3.0f);
                    _hud?.SetStatus(heavyThrow ? "RZUT SIŁACZA • PRZEBICIE" : "HANTLA 44 CM • RZUT");
                    break;
                }
                case OperatorId.Dawid:
                {
                    bool stretchBurst = _primaryCount % 3 == 0;
                    float damage = CombatBalanceCatalog.ScaleCharacterBasicAttackDamage(1f, _profile.BasicAttackDamageMultiplier)
                        * (stretchBurst ? 1.15f : 1f);
                    if (stretchBurst)
                    {
                        for (int i = -1; i <= 1; i++)
                        {
                            Quaternion spread = Quaternion.Euler(0f, i * 12f, 0f);
                            SpawnProjectile(origin, spread * transform.forward, PrimitiveType.Capsule,
                                _profile.SecondaryColor, damage, 14.5f, 0, 0.08f,
                                1.55f, 0.48f, 0.25f, false, 3.0f);
                        }
                    }
                    else
                    {
                        SpawnProjectile(origin, transform.forward, PrimitiveType.Capsule,
                            _profile.SecondaryColor, damage, 14.5f, 0, 0f,
                            1.1f, 0.58f, 0.15f, false, 3.0f);
                    }
                    _hud?.SetStatus(stretchBurst ? "STRETCH • 3 PASMA ROZRZUTU" : "FOLIA STRETCH • CEL SPOWOLNIONY");
                    break;
                }
                case OperatorId.Mateusz:
                {
                    SpawnProjectile(origin, transform.forward, PrimitiveType.Sphere,
                        _profile.SecondaryColor, CombatBalanceCatalog.ScaleCharacterBasicAttackDamage(1f, _profile.BasicAttackDamageMultiplier),
                        20f, 0, 0.22f, 1.1f, 0.58f, 0f, false, 1.4f, true);
                    _hud?.SetStatus("IMPULS PARALIZATORA • ELEKTRYZACJA");
                    break;
                }
                case OperatorId.Piotr:
                {
                    SpawnProjectile(origin, transform.forward, PrimitiveType.Cube,
                        _profile.SecondaryColor, CombatBalanceCatalog.ScaleCharacterBasicAttackDamage(1f, _profile.BasicAttackDamageMultiplier),
                        15f, 5, 0f, 0f, 1f, 0.7f, true, 6.5f);
                    _hud?.SetStatus("GRZECHOTKA B4 • RZUT I POWRÓT");
                    break;
                }
            }
        }

        public void OnPrimaryHit()
        {
            if (_profile == null || _profile.Id != OperatorId.Mateusz) return;
            _mateuszHitCount++;
            if (_mateuszHitCount % 9 != 0) return;

            _sprintRemaining = 3.2f;
            _invulnerabilityRemaining = 1.25f;
            _hud?.SetStatus("SPEEDRUN • SPRINT + NIETYKALNOŚĆ");
        }

        public bool TryActivateAbility(GameMode mode)
        {
            if (_profile == null || _player == null || _player.IsDefeated || _abilityCooldownRemaining > 0f)
                return false;

            _abilityCooldownDuration = CombatBalanceCatalog.GetAbilityCooldown(_profile.AbilityCooldownSeconds, mode);
            _abilityCooldownRemaining = _abilityCooldownDuration;
            switch (_profile.Id)
            {
                case OperatorId.Marcin:
                    SpawnSupport(SupportStyle.Tank, 0, mode == GameMode.Survival ? 6f : 8f, _profile.SecondaryColor);
                    _hud?.SetStatus("KONWÓJ WZ-404 • CZOŁG OSŁONOWY AKTYWNY");
                    break;

                case OperatorId.Grzesiek:
                    BeginGrzesiekArm();
                    _ramRemaining = 6f;
                    _hud?.SetStatus("44 CM ZAGŁADY • PIĘŚĆ + 5 RAKIET");
                    break;

                case OperatorId.Dawid:
                    for (int i = -2; i <= 2; i++)
                    {
                        Quaternion spread = Quaternion.Euler(0f, i * 13f, 0f);
                        SpawnProjectile(transform.position + Vector3.up * 1.05f + transform.forward * 0.55f,
                            spread * transform.forward, PrimitiveType.Cube, _profile.SecondaryColor,
                            1.45f, 12f, 2, 0f, 0.65f, 0.68f, 1.1f, false, 3.2f, false, 2);
                    }
                    _shieldRemaining = 3.5f;
                    _player.RestoreHealth(1f);
                    _hud?.SetStatus("SALWA 5 PŁYT CALACATTA • KASK + KUBEŁEK MOCY");
                    break;

                case OperatorId.Mateusz:
                    EnemyAgent.TriggerFactionBrawl(mode == GameMode.Survival ? 7.5f : 9f);
                    BeginContractRipEffect();
                    _hud?.SetStatus("MAM WYJEBANE • UMOWA NA 9 MIESIĘCY ROZDARTA");
                    break;

                case OperatorId.Piotr:
                    DamageNearbyEnemies(7.2f, 2.6f, 0.85f, 6f);
                    for (int i = 0; i < 3; i++)
                        SpawnSupport(SupportStyle.Capybara, i, 8.5f, _profile.SecondaryColor);
                    _hud?.SetStatus("RYTUAŁ MAFIKAPIBAR • OCHRONA RODZINY B4");
                    break;
            }

            UpdateAbilityHud();
            return true;
        }

        private void SpawnProjectile(
            Vector3 origin, Vector3 direction, PrimitiveType shape, Color color,
            float damage, float speed, int pierce, float stun, float slowDuration,
            float slowMultiplier, float knockback, bool returnToOwner, float range,
            bool countsForMateuszPassive = false, int ricochets = 0)
        {
            CombatProjectile.Spawn(
                shape, transform, origin, direction, color, damage, 3.2f, speed,
                pierce, stun, slowDuration, slowMultiplier, knockback,
                returnToOwner, range, countsForMateuszPassive, ricochets);
        }

        private void DamageNearbyEnemies(float radius, float damage, float stun, float knockback)
        {
            Vector3 center = transform.position;
            foreach (EnemyAgent enemy in _enemyCache)
            {
                if (enemy == null || Vector3.Distance(center, enemy.transform.position) > radius) continue;
                Vector3 push = enemy.transform.position - center;
                push.y = 0f;
                if (push.sqrMagnitude < 0.01f) push = transform.forward;
                enemy.ApplyCombatHit(damage, stun, 0f, 1f, push.normalized * knockback);
            }
        }

        private void BeginGrzesiekArm()
        {
            if (_grzesiekArmRoot != null) Destroy(_grzesiekArmRoot);
            _grzesiekArmRoot = new GameObject("Grzesiek 44cm articulated muscular fist");
            Transform parent = _player != null ? _player.transform.parent : null;
            if (parent != null) _grzesiekArmRoot.transform.SetParent(parent, true);
            _grzesiekArmRemaining = 1.05f;
            _grzesiekArmImpactDone = false;

            Transform root = _grzesiekArmRoot.transform;
            Color skin = new Color(0.78f, 0.48f, 0.33f);
            Color muscle = new Color(0.91f, 0.64f, 0.46f);
            Color highlight = new Color(0.98f, 0.75f, 0.58f);
            Color shadow = new Color(0.48f, 0.23f, 0.18f);
            Color vein = new Color(0.67f, 0.35f, 0.28f);
            Color band = new Color(0.08f, 0.32f, 0.18f);
            Color metal = new Color(0.74f, 0.82f, 0.89f);
            Color darkMetal = new Color(0.20f, 0.27f, 0.35f);

            CreatePart(root, PrimitiveType.Sphere, "Massive shoulder", new Vector3(-0.36f, 0.68f, -0.04f),
                new Vector3(0.98f, 0.90f, 0.98f), skin);
            CreatePart(root, PrimitiveType.Capsule, "Upper arm", new Vector3(-0.10f, 0.52f, 0.43f),
                new Vector3(0.68f, 1.18f, 0.68f), muscle);
            _grzesiekBicep = new GameObject("Biceps peak").transform;
            _grzesiekBicep.SetParent(root, false);
            _grzesiekBicep.localPosition = new Vector3(-0.12f, 0.79f, 0.36f);
            CreatePart(_grzesiekBicep, PrimitiveType.Sphere, "Biceps muscle", Vector3.zero,
                new Vector3(0.84f, 0.78f, 1.12f), muscle);
            CreatePart(_grzesiekBicep, PrimitiveType.Sphere, "Biceps highlight", new Vector3(-0.02f, 0.13f, 0.04f),
                new Vector3(0.46f, 0.22f, 0.78f), highlight);
            CreatePart(root, PrimitiveType.Sphere, "Triceps contour", new Vector3(-0.11f, 0.43f, 0.48f),
                new Vector3(0.48f, 0.30f, 0.72f), shadow);

            GameObject elbowObject = new GameObject("44cm elbow pivot");
            _grzesiekElbowPivot = elbowObject.transform;
            _grzesiekElbowPivot.SetParent(root, false);
            _grzesiekElbowPivot.localPosition = new Vector3(0.02f, 0.24f, 0.84f);
            Transform elbow = _grzesiekElbowPivot;
            GameObject forearmObject = new GameObject("Thick forearm");
            Transform forearm = forearmObject.transform;
            forearm.SetParent(elbow, false);
            forearm.localPosition = new Vector3(0f, 0.02f, 0.33f);
            forearm.localRotation = Quaternion.Euler(90f, 0f, 0f);
            CreatePart(forearm, PrimitiveType.Capsule, "Forearm body", Vector3.zero,
                new Vector3(0.68f, 1.08f, 0.68f), skin);
            CreatePart(elbow, PrimitiveType.Sphere, "Forearm muscle", new Vector3(0f, 0.13f, 0.34f),
                new Vector3(0.64f, 0.58f, 0.98f), muscle);
            CreatePart(elbow, PrimitiveType.Sphere, "Forearm highlight", new Vector3(-0.12f, 0.22f, 0.36f),
                new Vector3(0.22f, 0.16f, 0.70f), highlight);

            Transform veinA = new GameObject("Bicep vein A").transform;
            veinA.SetParent(root, false);
            veinA.localPosition = new Vector3(-0.34f, 0.73f, 0.47f);
            veinA.localRotation = Quaternion.Euler(0f, 0f, -18f);
            CreatePart(veinA, PrimitiveType.Capsule, "Muscle striation", Vector3.zero,
                new Vector3(0.055f, 0.34f, 0.055f), vein);
            Transform veinB = new GameObject("Bicep vein B").transform;
            veinB.SetParent(root, false);
            veinB.localPosition = new Vector3(0.05f, 0.68f, 0.44f);
            veinB.localRotation = Quaternion.Euler(0f, 0f, 14f);
            CreatePart(veinB, PrimitiveType.Capsule, "Muscle striation", Vector3.zero,
                new Vector3(0.045f, 0.27f, 0.045f), vein);

            GameObject wrist = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            wrist.name = "Green steel wrist guard";
            wrist.transform.SetParent(elbow, false);
            wrist.transform.localPosition = new Vector3(0f, -0.005f, 0.72f);
            wrist.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            wrist.transform.localScale = new Vector3(0.62f, 0.08f, 0.62f);
            Collider wristCollider = wrist.GetComponent<Collider>();
            if (wristCollider != null) Destroy(wristCollider);
            Renderer wristRenderer = wrist.GetComponent<Renderer>();
            if (wristRenderer != null) wristRenderer.sharedMaterial = GetSupportMaterial(band);
            CreatePart(elbow, PrimitiveType.Cylinder, "Steel wrist rim", new Vector3(0f, -0.005f, 0.80f),
                new Vector3(0.58f, 0.035f, 0.58f), metal);

            GameObject fistObject = new GameObject("44cm clenched fist pivot");
            _grzesiekFistPivot = fistObject.transform;
            _grzesiekFistPivot.SetParent(elbow, false);
            _grzesiekFistPivot.localPosition = new Vector3(0f, -0.045f, 0.98f);
            Transform fist = _grzesiekFistPivot;
            CreatePart(fist, PrimitiveType.Sphere, "Closed fist palm", Vector3.zero,
                new Vector3(0.84f, 0.73f, 0.86f), skin);
            for (int knuckle = 0; knuckle < 4; knuckle++)
            {
                float x = -0.25f + knuckle * 0.17f;
                CreatePart(fist, PrimitiveType.Capsule, "Curled finger " + (knuckle + 1),
                    new Vector3(x, 0.035f, 0.12f), new Vector3(0.17f, 0.28f, 0.17f), muscle);
                CreatePart(fist, PrimitiveType.Sphere, "Raised knuckle " + (knuckle + 1),
                    new Vector3(x, 0.17f, 0.23f), new Vector3(0.22f, 0.20f, 0.18f), highlight);
                CreatePart(fist, PrimitiveType.Cube, "Knuckle crease " + (knuckle + 1),
                    new Vector3(x, 0.18f, 0.325f), new Vector3(0.08f, 0.018f, 0.012f), shadow);
            }
            CreatePart(fist, PrimitiveType.Capsule, "Thumb locked over fist",
                new Vector3(0.32f, -0.015f, 0.04f), new Vector3(0.22f, 0.48f, 0.22f), skin);
            CreatePart(fist, PrimitiveType.Cube, "44cm steel knuckle plate",
                new Vector3(0f, 0.19f, 0.32f), new Vector3(0.74f, 0.12f, 0.10f), metal);
            for (int rivet = 0; rivet < 4; rivet++)
                CreatePart(fist, PrimitiveType.Sphere, "Green knuckle rivet " + (rivet + 1),
                    new Vector3(-0.22f + rivet * 0.145f, 0.20f, 0.385f),
                    Vector3.one * 0.055f, band);
            CreatePart(fist, PrimitiveType.Cube, "Fist underside brace",
                new Vector3(0f, -0.20f, 0.06f), new Vector3(0.20f, 0.10f, 0.28f), darkMetal);
        }

        private void TickGrzesiekArm(float deltaTime)
        {
            if (_grzesiekArmRemaining <= 0f) return;
            _grzesiekArmRemaining = Mathf.Max(0f, _grzesiekArmRemaining - deltaTime);
            if (_grzesiekArmRoot == null) return;

            float progress = 1f - _grzesiekArmRemaining / 1.05f;
            float anticipation = 1f - Mathf.SmoothStep(0f, 1f, Mathf.Clamp01(progress / 0.34f));
            float strike = Mathf.SmoothStep(0f, 1f, Mathf.Clamp01((progress - 0.27f) / 0.22f));
            float followThrough = Mathf.SmoothStep(0f, 1f, Mathf.Clamp01((progress - 0.47f) / 0.18f));
            float recover = Mathf.SmoothStep(0f, 1f, Mathf.Clamp01((progress - 0.76f) / 0.24f));

            Transform root = _grzesiekArmRoot.transform;
            root.position = transform.position + transform.forward * (0.14f + strike * 0.42f) + Vector3.up * 0.44f;
            root.rotation = transform.rotation * Quaternion.Euler(-10f - anticipation * 8f + strike * 14f - followThrough * 5f, 0f, 0f);
            root.localScale = Vector3.one * (1.36f + Mathf.Sin(progress * Mathf.PI) * 0.08f - recover * 0.18f);
            if (_grzesiekElbowPivot != null)
                _grzesiekElbowPivot.localRotation = Quaternion.Euler(Mathf.Lerp(-52f, 12f, strike) + Mathf.Sin(progress * Mathf.PI * 2f) * 2.5f, 0f, 0f);
            if (_grzesiekFistPivot != null)
                _grzesiekFistPivot.localRotation = Quaternion.Euler(Mathf.Lerp(18f, -24f, strike) + followThrough * 8f, 0f, 0f);
            if (_grzesiekBicep != null)
                _grzesiekBicep.localScale = new Vector3(1f, 1f + anticipation * 0.10f + strike * 0.08f, 1f);

            if (!_grzesiekArmImpactDone && progress >= 0.39f)
            {
                _grzesiekArmImpactDone = true;
                Vector3 hitPoint = transform.position + transform.forward * 1.9f + Vector3.up * 0.18f;
                DamageNearbyEnemies(4.6f, 1.55f, 0.42f, 4.8f);
                OperatorImpactBurst.Spawn(_player != null ? _player.transform.parent : transform.parent,
                    hitPoint, _profile.SecondaryColor, 1.65f);
                SpawnFiveHomingRockets();
                _hud?.SetStatus("44 CM ZAGŁADY • 5 RAKIET W LOCIE");
            }

            if (_grzesiekArmRemaining <= 0f)
            {
                Destroy(_grzesiekArmRoot);
                _grzesiekArmRoot = null;
                _grzesiekElbowPivot = null;
                _grzesiekFistPivot = null;
                _grzesiekBicep = null;
            }
        }

        private void SpawnFiveHomingRockets()
        {
            HashSet<EnemyAgent> assigned = new HashSet<EnemyAgent>();
            for (int i = 0; i < 5; i++)
            {
                EnemyAgent target = null;
                float bestDistance = 28f * 28f;
                foreach (EnemyAgent candidate in _enemyCache)
                {
                    if (candidate == null || candidate.IsDefeated || assigned.Contains(candidate)) continue;
                    float sqrDistance = (candidate.transform.position - transform.position).sqrMagnitude;
                    if (sqrDistance >= bestDistance) continue;
                    bestDistance = sqrDistance;
                    target = candidate;
                }
                if (target != null) assigned.Add(target);
                Quaternion spread = Quaternion.Euler(0f, (i - 2) * 7f, 0f);
                Vector3 direction = (spread * transform.forward + Vector3.up * 0.035f).normalized;
                Vector3 origin = transform.position + Vector3.up * 1.02f + transform.forward * 0.46f + transform.right * ((i - 2) * 0.18f);
                OperatorHomingRocket.Spawn(_player != null ? _player.transform.parent : transform.parent, origin, direction, target, _profile.SecondaryColor, 1.35f, 17.5f, 5.8f, 1.45f, 3.4f);
            }
        }

        private void BeginContractRipEffect()
        {
            if (_contractEffectRoot != null) Destroy(_contractEffectRoot);
            _contractFragments.Clear();
            _contractFragmentDirections.Clear();
            _contractEffectRoot = new GameObject("Mateusz 9 month contract rip");
            Transform parent = _player != null ? _player.transform.parent : null;
            if (parent != null) _contractEffectRoot.transform.SetParent(parent, true);
            _contractLeft = new GameObject("Contract left half").transform;
            _contractRight = new GameObject("Contract right half").transform;
            _contractLeft.SetParent(_contractEffectRoot.transform, false);
            _contractRight.SetParent(_contractEffectRoot.transform, false);

            Color paper = new Color(1f, 0.94f, 0.78f);
            Color paperShadow = new Color(0.82f, 0.74f, 0.58f);
            Color ink = new Color(0.10f, 0.14f, 0.22f);
            Color red = new Color(0.72f, 0.10f, 0.16f);
            CreatePart(_contractLeft, PrimitiveType.Cube, "Contract page left", new Vector3(-0.23f, 0f, 0f),
                new Vector3(0.46f, 0.82f, 0.035f), paper);
            CreatePart(_contractRight, PrimitiveType.Cube, "Contract page right", new Vector3(0.23f, 0f, 0f),
                new Vector3(0.46f, 0.82f, 0.035f), paper);
            CreatePart(_contractLeft, PrimitiveType.Cube, "Left page header line", new Vector3(-0.23f, 0.30f, 0.026f),
                new Vector3(0.34f, 0.025f, 0.012f), red);
            CreatePart(_contractRight, PrimitiveType.Cube, "Right page header line", new Vector3(0.23f, 0.30f, 0.026f),
                new Vector3(0.34f, 0.025f, 0.012f), red);
            for (int line = 0; line < 4; line++)
            {
                float y = 0.13f - line * 0.12f;
                CreatePart(_contractLeft, PrimitiveType.Cube, "Contract text line L" + line,
                    new Vector3(-0.23f, y, 0.027f), new Vector3(0.33f, 0.012f, 0.01f), paperShadow);
                CreatePart(_contractRight, PrimitiveType.Cube, "Contract text line R" + line,
                    new Vector3(0.23f, y, 0.027f), new Vector3(0.33f, 0.012f, 0.01f), paperShadow);
            }
            CreateContractText(_contractLeft, "UMOWA\nNA 9 MIESIĘCY", new Vector3(-0.23f, 0.02f, 0.05f), ink);
            CreateContractText(_contractRight, "ROZWIĄZANIE\nROZDARTA", new Vector3(0.23f, 0.02f, 0.05f), red);
            CreateContractText(_contractLeft, "PODPIS PRACOWNIKA", new Vector3(-0.23f, -0.31f, 0.05f), ink);
            CreateContractText(_contractRight, "EGZEMPLARZ 09", new Vector3(0.23f, -0.31f, 0.05f), ink);
            CreatePart(_contractLeft, PrimitiveType.Cylinder, "Left red cancellation seal",
                new Vector3(-0.23f, -0.12f, 0.052f), new Vector3(0.19f, 0.018f, 0.19f), red);
            CreatePart(_contractRight, PrimitiveType.Cylinder, "Right red cancellation seal",
                new Vector3(0.23f, -0.12f, 0.052f), new Vector3(0.19f, 0.018f, 0.19f), red);
            CreatePart(_contractEffectRoot.transform, PrimitiveType.Cube, "Torn centre seam",
                new Vector3(0f, 0f, 0.06f), new Vector3(0.035f, 0.88f, 0.04f), red);
            CreateContractText(_contractEffectRoot.transform, "MAM WYJEBANE",
                new Vector3(0f, 0.72f, 0.10f), new Color(0.93f, 0.48f, 0.95f));

            // Small paper fibres kick outward on the rip; they are children of the
            // temporary root so every fragment is cleaned up with the document.
            for (int i = 0; i < 6; i++)
            {
                float direction = (i - 2.5f) * 0.18f;
                GameObject fragment = GameObject.CreatePrimitive(PrimitiveType.Cube);
                fragment.name = "Contract torn paper fibre " + (i + 1);
                fragment.transform.SetParent(_contractEffectRoot.transform, false);
                fragment.transform.localPosition = new Vector3(direction * 0.05f, (i % 2 == 0 ? 0.08f : -0.08f), 0.08f);
                fragment.transform.localScale = new Vector3(0.08f, 0.018f, 0.012f);
                fragment.transform.localRotation = Quaternion.Euler(0f, 0f, (i - 2.5f) * 9f);
                Collider fragmentCollider = fragment.GetComponent<Collider>();
                if (fragmentCollider != null) Destroy(fragmentCollider);
                Renderer fragmentRenderer = fragment.GetComponent<Renderer>();
                if (fragmentRenderer != null) fragmentRenderer.sharedMaterial = GetSupportMaterial(i % 2 == 0 ? paper : paperShadow);
                _contractFragments.Add(fragment.transform);
                Vector3 away = new Vector3((i - 2.5f) * 0.24f, 0.55f + (i % 3) * 0.12f, (i % 2 == 0 ? 0.14f : -0.14f)).normalized;
                _contractFragmentDirections.Add(away);
            }

            _contractEffectRemaining = 1.48f;
            TickContractEffect(0f);
        }

        private void CreateContractText(Transform parent, string value, Vector3 localPosition, Color color)
        {
            CreateContractTextFace(parent, value, localPosition, color, false);
            CreateContractTextFace(parent, value, new Vector3(localPosition.x, localPosition.y, -localPosition.z), color, true);
        }

        private static void CreateContractTextFace(Transform parent, string value, Vector3 localPosition, Color color, bool reverse)
        {
            GameObject label = new GameObject("Contract lettering");
            label.transform.SetParent(parent, false);
            label.transform.localPosition = localPosition;
            if (reverse) label.transform.localRotation = Quaternion.Euler(0f, 180f, 0f);
            TextMesh text = label.AddComponent<TextMesh>();
            text.text = value;
            text.fontSize = 30;
            text.characterSize = 0.045f;
            text.anchor = TextAnchor.MiddleCenter;
            text.alignment = TextAlignment.Center;
            text.color = color;
            text.font = Resources.GetBuiltinResource<Font>("Arial.ttf");
        }

        private void TickContractEffect(float deltaTime)
        {
            if (_contractEffectRemaining <= 0f || _contractEffectRoot == null) return;
            _contractEffectRemaining = Mathf.Max(0f, _contractEffectRemaining - deltaTime);
            float progress = 1f - _contractEffectRemaining / 1.48f;
            float tension = 1f - Mathf.SmoothStep(0f, 1f, Mathf.Clamp01(progress / 0.20f));
            float split = Mathf.SmoothStep(0f, 1f, Mathf.Clamp01((progress - 0.10f) / 0.44f));
            float flutter = Mathf.Sin(progress * 42f) * tension * 0.025f;

            _contractEffectRoot.transform.position = transform.position + transform.forward * 1.25f
                + Vector3.up * (1.02f + Mathf.Sin(progress * Mathf.PI) * 0.18f);
            _contractEffectRoot.transform.rotation = transform.rotation;
            if (_contractLeft != null)
            {
                _contractLeft.localPosition = new Vector3(-split * 0.58f - flutter, Mathf.Sin(progress * Mathf.PI * 1.35f) * 0.15f, 0f);
                _contractLeft.localRotation = Quaternion.Euler(0f, split * 16f, -split * 34f - flutter * 40f);
            }
            if (_contractRight != null)
            {
                _contractRight.localPosition = new Vector3(split * 0.58f + flutter, Mathf.Sin(progress * Mathf.PI * 1.55f + 0.3f) * 0.13f, 0f);
                _contractRight.localRotation = Quaternion.Euler(0f, -split * 16f, split * 34f + flutter * 40f);
            }

            float fragmentProgress = Mathf.SmoothStep(0f, 1f, Mathf.Clamp01((progress - 0.18f) / 0.56f));
            for (int i = 0; i < _contractFragments.Count; i++)
            {
                Transform fragment = _contractFragments[i];
                if (fragment == null) continue;
                Vector3 direction = _contractFragmentDirections[i];
                fragment.localPosition = new Vector3(direction.x * fragmentProgress * 0.80f,
                    direction.y * fragmentProgress * 0.62f - fragmentProgress * fragmentProgress * 0.24f,
                    0.08f + direction.z * fragmentProgress);
                fragment.localRotation *= Quaternion.Euler(160f * deltaTime, (120f + i * 20f) * deltaTime, 220f * deltaTime);
                float scale = Mathf.Max(0.001f, 1f - Mathf.Clamp01((progress - 0.68f) / 0.30f));
                fragment.localScale = new Vector3(0.08f, 0.018f, 0.012f) * scale;
            }

            if (progress > 0.43f && progress < 0.50f && _contractEffectRemaining > 0f)
                OperatorImpactBurst.Spawn(_player != null ? _player.transform.parent : transform.parent,
                    transform.position + transform.forward * 1.10f + Vector3.up * 0.12f,
                    new Color(0.84f, 0.22f, 0.88f), 1.20f);

            if (_contractEffectRemaining <= 0f)
            {
                Destroy(_contractEffectRoot);
                _contractEffectRoot = null;
                _contractLeft = null;
                _contractRight = null;
                _contractFragments.Clear();
                _contractFragmentDirections.Clear();
            }
        }

        private void SpawnSupport(SupportStyle style, int index, float duration, Color color)
        {
            GameObject root = new GameObject(style == SupportStyle.Tank
                ? "WZ-404 escort" : "MafiKapibara guard");
            if (_player != null && _player.transform.parent != null)
                root.transform.SetParent(_player.transform.parent, true);
            root.transform.position = transform.position + Vector3.up * 0.45f;
            BuildSupportVisual(root.transform, style, color, index);
            _supportUnits.Add(new SupportUnit
            {
                Root = root,
                Style = style,
                Index = index,
                ExpiresAt = Time.time + duration,
                NextAttackAt = Time.time + 0.35f
            });
        }

        private void TickSupportUnits()
        {
            for (int i = _supportUnits.Count - 1; i >= 0; i--)
            {
                SupportUnit unit = _supportUnits[i];
                if (unit.Root == null || Time.time >= unit.ExpiresAt)
                {
                    if (unit.Root != null) Destroy(unit.Root);
                    _supportUnits.RemoveAt(i);
                    continue;
                }

                EnemyAgent target = FindClosestEnemy(unit.Style == SupportStyle.Tank ? 22f : 13f);
                Vector3 desired;
                if (unit.Style == SupportStyle.Tank)
                {
                    desired = transform.position - transform.forward * 2.3f + transform.right * 1.15f + Vector3.up * 0.15f;
                    unit.Root.transform.position = Vector3.Lerp(unit.Root.transform.position, desired, 1f - Mathf.Exp(-5f * Time.deltaTime));
                    if (target != null)
                    {
                        Vector3 aim = target.transform.position - unit.Root.transform.position;
                        aim.y = 0f;
                        if (aim.sqrMagnitude > 0.05f) unit.Root.transform.rotation = Quaternion.LookRotation(aim.normalized);
                        if (Time.time >= unit.NextAttackAt)
                        {
                            Vector3 muzzle = unit.Root.transform.position + Vector3.up * 0.48f + unit.Root.transform.forward * 0.75f;
                            SpawnProjectile(muzzle, unit.Root.transform.forward, PrimitiveType.Sphere,
                                _profile.SecondaryColor, 1.35f, 18f, 1, 0.12f, 0f, 1f, 1.1f, false, 5f);
                            unit.NextAttackAt = Time.time + 0.82f;
                        }
                    }
                }
                else
                {
                    float side = unit.Index == 0 ? -1.2f : unit.Index == 1 ? 1.2f : 0f;
                    desired = transform.position - transform.forward * (unit.Index == 2 ? 1.0f : 2.05f)
                        + transform.right * side + Vector3.up * 0.08f;
                    if (unit.Index == 2 && target != null && Time.time >= unit.NextAttackAt)
                    {
                        Vector3 delta = target.transform.position - unit.Root.transform.position;
                        delta.y = 0f;
                        if (delta.magnitude > 1.35f)
                            unit.Root.transform.position = Vector3.MoveTowards(unit.Root.transform.position,
                                target.transform.position + Vector3.up * 0.25f, 7.5f * Time.deltaTime);
                        else
                        {
                            target.ApplyCombatHit(1.6f, 0.25f, 0f, 1f, delta.normalized * 1.4f);
                            unit.NextAttackAt = Time.time + 1.15f;
                        }
                    }
                    else
                    {
                        unit.Root.transform.position = Vector3.Lerp(unit.Root.transform.position, desired, 1f - Mathf.Exp(-6f * Time.deltaTime));
                        if (target != null && Time.time >= unit.NextAttackAt)
                        {
                            Vector3 aim = target.transform.position - unit.Root.transform.position;
                            aim.y = 0f;
                            if (aim.sqrMagnitude > 0.05f)
                                SpawnProjectile(unit.Root.transform.position + Vector3.up * 0.35f,
                                    aim.normalized, PrimitiveType.Capsule, _profile.SecondaryColor,
                                    0.9f, 15f, 0, 0f, 0f, 1f, 0.4f, false, 4f);
                            unit.NextAttackAt = Time.time + 1.25f;
                        }
                    }
                }
            }
        }

        private EnemyAgent FindClosestEnemy(float maxRange)
        {
            EnemyAgent closest = null;
            float bestDistance = maxRange * maxRange;
            Vector3 position = transform.position;
            foreach (EnemyAgent enemy in _enemyCache)
            {
                if (enemy == null || enemy.IsDefeated) continue;
                float sqrDistance = (enemy.transform.position - position).sqrMagnitude;
                if (sqrDistance >= bestDistance) continue;
                bestDistance = sqrDistance;
                closest = enemy;
            }
            return closest;
        }

        private static void BuildSupportVisual(Transform root, SupportStyle style, Color color, int index)
        {
            if (style == SupportStyle.Tank)
            {
                CreatePart(root, PrimitiveType.Cube, "WZ hull", new Vector3(0f, 0.28f, 0f), new Vector3(1.35f, 0.42f, 0.92f), new Color(0.15f, 0.24f, 0.20f));
                CreatePart(root, PrimitiveType.Cube, "WZ turret", new Vector3(0f, 0.57f, 0.02f), new Vector3(0.58f, 0.26f, 0.56f), color);
                CreatePart(root, PrimitiveType.Cylinder, "WZ barrel", new Vector3(0f, 0.62f, 0.47f), new Vector3(0.12f, 0.12f, 0.62f), color);
                for (int side = -1; side <= 1; side += 2)
                    CreatePart(root, PrimitiveType.Cube, "WZ track", new Vector3(side * 0.53f, 0.12f, 0f), new Vector3(0.22f, 0.18f, 1.05f), new Color(0.08f, 0.10f, 0.11f));
            }
            else
            {
                CreatePart(root, PrimitiveType.Capsule, "Capybara body", new Vector3(0f, 0.30f, 0f), new Vector3(0.65f, 0.55f, 0.95f), new Color(0.48f, 0.30f, 0.18f));
                CreatePart(root, PrimitiveType.Sphere, "Capybara head", new Vector3(0f, 0.48f, 0.43f), new Vector3(0.47f, 0.38f, 0.42f), color);
                CreatePart(root, PrimitiveType.Cube, "Capybara vest", new Vector3(0f, 0.31f, -0.03f), new Vector3(0.56f, 0.22f, 0.52f), new Color(0.08f, 0.10f, 0.15f));
                CreatePart(root, PrimitiveType.Sphere, "Capybara muzzle", new Vector3(0f, 0.38f, 0.67f), new Vector3(0.24f, 0.16f, 0.16f), new Color(0.20f, 0.13f, 0.10f));
                if (index == 0)
                    CreatePart(root, PrimitiveType.Cube, "Capybara radio", new Vector3(-0.28f, 0.48f, -0.22f), new Vector3(0.12f, 0.20f, 0.12f), color);
            }
        }

        private static Material GetSupportMaterial(Color color)
        {
            Color32 rgba = color;
            int key = (rgba.r << 24) | (rgba.g << 16) | (rgba.b << 8) | rgba.a;
            if (SupportMaterials.TryGetValue(key, out Material material) && material != null) return material;

            Shader shader = Shader.Find("Universal Render Pipeline/Lit");
            if (shader == null) shader = Shader.Find("Standard");
            if (shader == null)
            {
                Debug.LogError("No compatible shader is available for operator visuals.");
                return null;
            }
            material = new Material(shader) { color = color, enableInstancing = true };
            SupportMaterials[key] = material;
            return material;
        }

        private static void CreatePart(Transform parent, PrimitiveType type, string name, Vector3 localPosition, Vector3 scale, Color color)
        {
            GameObject part = GameObject.CreatePrimitive(type);
            part.name = name;
            part.transform.SetParent(parent, false);
            part.transform.localPosition = localPosition;
            part.transform.localScale = scale;
            Collider collider = part.GetComponent<Collider>();
            if (collider != null) Destroy(collider);
            Renderer renderer = part.GetComponent<Renderer>();
            if (renderer != null) renderer.sharedMaterial = GetSupportMaterial(color);
        }

        private void UpdateAbilityHud()
        {
            if (_hud == null || _profile == null) return;
            _hud.SetAbilityState(_abilityCooldownRemaining, _abilityCooldownDuration);
        }

        private void OnDestroy()
        {
            for (int i = 0; i < _supportUnits.Count; i++)
                if (_supportUnits[i].Root != null) Destroy(_supportUnits[i].Root);
            _supportUnits.Clear();
            if (_grzesiekArmRoot != null) Destroy(_grzesiekArmRoot);
            if (_contractEffectRoot != null) Destroy(_contractEffectRoot);
            _contractFragments.Clear();
            _contractFragmentDirections.Clear();
        }
    }
}
