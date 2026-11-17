using System.Collections.Generic;
using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    [RequireComponent(typeof(CharacterController))]
    public sealed class EnemyAgent : MonoBehaviour
    {
        private CharacterController _controller;
        private PlayerController _target;
        private EnemyArchetypeProfile _profile;
        private float _health;
        private float _maxHealth;
        private float _moveSpeed;
        private float _attackInterval;
        private float _attackRange;
        private float _aggroRange;
        private float _attackDamage;
        private float _abilityRateMultiplier = 1f;
        private float _attackTimer;
        private float _stunRemaining;
        private float _slowRemaining;
        private float _slowMultiplier = 1f;
        private float _hitFlashTimer;
        private float _supportShieldRemaining;
        private float _chargeWindupRemaining;
        private float _chargeRemaining;
        private float _phaseTwoMoveMultiplier = 1f;
        private Vector3 _chargeDirection;
        private Vector3 _knockbackVelocity;
        private Vector3 _patrolCenter;
        private float _patrolDirection = 1f;
        private bool _chargeHitApplied;
        private bool _phaseTwo;
        private bool _defeated;
        private bool _factionBrawlTint;
        private GameObject _factionBrawlVisualRoot;
        private LineRenderer _factionBrawlRing;
        private Transform _factionBrawlMarker;
        private EnemyAgent _factionBrawlTarget;
        private float _factionBrawlRetargetRemaining;
        private static float _factionBrawlUntil;
        private Renderer[] _renderers;
        private MaterialPropertyBlock _propertyBlock;
        private static EnemyAgent[] _separationCache = new EnemyAgent[0];
        private static readonly Dictionary<Vector2Int, List<EnemyAgent>> SeparationBuckets =
            new Dictionary<Vector2Int, List<EnemyAgent>>(64);
        private const float SeparationCellSize = 3.6f;
        private static float _nextSeparationRefreshTime;
        private static readonly int BaseColorId = Shader.PropertyToID("_BaseColor");
        private static readonly int ColorId = Shader.PropertyToID("_Color");
        private static Material _factionBrawlMaterial;

        public bool IsDefeated { get { return _defeated; } }
        public EnemyKind Kind { get { return _profile != null ? _profile.Id : EnemyKind.Customer; } }
        public float CurrentHealth { get { return _health; } }
        public float MaxHealth { get { return _maxHealth; } }

        public static EnemyAgent[] GetCachedAgents()
        {
            RefreshSeparationIndex();
            return _separationCache;
        }

        /// <summary>Invalidate spatial data immediately when a run world is torn down.</summary>
        public static void InvalidateSpatialCache()
        {
            _separationCache = new EnemyAgent[0];
            SeparationBuckets.Clear();
            _nextSeparationRefreshTime = 0f;
            _factionBrawlUntil = 0f;
        }

        /// <summary>Redirects every live enemy toward another enemy, never the player.</summary>
        public static void TriggerFactionBrawl(float durationSeconds)
        {
            float safeDuration = Mathf.Clamp(durationSeconds, 1f, 12f);
            _factionBrawlUntil = Mathf.Max(_factionBrawlUntil, Time.time + safeDuration);
            RefreshSeparationIndex();
        }

        public static bool IsFactionBrawlActive
        {
            get { return Time.time < _factionBrawlUntil; }
        }

        public void Initialize(PlayerController target, EnemyKind kind, float healthMultiplier = 1f, float speedMultiplier = 1f, float abilityRateMultiplier = 1f)
        {
            _controller = GetComponent<CharacterController>();
            _target = target;
            _profile = EnemyArchetypeCatalog.Get(kind);
            _maxHealth = Mathf.Max(1f, _profile.BaseHealth * Mathf.Clamp(healthMultiplier, 0.25f, 8f));
            _health = _maxHealth;
            float safeSpeedMultiplier = Mathf.Clamp(speedMultiplier, 0.5f, 2.5f);
            _moveSpeed = _profile.MoveSpeed * safeSpeedMultiplier;
            _attackInterval = _profile.AttackInterval;
            _attackRange = _profile.AttackRange;
            _aggroRange = _profile.AggroRange;
            _attackDamage = _profile.AttackDamage;
            _abilityRateMultiplier = Mathf.Clamp(abilityRateMultiplier, 0.5f, 2.5f);
            _attackTimer = _attackInterval * 0.55f;
            _patrolCenter = transform.position;
            _patrolDirection = (GetInstanceID() & 1) == 0 ? 1f : -1f;
            _renderers = GetComponentsInChildren<Renderer>();
            _propertyBlock = new MaterialPropertyBlock();
            _defeated = _profile.IsHazardOnly;
            if (_defeated) gameObject.SetActive(false);
        }

        // Retained for older callers while scenes are migrated to typed archetypes.
        public void Initialize(PlayerController target, float health = 5f)
        {
            Initialize(target, EnemyKind.Customer, 1f);
            _health = Mathf.Max(1f, health);
            _maxHealth = _health;
        }

        public void ApplyDamage(float damage)
        {
            ApplyCombatHit(damage, 0f, 0f, 1f, Vector3.zero);
        }

        /// <summary>Enemy-vs-enemy damage does not count as operator or weapon damage in Survival.</summary>
        public void ApplyFactionDamage(float damage, Vector3 knockbackVelocity)
        {
            if (_defeated || float.IsNaN(damage) || float.IsInfinity(damage) || damage <= 0f) return;
            float applied = damage;
            if (_supportShieldRemaining > 0f) applied *= 0.62f;
            if (applied <= 0f) return;
            _health = Mathf.Max(0f, _health - applied);
            _hitFlashTimer = 0.16f;
            _knockbackVelocity += Vector3.ClampMagnitude(knockbackVelocity, 6.5f);
            if (_profile != null && _profile.IsBoss && !_phaseTwo && _health <= MaxHealth * 0.5f)
            {
                _phaseTwo = true;
                _phaseTwoMoveMultiplier = 1.22f;
                _attackTimer = Mathf.Min(_attackTimer, _attackInterval / _abilityRateMultiplier * 0.35f);
            }
            if (_health <= 0f) Defeat();
        }

        private void TickFactionBrawlVisual(float deltaTime)
        {
            if (_factionBrawlVisualRoot == null)
            {
                _factionBrawlVisualRoot = new GameObject("Enemy faction-brawl marker");
                _factionBrawlVisualRoot.transform.SetParent(transform, false);
                _factionBrawlVisualRoot.transform.localPosition = Vector3.zero;

                GameObject ringObject = new GameObject("Magenta target ring");
                ringObject.transform.SetParent(_factionBrawlVisualRoot.transform, false);
                ringObject.transform.localPosition = new Vector3(0f, 0.06f, 0f);
                _factionBrawlRing = ringObject.AddComponent<LineRenderer>();
                _factionBrawlRing.useWorldSpace = false;
                _factionBrawlRing.loop = true;
                _factionBrawlRing.positionCount = 32;
                _factionBrawlRing.widthMultiplier = 0.052f;
                _factionBrawlRing.numCapVertices = 2;
                _factionBrawlRing.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                _factionBrawlRing.receiveShadows = false;
                for (int i = 0; i < 32; i++)
                {
                    float angle = (float)i / 32f * Mathf.PI * 2f;
                    _factionBrawlRing.SetPosition(i, new Vector3(Mathf.Cos(angle) * 0.64f, 0f, Mathf.Sin(angle) * 0.64f));
                }

                GameObject marker = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                marker.name = "Enemy-on-enemy status marker";
                marker.transform.SetParent(_factionBrawlVisualRoot.transform, false);
                marker.transform.localPosition = new Vector3(0f, 1.75f, 0f);
                marker.transform.localScale = Vector3.one * 0.16f;
                Collider markerCollider = marker.GetComponent<Collider>();
                if (markerCollider != null) Destroy(markerCollider);
                _factionBrawlMarker = marker.transform;

                if (_factionBrawlMaterial == null)
                {
                    Shader shader = Shader.Find("Universal Render Pipeline/Unlit");
                    if (shader == null) shader = Shader.Find("Unlit/Color");
                    if (shader == null) shader = Shader.Find("Standard");
                    if (shader != null)
                    {
                        _factionBrawlMaterial = new Material(shader)
                        {
                            color = new Color(0.91f, 0.32f, 0.96f),
                            enableInstancing = true
                        };
                        if (_factionBrawlMaterial.HasProperty("_EmissionColor"))
                        {
                            _factionBrawlMaterial.EnableKeyword("_EMISSION");
                            _factionBrawlMaterial.SetColor("_EmissionColor", new Color(0.72f, 0.10f, 0.94f) * 1.4f);
                        }
                    }
                }
                if (_factionBrawlRing != null) _factionBrawlRing.sharedMaterial = _factionBrawlMaterial;
                Renderer markerRenderer = marker.GetComponent<Renderer>();
                if (markerRenderer != null) markerRenderer.sharedMaterial = _factionBrawlMaterial;
            }

            float pulse = 0.92f + Mathf.Sin(Time.time * 11f + GetInstanceID() * 0.01f) * 0.10f;
            if (_factionBrawlRing != null) _factionBrawlRing.widthMultiplier = 0.042f + pulse * 0.018f;
            if (_factionBrawlMarker != null)
            {
                _factionBrawlMarker.Rotate(Vector3.up, 210f * deltaTime, Space.Self);
                _factionBrawlMarker.localScale = Vector3.one * (0.13f + pulse * 0.055f);
            }
        }

        private void ClearFactionBrawlVisual()
        {
            if (_factionBrawlVisualRoot != null) Destroy(_factionBrawlVisualRoot);
            _factionBrawlVisualRoot = null;
            _factionBrawlRing = null;
            _factionBrawlMarker = null;
        }

        private void TickFactionBrawl(float deltaTime)
        {
            _factionBrawlRetargetRemaining = Mathf.Max(0f, _factionBrawlRetargetRemaining - deltaTime);
            if (_factionBrawlTarget == null || _factionBrawlTarget.IsDefeated || _factionBrawlRetargetRemaining <= 0f)
            {
                _factionBrawlTarget = null;
                RefreshSeparationIndex();
                float bestDistance = 21.5f * 21.5f;
                foreach (EnemyAgent candidate in _separationCache)
                {
                    if (candidate == null || candidate == this || candidate.IsDefeated) continue;
                    Vector3 offset = candidate.transform.position - transform.position;
                    offset.y = 0f;
                    float sqrDistance = offset.sqrMagnitude;
                    if (sqrDistance >= bestDistance) continue;
                    bestDistance = sqrDistance;
                    _factionBrawlTarget = candidate;
                }
                _factionBrawlRetargetRemaining = 0.24f;
            }
            if (_factionBrawlTarget == null)
            {
                _attackTimer = Mathf.Max(_attackTimer, 0.12f);
                return;
            }

            Vector3 offsetToEnemy = _factionBrawlTarget.transform.position - transform.position;
            offsetToEnemy.y = 0f;
            float distance = offsetToEnemy.magnitude;
            Vector3 direction = distance > 0.001f ? offsetToEnemy / distance : transform.forward;
            Face(direction, deltaTime);
            const float contactRange = 1.55f;
            if (distance > contactRange)
            {
                Vector3 avoidance = EnemyNavigationWorld.GetObstacleAvoidanceVector(
                    transform.position, _factionBrawlTarget.transform.position,
                    GetInstanceID(), (_controller != null ? _controller.radius : 0.34f) + 0.55f);
                Vector3 travel = (direction + avoidance * 0.78f).normalized;
                Vector3 velocity = travel * (_moveSpeed * _phaseTwoMoveMultiplier * 0.82f * _slowMultiplier);
                velocity.y = -2f;
                if (_controller != null) _controller.Move(velocity * deltaTime);
                return;
            }
            if (_attackTimer <= 0f)
            {
                float brawlDamage = _profile != null && _profile.IsBoss ? _attackDamage * 0.58f : _attackDamage * 0.72f;
                _factionBrawlTarget.ApplyFactionDamage(brawlDamage, direction * 0.72f + Vector3.up * 0.12f);
                _attackTimer = _attackInterval / _abilityRateMultiplier * 1.12f;
            }
        }

        public void GrantSupportShield(float duration)
        {
            if (_defeated) return;
            _supportShieldRemaining = Mathf.Max(_supportShieldRemaining, Mathf.Clamp(duration, 0f, 6f));
        }

        public void ApplyCombatHit(
            float damage,
            float stunSeconds,
            float slowSeconds,
            float slowMultiplier,
            Vector3 knockbackVelocity)
        {
            ApplyCombatHitInternal(damage, stunSeconds, slowSeconds, slowMultiplier, knockbackVelocity, null);
        }

        public void ApplyWeaponHit(
            float damage,
            float stunSeconds,
            float slowSeconds,
            float slowMultiplier,
            Vector3 knockbackVelocity,
            SurvivalWeaponKind weapon)
        {
            ApplyCombatHitInternal(damage, stunSeconds, slowSeconds, slowMultiplier, knockbackVelocity, weapon);
        }

        private void ApplyCombatHitInternal(
            float damage,
            float stunSeconds,
            float slowSeconds,
            float slowMultiplier,
            Vector3 knockbackVelocity,
            SurvivalWeaponKind? weaponSource)
        {
            if (_defeated || float.IsNaN(damage) || float.IsInfinity(damage) || damage <= 0f) return;

            GameMode mode = GameSession.Current != null ? GameSession.Current.Mode : GameMode.Campaign;
            float balancedDamage = CombatBalanceCatalog.ScaleOutgoingDamage(damage, mode);
            if (_supportShieldRemaining > 0f) balancedDamage *= 0.62f;
            if (balancedDamage <= 0f) return;

            float actualDamage = Mathf.Min(Mathf.Max(0f, _health), balancedDamage);
            _health = Mathf.Max(0f, _health - balancedDamage);
            if (mode == GameMode.Survival)
            {
                if (weaponSource.HasValue) SurvivalDamageTracker.RecordWeaponDamage(weaponSource.Value, actualDamage);
                else SurvivalDamageTracker.RecordOperatorDamage(actualDamage);
            }
            _hitFlashTimer = 0.13f;
            _stunRemaining = Mathf.Max(_stunRemaining, Mathf.Clamp(stunSeconds, 0f, 3f));
            if (slowSeconds > _slowRemaining)
            {
                _slowRemaining = Mathf.Clamp(slowSeconds, 0f, 5f);
                _slowMultiplier = Mathf.Clamp(slowMultiplier, 0.15f, 1f);
            }
            _knockbackVelocity += Vector3.ClampMagnitude(knockbackVelocity, 12f);

            if (_profile != null && _profile.IsBoss && !_phaseTwo && _health <= MaxHealth * 0.5f)
            {
                _phaseTwo = true;
                _phaseTwoMoveMultiplier = 1.22f;
                _attackTimer = Mathf.Min(_attackTimer, _attackInterval / _abilityRateMultiplier * 0.35f);
            }

            if (_health <= 0f) Defeat();
        }

        private void Awake()
        {
            _controller = GetComponent<CharacterController>();
        }

        private void Update()
        {
            if (_defeated || _profile == null) return;

            if (_target == null || _target.IsDefeated || GameSession.Current == null
                || GameSession.Current.State != GameFlowState.Playing)
            {
                if (_factionBrawlTint)
                {
                    _factionBrawlTint = false;
                    ClearFactionBrawlVisual();
                    SetHitTint(false);
                }
                return;
            }

            float deltaTime = Time.deltaTime;
            _attackTimer -= deltaTime;
            _stunRemaining = Mathf.Max(0f, _stunRemaining - deltaTime);
            _slowRemaining = Mathf.Max(0f, _slowRemaining - deltaTime);
            _supportShieldRemaining = Mathf.Max(0f, _supportShieldRemaining - deltaTime);
            if (_slowRemaining <= 0f) _slowMultiplier = 1f;

            ApplySeparation(deltaTime);
            if (_knockbackVelocity.sqrMagnitude > 0.01f)
            {
                Move(_knockbackVelocity, deltaTime);
                _knockbackVelocity = Vector3.MoveTowards(_knockbackVelocity, Vector3.zero, 18f * deltaTime);
            }

            bool factionBrawlActive = IsFactionBrawlActive;
            if (factionBrawlActive)
            {
                if (!_factionBrawlTint)
                {
                    _factionBrawlTint = true;
                    SetHitTint(_hitFlashTimer > 0f);
                }
                TickFactionBrawlVisual(deltaTime);
            }
            else if (_factionBrawlTint)
            {
                _factionBrawlTint = false;
                ClearFactionBrawlVisual();
                SetHitTint(_hitFlashTimer > 0f);
            }

            // Visual state must tick/expire even while the enemy is stunned.
            if (_stunRemaining > 0f)
            {
                UpdateHitFlash(deltaTime);
                return;
            }

            if (factionBrawlActive)
            {
                TickFactionBrawl(deltaTime);
                UpdateHitFlash(deltaTime);
                return;
            }

            Vector3 offset = _target.transform.position - transform.position;
            offset.y = 0f;
            float distance = offset.magnitude;
            Vector3 direction = distance > 0.01f ? offset / distance : transform.forward;

            if (_chargeRemaining > 0f)
            {
                TickCharge(deltaTime);
                UpdateHitFlash(deltaTime);
                return;
            }

            if (_chargeWindupRemaining > 0f)
            {
                _chargeWindupRemaining -= deltaTime;
                if (_chargeWindupRemaining <= 0f)
                {
                    _chargeDirection = direction;
                    _chargeRemaining = _profile.IsBoss ? 0.82f : 0.62f;
                    _chargeHitApplied = false;
                    transform.rotation = Quaternion.LookRotation(_chargeDirection);
                }
                UpdateHitFlash(deltaTime);
                return;
            }

            switch (_profile.Behavior)
            {
                case EnemyBehaviorStyle.Ranged:
                    TickRanged(deltaTime, direction, distance);
                    break;
                case EnemyBehaviorStyle.Support:
                    TickSupport(deltaTime, direction, distance);
                    break;
                case EnemyBehaviorStyle.Charger:
                case EnemyBehaviorStyle.Boss:
                case EnemyBehaviorStyle.PatrolRammer:
                    TickCharger(deltaTime, direction, distance);
                    break;
                case EnemyBehaviorStyle.MeleeChaser:
                default:
                    TickMelee(deltaTime, direction, distance);
                    break;
            }

            UpdateHitFlash(deltaTime);
        }

        private bool HasClearAttackLine()
        {
            if (_target == null) return false;
            Vector3 origin = transform.position + Vector3.up * 0.88f;
            Vector3 target = _target.transform.position + Vector3.up * 0.82f;
            return EnemyNavigationWorld.HasClearLineToTarget(origin, target, 0.12f);
        }

        private void TickMelee(float deltaTime, Vector3 direction, float distance)
        {
            if (distance > _attackRange)
            {
                if (distance <= _aggroRange)
                    Move(direction * (_moveSpeed * _phaseTwoMoveMultiplier * _slowMultiplier), deltaTime);
                else
                    TickPatrol(deltaTime);
                Face(direction, deltaTime);
                return;
            }

            if (!HasClearAttackLine())
            {
                Move(direction * (_moveSpeed * _phaseTwoMoveMultiplier * _slowMultiplier), deltaTime);
                Face(direction, deltaTime);
                return;
            }

            if (_attackTimer <= 0f)
            {
                _target.ApplyDamage(_attackDamage);
                _attackTimer = _attackInterval / _abilityRateMultiplier;
            }
        }

        private void TickRanged(float deltaTime, Vector3 direction, float distance)
        {
            float preferredRange = _attackRange;
            bool clearAttackLine = HasClearAttackLine();
            if (!clearAttackLine || distance > preferredRange * 1.12f)
                Move(direction * (_moveSpeed * _slowMultiplier), deltaTime);
            else if (distance < preferredRange * 0.58f)
                Move(-direction * (_moveSpeed * 0.72f * _slowMultiplier), deltaTime);
            else
            {
                Vector3 strafe = Vector3.Cross(Vector3.up, direction) * _patrolDirection;
                Move(strafe * (_moveSpeed * 0.34f * _slowMultiplier), deltaTime);
            }

            Face(direction, deltaTime);
            if (clearAttackLine && _attackTimer <= 0f)
            {
                FireRangedAttack(direction);
                _attackTimer = _attackInterval / _abilityRateMultiplier * (_phaseTwo ? 0.78f : 1f);
            }
        }

        private void TickSupport(float deltaTime, Vector3 direction, float distance)
        {
            if (distance > _attackRange * 0.90f)
                Move(direction * (_moveSpeed * 0.82f * _slowMultiplier), deltaTime);
            Face(direction, deltaTime);

            if (_attackTimer > 0f) return;
            RefreshSeparationIndex();
            int shielded = 0;
            foreach (EnemyAgent ally in _separationCache)
            {
                if (ally == null || ally == this || ally.IsDefeated) continue;
                if ((ally.transform.position - transform.position).sqrMagnitude > 6.5f * 6.5f) continue;
                ally.GrantSupportShield(2.3f);
                shielded++;
            }

            if (shielded == 0)
            {
                if (HasClearAttackLine())
                    FireRangedAttack(direction);
                else
                    Move(direction * (_moveSpeed * 0.82f * _slowMultiplier), deltaTime);
            }
            _attackTimer = _attackInterval / _abilityRateMultiplier * (_phaseTwo ? 0.85f : 1f);
        }

        private void TickCharger(float deltaTime, Vector3 direction, float distance)
        {
            if (distance > _attackRange && distance <= _aggroRange)
            {
                Move(direction * (_moveSpeed * _phaseTwoMoveMultiplier * _slowMultiplier), deltaTime);
                Face(direction, deltaTime);
            }
            else if (distance > _aggroRange)
            {
                TickPatrol(deltaTime);
            }

            if (_attackTimer <= 0f && distance <= _aggroRange)
            {
                if (!HasClearAttackLine())
                {
                    Move(direction * (_moveSpeed * _phaseTwoMoveMultiplier * _slowMultiplier), deltaTime);
                    Face(direction, deltaTime);
                    return;
                }

                _chargeWindupRemaining = _profile.IsBoss ? 0.82f : 0.62f;
                _attackTimer = _attackInterval / _abilityRateMultiplier * (_phaseTwo ? 0.76f : 1f);
            }
        }

        private void TickCharge(float deltaTime)
        {
            float chargeSpeed = _moveSpeed * (_profile.IsBoss ? 2.15f : 2.45f) * _phaseTwoMoveMultiplier;
            Move(_chargeDirection * chargeSpeed, deltaTime);

            if (!_chargeHitApplied && _target != null)
            {
                Vector3 offset = _target.transform.position - transform.position;
                offset.y = 0f;
                if (offset.sqrMagnitude <= (_attackRange + 0.5f) * (_attackRange + 0.5f)
                    && HasClearAttackLine())
                {
                    _target.ApplyDamage(_attackDamage * (_profile.IsBoss ? 1.35f : 1f));
                    _chargeHitApplied = true;
                }
            }

            _chargeRemaining = Mathf.Max(0f, _chargeRemaining - deltaTime);
        }

        private void TickPatrol(float deltaTime)
        {
            float patrolOffset = transform.position.x - _patrolCenter.x;
            if (patrolOffset > 2.8f) _patrolDirection = -1f;
            else if (patrolOffset < -2.8f) _patrolDirection = 1f;

            Vector3 direction = Vector3.right * _patrolDirection;
            Move(direction * (_moveSpeed * 0.28f * _slowMultiplier), deltaTime);
            Face(direction, deltaTime);
        }

        private void FireRangedAttack(Vector3 direction)
        {
            if (_target == null) return;
            Vector3 origin = transform.position + Vector3.up * 0.92f + transform.forward * 0.48f;
            Vector3 aim = _target.transform.position + Vector3.up * 0.82f - origin;
            if (aim.sqrMagnitude < 0.01f) aim = direction;
            EnemyAttackProjectile.Spawn(
                _target, _attackDamage, origin, aim.normalized, 10.5f, _profile.AccentColor);
        }

        private static Vector2Int GetSeparationCell(Vector3 position)
        {
            return new Vector2Int(
                Mathf.FloorToInt(position.x / SeparationCellSize),
                Mathf.FloorToInt(position.z / SeparationCellSize));
        }

        private static void RefreshSeparationIndex()
        {
            if (Time.time < _nextSeparationRefreshTime) return;

            _separationCache = FindObjectsByType<EnemyAgent>(FindObjectsSortMode.None);
            foreach (List<EnemyAgent> bucket in SeparationBuckets.Values)
                bucket.Clear();

            foreach (EnemyAgent enemy in _separationCache)
            {
                if (enemy == null || enemy.IsDefeated) continue;
                Vector2Int cell = GetSeparationCell(enemy.transform.position);
                if (!SeparationBuckets.TryGetValue(cell, out List<EnemyAgent> bucket))
                {
                    bucket = new List<EnemyAgent>(6);
                    SeparationBuckets.Add(cell, bucket);
                }
                bucket.Add(enemy);
            }

            _nextSeparationRefreshTime = Time.time + 0.10f;
        }

        private void ApplySeparation(float deltaTime)
        {
            if (_controller == null || _target == null) return;
            RefreshSeparationIndex();

            Vector3 force = Vector3.zero;
            Vector2Int originCell = GetSeparationCell(transform.position);
            for (int cellX = -1; cellX <= 1; cellX++)
            {
                for (int cellZ = -1; cellZ <= 1; cellZ++)
                {
                    Vector2Int cell = new Vector2Int(originCell.x + cellX, originCell.y + cellZ);
                    if (!SeparationBuckets.TryGetValue(cell, out List<EnemyAgent> bucket)) continue;

                    for (int i = 0; i < bucket.Count; i++)
                    {
                        EnemyAgent other = bucket[i];
                        if (other == null || other == this || other.IsDefeated) continue;
                        Vector3 offset = transform.position - other.transform.position;
                        offset.y = 0f;
                        float distanceSquared = offset.sqrMagnitude;
                        float desiredDistance = (_profile != null && _profile.IsBoss ? 1.48f : 1.12f)
                            + (other._profile != null && other._profile.IsBoss ? 0.28f : 0f);
                        float desiredSquared = desiredDistance * desiredDistance;
                        if (distanceSquared >= desiredSquared) continue;

                        float distance = Mathf.Sqrt(Mathf.Max(0f, distanceSquared));
                        Vector3 direction;
                        if (distanceSquared < 0.0001f)
                            direction = GetInstanceID() < other.GetInstanceID() ? Vector3.right : Vector3.left;
                        else
                            direction = offset / distance;

                        float penetration = (desiredDistance - distance) / desiredDistance;
                        force += direction * penetration;
                    }
                }
            }

            Vector3 playerOffset = transform.position - _target.transform.position;
            playerOffset.y = 0f;
            float playerDistance = playerOffset.magnitude;
            const float playerClearance = 1.15f;
            if (playerDistance < playerClearance)
            {
                Vector3 playerSeparationDirection = playerDistance > 0.001f
                    ? playerOffset / playerDistance
                    : (GetInstanceID() < _target.GetInstanceID() ? Vector3.right : Vector3.left);
                float penetration = (playerClearance - playerDistance) / playerClearance;
                force += playerSeparationDirection * penetration * 1.35f;
            }

            if (force.sqrMagnitude < 0.0001f) return;
            Vector3 velocity = Vector3.ClampMagnitude(force * 3.4f, 3.8f);
            velocity.y = -2f;
            _controller.Move(velocity * deltaTime);
        }

        private void Move(Vector3 horizontalVelocity, float deltaTime)
        {
            if (_controller == null) return;

            Vector3 velocity = horizontalVelocity;
            velocity.y = 0f;
            if (_target != null && velocity.sqrMagnitude > 0.0001f)
            {
                Vector3 toTarget = _target.transform.position - transform.position;
                toTarget.y = 0f;
                Vector3 direction = velocity.normalized;
                Vector3 targetDirection = toTarget.sqrMagnitude > 0.0001f
                    ? toTarget.normalized : Vector3.zero;

                // Only steer actors that are actually advancing towards the
                // player. Retreat, knockback and deliberate lateral movement
                // remain untouched unless the actor is already inside a rack.
                bool advancing = Vector3.Dot(direction, targetDirection) > 0.35f;
                if (advancing)
                {
                    Vector3 avoidance = EnemyNavigationWorld.GetObstacleAvoidanceVector(
                        transform.position,
                        _target.transform.position,
                        GetInstanceID(),
                        (_controller != null ? _controller.radius : 0.34f) + 0.8f);
                    if (avoidance.sqrMagnitude > 0.0001f)
                    {
                        float speed = velocity.magnitude;
                        velocity = (direction + avoidance * 0.82f).normalized * speed;
                    }
                }
            }

            velocity.y = -2f;
            _controller.Move(velocity * deltaTime);
        }

        private void Face(Vector3 direction, float deltaTime)
        {
            direction.y = 0f;
            if (direction.sqrMagnitude < 0.01f) return;
            Quaternion facing = Quaternion.LookRotation(direction.normalized);
            transform.rotation = Quaternion.Slerp(transform.rotation, facing, 1f - Mathf.Exp(-7f * deltaTime));
        }

        private void Defeat()
        {
            if (_defeated) return;
            _defeated = true;
            ClearFactionBrawlVisual();
            if (_controller != null) _controller.enabled = false;
            if (_renderers != null)
            {
                foreach (Renderer renderer in _renderers)
                    if (renderer != null) renderer.enabled = false;
            }

            if (GameSession.Current != null)
            {
                GameSession.Current.Kills++;
                GameSession.Current.Score += _profile != null && _profile.IsBoss ? 100 : 10;
                if (_profile != null && _profile.IsBoss) GameSession.Current.BossesDefeated++;
            }
            if (GameSession.Current != null && GameSession.Current.Mode == GameMode.Survival)
            {
                SurvivalProgressionController progression = GetComponentInParent<SurvivalProgressionController>();
                progression?.OnEnemyDefeated(this);
            }
            else if (GameSession.Current != null && GameSession.Current.Mode == GameMode.Campaign)
            {
                CampaignMissionDirector campaign = GetComponentInParent<CampaignMissionDirector>();
                campaign?.OnEnemyDefeated(this);
            }
            Destroy(gameObject, 0.06f);
        }

        private void UpdateHitFlash(float deltaTime)
        {
            if (_hitFlashTimer <= 0f) return;
            _hitFlashTimer -= deltaTime;
            SetHitTint(_hitFlashTimer > 0f);
        }

        private void SetHitTint(bool active)
        {
            if (_renderers == null) return;
            Color tint = active
                ? (_factionBrawlTint ? new Color(0.86f, 0.30f, 0.94f, 1f) : new Color(1f, 0.48f, 0.32f, 1f))
                : (_factionBrawlTint ? new Color(0.72f, 0.30f, 0.84f, 1f)
                    : (_supportShieldRemaining > 0f ? new Color(0.42f, 0.76f, 1f, 1f) : Color.white));
            foreach (Renderer renderer in _renderers)
            {
                if (renderer == null) continue;
                renderer.GetPropertyBlock(_propertyBlock);
                _propertyBlock.SetColor(BaseColorId, tint);
                _propertyBlock.SetColor(ColorId, tint);
                renderer.SetPropertyBlock(_propertyBlock);
            }
        }
    }
}
