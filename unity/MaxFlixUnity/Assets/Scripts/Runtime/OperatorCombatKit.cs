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
        private enum SupportStyle { Tank, Cat, Capybara }

        private sealed class SupportUnit
        {
            public GameObject Root;
            public SupportStyle Style;
            public int Index;
            public float ExpiresAt;
            public float NextAttackAt;
            public EnemyAgent PounceTarget;
            public float PounceUntil;
        }

        private readonly List<SupportUnit> _supportUnits = new List<SupportUnit>();
        private readonly MaterialPropertyBlock _propertyBlock = new MaterialPropertyBlock();
        private static readonly Dictionary<int, Material> SupportMaterials = new Dictionary<int, Material>();
        private static Material _sharedProjectileMaterial;
        private EnemyAgent[] _enemyCache = new EnemyAgent[0];
        private float _enemyCacheRemaining;
        private static readonly int BaseColorId = Shader.PropertyToID("_BaseColor");
        private static readonly int ColorId = Shader.PropertyToID("_Color");
        private static readonly int EmissionColorId = Shader.PropertyToID("_EmissionColor");

        private PlayerController _player;
        private HudController _hud;
        private OperatorProfile _profile;
        private int _primaryCount;
        private int _mateuszHitCount;
        private float _abilityCooldownRemaining;
        private float _sprintRemaining;
        private float _invulnerabilityRemaining;
        private float _shieldRemaining;
        private float _ramRemaining;
        private float _ramDamageCooldown;

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
            UpdateAbilityHud();
        }

        public void Tick(float deltaTime)
        {
            if (_profile == null || _player == null || _player.IsDefeated) return;

            _abilityCooldownRemaining = Mathf.Max(0f, _abilityCooldownRemaining - deltaTime);
            _enemyCacheRemaining -= deltaTime;
            if (_enemyCacheRemaining <= 0f)
            {
                _enemyCache = FindObjectsByType<EnemyAgent>(FindObjectsSortMode.None);
                _enemyCacheRemaining = 0.25f;
            }
            _sprintRemaining = Mathf.Max(0f, _sprintRemaining - deltaTime);
            _invulnerabilityRemaining = Mathf.Max(0f, _invulnerabilityRemaining - deltaTime);
            _shieldRemaining = Mathf.Max(0f, _shieldRemaining - deltaTime);
            _ramRemaining = Mathf.Max(0f, _ramRemaining - deltaTime);
            _ramDamageCooldown = Mathf.Max(0f, _ramDamageCooldown - deltaTime);

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
                        _profile.SecondaryColor, _profile.BasicAttackDamageMultiplier * (auditSeal ? 2.1f : 1f),
                        17f, auditSeal ? 1 : 0, 0.34f, 0f, 1f, 0f, false, 2.8f);
                    _hud?.SetStatus(auditSeal ? "PIECZĘĆ AUDYTU • WZMOCNIONY ATAK" : "ZAKLĘCIE ERP • CEL OZNACZONY");
                    break;
                }
                case OperatorId.Grzesiek:
                {
                    bool heavyThrow = _primaryCount % 3 == 0;
                    SpawnProjectile(origin, transform.forward, PrimitiveType.Cylinder,
                        _profile.SecondaryColor, _profile.BasicAttackDamageMultiplier * (heavyThrow ? 1.8f : 1f),
                        14f, heavyThrow ? 4 : 0, 0f, 0f, 1f, heavyThrow ? 4.2f : 1.5f, false, 3.0f);
                    _hud?.SetStatus(heavyThrow ? "RZUT SIŁACZA • PRZEBICIE" : "HANTLA 44 CM • RZUT");
                    break;
                }
                case OperatorId.Dawid:
                {
                    bool stretchBurst = _primaryCount % 3 == 0;
                    SpawnProjectile(origin, transform.forward, PrimitiveType.Capsule,
                        _profile.SecondaryColor, _profile.BasicAttackDamageMultiplier * (stretchBurst ? 1.25f : 1f),
                        14.5f, stretchBurst ? 2 : 0, 0f, 1.55f, 0.48f, 0.25f, false, 3.0f);
                    _hud?.SetStatus(stretchBurst ? "STRETCH • PASMA ROZRZUcone" : "FOLIA STRETCH • CEL SPOWOLNIONY");
                    break;
                }
                case OperatorId.Mateusz:
                {
                    SpawnProjectile(origin, transform.forward, PrimitiveType.Sphere,
                        _profile.SecondaryColor, _profile.BasicAttackDamageMultiplier,
                        20f, 0, 0.22f, 1.1f, 0.58f, 0f, false, 1.4f, true);
                    _hud?.SetStatus("IMPULS PARALIZATORA • ELEKTRYZACJA");
                    break;
                }
                case OperatorId.Piotr:
                {
                    SpawnProjectile(origin, transform.forward, PrimitiveType.Cube,
                        _profile.SecondaryColor, _profile.BasicAttackDamageMultiplier,
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

            _abilityCooldownRemaining = _profile.AbilityCooldownSeconds;
            switch (_profile.Id)
            {
                case OperatorId.Marcin:
                    SpawnSupport(SupportStyle.Tank, 0, mode == GameMode.Survival ? 6f : 8f, _profile.SecondaryColor);
                    _hud?.SetStatus("KONWÓJ WZ-404 • CZOŁG OSŁONOWY AKTYWNY");
                    break;

                case OperatorId.Grzesiek:
                    DamageNearbyEnemies(5.2f, 3f, 0.6f, 5.4f);
                    _ramRemaining = 6f;
                    _hud?.SetStatus("ŚCISK ZAGŁADY • TRYB TARANA 6 S");
                    break;

                case OperatorId.Dawid:
                    for (int i = -2; i <= 2; i++)
                    {
                        Quaternion spread = Quaternion.Euler(0f, i * 13f, 0f);
                        SpawnProjectile(transform.position + Vector3.up * 1.05f + transform.forward * 0.55f,
                            spread * transform.forward, PrimitiveType.Cube, _profile.SecondaryColor,
                            1.45f, 12f, 2, 0f, 0.65f, 0.68f, 1.1f, false, 3.2f);
                    }
                    _shieldRemaining = 3.5f;
                    _player.RestoreHealth(1f);
                    _hud?.SetStatus("SALWA 5 PŁYT CALACATTA • KASK + KUBEŁEK MOCY");
                    break;

                case OperatorId.Mateusz:
                    float catDuration = mode == GameMode.Survival ? 6.5f : 9.5f;
                    for (int i = 0; i < 3; i++)
                        SpawnSupport(SupportStyle.Cat, i, catDuration, _profile.SecondaryColor);
                    _hud?.SetStatus("KOCIA ARMIA ONLINE • 3× MIAU-CRITICAL");
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
            bool countsForMateuszPassive = false)
        {
            GameObject projectile = GameObject.CreatePrimitive(shape);
            projectile.name = "Operator combat projectile";
            projectile.transform.position = origin;
            projectile.transform.rotation = Quaternion.LookRotation(direction.normalized, Vector3.up);
            projectile.transform.localScale = shape == PrimitiveType.Cylinder
                ? new Vector3(0.22f, 0.22f, 0.48f)
                : (shape == PrimitiveType.Cube ? new Vector3(0.22f, 0.22f, 0.32f) : Vector3.one * 0.22f);

            Renderer renderer = projectile.GetComponent<Renderer>();
            if (renderer != null)
            {
                if (_sharedProjectileMaterial == null)
                {
                    Shader shader = Shader.Find("Universal Render Pipeline/Lit");
                    if (shader == null) shader = Shader.Find("Standard");
                    _sharedProjectileMaterial = new Material(shader) { enableInstancing = true };
                    if (_sharedProjectileMaterial.HasProperty(EmissionColorId))
                        _sharedProjectileMaterial.EnableKeyword("_EMISSION");
                }
                renderer.sharedMaterial = _sharedProjectileMaterial;
                renderer.GetPropertyBlock(_propertyBlock);
                _propertyBlock.SetColor(BaseColorId, color);
                _propertyBlock.SetColor(ColorId, color);
                _propertyBlock.SetColor(EmissionColorId, color * 1.35f);
                renderer.SetPropertyBlock(_propertyBlock);
            }

            Collider hitbox = projectile.GetComponent<Collider>();
            if (hitbox != null) hitbox.isTrigger = true;
            Rigidbody body = projectile.AddComponent<Rigidbody>();
            body.useGravity = false;
            body.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;
            body.velocity = direction.normalized * speed;

            CombatProjectile impact = projectile.AddComponent<CombatProjectile>();
            impact.Initialize(damage, 3.2f, transform, speed, pierce, stun,
                slowDuration, slowMultiplier, knockback, returnToOwner, range, countsForMateuszPassive);
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

        private void SpawnSupport(SupportStyle style, int index, float duration, Color color)
        {
            GameObject root = new GameObject(style == SupportStyle.Tank
                ? "WZ-404 escort" : style == SupportStyle.Cat ? "Miau-critical support" : "MafiKapibara guard");
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
                else if (unit.Style == SupportStyle.Cat)
                {
                    float angle = Time.time * 2.15f + unit.Index * (Mathf.PI * 2f / 3f);
                    desired = transform.position + new Vector3(Mathf.Cos(angle), 0.12f, Mathf.Sin(angle)) * 1.55f;
                    if (unit.PounceTarget == null && target != null && Time.time >= unit.NextAttackAt)
                    {
                        unit.PounceTarget = target;
                        unit.PounceUntil = Time.time + 0.65f;
                    }

                    if (unit.PounceTarget != null)
                    {
                        if (unit.PounceTarget == null || Time.time > unit.PounceUntil)
                        {
                            unit.PounceTarget = null;
                        }
                        else
                        {
                            Vector3 pounce = unit.PounceTarget.transform.position + Vector3.up * 0.28f;
                            unit.Root.transform.position = Vector3.MoveTowards(unit.Root.transform.position, pounce, 10f * Time.deltaTime);
                            if (Vector3.Distance(unit.Root.transform.position, pounce) < 1.1f)
                            {
                                unit.PounceTarget.ApplyCombatHit(1.55f, 0.16f, 0f, 1f, transform.forward * 0.7f);
                                unit.PounceTarget = null;
                                unit.NextAttackAt = Time.time + 1.1f;
                            }
                            continue;
                        }
                    }
                    unit.Root.transform.position = Vector3.Lerp(unit.Root.transform.position, desired, 1f - Mathf.Exp(-8f * Time.deltaTime));
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
                if (enemy == null) continue;
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
            else if (style == SupportStyle.Cat)
            {
                CreatePart(root, PrimitiveType.Sphere, "Cat body", new Vector3(0f, 0.20f, 0f), new Vector3(0.58f, 0.42f, 0.78f), color);
                CreatePart(root, PrimitiveType.Sphere, "Cat head", new Vector3(0f, 0.54f, 0.28f), new Vector3(0.48f, 0.42f, 0.42f), color);
                CreatePart(root, PrimitiveType.Cylinder, "Cat left ear", new Vector3(-0.15f, 0.83f, 0.29f), new Vector3(0.16f, 0.28f, 0.16f), color);
                CreatePart(root, PrimitiveType.Cylinder, "Cat right ear", new Vector3(0.15f, 0.83f, 0.29f), new Vector3(0.16f, 0.28f, 0.16f), color);
                CreatePart(root, PrimitiveType.Sphere, "Cat visor", new Vector3(0f, 0.56f, 0.48f), new Vector3(0.25f, 0.09f, 0.04f), Color.black);
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
            if (renderer != null)
            {
                Color32 rgba = color;
                int key = (rgba.r << 24) | (rgba.g << 16) | (rgba.b << 8) | rgba.a;
                if (!SupportMaterials.TryGetValue(key, out Material material))
                {
                    Shader shader = Shader.Find("Universal Render Pipeline/Lit");
                    if (shader == null) shader = Shader.Find("Standard");
                    material = new Material(shader) { color = color, enableInstancing = true };
                    SupportMaterials.Add(key, material);
                }
                renderer.sharedMaterial = material;
            }
        }

        private void UpdateAbilityHud()
        {
            if (_hud == null || _profile == null) return;
            _hud.SetAbilityState(_abilityCooldownRemaining, _profile.AbilityCooldownSeconds);
        }

        private void OnDestroy()
        {
            for (int i = 0; i < _supportUnits.Count; i++)
                if (_supportUnits[i].Root != null) Destroy(_supportUnits[i].Root);
            _supportUnits.Clear();
        }
    }
}
