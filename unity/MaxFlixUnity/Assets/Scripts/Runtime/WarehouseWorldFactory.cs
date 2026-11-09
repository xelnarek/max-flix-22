using System.Collections.Generic;
using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    public static class WarehouseWorldFactory
    {
        private static Transform _worldRoot;
        private static readonly Dictionary<string, Material> MaterialCache = new Dictionary<string, Material>();

        public static PlayerController BuildB4Slice()
        {
            GameObject root = new GameObject("B4 Warehouse World");
            _worldRoot = root.transform;

            CreateLighting();
            CreateFloor();
            CreateRackBay(new Vector3(-8f, 0f, 4f), 3);
            CreateRackBay(new Vector3(0f, 0f, 4f), 3);
            CreateRackBay(new Vector3(8f, 0f, 4f), 3);
            CreateSafetyLanes();
            CreatePalletStack(new Vector3(-4f, 0f, -3f));
            CreatePalletStack(new Vector3(4f, 0f, -3f));
            CreatePalletStack(new Vector3(11f, 0f, -5f));

            PlayerController player = CreateOperator(OperatorCatalog.Get(GameSession.Current.SelectedOperator), new Vector3(0f, 0.1f, -9f));
            CreateCamera(player.transform);
            if (GameSession.Current.Mode == GameMode.Survival)
            {
                SurvivalWaveDirector director = root.AddComponent<SurvivalWaveDirector>();
                director.Initialize(player);
            }
            else
            {
                CreateTrainingEnemies(player);
            }
            return player;
        }

        private static void CreateLighting()
        {
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.44f, 0.54f, 0.66f);
            RenderSettings.ambientEquatorColor = new Color(0.26f, 0.31f, 0.37f);
            RenderSettings.ambientGroundColor = new Color(0.12f, 0.15f, 0.19f);
            RenderSettings.fog = true;
            RenderSettings.fogColor = new Color(0.23f, 0.29f, 0.35f);
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogStartDistance = 32f;
            RenderSettings.fogEndDistance = 82f;

            GameObject keyLight = new GameObject("B4 key light");
            keyLight.transform.SetParent(_worldRoot, false);
            keyLight.transform.rotation = Quaternion.Euler(48f, -32f, 0f);
            Light directional = keyLight.AddComponent<Light>();
            directional.type = LightType.Directional;
            directional.intensity = 1.25f;
            directional.color = new Color(1f, 0.86f, 0.68f);
            directional.shadows = LightShadows.Soft;

            GameObject fillLight = new GameObject("B4 cool fill");
            fillLight.transform.SetParent(_worldRoot, false);
            fillLight.transform.position = new Vector3(-10f, 8f, -2f);
            Light fill = fillLight.AddComponent<Light>();
            fill.type = LightType.Point;
            fill.range = 22f;
            fill.intensity = 2.2f;
            fill.color = new Color(0.36f, 0.66f, 0.95f);
            fill.shadows = LightShadows.None;
        }

        private static void CreateFloor()
        {
            GameObject floor = GameObject.CreatePrimitive(PrimitiveType.Cube);
            floor.name = "B4 polished concrete floor";
            floor.transform.SetParent(_worldRoot, false);
            floor.transform.position = new Vector3(0f, -0.3f, 0f);
            floor.transform.localScale = new Vector3(38f, 0.6f, 32f);
            ApplyMaterial(floor, new Color(0.19f, 0.24f, 0.30f), 0.78f, 0.12f);
        }

        private static void CreateRackBay(Vector3 origin, int bays)
        {
            Color steel = new Color(0.22f, 0.31f, 0.40f);
            Color orange = new Color(0.93f, 0.43f, 0.12f);
            for (int bay = 0; bay < bays; bay++)
            {
                float x = origin.x + bay * 2.4f;
                CreateBox("Rack upright", new Vector3(x, 1.65f, origin.z), new Vector3(0.18f, 3.3f, 0.18f), steel);
                CreateBox("Rack upright", new Vector3(x + 2.2f, 1.65f, origin.z), new Vector3(0.18f, 3.3f, 0.18f), steel);
                for (int level = 0; level < 3; level++)
                {
                    float y = 0.55f + level * 1.12f;
                    CreateBox("Orange rack beam", new Vector3(x + 1.1f, y, origin.z), new Vector3(2.25f, 0.13f, 0.24f), orange);
                    CreatePallet(new Vector3(x + 1.1f, y + 0.30f, origin.z));
                }
            }
            CreateBox("Rack top cross brace", origin + new Vector3(bays * 2.4f - 1.0f, 3.15f, 0f), new Vector3(bays * 2.4f, 0.12f, 0.18f), steel);
        }

        private static void CreatePallet(Vector3 center)
        {
            Color timber = new Color(0.47f, 0.32f, 0.20f);
            CreateBox("Pallet deck", center, new Vector3(1.45f, 0.15f, 1.05f), timber);
            for (int i = -1; i <= 1; i++)
                CreateBox("Pallet runner", center + new Vector3(i * 0.50f, -0.12f, 0f), new Vector3(0.16f, 0.10f, 0.95f), new Color(0.30f, 0.21f, 0.14f));
            CreateBox("Wrapped freight", center + new Vector3(0f, 0.58f, 0f), new Vector3(1.18f, 1.0f, 0.86f), new Color(0.63f, 0.72f, 0.79f), 0.34f);
        }

        private static void CreatePalletStack(Vector3 position)
        {
            for (int level = 0; level < 2; level++)
            {
                Vector3 center = position + new Vector3(0f, level * 0.75f, 0f);
                CreateBox("Staged pallet", center, new Vector3(1.55f, 0.16f, 1.15f), new Color(0.45f, 0.31f, 0.20f));
            }
        }

        private static void CreateSafetyLanes()
        {
            Color amber = new Color(1f, 0.65f, 0.14f);
            for (int z = -12; z <= 12; z += 4)
            {
                CreateBox("Pedestrian lane marking", new Vector3(-13f, 0.012f, z), new Vector3(0.12f, 0.02f, 2.2f), amber);
                CreateBox("Pedestrian lane marking", new Vector3(13f, 0.012f, z), new Vector3(0.12f, 0.02f, 2.2f), amber);
            }
            CreateBox("B4 central route line", new Vector3(0f, 0.014f, 0f), new Vector3(0.07f, 0.02f, 27f), new Color(0.18f, 0.64f, 0.79f));
        }

        private static PlayerController CreateOperator(OperatorProfile profile, Vector3 position)
        {
            GameObject player = new GameObject(profile.DisplayName);
            player.transform.SetParent(_worldRoot, false);
            player.transform.position = position;

            CharacterController controller = player.AddComponent<CharacterController>();
            controller.height = 1.78f;
            controller.radius = 0.34f;
            controller.center = new Vector3(0f, 0.89f, 0f);
            controller.stepOffset = 0.3f;
            controller.slopeLimit = 48f;

            BuildOperatorVisual(player.transform, profile);
            return player.AddComponent<PlayerController>();
        }

        private static void BuildOperatorVisual(Transform root, OperatorProfile profile)
        {
            Color dark = new Color(0.10f, 0.15f, 0.21f);
            CreateVisualPart(root, PrimitiveType.Capsule, "Torso / safety vest", new Vector3(0f, 0.83f, 0f), new Vector3(0.62f, 0.68f, 0.38f), profile.PrimaryColor);
            CreateVisualPart(root, PrimitiveType.Cube, "Reflective vest band", new Vector3(0f, 0.90f, 0.205f), new Vector3(0.60f, 0.09f, 0.025f), profile.SecondaryColor);
            CreateVisualPart(root, PrimitiveType.Sphere, "Head", new Vector3(0f, 1.55f, 0f), new Vector3(0.35f, 0.40f, 0.34f), new Color(0.84f, 0.66f, 0.53f));
            CreateVisualPart(root, PrimitiveType.Sphere, "Helmet shell", new Vector3(0f, 1.76f, 0f), new Vector3(0.42f, 0.19f, 0.42f), profile.SecondaryColor);
            CreateVisualPart(root, PrimitiveType.Cube, "Helmet brim", new Vector3(0f, 1.70f, 0.06f), new Vector3(0.48f, 0.05f, 0.46f), profile.SecondaryColor);
            CreateVisualPart(root, PrimitiveType.Cube, "Radio pack", new Vector3(-0.31f, 0.96f, -0.13f), new Vector3(0.12f, 0.22f, 0.13f), dark);
            CreateVisualPart(root, PrimitiveType.Cube, "Operator ID", new Vector3(0.19f, 1.13f, 0.21f), new Vector3(0.15f, 0.11f, 0.025f), profile.SecondaryColor);

            Transform leftShoulder = CreatePivot(root, "Left shoulder", new Vector3(-0.34f, 1.20f, 0f));
            Transform rightShoulder = CreatePivot(root, "Right shoulder", new Vector3(0.34f, 1.20f, 0f));
            BuildArm(leftShoulder, "Left arm", profile.PrimaryColor);
            BuildArm(rightShoulder, "Right arm", profile.PrimaryColor);

            Transform leftHip = CreatePivot(root, "Left hip", new Vector3(-0.16f, 0.50f, 0f));
            Transform rightHip = CreatePivot(root, "Right hip", new Vector3(0.16f, 0.50f, 0f));
            BuildLeg(leftHip, "Left leg", dark);
            BuildLeg(rightHip, "Right leg", dark);

            OperatorAnimationRig animationRig = root.gameObject.AddComponent<OperatorAnimationRig>();
            animationRig.Initialize(leftShoulder, rightShoulder, leftHip, rightHip, profile);

            if (profile.Id == OperatorId.Marcin)
                CreateVisualPart(rightShoulder, PrimitiveType.Cube, "B4 ERP tablet", new Vector3(0.02f, -0.32f, 0.24f), new Vector3(0.22f, 0.16f, 0.035f), new Color(0.10f, 0.55f, 0.86f));
            else if (profile.Id == OperatorId.Grzesiek)
                CreateVisualPart(rightShoulder, PrimitiveType.Cylinder, "Training dumbbell", new Vector3(0f, -0.32f, 0.22f), new Vector3(0.13f, 0.42f, 0.13f), new Color(0.13f, 0.18f, 0.21f));
            else if (profile.Id == OperatorId.Dawid)
                CreateVisualPart(rightShoulder, PrimitiveType.Cylinder, "Stretch film roll", new Vector3(0f, -0.34f, 0.22f), new Vector3(0.16f, 0.24f, 0.16f), new Color(0.78f, 0.86f, 0.91f));
            else if (profile.Id == OperatorId.Mateusz)
                CreateVisualPart(rightShoulder, PrimitiveType.Cube, "Taser", new Vector3(0f, -0.32f, 0.24f), new Vector3(0.19f, 0.13f, 0.25f), new Color(0.48f, 0.20f, 0.86f));
            else
                CreateVisualPart(rightShoulder, PrimitiveType.Cube, "Ratchet wrench", new Vector3(0f, -0.33f, 0.22f), new Vector3(0.12f, 0.46f, 0.09f), new Color(0.75f, 0.80f, 0.85f));
        }

        private static Transform CreatePivot(Transform parent, string name, Vector3 localPosition)
        {
            GameObject pivot = new GameObject(name);
            pivot.transform.SetParent(parent, false);
            pivot.transform.localPosition = localPosition;
            return pivot.transform;
        }

        private static void BuildArm(Transform pivot, string name, Color color)
        {
            CreateVisualPart(pivot, PrimitiveType.Capsule, name, new Vector3(0f, -0.19f, 0f), new Vector3(0.20f, 0.31f, 0.20f), color);
            CreateVisualPart(pivot, PrimitiveType.Sphere, name + " hand", new Vector3(0f, -0.39f, 0.04f), new Vector3(0.15f, 0.15f, 0.15f), new Color(0.84f, 0.66f, 0.53f));
        }

        private static void BuildLeg(Transform pivot, string name, Color color)
        {
            CreateVisualPart(pivot, PrimitiveType.Capsule, name, new Vector3(0f, -0.22f, 0f), new Vector3(0.22f, 0.34f, 0.22f), color);
            CreateVisualPart(pivot, PrimitiveType.Cube, name + " boot", new Vector3(0f, -0.43f, 0.08f), new Vector3(0.22f, 0.12f, 0.36f), new Color(0.20f, 0.15f, 0.12f));
        }

        private static void CreateTrainingEnemies(PlayerController player)
        {
            CreateEnemy(new Vector3(-5f, 0.05f, 4f), player, EnemyKind.Customer);
            CreateEnemy(new Vector3(6f, 0.05f, 8f), player, EnemyKind.AgvRobot);
            CreateEnemy(new Vector3(10f, 0.05f, -1f), player, EnemyKind.Inspector);
        }

        public static EnemyAgent SpawnSurvivalEnemy(PlayerController player, EnemyKind kind, Vector3 position,
            float healthMultiplier, float speedMultiplier, float abilityRateMultiplier)
        {
            if (_worldRoot == null || player == null) return null;
            return CreateEnemy(position, player, kind, healthMultiplier, speedMultiplier, abilityRateMultiplier);
        }

        private static EnemyAgent CreateEnemy(Vector3 position, PlayerController player, EnemyKind kind,
            float healthMultiplier = 1f, float speedMultiplier = 1f, float abilityRateMultiplier = 1f)
        {
            EnemyArchetypeProfile profile = EnemyArchetypeCatalog.Get(kind);
            if (profile.IsHazardOnly) return null;

            GameObject enemy = new GameObject(profile.DisplayName + " • B4");
            enemy.transform.SetParent(_worldRoot, false);
            enemy.transform.position = position;

            bool boss = profile.IsBoss;
            CharacterController controller = enemy.AddComponent<CharacterController>();
            controller.height = boss ? 2.05f : 1.65f;
            controller.radius = boss ? 0.48f : 0.34f;
            controller.center = new Vector3(0f, controller.height * 0.5f, 0f);
            Color skin = new Color(0.76f, 0.58f, 0.45f);

            if (kind == EnemyKind.AgvRobot)
            {
                CreateVisualPart(enemy.transform, PrimitiveType.Cube, "AGV chassis", new Vector3(0f, 0.42f, 0f), new Vector3(0.92f, 0.56f, 0.78f), profile.AccentColor);
                CreateVisualPart(enemy.transform, PrimitiveType.Cube, "AGV sensor rail", new Vector3(0f, 0.78f, 0f), new Vector3(0.72f, 0.08f, 0.16f), new Color(0.12f, 0.20f, 0.26f));
                CreateVisualPart(enemy.transform, PrimitiveType.Sphere, "AGV scanning eye", new Vector3(0f, 0.57f, 0.42f), new Vector3(0.25f, 0.10f, 0.06f), new Color(0.25f, 0.94f, 1f));
                for (int side = -1; side <= 1; side += 2)
                    CreateVisualPart(enemy.transform, PrimitiveType.Cylinder, "AGV wheel", new Vector3(side * 0.48f, 0.18f, 0f), new Vector3(0.15f, 0.18f, 0.15f), new Color(0.08f, 0.10f, 0.13f));
            }
            else
            {
                float bodyScale = boss ? 1.20f : 1f;
                CreateVisualPart(enemy.transform, PrimitiveType.Capsule, "Enemy torso", new Vector3(0f, 0.78f * bodyScale, 0f), new Vector3(0.65f * bodyScale, 0.68f * bodyScale, 0.38f * bodyScale), profile.AccentColor);
                CreateVisualPart(enemy.transform, PrimitiveType.Sphere, "Enemy head", new Vector3(0f, 1.47f * bodyScale, 0f), new Vector3(0.34f * bodyScale, 0.37f * bodyScale, 0.33f * bodyScale), skin);
                CreateVisualPart(enemy.transform, PrimitiveType.Sphere, "Enemy helmet", new Vector3(0f, 1.68f * bodyScale, 0f), new Vector3(0.42f * bodyScale, 0.18f * bodyScale, 0.42f * bodyScale), profile.AccentColor);

                if (kind == EnemyKind.Inspector)
                {
                    CreateVisualPart(enemy.transform, PrimitiveType.Cube, "Inspector visor", new Vector3(0f, 1.52f, 0.18f), new Vector3(0.42f, 0.06f, 0.08f), new Color(0.94f, 0.76f, 0.22f));
                    CreateVisualPart(enemy.transform, PrimitiveType.Cube, "Inspection clipboard", new Vector3(0.44f, 0.84f, 0.20f), new Vector3(0.22f, 0.34f, 0.06f), new Color(0.40f, 0.28f, 0.16f));
                }
            }

            if (kind == EnemyKind.Kurier || kind == EnemyKind.PanRoman)
            {
                CreateVisualPart(enemy.transform, PrimitiveType.Cube, "Delivery backpack", new Vector3(0f, 0.88f, -0.27f), new Vector3(0.40f, 0.45f, 0.27f), new Color(0.10f, 0.20f, 0.28f));
                CreateVisualPart(enemy.transform, PrimitiveType.Cube, "Backpack label", new Vector3(0f, 0.90f, -0.415f), new Vector3(0.23f, 0.12f, 0.025f), new Color(0.92f, 0.72f, 0.25f));
            }
            else if (kind == EnemyKind.CyberSalesman)
            {
                CreateVisualPart(enemy.transform, PrimitiveType.Cube, "Cyber visor", new Vector3(0f, 1.48f, 0.19f), new Vector3(0.50f, 0.12f, 0.07f), new Color(0.08f, 0.95f, 1f));
                CreateVisualPart(enemy.transform, PrimitiveType.Cube, "Holographic offer", new Vector3(0.48f, 1.02f, 0.16f), new Vector3(0.42f, 0.42f, 0.035f), new Color(0.12f, 0.85f, 0.92f));
            }
            else if (kind == EnemyKind.RadioactivePip || kind == EnemyKind.MutantGammaForklift)
            {
                CreateVisualPart(enemy.transform, PrimitiveType.Sphere, "Radiation core", new Vector3(0f, 0.90f, 0.24f), new Vector3(0.27f, 0.27f, 0.09f), new Color(0.35f, 1f, 0.18f));
                CreateVisualPart(enemy.transform, PrimitiveType.Cube, "Radiation warning", new Vector3(0f, 1.48f, 0.19f), new Vector3(0.42f, 0.07f, 0.07f), new Color(0.92f, 1f, 0.14f));
            }
            else if (kind == EnemyKind.CrazyStacker || kind == EnemyKind.EliteWalczakGuard)
            {
                CreateVisualPart(enemy.transform, PrimitiveType.Cube, "Forklift guard plate", new Vector3(0f, 0.72f, 0.27f), new Vector3(0.76f, 0.30f, 0.12f), new Color(0.12f, 0.15f, 0.18f));
                CreateVisualPart(enemy.transform, PrimitiveType.Cube, "Hazard stripe", new Vector3(0f, 0.72f, 0.34f), new Vector3(0.62f, 0.08f, 0.025f), new Color(1f, 0.68f, 0.12f));
            }
            else if (kind == EnemyKind.Sebix || kind == EnemyKind.Walczak || kind == EnemyKind.KingLeto || kind == EnemyKind.BosmanKrakow)
            {
                for (int side = -1; side <= 1; side += 2)
                    CreateVisualPart(enemy.transform, PrimitiveType.Cylinder, "Boss shoulder armor", new Vector3(side * 0.46f, 1.08f, 0f), new Vector3(0.24f, 0.28f, 0.24f), new Color(0.12f, 0.16f, 0.22f));
                CreateVisualPart(enemy.transform, PrimitiveType.Cube, "Boss chest insignia", new Vector3(0f, 0.95f, 0.22f), new Vector3(0.24f, 0.24f, 0.06f), profile.AccentColor);
            }
            else if (kind == EnemyKind.PiorunDrone)
            {
                CreateVisualPart(enemy.transform, PrimitiveType.Sphere, "Drone core", new Vector3(0f, 1.25f, 0f), new Vector3(0.50f, 0.34f, 0.52f), profile.AccentColor);
                CreateVisualPart(enemy.transform, PrimitiveType.Sphere, "Drone sensor eye", new Vector3(0f, 1.28f, 0.26f), new Vector3(0.22f, 0.12f, 0.06f), new Color(0.85f, 1f, 1f));
                for (int i = 0; i < 4; i++)
                {
                    float angle = i * Mathf.PI * 0.5f;
                    Vector3 arm = new Vector3(Mathf.Cos(angle), 1.28f, Mathf.Sin(angle)) * 0.48f;
                    CreateVisualPart(enemy.transform, PrimitiveType.Cube, "Drone rotor arm", arm, new Vector3(0.48f, 0.07f, 0.08f), new Color(0.12f, 0.18f, 0.23f));
                    CreateVisualPart(enemy.transform, PrimitiveType.Cylinder, "Drone rotor", arm + new Vector3(Mathf.Cos(angle) * 0.30f, 0.06f, Mathf.Sin(angle) * 0.30f), new Vector3(0.22f, 0.035f, 0.22f), new Color(0.82f, 0.90f, 0.96f));
                }
            }
            else if (kind == EnemyKind.Monter)
            {
                CreateVisualPart(enemy.transform, PrimitiveType.Cube, "Tool belt", new Vector3(0f, 0.54f, 0.20f), new Vector3(0.68f, 0.16f, 0.12f), new Color(0.13f, 0.11f, 0.09f));
                CreateVisualPart(enemy.transform, PrimitiveType.Cylinder, "Wrench", new Vector3(0.40f, 0.88f, 0.20f), new Vector3(0.07f, 0.26f, 0.07f), new Color(0.65f, 0.71f, 0.76f));
            }
            else if (kind == EnemyKind.Pomazaniec)
            {
                CreateVisualPart(enemy.transform, PrimitiveType.Cylinder, "Bike front wheel", new Vector3(0f, 0.18f, 0.48f), new Vector3(0.32f, 0.055f, 0.32f), new Color(0.10f, 0.12f, 0.16f));
                CreateVisualPart(enemy.transform, PrimitiveType.Cube, "Bike frame", new Vector3(0f, 0.42f, 0.02f), new Vector3(0.10f, 0.10f, 0.72f), new Color(0.92f, 0.16f, 0.45f));
            }

            EnemyAgent agent = enemy.AddComponent<EnemyAgent>();
            agent.Initialize(player, kind, healthMultiplier, speedMultiplier, abilityRateMultiplier);
            return agent;
        }

        private static GameObject CreateBox(string objectName, Vector3 position, Vector3 scale, Color color, float roughness = 0.65f)
        {
            GameObject box = GameObject.CreatePrimitive(PrimitiveType.Cube);
            box.name = objectName;
            box.transform.SetParent(_worldRoot, false);
            box.transform.position = position;
            box.transform.localScale = scale;
            ApplyMaterial(box, color, roughness, 0.10f);
            return box;
        }

        private static void CreateVisualPart(Transform parent, PrimitiveType primitive, string partName, Vector3 localPosition, Vector3 localScale, Color color)
        {
            GameObject part = GameObject.CreatePrimitive(primitive);
            part.name = partName;
            part.transform.SetParent(parent, false);
            part.transform.localPosition = localPosition;
            part.transform.localScale = localScale;
            Collider collider = part.GetComponent<Collider>();
            if (collider != null) Object.Destroy(collider);
            ApplyMaterial(part, color, 0.48f, 0.08f);
        }

        private static void ApplyMaterial(GameObject target, Color color, float roughness, float metalness)
        {
            Renderer renderer = target.GetComponent<Renderer>();
            if (renderer == null) return;
            string key = ColorUtility.ToHtmlStringRGBA(color) + "_" + Mathf.RoundToInt(roughness * 100f) + "_" + Mathf.RoundToInt(metalness * 100f);
            if (!MaterialCache.TryGetValue(key, out Material material))
            {
                Shader shader = Shader.Find("Universal Render Pipeline/Lit");
                if (shader == null) shader = Shader.Find("Standard");
                material = new Material(shader);
                material.color = color;
                if (material.HasProperty("_Smoothness")) material.SetFloat("_Smoothness", 1f - roughness);
                if (material.HasProperty("_Metallic")) material.SetFloat("_Metallic", metalness);
                MaterialCache.Add(key, material);
            }
            renderer.sharedMaterial = material;
        }

        private static void CreateCamera(Transform target)
        {
            GameObject cameraObject = new GameObject("Main Camera");
            cameraObject.tag = "MainCamera";
            cameraObject.transform.SetParent(_worldRoot, false);
            cameraObject.transform.position = target.position + new Vector3(0f, 7.8f, -9.5f);
            Camera camera = cameraObject.AddComponent<Camera>();
            camera.fieldOfView = 56f;
            camera.nearClipPlane = 0.08f;
            camera.farClipPlane = 150f;
            cameraObject.AddComponent<AudioListener>();
            CameraFollowRig rig = cameraObject.AddComponent<CameraFollowRig>();
            rig.SetTarget(target);
        }
    }
}
