using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    /// <summary>Lightweight homing missile for Grzesiek's 44cm Zagłady ability.</summary>
    public sealed class OperatorHomingRocket : MonoBehaviour
    {
        private EnemyAgent _target;
        private Vector3 _direction;
        private float _damage;
        private float _speed;
        private float _turnRate;
        private float _blastRadius;
        private float _life;
        private bool _detonated;
        private static Material _bodyMaterial;
        private static Material _accentMaterial;
        private static Material _flameMaterial;

        public static OperatorHomingRocket Spawn(Transform parent, Vector3 origin, Vector3 direction,
            EnemyAgent target, Color color, float damage, float speed, float turnRate, float blastRadius, float lifetime)
        {
            GameObject root = new GameObject("44cm homing rocket");
            if (parent != null) root.transform.SetParent(parent, true);
            root.transform.position = origin;
            root.transform.rotation = direction.sqrMagnitude > 0.001f ? Quaternion.LookRotation(direction.normalized) : Quaternion.identity;
            OperatorHomingRocket rocket = root.AddComponent<OperatorHomingRocket>();
            rocket.Initialize(direction, target, color, damage, speed, turnRate, blastRadius, lifetime);
            return rocket;
        }

        private void Initialize(Vector3 direction, EnemyAgent target, Color color, float damage,
            float speed, float turnRate, float blastRadius, float lifetime)
        {
            _direction = direction.sqrMagnitude > 0.001f ? direction.normalized : transform.forward;
            _target = target;
            _damage = Mathf.Clamp(damage, 0.25f, 5f);
            _speed = Mathf.Clamp(speed, 5f, 32f);
            _turnRate = Mathf.Clamp(turnRate, 1f, 12f);
            _blastRadius = Mathf.Clamp(blastRadius, 0.5f, 3.5f);
            _life = Mathf.Clamp(lifetime, 0.5f, 6f);
            EnsureMaterials(color);
            CreatePart(PrimitiveType.Capsule, "Rocket metal body", new Vector3(0f, 0f, -0.02f),
                new Vector3(0.18f, 0.55f, 0.18f), _bodyMaterial, Quaternion.Euler(90f, 0f, 0f));
            CreatePart(PrimitiveType.Sphere, "Rocket nose", new Vector3(0f, 0f, 0.34f),
                new Vector3(0.17f, 0.22f, 0.17f), _accentMaterial);
            CreatePart(PrimitiveType.Sphere, "Rocket exhaust", new Vector3(0f, 0f, -0.36f),
                new Vector3(0.12f, 0.12f, 0.18f), _flameMaterial);
            for (int i = 0; i < 3; i++)
            {
                float angle = i * 120f;
                Vector3 offset = Quaternion.Euler(0f, 0f, angle) * new Vector3(0.13f, 0f, -0.22f);
                CreatePart(PrimitiveType.Cube, "Rocket stabilizer", offset, new Vector3(0.055f, 0.20f, 0.20f),
                    _accentMaterial, Quaternion.Euler(0f, 0f, angle));
            }
            SphereCollider collider = gameObject.AddComponent<SphereCollider>();
            collider.isTrigger = true;
            collider.radius = 0.24f;
            Rigidbody body = gameObject.AddComponent<Rigidbody>();
            body.isKinematic = true;
            body.useGravity = false;
            body.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;
            TrailRenderer trail = gameObject.AddComponent<TrailRenderer>();
            trail.time = 0.22f;
            trail.minVertexDistance = 0.08f;
            trail.startWidth = 0.13f;
            trail.endWidth = 0.015f;
            trail.material = _accentMaterial;
            trail.startColor = new Color(color.r, color.g, color.b, 0.9f);
            trail.endColor = new Color(color.r, color.g, color.b, 0f);
            trail.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            trail.receiveShadows = false;
        }

        private void Update()
        {
            if (_detonated) return;
            float dt = Time.deltaTime;
            _life -= dt;
            if (_target == null || _target.IsDefeated) _target = FindClosestTarget(28f);
            if (_target != null)
            {
                Vector3 aim = _target.transform.position + Vector3.up * 0.62f - transform.position;
                if (aim.sqrMagnitude > 0.01f)
                    _direction = Vector3.RotateTowards(_direction, aim.normalized, _turnRate * dt, 0f).normalized;
            }
            transform.position += _direction * (_speed * dt);
            if (_direction.sqrMagnitude > 0.001f) transform.rotation = Quaternion.LookRotation(_direction);
            if (_target != null && Vector3.Distance(transform.position, _target.transform.position + Vector3.up * 0.62f) < 0.72f)
            {
                Detonate();
                return;
            }
            if (_life <= 0f) Destroy(gameObject);
        }

        private EnemyAgent FindClosestTarget(float range)
        {
            EnemyAgent closest = null;
            float best = range * range;
            foreach (EnemyAgent candidate in EnemyAgent.GetCachedAgents())
            {
                if (candidate == null || candidate.IsDefeated) continue;
                float sqrDistance = (candidate.transform.position - transform.position).sqrMagnitude;
                if (sqrDistance >= best) continue;
                best = sqrDistance;
                closest = candidate;
            }
            return closest;
        }

        private void OnTriggerEnter(Collider other)
        {
            if (_detonated) return;
            EnemyAgent hit = other.GetComponentInParent<EnemyAgent>();
            if (hit == null || hit.IsDefeated) return;
            _target = hit;
            Detonate();
        }

        private void Detonate()
        {
            if (_detonated) return;
            _detonated = true;
            Vector3 center = transform.position;
            foreach (EnemyAgent enemy in EnemyAgent.GetCachedAgents())
            {
                if (enemy == null || enemy.IsDefeated) continue;
                Vector3 offset = enemy.transform.position - center;
                float distance = offset.magnitude;
                if (distance > _blastRadius) continue;
                Vector3 push = distance > 0.01f ? offset / distance : _direction;
                float falloff = Mathf.Lerp(1f, 0.58f, Mathf.Clamp01(distance / _blastRadius));
                enemy.ApplyCombatHit(_damage * falloff, 0.22f, 0f, 1f, push * 2.5f);
            }
            GameObject flash = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            flash.name = "Rocket impact flash";
            flash.transform.position = center;
            flash.transform.localScale = Vector3.one * 0.36f;
            Collider flashCollider = flash.GetComponent<Collider>();
            if (flashCollider != null) Destroy(flashCollider);
            Renderer renderer = flash.GetComponent<Renderer>();
            if (renderer != null) renderer.sharedMaterial = _accentMaterial;
            Destroy(flash, 0.12f);
            Destroy(gameObject);
        }

        private void CreatePart(PrimitiveType type, string partName, Vector3 position, Vector3 scale,
            Material material, Quaternion? rotation = null)
        {
            GameObject part = GameObject.CreatePrimitive(type);
            part.name = partName;
            part.transform.SetParent(transform, false);
            part.transform.localPosition = position;
            part.transform.localScale = scale;
            if (rotation.HasValue) part.transform.localRotation = rotation.Value;
            Collider collider = part.GetComponent<Collider>();
            if (collider != null) Destroy(collider);
            Renderer renderer = part.GetComponent<Renderer>();
            if (renderer != null) renderer.sharedMaterial = material;
        }

        private static void EnsureMaterials(Color accent)
        {
            if (_bodyMaterial != null && _accentMaterial != null && _flameMaterial != null) return;
            Shader shader = Shader.Find("Universal Render Pipeline/Lit");
            if (shader == null) shader = Shader.Find("Standard");
            if (shader == null) return;
            if (_bodyMaterial == null) _bodyMaterial = new Material(shader)
                { color = new Color(0.15f, 0.20f, 0.27f), metallic = 0.78f, smoothness = 0.74f, enableInstancing = true };
            if (_accentMaterial == null) _accentMaterial = new Material(shader)
                { color = accent, metallic = 0.32f, smoothness = 0.62f, enableInstancing = true };
            if (_flameMaterial == null) _flameMaterial = new Material(shader)
                { color = new Color(0.35f, 0.88f, 1f), enableInstancing = true };
        }
    }
}
