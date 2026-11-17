using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    /// <summary>Readable low-poly guided missile with a visible exhaust and bounded splash damage.</summary>
    public sealed class OperatorHomingRocket : MonoBehaviour
    {
        private EnemyAgent _target;
        private Vector3 _direction;
        private float _damage;
        private float _speed;
        private float _turnRate;
        private float _blastRadius;
        private float _life;
        private float _retargetRemaining;
        private bool _detonated;
        private Transform _exhaustGlow;
        private Transform _exhaustCore;
        private TrailRenderer _trail;

        private static Material _bodyMaterial;
        private static Material _accentMaterial;
        private static Material _flameMaterial;
        private static Material _metalMaterial;

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

            CreatePart(PrimitiveType.Capsule, "Rocket armored body", new Vector3(0f, 0f, -0.02f),
                new Vector3(0.18f, 0.62f, 0.18f), _bodyMaterial, Quaternion.Euler(90f, 0f, 0f));
            CreatePart(PrimitiveType.Sphere, "Rocket reinforced nose", new Vector3(0f, 0f, 0.34f),
                new Vector3(0.18f, 0.22f, 0.18f), _accentMaterial);
            CreatePart(PrimitiveType.Cylinder, "Rocket nose band", new Vector3(0f, 0f, 0.17f),
                new Vector3(0.19f, 0.045f, 0.19f), _metalMaterial, Quaternion.Euler(90f, 0f, 0f));
            CreatePart(PrimitiveType.Cylinder, "Rocket exhaust nozzle", new Vector3(0f, 0f, -0.38f),
                new Vector3(0.22f, 0.12f, 0.22f), _metalMaterial, Quaternion.Euler(90f, 0f, 0f));

            for (int i = 0; i < 4; i++)
            {
                float angle = i * 90f;
                Vector3 offset = Quaternion.Euler(0f, 0f, angle) * new Vector3(0.13f, 0f, -0.25f);
                CreatePart(PrimitiveType.Cube, "Rocket stabilizer " + (i + 1), offset,
                    new Vector3(0.055f, 0.22f, 0.24f), _accentMaterial, Quaternion.Euler(0f, 0f, angle));
            }

            GameObject exhaust = new GameObject("Rocket pulsing exhaust");
            exhaust.transform.SetParent(transform, false);
            exhaust.transform.localPosition = new Vector3(0f, 0f, -0.49f);
            _exhaustGlow = exhaust.transform;
            GameObject core = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            core.name = "Rocket hot core";
            core.transform.SetParent(transform, false);
            core.transform.localPosition = new Vector3(0f, 0f, -0.51f);
            core.transform.localScale = Vector3.one * 0.095f;
            Collider coreCollider = core.GetComponent<Collider>();
            if (coreCollider != null) Destroy(coreCollider);
            Renderer coreRenderer = core.GetComponent<Renderer>();
            if (coreRenderer != null) coreRenderer.sharedMaterial = _flameMaterial;
            _exhaustCore = core.transform;
            GameObject glow = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            glow.name = "Rocket exhaust glow";
            glow.transform.SetParent(exhaust.transform, false);
            glow.transform.localScale = new Vector3(0.16f, 0.16f, 0.28f);
            Collider glowCollider = glow.GetComponent<Collider>();
            if (glowCollider != null) Destroy(glowCollider);
            Renderer glowRenderer = glow.GetComponent<Renderer>();
            if (glowRenderer != null) glowRenderer.sharedMaterial = _accentMaterial;

            SphereCollider collider = gameObject.AddComponent<SphereCollider>();
            collider.isTrigger = true;
            collider.radius = 0.24f;
            Rigidbody body = gameObject.AddComponent<Rigidbody>();
            body.isKinematic = true;
            body.useGravity = false;
            body.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;

            _trail = gameObject.AddComponent<TrailRenderer>();
            _trail.time = 0.34f;
            _trail.minVertexDistance = 0.055f;
            _trail.startWidth = 0.15f;
            _trail.endWidth = 0.008f;
            _trail.material = _accentMaterial;
            _trail.startColor = new Color(color.r, color.g, color.b, 0.95f);
            _trail.endColor = new Color(color.r, color.g, color.b, 0f);
            _trail.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            _trail.receiveShadows = false;
        }

        private void Update()
        {
            if (_detonated) return;
            float dt = Time.deltaTime;
            _life -= dt;
            if (_target == null || _target.IsDefeated)
            {
                _retargetRemaining = Mathf.Max(0f, _retargetRemaining - dt);
                if (_retargetRemaining <= 0f)
                {
                    _target = FindClosestTarget(28f);
                    // When the arena is empty, wait briefly before another broadphase scan.
                    _retargetRemaining = _target != null ? 0.12f : 0.20f;
                }
            }
            if (_target != null)
            {
                Vector3 aim = _target.transform.position + Vector3.up * 0.62f - transform.position;
                if (aim.sqrMagnitude > 0.01f)
                    _direction = Vector3.RotateTowards(_direction, aim.normalized, _turnRate * dt, 0f).normalized;
            }

            transform.position += _direction * (_speed * dt);
            if (_direction.sqrMagnitude > 0.001f) transform.rotation = Quaternion.LookRotation(_direction);
            float pulse = 0.84f + Mathf.Sin(Time.time * 38f + transform.position.x * 0.7f) * 0.18f;
            if (_exhaustGlow != null) _exhaustGlow.localScale = new Vector3(1f, 1f, pulse);
            if (_exhaustCore != null) _exhaustCore.localScale = Vector3.one * (0.085f + pulse * 0.035f);

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
            if (_trail != null)
            {
                _trail.emitting = false;
                _trail.Clear();
            }

            Vector3 center = transform.position;
            foreach (EnemyAgent enemy in EnemyAgent.GetCachedAgents())
            {
                if (enemy == null || enemy.IsDefeated) continue;
                Vector3 offset = enemy.transform.position - center;
                float distance = offset.magnitude;
                if (distance > _blastRadius) continue;
                Vector3 push = distance > 0.01f ? offset / distance : _direction;
                float falloff = Mathf.Lerp(1f, 0.58f, Mathf.Clamp01(distance / _blastRadius));
                enemy.ApplyCombatHit(_damage * falloff, 0.26f, 0f, 1f, push * 2.8f);
            }

            OperatorImpactBurst.Spawn(transform.parent, center, new Color(0.22f, 0.92f, 0.58f), _blastRadius);
            foreach (Renderer renderer in GetComponentsInChildren<Renderer>())
                if (renderer != null) renderer.enabled = false;
            Collider ownCollider = GetComponent<Collider>();
            if (ownCollider != null) ownCollider.enabled = false;
            Destroy(gameObject, 0.04f);
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
            if (_bodyMaterial != null && _accentMaterial != null && _flameMaterial != null && _metalMaterial != null) return;
            Shader shader = Shader.Find("Universal Render Pipeline/Lit");
            if (shader == null) shader = Shader.Find("Standard");
            if (shader == null) return;
            if (_bodyMaterial == null) _bodyMaterial = new Material(shader)
                { color = new Color(0.15f, 0.20f, 0.27f), metallic = 0.82f, smoothness = 0.78f, enableInstancing = true };
            if (_accentMaterial == null) _accentMaterial = new Material(shader)
                { color = accent, metallic = 0.42f, smoothness = 0.68f, enableInstancing = true };
            if (_flameMaterial == null) _flameMaterial = new Material(shader)
                { color = new Color(0.44f, 0.95f, 1f), enableInstancing = true };
            if (_metalMaterial == null) _metalMaterial = new Material(shader)
                { color = new Color(0.60f, 0.69f, 0.78f), metallic = 0.90f, smoothness = 0.82f, enableInstancing = true };
        }
    }
}
