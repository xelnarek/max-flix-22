using System.Collections.Generic;
using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    [RequireComponent(typeof(Rigidbody))]
    public sealed class CombatProjectile : MonoBehaviour
    {
        private const int PoolLimitPerShape = 18;
        private static readonly PrimitiveType[] SupportedShapes =
        {
            PrimitiveType.Cube, PrimitiveType.Sphere, PrimitiveType.Cylinder, PrimitiveType.Capsule
        };
        private static readonly Dictionary<PrimitiveType, List<CombatProjectile>> Pools =
            new Dictionary<PrimitiveType, List<CombatProjectile>>();
        private static Transform _poolRoot;
        private static Material _sharedMaterial;
        private static readonly int BaseColorId = Shader.PropertyToID("_BaseColor");
        private static readonly int ColorId = Shader.PropertyToID("_Color");
        private static readonly int EmissionColorId = Shader.PropertyToID("_EmissionColor");

        private readonly HashSet<int> _hitTargets = new HashSet<int>();
        private Rigidbody _body;
        private Collider _collider;
        private Renderer _renderer;
        private MaterialPropertyBlock _propertyBlock;
        private Transform _owner;
        private PlayerController _ownerPlayer;
        private PrimitiveType _shape;
        private bool _countsForMateuszPassive;
        private bool _pooledActive;
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
        private int _ricochetsRemaining;
        private bool _returnToOwner;
        private bool _returning;
        private Vector3 _lastPosition;

        public static int PooledCount
        {
            get
            {
                int count = 0;
                foreach (List<CombatProjectile> items in Pools.Values) count += items.Count;
                return count;
            }
        }

        public static void Prewarm(int perShape = 3)
        {
            int count = Mathf.Clamp(perShape, 0, PoolLimitPerShape);
            foreach (PrimitiveType shape in SupportedShapes)
            {
                List<CombatProjectile> items = GetPool(shape);
                while (items.Count < count)
                {
                    if (CreatePooled(shape) == null) break;
                }
            }
        }

        public static CombatProjectile Spawn(
            PrimitiveType shape, Transform owner, Vector3 origin, Vector3 direction, Color color,
            float damage, float lifeSeconds, float speed, int pierce, float stunSeconds,
            float slowSeconds, float slowMultiplier, float knockback, bool returnToOwner,
            float maxRange, bool countsForMateuszPassive = false, int ricochets = 0)
        {
            if (direction.sqrMagnitude < 0.0001f) return null;
            CombatProjectile projectile = Acquire(shape);
            if (projectile == null) return null;

            Vector3 normalizedDirection = direction.normalized;
            projectile.transform.position = origin;
            projectile.transform.rotation = Quaternion.LookRotation(normalizedDirection, Vector3.up);
            projectile.transform.localScale = GetShapeScale(shape);
            projectile.ApplyColor(color);
            projectile.Initialize(damage, lifeSeconds, owner, speed, pierce, stunSeconds,
                slowSeconds, slowMultiplier, knockback, returnToOwner, maxRange,
                countsForMateuszPassive, ricochets);

            projectile._body.detectCollisions = true;
            projectile._body.isKinematic = false;
            projectile._body.useGravity = false;
            projectile._body.velocity = normalizedDirection * projectile._speed;
            projectile._body.angularVelocity = Vector3.zero;
            if (projectile._collider != null) projectile._collider.enabled = true;
            projectile._pooledActive = true;
            projectile.gameObject.SetActive(true);
            return projectile;
        }

        private static CombatProjectile Acquire(PrimitiveType shape)
        {
            List<CombatProjectile> items = GetPool(shape);
            for (int i = 0; i < items.Count; i++)
            {
                CombatProjectile projectile = items[i];
                if (projectile != null && !projectile.gameObject.activeSelf) return projectile;
            }

            if (items.Count >= PoolLimitPerShape) return null;
            return CreatePooled(shape);
        }

        private static List<CombatProjectile> GetPool(PrimitiveType shape)
        {
            if (!Pools.TryGetValue(shape, out List<CombatProjectile> items))
            {
                items = new List<CombatProjectile>(PoolLimitPerShape);
                Pools.Add(shape, items);
            }
            return items;
        }

        private static CombatProjectile CreatePooled(PrimitiveType shape)
        {
            if (_poolRoot == null)
            {
                GameObject root = new GameObject("Operator projectile pool");
                _poolRoot = root.transform;
            }

            GameObject instance = GameObject.CreatePrimitive(shape);
            instance.name = "Pooled operator projectile • " + shape;
            instance.transform.SetParent(_poolRoot, false);
            instance.transform.localScale = GetShapeScale(shape);

            Collider hitbox = instance.GetComponent<Collider>();
            if (hitbox != null)
            {
                hitbox.isTrigger = true;
                hitbox.enabled = false;
            }

            Rigidbody body = instance.AddComponent<Rigidbody>();
            body.useGravity = false;
            body.detectCollisions = false;
            body.interpolation = RigidbodyInterpolation.Interpolate;
            body.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;

            CombatProjectile projectile = instance.AddComponent<CombatProjectile>();
            projectile._body = body;
            projectile._collider = hitbox;
            projectile._renderer = instance.GetComponent<Renderer>();
            projectile._propertyBlock = new MaterialPropertyBlock();
            projectile._shape = shape;

            if (_sharedMaterial == null)
            {
                Shader shader = Shader.Find("Universal Render Pipeline/Lit");
                if (shader == null) shader = Shader.Find("Standard");
                if (shader != null)
                {
                    _sharedMaterial = new Material(shader) { enableInstancing = true };
                    if (_sharedMaterial.HasProperty(EmissionColorId)) _sharedMaterial.EnableKeyword("_EMISSION");
                }
            }
            if (projectile._renderer != null && _sharedMaterial != null)
                projectile._renderer.sharedMaterial = _sharedMaterial;

            instance.SetActive(false);
            GetPool(shape).Add(projectile);
            return projectile;
        }

        private static Vector3 GetShapeScale(PrimitiveType shape)
        {
            switch (shape)
            {
                case PrimitiveType.Cylinder: return new Vector3(0.22f, 0.22f, 0.48f);
                case PrimitiveType.Cube: return new Vector3(0.22f, 0.22f, 0.32f);
                case PrimitiveType.Capsule: return new Vector3(0.18f, 0.30f, 0.18f);
                default: return Vector3.one * 0.22f;
            }
        }

        private void ApplyColor(Color color)
        {
            if (_renderer == null) return;
            if (_propertyBlock == null) _propertyBlock = new MaterialPropertyBlock();
            _renderer.GetPropertyBlock(_propertyBlock);
            _propertyBlock.SetColor(BaseColorId, color);
            _propertyBlock.SetColor(ColorId, color);
            _propertyBlock.SetColor(EmissionColorId, color * 1.35f);
            _renderer.SetPropertyBlock(_propertyBlock);
        }

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
            bool countsForMateuszPassive = false,
            int ricochets = 0)
        {
            if (_body == null) _body = GetComponent<Rigidbody>();
            _owner = owner;
            _ownerPlayer = owner != null ? owner.GetComponent<PlayerController>() : null;
            _countsForMateuszPassive = countsForMateuszPassive;
            _damage = Mathf.Max(0.1f, damage);
            _lifeSeconds = Mathf.Clamp(lifeSeconds, 0.1f, 8f);
            _speed = Mathf.Clamp(speed, 1f, 40f);
            _pierceRemaining = Mathf.Max(0, pierce);
            _ricochetsRemaining = Mathf.Clamp(ricochets, 0, 4);
            _stunSeconds = Mathf.Clamp(stunSeconds, 0f, 3f);
            _slowSeconds = Mathf.Clamp(slowSeconds, 0f, 5f);
            _slowMultiplier = Mathf.Clamp(slowMultiplier, 0.15f, 1f);
            _knockback = Mathf.Clamp(knockback, 0f, 12f);
            _returnToOwner = returnToOwner;
            _returning = false;
            _maxRange = Mathf.Clamp(maxRange, 1f, 60f);
            _travelled = 0f;
            _lastPosition = transform.position;
            _hitTargets.Clear();
            if (_body != null)
            {
                _body.useGravity = false;
                _body.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;
            }
        }

        private void Update()
        {
            if (!_pooledActive || GameSession.Current == null
                || GameSession.Current.State != GameFlowState.Playing) return;

            float deltaTime = Time.deltaTime;
            _lifeSeconds -= deltaTime;
            if (_lifeSeconds <= 0f)
            {
                ReturnToPool();
                return;
            }

            if (_returning)
            {
                if (_owner == null)
                {
                    ReturnToPool();
                    return;
                }

                Vector3 toOwner = _owner.position + Vector3.up * 0.9f - transform.position;
                if (toOwner.sqrMagnitude <= 1.05f * 1.05f)
                {
                    ReturnToPool();
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
            if (!_pooledActive || other == null) return;

            PlayerController player = other.GetComponentInParent<PlayerController>();
            if (player != null)
            {
                if (_returning && player.transform == _owner) ReturnToPool();
                return;
            }

            EnemyAgent enemy = other.GetComponentInParent<EnemyAgent>();
            if (enemy == null || enemy.IsDefeated)
            {
                if (_ricochetsRemaining > 0 && !other.isTrigger && _body != null)
                {
                    Vector3 surface = other.ClosestPoint(transform.position);
                    Vector3 normal = transform.position - surface;
                    if (normal.sqrMagnitude < 0.001f) normal = -_body.velocity.normalized;
                    _body.velocity = Vector3.Reflect(_body.velocity, normal.normalized).normalized * _speed;
                    _ricochetsRemaining--;
                }
                else if (!other.isTrigger && !other.CompareTag("MainCamera"))
                {
                    ReturnToPool();
                }
                return;
            }

            int targetId = enemy.GetInstanceID();
            if (!_hitTargets.Add(targetId)) return;

            Vector3 direction = _body != null && _body.velocity.sqrMagnitude > 0.01f
                ? _body.velocity.normalized
                : transform.forward;
            enemy.ApplyCombatHit(_damage, _stunSeconds, _slowSeconds, _slowMultiplier, direction * _knockback);
            if (_countsForMateuszPassive && _ownerPlayer != null) _ownerPlayer.RecordPrimaryHit();

            if (_ricochetsRemaining > 0 && _body != null)
            {
                Vector3 normal = transform.position - enemy.transform.position;
                normal.y = 0f;
                if (normal.sqrMagnitude < 0.001f) normal = -_body.velocity;
                _body.velocity = Vector3.Reflect(_body.velocity, normal.normalized).normalized * _speed;
                _ricochetsRemaining--;
                return;
            }

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

            ReturnToPool();
        }

        private void BeginReturn()
        {
            if (_returning) return;
            if (_owner == null)
            {
                ReturnToPool();
                return;
            }

            _returning = true;
            Vector3 direction = _owner.position + Vector3.up * 0.9f - transform.position;
            _body.velocity = direction.normalized * _speed;
        }

        private void ReturnToPool()
        {
            if (!_pooledActive) return;
            _pooledActive = false;
            _owner = null;
            _ownerPlayer = null;
            _damage = 0f;
            _lifeSeconds = 0f;
            _travelled = 0f;
            _returning = false;
            _returnToOwner = false;
            _hitTargets.Clear();

            if (_body != null)
            {
                _body.velocity = Vector3.zero;
                _body.angularVelocity = Vector3.zero;
                _body.detectCollisions = false;
                _body.Sleep();
            }
            if (_collider != null) _collider.enabled = false;
            gameObject.SetActive(false);
        }

        private void OnDestroy()
        {
            if (Pools.TryGetValue(_shape, out List<CombatProjectile> items))
                items.Remove(this);
        }
    }
}
