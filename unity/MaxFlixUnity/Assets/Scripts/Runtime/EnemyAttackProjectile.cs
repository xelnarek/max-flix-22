using System.Collections.Generic;
using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    [RequireComponent(typeof(Rigidbody), typeof(SphereCollider))]
    public sealed class EnemyAttackProjectile : MonoBehaviour
    {
        private const int PoolLimit = 36;
        private const int DefaultPrewarmCount = 12;

        private static Material _sharedMaterial;
        private static readonly List<EnemyAttackProjectile> Pool = new List<EnemyAttackProjectile>(PoolLimit);
        private static Transform _poolRoot;
        private static readonly int BaseColorId = Shader.PropertyToID("_BaseColor");
        private static readonly int ColorId = Shader.PropertyToID("_Color");

        private Rigidbody _body;
        private SphereCollider _sphere;
        private PlayerController _target;
        private float _damage;
        private float _lifeRemaining;
        private MaterialPropertyBlock _propertyBlock;
        private bool _initialized;

        public static int PooledCount { get { return Pool.Count; } }

        public static void Prewarm(int requestedCount = DefaultPrewarmCount)
        {
            int count = Mathf.Clamp(requestedCount, 0, PoolLimit);
            while (Pool.Count < count)
            {
                EnemyAttackProjectile projectile = CreatePooledProjectile();
                if (projectile == null) break;
                projectile.gameObject.SetActive(false);
            }
        }

        public static void Spawn(PlayerController target, float damage, Vector3 position,
            Vector3 direction, float speed, Color color)
        {
            if (target == null || direction.sqrMagnitude < 0.0001f) return;
            EnemyAttackProjectile projectile = Acquire();
            if (projectile == null) return;
            projectile.Initialize(target, damage, position, direction, speed, color);
            projectile.gameObject.SetActive(true);
        }

        private static EnemyAttackProjectile Acquire()
        {
            for (int i = 0; i < Pool.Count; i++)
            {
                EnemyAttackProjectile projectile = Pool[i];
                if (projectile != null && !projectile.gameObject.activeSelf)
                    return projectile;
            }

            if (Pool.Count >= PoolLimit) return null;
            return CreatePooledProjectile();
        }

        private static EnemyAttackProjectile CreatePooledProjectile()
        {
            if (_poolRoot == null)
            {
                GameObject root = new GameObject("Enemy projectile pool");
                _poolRoot = root.transform;
            }

            GameObject instance = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            instance.name = "Pooled enemy attack projectile";
            instance.transform.SetParent(_poolRoot, false);
            instance.transform.localScale = Vector3.one * 0.34f;

            SphereCollider sphere = instance.GetComponent<SphereCollider>();
            if (sphere != null)
            {
                sphere.isTrigger = true;
                sphere.radius = 0.42f;
                sphere.enabled = false;
            }

            Rigidbody body = instance.AddComponent<Rigidbody>();
            body.useGravity = false;
            body.isKinematic = false;
            body.interpolation = RigidbodyInterpolation.Interpolate;
            body.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;

            EnemyAttackProjectile projectile = instance.AddComponent<EnemyAttackProjectile>();
            projectile._body = body;
            projectile._sphere = sphere;
            projectile._propertyBlock = new MaterialPropertyBlock();

            Renderer renderer = instance.GetComponent<Renderer>();
            if (renderer != null)
            {
                if (_sharedMaterial == null)
                {
                    Shader shader = Shader.Find("Universal Render Pipeline/Lit");
                    if (shader == null) shader = Shader.Find("Standard");
                    if (shader != null) _sharedMaterial = new Material(shader) { enableInstancing = true };
                }
                if (_sharedMaterial != null) renderer.sharedMaterial = _sharedMaterial;
            }

            instance.SetActive(false);
            Pool.Add(projectile);
            return projectile;
        }

        private void Initialize(PlayerController target, float damage, Vector3 position,
            Vector3 direction, float speed, Color color)
        {
            if (_body == null) _body = GetComponent<Rigidbody>();
            if (_sphere == null) _sphere = GetComponent<SphereCollider>();
            if (_propertyBlock == null) _propertyBlock = new MaterialPropertyBlock();

            _target = target;
            _damage = Mathf.Max(0.1f, damage);
            _lifeRemaining = 4f;
            _initialized = true;

            transform.position = position;
            transform.rotation = Quaternion.LookRotation(direction.normalized, Vector3.up);
            if (_sphere != null) _sphere.enabled = true;

            _body.isKinematic = false;
            _body.useGravity = false;
            _body.detectCollisions = true;
            _body.velocity = direction.normalized * Mathf.Clamp(speed, 2f, 24f);
            _body.angularVelocity = Vector3.zero;

            Renderer renderer = GetComponent<Renderer>();
            if (renderer != null)
            {
                renderer.GetPropertyBlock(_propertyBlock);
                _propertyBlock.SetColor(BaseColorId, color);
                _propertyBlock.SetColor(ColorId, color);
                renderer.SetPropertyBlock(_propertyBlock);
            }
        }

        private void Update()
        {
            if (!_initialized || _target == null || GameSession.Current == null
                || GameSession.Current.State != GameFlowState.Playing) return;

            _lifeRemaining -= Time.deltaTime;
            if (_lifeRemaining <= 0f) ReturnToPool();
        }

        private void OnTriggerEnter(Collider other)
        {
            if (!_initialized || other == null) return;

            PlayerController player = other.GetComponentInParent<PlayerController>();
            if (player != null)
            {
                if (player == _target) player.ApplyDamage(_damage);
                ReturnToPool();
                return;
            }

            if (other.GetComponentInParent<EnemyAgent>() != null) return;
            if (!other.isTrigger) ReturnToPool();
        }

        private void ReturnToPool()
        {
            if (!_initialized) return;
            _initialized = false;
            _target = null;
            _damage = 0f;
            _lifeRemaining = 0f;

            if (_body != null)
            {
                _body.velocity = Vector3.zero;
                _body.angularVelocity = Vector3.zero;
                _body.detectCollisions = false;
                _body.Sleep();
            }
            if (_sphere != null) _sphere.enabled = false;
            gameObject.SetActive(false);
        }

        private void OnDestroy()
        {
            Pool.Remove(this);
            if (_poolRoot == null || _poolRoot.childCount != 0) return;
            Destroy(_poolRoot.gameObject);
            _poolRoot = null;
        }
    }
}
