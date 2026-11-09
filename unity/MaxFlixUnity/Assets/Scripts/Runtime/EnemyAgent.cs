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
        private Renderer[] _renderers;
        private MaterialPropertyBlock _propertyBlock;
        private static readonly int BaseColorId = Shader.PropertyToID("_BaseColor");
        private static readonly int ColorId = Shader.PropertyToID("_Color");

        public bool IsDefeated { get { return _defeated; } }
        public EnemyKind Kind { get { return _profile != null ? _profile.Id : EnemyKind.Customer; } }
        public float CurrentHealth { get { return _health; } }
        public float MaxHealth { get { return _maxHealth; } }

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

            float actualDamage = Mathf.Min(_health, balancedDamage);
            _health -= balancedDamage;
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
            if (_defeated || _target == null || _target.IsDefeated || _profile == null) return;

            float deltaTime = Time.deltaTime;
            _attackTimer -= deltaTime;
            _stunRemaining = Mathf.Max(0f, _stunRemaining - deltaTime);
            _slowRemaining = Mathf.Max(0f, _slowRemaining - deltaTime);
            _supportShieldRemaining = Mathf.Max(0f, _supportShieldRemaining - deltaTime);
            if (_slowRemaining <= 0f) _slowMultiplier = 1f;

            if (_knockbackVelocity.sqrMagnitude > 0.01f)
            {
                Move(_knockbackVelocity, deltaTime);
                _knockbackVelocity = Vector3.MoveTowards(_knockbackVelocity, Vector3.zero, 18f * deltaTime);
            }

            if (_stunRemaining > 0f)
            {
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

            if (_attackTimer <= 0f)
            {
                _target.ApplyDamage(_attackDamage);
                _attackTimer = _attackInterval / _abilityRateMultiplier;
            }
        }

        private void TickRanged(float deltaTime, Vector3 direction, float distance)
        {
            float preferredRange = _attackRange;
            if (distance > preferredRange * 1.12f)
                Move(direction * (_moveSpeed * _slowMultiplier), deltaTime);
            else if (distance < preferredRange * 0.58f)
                Move(-direction * (_moveSpeed * 0.72f * _slowMultiplier), deltaTime);
            else
            {
                Vector3 strafe = Vector3.Cross(Vector3.up, direction) * _patrolDirection;
                Move(strafe * (_moveSpeed * 0.34f * _slowMultiplier), deltaTime);
            }

            Face(direction, deltaTime);
            if (_attackTimer <= 0f)
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
            EnemyAgent[] allies = FindObjectsByType<EnemyAgent>(FindObjectsSortMode.None);
            int shielded = 0;
            foreach (EnemyAgent ally in allies)
            {
                if (ally == null || ally == this || ally.IsDefeated) continue;
                if ((ally.transform.position - transform.position).sqrMagnitude > 6.5f * 6.5f) continue;
                ally.GrantSupportShield(2.3f);
                shielded++;
            }

            if (shielded == 0) FireRangedAttack(direction);
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
                if (offset.sqrMagnitude <= (_attackRange + 0.5f) * (_attackRange + 0.5f))
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
            GameObject shot = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            shot.name = _profile.DisplayName + " attack";
            shot.transform.position = origin;
            shot.transform.localScale = Vector3.one * 0.34f;
            Collider collider = shot.GetComponent<Collider>();
            if (collider != null) collider.isTrigger = true;
            Rigidbody body = shot.AddComponent<Rigidbody>();
            body.useGravity = false;
            EnemyAttackProjectile attack = shot.AddComponent<EnemyAttackProjectile>();
            attack.Initialize(_target, _attackDamage, aim.normalized, 10.5f, _profile.AccentColor);
        }

        private void Move(Vector3 horizontalVelocity, float deltaTime)
        {
            if (_controller == null) return;
            Vector3 velocity = horizontalVelocity;
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
                ? new Color(1f, 0.48f, 0.32f, 1f)
                : (_supportShieldRemaining > 0f ? new Color(0.42f, 0.76f, 1f, 1f) : Color.white);
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
