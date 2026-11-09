using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    [RequireComponent(typeof(CharacterController))]
    public sealed class EnemyAgent : MonoBehaviour
    {
        [SerializeField] private float moveSpeed = 2.6f;
        [SerializeField] private float attackDistance = 1.55f;
        [SerializeField] private float attackInterval = 1.4f;

        private CharacterController _controller;
        private PlayerController _target;
        private float _health = 5f;
        private float _attackTimer;
        private float _hitFlashTimer;
        private float _stunRemaining;
        private float _slowRemaining;
        private float _slowMultiplier = 1f;
        private Vector3 _knockbackVelocity;
        private bool _defeated;
        private Renderer[] _renderers;
        private MaterialPropertyBlock _propertyBlock;
        private static readonly int BaseColorId = Shader.PropertyToID("_BaseColor");
        private static readonly int ColorId = Shader.PropertyToID("_Color");

        public bool IsDefeated { get { return _defeated; } }

        public void Initialize(PlayerController target, float health = 5f)
        {
            _controller = GetComponent<CharacterController>();
            _target = target;
            _health = Mathf.Max(1f, health);
            _renderers = GetComponentsInChildren<Renderer>();
            _propertyBlock = new MaterialPropertyBlock();
        }

        public void ApplyDamage(float damage)
        {
            ApplyCombatHit(damage, 0f, 0f, 1f, Vector3.zero);
        }

        public void ApplyCombatHit(
            float damage,
            float stunSeconds,
            float slowSeconds,
            float slowMultiplier,
            Vector3 knockbackVelocity)
        {
            if (_defeated || float.IsNaN(damage) || float.IsInfinity(damage) || damage <= 0f) return;

            _health -= damage;
            _hitFlashTimer = 0.13f;
            _stunRemaining = Mathf.Max(_stunRemaining, Mathf.Clamp(stunSeconds, 0f, 3f));
            if (slowSeconds > _slowRemaining)
            {
                _slowRemaining = Mathf.Clamp(slowSeconds, 0f, 5f);
                _slowMultiplier = Mathf.Clamp(slowMultiplier, 0.15f, 1f);
            }
            _knockbackVelocity += Vector3.ClampMagnitude(knockbackVelocity, 12f);

            if (_health <= 0f)
            {
                _defeated = true;
                if (GameSession.Current != null) GameSession.Current.Kills++;
                Destroy(gameObject, 0.06f);
            }
        }

        private void Awake()
        {
            _controller = GetComponent<CharacterController>();
        }

        private void Update()
        {
            if (_defeated || _target == null || _target.IsDefeated) return;

            float deltaTime = Time.deltaTime;
            if (_controller == null) _controller = GetComponent<CharacterController>();

            if (_knockbackVelocity.sqrMagnitude > 0.01f)
            {
                _controller.Move(_knockbackVelocity * deltaTime);
                _knockbackVelocity = Vector3.MoveTowards(_knockbackVelocity, Vector3.zero, 18f * deltaTime);
            }

            if (_stunRemaining > 0f)
            {
                _stunRemaining = Mathf.Max(0f, _stunRemaining - deltaTime);
                UpdateHitFlash(deltaTime);
                return;
            }

            _slowRemaining = Mathf.Max(0f, _slowRemaining - deltaTime);
            if (_slowRemaining <= 0f) _slowMultiplier = 1f;

            Vector3 offset = _target.transform.position - transform.position;
            offset.y = 0f;
            float distance = offset.magnitude;
            if (distance > attackDistance && distance > 0.01f)
            {
                Vector3 direction = offset / distance;
                _controller.Move(direction * (moveSpeed * _slowMultiplier) * deltaTime);
                transform.rotation = Quaternion.Slerp(
                    transform.rotation,
                    Quaternion.LookRotation(direction),
                    1f - Mathf.Exp(-7f * deltaTime)
                );
            }
            else
            {
                _attackTimer -= deltaTime;
                if (_attackTimer <= 0f)
                {
                    _attackTimer = attackInterval;
                    _target.ApplyDamage(1f);
                }
            }

            UpdateHitFlash(deltaTime);
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
            Color tint = active ? new Color(1f, 0.48f, 0.32f, 1f) : Color.white;
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
