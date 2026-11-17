using System.Collections.Generic;
using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    /// <summary>
    /// Small pooled-style visual footprint for the two operator skills.
    /// It creates one expanding ground ring, one flash core and four low-cost
    /// fragments; no colliders, rigidbodies, lights or per-fragment materials.
    /// </summary>
    public sealed class OperatorImpactBurst : MonoBehaviour
    {
        private static readonly Dictionary<int, Material> MaterialCache = new Dictionary<int, Material>();

        private Transform _ring;
        private Transform _core;
        private readonly List<Transform> _shards = new List<Transform>(4);
        private readonly List<Vector3> _directions = new List<Vector3>(4);
        private Mesh _ringMesh;
        private float _age;
        private float _life = 0.48f;
        private float _radius = 1.2f;

        public static void Spawn(Transform parent, Vector3 position, Color color, float radius)
        {
            GameObject root = new GameObject("Operator impact burst");
            if (parent != null) root.transform.SetParent(parent, true);
            root.transform.position = position;
            OperatorImpactBurst burst = root.AddComponent<OperatorImpactBurst>();
            burst.Initialize(color, radius);
        }

        private void Initialize(Color color, float radius)
        {
            _radius = Mathf.Clamp(radius, 0.5f, 3f);
            Material material = GetSharedMaterial(color);

            GameObject ringObject = new GameObject("Expanding impact ring");
            ringObject.transform.SetParent(transform, false);
            ringObject.transform.localPosition = new Vector3(0f, 0.055f, 0f);
            _ring = ringObject.transform;
            MeshFilter filter = ringObject.AddComponent<MeshFilter>();
            _ringMesh = BuildRingMesh();
            filter.sharedMesh = _ringMesh;
            MeshRenderer ringRenderer = ringObject.AddComponent<MeshRenderer>();
            ringRenderer.sharedMaterial = material;
            ringRenderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            ringRenderer.receiveShadows = false;
            _ring.localScale = new Vector3(0.08f, 1f, 0.08f);

            GameObject coreObject = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            coreObject.name = "Impact flash core";
            coreObject.transform.SetParent(transform, false);
            coreObject.transform.localPosition = new Vector3(0f, 0.28f, 0f);
            Collider coreCollider = coreObject.GetComponent<Collider>();
            if (coreCollider != null) Destroy(coreCollider);
            Renderer coreRenderer = coreObject.GetComponent<Renderer>();
            if (coreRenderer != null)
            {
                coreRenderer.sharedMaterial = material;
                coreRenderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                coreRenderer.receiveShadows = false;
            }
            _core = coreObject.transform;
            _core.localScale = Vector3.one * 0.08f;

            for (int i = 0; i < 4; i++)
            {
                GameObject shard = GameObject.CreatePrimitive(PrimitiveType.Cube);
                shard.name = "Impact fragment " + (i + 1);
                shard.transform.SetParent(transform, false);
                shard.transform.localPosition = Vector3.up * 0.22f;
                shard.transform.localScale = new Vector3(0.12f, 0.12f, 0.20f);
                Collider shardCollider = shard.GetComponent<Collider>();
                if (shardCollider != null) Destroy(shardCollider);
                Renderer renderer = shard.GetComponent<Renderer>();
                if (renderer != null)
                {
                    renderer.sharedMaterial = material;
                    renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                    renderer.receiveShadows = false;
                }
                _shards.Add(shard.transform);
                float angle = i * 90f + 45f;
                Vector3 direction = Quaternion.Euler(0f, angle, 0f) * new Vector3(1f, 0.42f, 0f);
                _directions.Add(direction.normalized);
            }
        }

        private void Update()
        {
            _age += Time.deltaTime;
            float t = Mathf.Clamp01(_age / _life);
            float eased = 1f - Mathf.Pow(1f - t, 2.2f);

            if (_ring != null)
                _ring.localScale = new Vector3(
                    Mathf.Lerp(0.08f, _radius * 2f, eased),
                    1f,
                    Mathf.Lerp(0.08f, _radius * 2f, eased));

            if (_core != null)
            {
                float flash = Mathf.Sin(t * Mathf.PI) * 0.72f;
                _core.localScale = Vector3.one * flash;
            }

            for (int i = 0; i < _shards.Count; i++)
            {
                Transform shard = _shards[i];
                if (shard == null) continue;
                Vector3 direction = _directions[i];
                shard.localPosition = Vector3.up * (0.20f + t * direction.y * 0.55f)
                    + new Vector3(direction.x, 0f, direction.z) * (t * t * _radius * 0.78f);
                shard.localRotation = Quaternion.Euler(t * (180f + i * 38f), t * (260f - i * 24f), t * (210f + i * 16f));
                float size = Mathf.Max(0.001f, (1f - t) * 0.13f);
                shard.localScale = new Vector3(size, size, size * 1.55f);
            }

            if (_age >= _life) Destroy(gameObject);
        }

        private void OnDestroy()
        {
            if (_ringMesh != null) Destroy(_ringMesh);
        }

        private static Material GetSharedMaterial(Color color)
        {
            Color32 rgba = color;
            int key = (rgba.r << 24) | (rgba.g << 16) | (rgba.b << 8) | rgba.a;
            if (MaterialCache.TryGetValue(key, out Material cached) && cached != null) return cached;

            Shader shader = Shader.Find("Universal Render Pipeline/Unlit");
            if (shader == null) shader = Shader.Find("Unlit/Color");
            if (shader == null) shader = Shader.Find("Standard");
            if (shader == null) return null;

            Material material = new Material(shader)
            {
                color = color,
                enableInstancing = true
            };
            if (material.HasProperty("_EmissionColor"))
            {
                material.EnableKeyword("_EMISSION");
                material.SetColor("_EmissionColor", color * 1.35f);
            }
            MaterialCache[key] = material;
            return material;
        }

        private static Mesh BuildRingMesh()
        {
            const int segments = 32;
            const int sides = 6;
            const float majorRadius = 0.5f;
            const float tubeRadius = 0.035f;
            Vector3[] vertices = new Vector3[(segments + 1) * (sides + 1)];
            Vector2[] uv = new Vector2[vertices.Length];
            int[] triangles = new int[segments * sides * 6];

            for (int i = 0; i <= segments; i++)
            {
                float u = (float)i / segments * Mathf.PI * 2f;
                for (int j = 0; j <= sides; j++)
                {
                    float v = (float)j / sides * Mathf.PI * 2f;
                    int index = i * (sides + 1) + j;
                    float radial = majorRadius + tubeRadius * Mathf.Cos(v);
                    vertices[index] = new Vector3(radial * Mathf.Cos(u), tubeRadius * Mathf.Sin(v), radial * Mathf.Sin(u));
                    uv[index] = new Vector2((float)i / segments, (float)j / sides);
                }
            }

            int triangleIndex = 0;
            for (int i = 0; i < segments; i++)
            {
                for (int j = 0; j < sides; j++)
                {
                    int a = i * (sides + 1) + j;
                    int b = a + sides + 1;
                    // Keep outward-facing winding so the low-poly torus remains visible
                    // with back-face culling enabled by the active render pipeline.
                    triangles[triangleIndex++] = a;
                    triangles[triangleIndex++] = a + 1;
                    triangles[triangleIndex++] = b;
                    triangles[triangleIndex++] = b;
                    triangles[triangleIndex++] = a + 1;
                    triangles[triangleIndex++] = b + 1;
                }
            }

            Mesh mesh = new Mesh { name = "Low-poly impact ring" };
            mesh.vertices = vertices;
            mesh.uv = uv;
            mesh.triangles = triangles;
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            return mesh;
        }
    }
}
