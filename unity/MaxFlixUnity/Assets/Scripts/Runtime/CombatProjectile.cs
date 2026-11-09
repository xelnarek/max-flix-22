using System.Collections.Generic;
using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    [RequireComponent(typeof(Rigidbody))]
    public sealed class CombatProjectile : MonoBehaviour
    {
        private readonly HashSet<int> _hitTargets = new HashSet<int>();
        private Rigidbody _body;
        private Transform _owner;
        private PlayerController _ownerPlayer;
        private bool _countsForMateuszPassive;
        private float _damage;
        private float _lifeSeconds;
        private float _speed;
        private float _stunSeconds;
        private float _slowSeconds;
        private float _slowMultiplier = 1f;
        private float _knockback;
        private float _maxRange;
        private float _travelled;
        private int _pierceRemaining;
        private bool _returnToOwner;
        private bool _returning;
        private Vector3 _lastPosition;

        public void Initialize(float damage, float lifeSeconds)
        {
            Initialize(damage, lifeSeconds, null, 16f, 0, 0f, 0f, 1f, 0f, false, 100f);
        }

        public void Initialize(
            float damage,
            float lifeSeconds,
            Transform owner,
            float speed,
            int pierce,
            float stunSeconds,
            float slowSeconds,
            float slowMultiplier,
            float knockback,
            bool returnToOwner,
            float maxRange,
            bool countsForMateuszPassive = false)
        {
            _body = GetComponent<Rigidbody>();
            _owner = owner;
            _ownerPlayer = owner != null ? owner.GetComponent<PlayerController>() : null;
            _countsForMateuszPassive = countsForMateuszPassive;
            _damage = Mathf.Max(0.1f, damage);
            _lifeSeconds = Mathf.Clamp(lifeSeconds, 0.1f, 8f);
            _speed = Mathf.Clamp(speed, 1f, 40f);
            _pierceRemaining = Mathf.Max(0, pierce);
            _stunSeconds = Mathf.Clamp(stunSeconds, 0f, 3f);
            _slowSeconds = Mathf.Clamp(slowSeconds, 0f, 5f);
            _slowMultiplier = Mathf.Clamp(slowMultiplier, 0.15f, 1f);
            _knockback = Mathf.Clamp(knockback, 0f, 12f);
            _returnToOwner = returnToOwner;
            _maxRange = Mathf.Clamp(maxRange, 1f, 60f);
            _lastPosition = transform.position;
            if (_body != null)
            {
                _body.useGravity = false;
                _body.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;
            }
        }

        private void Update()
        {
            float deltaTime = Time.deltaTime;
            _lifeSeconds -= deltaTime;
            if (_lifeSeconds <= 0f)
            {
                Destroy(gameObject);
                return;
            }

            if (_returning)
            {
                if (_owner == null)
                {
                    Destroy(gameObject);
                    return;
                }

                Vector3 toOwner = _owner.position + Vector3.up * 0.9f - transform.position;
                if (toOwner.sqrMagnitude <= 1.05f * 1.05f)
                {
                    Destroy(gameObject);
                    return;
                }
                _body.velocity = toOwner.normalized * _speed;
            }
            else if (_returnToOwner)
            {
                _travelled += Vector3.Distance(transform.position, _lastPosition);
                if (_travelled >= _maxRange) BeginReturn();
            }

            _lastPosition = transform.position;
        }

        private void OnTriggerEnter(Collider other)
        {
            PlayerController player = other.GetComponentInParent<PlayerController>();
            if (player != null)
            {
                if (_returning && player.transform == _owner) Destroy(gameObject);
                return;
            }

            EnemyAgent enemy = other.GetComponentInParent<EnemyAgent>();
            if (enemy == null || enemy.IsDefeated) return;

            int targetId = enemy.GetInstanceID();
            if (!_hitTargets.Add(targetId)) return;

            Vector3 direction = _body != null && _body.velocity.sqrMagnitude > 0.01f
                ? _body.velocity.normalized
                : transform.forward;
            enemy.ApplyCombatHit(_damage, _stunSeconds, _slowSeconds, _slowMultiplier, direction * _knockback);
            if (_countsForMateuszPassive && _ownerPlayer != null) _ownerPlayer.RecordPrimaryHit();

            if (_pierceRemaining > 0)
            {
                _pierceRemaining--;
                return;
            }

            if (_returnToOwner && !_returning)
            {
                BeginReturn();
                return;
            }

            Destroy(gameObject);
        }

        private void BeginReturn()
        {
            if (_returning) return;
            if (_owner == null)
            {
                Destroy(gameObject);
                return;
            }

            _returning = true;
            Vector3 direction = _owner.position + Vector3.up * 0.9f - transform.position;
            _body.velocity = direction.normalized * _speed;
        }
    }
}
