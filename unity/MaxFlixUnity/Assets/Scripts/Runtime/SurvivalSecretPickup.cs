using System.Collections.Generic;
using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    /// <summary>
    /// World-space pickup for one of the five stable secrets in every Survival
    /// biome. Each object owns one trigger; its low-poly prop is collider-free.
    /// </summary>
    [RequireComponent(typeof(SphereCollider))]
    public sealed class SurvivalSecretPickup : MonoBehaviour
    {
        private static readonly Dictionary<long, Material> Materials = new Dictionary<long, Material>();
        private static readonly int BaseColorId = Shader.PropertyToID("_BaseColor");
        private static readonly int ColorId = Shader.PropertyToID("_Color");
        private static readonly int EmissionId = Shader.PropertyToID("_EmissionColor");

        private SurvivalSecretDefinition _definition;
        private WarehouseMapId _mapId;
        private Transform _visualRoot;
        private bool _collected;
        private float _age;

        public void Initialize(WarehouseMapId mapId, SurvivalSecretDefinition definition)
        {
            _mapId = mapId;
            _definition = definition;
            SphereCollider trigger = GetComponent<SphereCollider>();
            trigger.isTrigger = true;
            trigger.radius = 1.35f;
            trigger.center = new Vector3(0f, 0.9f, 0f);

            _visualRoot = new GameObject("Visual • " + definition.Id).transform;
            _visualRoot.SetParent(transform, false);
            BuildVisual(definition.Style);
        }

        private void Update()
        {
            if (_collected || _visualRoot == null) return;
            _age += Time.deltaTime;
            _visualRoot.localPosition = new Vector3(0f, 0.10f + Mathf.Sin(_age * 2.2f) * 0.09f, 0f);
            _visualRoot.Rotate(Vector3.up, Time.deltaTime * (_definition.Style == SurvivalSecretStyle.Necronomicon ? 12f : 22f), Space.World);
        }

        private void OnTriggerEnter(Collider other)
        {
            if (_collected || GameSession.Current == null
                || GameSession.Current.Mode != GameMode.Survival
                || GameSession.Current.State != GameFlowState.Playing)
                return;

            PlayerController player = other != null ? other.GetComponentInParent<PlayerController>() : null;
            if (player == null || player.IsDefeated) return;
            Collect(player);
        }

        private void Collect(PlayerController player)
        {
            if (_collected || _definition == null || player == null) return;
            _collected = true;

            SphereCollider trigger = GetComponent<SphereCollider>();
            if (trigger != null) trigger.enabled = false;

            string discoveryKey = "paleciaki.survival.secret.v1."
                + _mapId.ToString().ToLowerInvariant() + "." + _definition.Id;
            if (PlayerPrefs.GetInt(discoveryKey, 0) == 0)
            {
                PlayerPrefs.SetInt(discoveryKey, 1);
                PlayerPrefs.Save();
            }

            GameSession.Current.SecretsFound = Mathf.Clamp(GameSession.Current.SecretsFound + 1, 0, 20);
            GameSession.Current.Score += 750;
            GameSession.Current.Coins += 5;
            HudController hud = FindFirstObjectByType<HudController>();
            hud?.SetSecretsCount(GameSession.Current.SecretsFound, 20);
            hud?.SetStatus("SEKRET ODKRYTY • " + _definition.DisplayName.ToUpperInvariant() + " • +750 PKT");

            // Special relics launch a genuinely independent full-screen 2D
            // encounter. The warehouse remains loaded but fully paused beneath it.
            if (_definition.Style == SurvivalSecretStyle.RabbitHole
                || _definition.Style == SurvivalSecretStyle.Necronomicon)
            {
                SurvivalSecretEncounterController.Open(player, _definition.Style);
            }

            Destroy(gameObject);
        }

        private void BuildVisual(SurvivalSecretStyle style)
        {
            switch (style)
            {
                case SurvivalSecretStyle.Wz:
                    Part(PrimitiveType.Cube, "WZ document", new Vector3(0f, 0.74f, 0f),
                        new Vector3(0.84f, 0.08f, 0.58f), new Color(0.88f, 0.91f, 0.87f));
                    Part(PrimitiveType.Cube, "WZ folded edge", new Vector3(0.26f, 0.80f, 0.04f),
                        new Vector3(0.12f, 0.035f, 0.42f), new Color(0.16f, 0.55f, 0.72f), true);
                    for (int row = 0; row < 3; row++)
                        Part(PrimitiveType.Cube, "WZ ink line " + row, new Vector3(-0.05f, 0.795f, -0.14f + row * 0.12f),
                            new Vector3(0.42f, 0.012f, 0.018f), new Color(0.20f, 0.29f, 0.35f));
                    break;

                case SurvivalSecretStyle.Cassette:
                    Part(PrimitiveType.Cube, "Cassette shell", new Vector3(0f, 0.48f, 0f),
                        new Vector3(0.86f, 0.20f, 0.58f), new Color(0.12f, 0.16f, 0.23f), true);
                    Part(PrimitiveType.Cube, "Cassette label", new Vector3(0f, 0.59f, 0.015f),
                        new Vector3(0.62f, 0.025f, 0.25f), new Color(0.91f, 0.83f, 0.63f));
                    for (int reel = -1; reel <= 1; reel += 2)
                        Part(PrimitiveType.Cylinder, "Cassette reel " + reel, new Vector3(reel * 0.20f, 0.615f, 0.02f),
                            new Vector3(0.15f, 0.035f, 0.15f), new Color(0.72f, 0.76f, 0.78f), true);
                    Part(PrimitiveType.Cube, "Cassette tape window", new Vector3(0f, 0.62f, 0.16f),
                        new Vector3(0.34f, 0.02f, 0.09f), new Color(0.08f, 0.12f, 0.17f));
                    break;

                case SurvivalSecretStyle.Capybara:
                    Part(PrimitiveType.Capsule, "Capybara body", new Vector3(0f, 0.45f, 0f),
                        new Vector3(0.72f, 0.67f, 1.08f), new Color(0.58f, 0.37f, 0.19f), true);
                    Part(PrimitiveType.Sphere, "Capybara head", new Vector3(0f, 0.62f, 0.47f),
                        new Vector3(0.52f, 0.47f, 0.50f), new Color(0.69f, 0.47f, 0.25f), true);
                    Part(PrimitiveType.Sphere, "Capybara muzzle", new Vector3(0f, 0.49f, 0.72f),
                        new Vector3(0.28f, 0.20f, 0.18f), new Color(0.28f, 0.18f, 0.12f));
                    for (int side = -1; side <= 1; side += 2)
                    {
                        Part(PrimitiveType.Sphere, "Capybara ear", new Vector3(side * 0.19f, 0.92f, 0.38f),
                            new Vector3(0.15f, 0.16f, 0.12f), new Color(0.40f, 0.25f, 0.14f));
                        Part(PrimitiveType.Sphere, "Capybara eye", new Vector3(side * 0.17f, 0.70f, 0.68f),
                            Vector3.one * 0.065f, new Color(0.035f, 0.025f, 0.02f));
                        Part(PrimitiveType.Cylinder, "Capybara foot", new Vector3(side * 0.22f, 0.12f, -0.22f),
                            new Vector3(0.12f, 0.22f, 0.12f), new Color(0.29f, 0.19f, 0.12f));
                        Part(PrimitiveType.Cylinder, "Capybara foot", new Vector3(side * 0.22f, 0.12f, 0.36f),
                            new Vector3(0.12f, 0.22f, 0.12f), new Color(0.29f, 0.19f, 0.12f));
                    }
                    break;

                case SurvivalSecretStyle.RabbitHole:
                    Part(PrimitiveType.Cylinder, "Rabbit hole dark mouth", new Vector3(0f, 0.035f, 0.06f),
                        new Vector3(1.12f, 0.04f, 1.12f), new Color(0.035f, 0.015f, 0.075f), true);
                    Part(PrimitiveType.Cylinder, "Rabbit hole neon rim", new Vector3(0f, 0.075f, 0.06f),
                        new Vector3(1.30f, 0.035f, 1.30f), new Color(0.75f, 0.20f, 0.95f), true);
                    Part(PrimitiveType.Sphere, "White rabbit body", new Vector3(0f, 0.48f, -0.48f),
                        new Vector3(0.38f, 0.55f, 0.32f), new Color(0.92f, 0.91f, 0.87f));
                    Part(PrimitiveType.Sphere, "White rabbit head", new Vector3(0f, 0.93f, -0.42f),
                        new Vector3(0.34f, 0.34f, 0.33f), new Color(0.96f, 0.94f, 0.90f));
                    for (int side = -1; side <= 1; side += 2)
                        Part(PrimitiveType.Capsule, "Rabbit ear", new Vector3(side * 0.13f, 1.28f, -0.44f),
                            new Vector3(0.11f, 0.39f, 0.10f), new Color(0.95f, 0.91f, 0.90f));
                    Part(PrimitiveType.Cube, "Rabbit invitation sign", new Vector3(0f, 0.86f, 0.88f),
                        new Vector3(0.72f, 0.62f, 0.08f), new Color(0.16f, 0.12f, 0.24f), true);
                    Part(PrimitiveType.Cube, "Rabbit sign arrow", new Vector3(0f, 0.89f, 0.94f),
                        new Vector3(0.30f, 0.08f, 0.02f), new Color(0.96f, 0.45f, 0.89f), true);
                    break;

                case SurvivalSecretStyle.Necronomicon:
                    Part(PrimitiveType.Cube, "Necronomicon leather cover", new Vector3(0f, 0.50f, 0f),
                        new Vector3(0.78f, 0.20f, 0.98f), new Color(0.12f, 0.07f, 0.15f), true);
                    Part(PrimitiveType.Cube, "Necronomicon parchment block", new Vector3(0.01f, 0.51f, 0.01f),
                        new Vector3(0.66f, 0.11f, 0.85f), new Color(0.71f, 0.64f, 0.47f));
                    Part(PrimitiveType.Cube, "Necronomicon gold frame", new Vector3(0f, 0.62f, 0f),
                        new Vector3(0.67f, 0.035f, 0.86f), new Color(0.67f, 0.49f, 0.19f), true);
                    Part(PrimitiveType.Sphere, "Necronomicon elder eye", new Vector3(0f, 0.67f, 0.02f),
                        new Vector3(0.23f, 0.085f, 0.23f), new Color(0.23f, 1f, 0.70f), true);
                    for (int rune = 0; rune < 4; rune++)
                    {
                        float angle = rune * Mathf.PI * 0.5f;
                        Part(PrimitiveType.Cube, "Necronomicon rune", new Vector3(Mathf.Cos(angle) * 0.56f, 0.88f, Mathf.Sin(angle) * 0.56f),
                            Vector3.one * 0.11f, new Color(0.18f, 0.95f, 0.72f), true);
                    }
                    break;
            }
        }

        private void Part(PrimitiveType shape, string label, Vector3 localPosition, Vector3 scale, Color color, bool emissive = false)
        {
            GameObject part = GameObject.CreatePrimitive(shape);
            part.name = label;
            part.transform.SetParent(_visualRoot, false);
            part.transform.localPosition = localPosition;
            part.transform.localScale = scale;
            Collider collider = part.GetComponent<Collider>();
            if (collider != null) Destroy(collider);
            Renderer renderer = part.GetComponent<Renderer>();
            if (renderer == null) return;

            Color32 rgba = color;
            uint packedColor = ((uint)rgba.r << 24) | ((uint)rgba.g << 16)
                | ((uint)rgba.b << 8) | rgba.a;
            long key = ((long)packedColor << 1) | (emissive ? 1L : 0L);
            if (!Materials.TryGetValue(key, out Material material))
            {
                Shader shader = Shader.Find("Universal Render Pipeline/Lit");
                if (shader == null) shader = Shader.Find("Standard");
                if (shader == null)
                {
                    Debug.LogError("No compatible shader for Survival secret props.");
                    return;
                }
                material = new Material(shader) { color = color, enableInstancing = true };
                if (emissive)
                {
                    material.EnableKeyword("_EMISSION");
                    if (material.HasProperty(EmissionId)) material.SetColor(EmissionId, color * 1.4f);
                }
                Materials.Add(key, material);
            }
            renderer.sharedMaterial = material;
        }
    }
}
