using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    [RequireComponent(typeof(Rigidbody))]
    public sealed class CombatProjectile : MonoBehaviour
    {
        private float _damage;
        private float _lifeSeconds;

        public void Initialize(float damage, float lifeSeconds)
        {
            _damage = Mathf.Max(0.1f, damage);
            _lifeSeconds = Mathf.Clamp(lifeSeconds, 0.1f, 6f);
        }

        private void Update()
        {
            _lifeSeconds -= Time.deltaTime;
            if (_lifeSeconds <= 0f) Destroy(gameObject);
        }

        private void OnTriggerEnter(Collider other)
        {
            EnemyAgent enemy = other.GetComponentInParent<EnemyAgent>();
            if (enemy == null) return;
            enemy.ApplyDamage(_damage);
            Destroy(gameObject);
        }
    }
}
