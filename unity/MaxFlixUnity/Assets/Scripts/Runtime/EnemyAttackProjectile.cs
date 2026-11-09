using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    [RequireComponent(typeof(Rigidbody), typeof(SphereCollider))]
    public sealed class EnemyAttackProjectile : MonoBehaviour
    {
        private static Material _sharedMaterial;
        private static readonly int BaseColorId = Shader.PropertyToID("_BaseColor");
        private static readonly int ColorId = Shader.PropertyToID("_Color");

        private Rigidbody _body;
        private PlayerController _target;
        private float _damage;
        private float _lifeRemaining = 4f;
        private MaterialPropertyBlock _propertyBlock;

        public void Initialize(PlayerController target, float damage, Vector3 direction, float speed, Color color)
        {
            _target = target;
            _damage = Mathf.Max(0.1f, damage);
            _body = GetComponent<Rigidbody>();
            _propertyBlock = new MaterialPropertyBlock();
            _body.useGravity = false;
            _body.isKinematic = false;
            _body.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;
            _body.velocity = direction.normalized * Mathf.Clamp(speed, 2f, 24f);

            SphereCollider sphere = GetComponent<SphereCollider>();
            sphere.isTrigger = true;
            sphere.radius = 0.42f;

            Renderer renderer = GetComponent<Renderer>();
            if (renderer != null)
            {
                if (_sharedMaterial == null)
                {
                    Shader shader = Shader.Find("Universal Render Pipeline/Lit");
                    if (shader == null) shader = Shader.Find("Standard");
                    _sharedMaterial = new Material(shader) { enableInstancing = true };
                }
                renderer.sharedMaterial = _sharedMaterial;
                renderer.GetPropertyBlock(_propertyBlock);
                _propertyBlock.SetColor(BaseColorId, color);
                _propertyBlock.SetColor(ColorId, color);
                renderer.SetPropertyBlock(_propertyBlock);
            }
        }

        private void Update()
        {
            _lifeRemaining -= Time.deltaTime;
            if (_lifeRemaining <= 0f) Destroy(gameObject);
        }

        private void OnTriggerEnter(Collider other)
        {
            PlayerController player = other.GetComponentInParent<PlayerController>();
            if (player != null)
            {
                if (player == _target) player.ApplyDamage(_damage);
                Destroy(gameObject);
                return;
            }

            if (other.GetComponentInParent<EnemyAgent>() != null) return;
            if (!other.isTrigger) Destroy(gameObject);
        }
    }
}
