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
        private Renderer[] _renderers;
        private MaterialPropertyBlock _propertyBlock;
        private static readonly int BaseColorId = Shader.PropertyToID("_BaseColor");
        private static readonly int ColorId = Shader.PropertyToID("_Color");

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
            if (float.IsNaN(damage) || float.IsInfinity(damage) || damage <= 0f) return;
            _health -= damage;
            _hitFlashTimer = 0.13f;
            if (_health <= 0f)
            {
                if (GameSession.Current != null) GameSession.Current.Kills++;
                Destroy(gameObject, 0.06f);
            }
        }

        private void Update()
        {
            if (_target == null || _target.IsDefeated) return;

            Vector3 offset = _target.transform.position - transform.position;
            offset.y = 0f;
            float distance = offset.magnitude;
            if (distance > attackDistance && distance > 0.01f)
            {
                Vector3 direction = offset / distance;
                _controller.Move(direction * moveSpeed * Time.deltaTime);
                transform.rotation = Quaternion.Slerp(
                    transform.rotation,
                    Quaternion.LookRotation(direction),
                    1f - Mathf.Exp(-7f * Time.deltaTime)
                );
            }
            else
            {
                _attackTimer -= Time.deltaTime;
                if (_attackTimer <= 0f)
                {
                    _attackTimer = attackInterval;
                    _target.ApplyDamage(1f);
                }
            }

            if (_hitFlashTimer > 0f)
            {
                _hitFlashTimer -= Time.deltaTime;
                SetHitTint(_hitFlashTimer > 0f);
            }
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
