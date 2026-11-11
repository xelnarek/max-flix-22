#if UNITY_EDITOR
using System.Collections.Generic;
using MaxFlix.Unity.Runtime;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;

namespace MaxFlix.Unity.Editor
{
    /// <summary>
    /// Creates a disposable visual review scene for the imported character roster.
    /// It does not alter the bootstrap scene or add itself to Build Settings.
    /// </summary>
    public static class GobkitRigPreviewBuilder
    {
        private const string ScenePath = "Assets/Scenes/GobkitRigPreview.unity";
        private const int Columns = 6;
        private const float ColumnSpacing = 4.6f;
        private const float RowSpacing = 5.0f;

        [MenuItem("Max Flix/Build CC0 rig preview scene")]
        public static void BuildPreviewScene()
        {
            if (!AssetDatabase.IsValidFolder("Assets/Scenes"))
                AssetDatabase.CreateFolder("Assets", "Scenes");

            Scene scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            scene.name = "GobkitRigPreview";
            RenderSettings.ambientMode = AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.34f, 0.38f, 0.44f);
            RenderSettings.reflectionIntensity = 0.35f;

            GameObject previewRoot = new GameObject("CC0 Gobkit Rig Review • 17 models");
            CreateGround(previewRoot.transform);
            CreateLighting(previewRoot.transform);
            CreateCamera(previewRoot.transform);

            IReadOnlyList<string> models = GobkitActorCatalog.RequiredModelIds;
            List<string> missing = new List<string>();
            for (int index = 0; index < models.Count; index++)
            {
                string modelId = models[index];
                string assetPath = GobkitActorCatalog.GetAssetPath(modelId);
                GameObject prefab = AssetDatabase.LoadAssetAtPath<GameObject>(assetPath);
                if (prefab == null)
                {
                    missing.Add(modelId);
                    continue;
                }

                int column = index % Columns;
                int row = index / Columns;
                float x = (column - (Columns - 1) * 0.5f) * ColumnSpacing;
                float z = (row - 1) * RowSpacing;
                GameObject instance = PrefabUtility.InstantiatePrefab(prefab, scene) as GameObject;
                if (instance == null)
                {
                    missing.Add(modelId + " (prefab instantiation failed)");
                    continue;
                }

                instance.name = "CC0 • " + modelId;
                instance.transform.SetParent(previewRoot.transform, true);
                instance.transform.position = new Vector3(x, 0f, z);
                FitToPreviewHeight(instance.transform, 2.0f);
                CreateLabel(previewRoot.transform, modelId, new Vector3(x, 0.035f, z + 1.9f));
            }

            if (missing.Count > 0)
                Debug.LogWarning("[Max Flix] Missing preview rigs: " + string.Join(", ", missing));
            else
                Debug.Log("[Max Flix] Preview scene contains all " + models.Count + " imported CC0 rigs.");

            EditorSceneManager.MarkSceneDirty(scene);
            EditorSceneManager.SaveScene(scene, ScenePath);
            Selection.activeObject = previewRoot;
            Debug.Log("[Max Flix] Saved rig review scene to " + ScenePath + ". It is not included in Player Build Settings.");
        }

        private static void CreateGround(Transform parent)
        {
            GameObject floor = GameObject.CreatePrimitive(PrimitiveType.Cube);
            floor.name = "Preview floor • neutral graphite";
            floor.transform.SetParent(parent, false);
            floor.transform.position = new Vector3(0f, -0.16f, 0f);
            floor.transform.localScale = new Vector3(32f, 0.3f, 19f);
            Shader shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            if (shader != null)
            {
                Material material = new Material(shader);
                material.color = new Color(0.10f, 0.14f, 0.19f);
                floor.GetComponent<Renderer>().sharedMaterial = material;
            }
        }

        private static void CreateLighting(Transform parent)
        {
            GameObject lightObject = new GameObject("Rig review key light");
            lightObject.transform.SetParent(parent, false);
            lightObject.transform.rotation = Quaternion.Euler(48f, -28f, 0f);
            Light light = lightObject.AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 1.5f;
            light.color = new Color(1f, 0.94f, 0.84f);
            light.shadows = LightShadows.Soft;
        }

        private static void CreateCamera(Transform parent)
        {
            GameObject cameraObject = new GameObject("Rig review camera");
            cameraObject.transform.SetParent(parent, false);
            cameraObject.transform.position = new Vector3(0f, 24f, -27f);
            cameraObject.transform.rotation = Quaternion.LookRotation(new Vector3(0f, -0.64f, 0.77f));
            Camera camera = cameraObject.AddComponent<Camera>();
            camera.orthographic = true;
            camera.orthographicSize = 15.5f;
            camera.nearClipPlane = 0.1f;
            camera.farClipPlane = 100f;
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = new Color(0.035f, 0.05f, 0.075f);
        }

        private static void FitToPreviewHeight(Transform root, float targetHeight)
        {
            Bounds bounds;
            if (!TryGetBounds(root, out bounds) || bounds.size.y < 0.01f) return;
            float scale = targetHeight / bounds.size.y;
            root.localScale *= scale;
            if (!TryGetBounds(root, out bounds)) return;
            root.position += Vector3.up * -bounds.min.y;
        }

        private static bool TryGetBounds(Transform root, out Bounds bounds)
        {
            Renderer[] renderers = root.GetComponentsInChildren<Renderer>(true);
            bool found = false;
            bounds = new Bounds(root.position, Vector3.zero);
            foreach (Renderer renderer in renderers)
            {
                if (renderer == null || !renderer.enabled) continue;
                if (!found)
                {
                    bounds = renderer.bounds;
                    found = true;
                }
                else
                {
                    bounds.Encapsulate(renderer.bounds);
                }
            }
            return found;
        }

        private static void CreateLabel(Transform parent, string value, Vector3 position)
        {
            GameObject label = new GameObject("Label • " + value);
            label.transform.SetParent(parent, false);
            label.transform.position = position;
            TextMesh text = label.AddComponent<TextMesh>();
            text.text = value.ToUpperInvariant();
            text.anchor = TextAnchor.MiddleCenter;
            text.alignment = TextAlignment.Center;
            text.fontSize = 40;
            text.characterSize = 0.07f;
            text.color = new Color(0.88f, 0.93f, 0.98f);
            text.transform.rotation = Quaternion.Euler(65f, 0f, 0f);
        }
    }
}
#endif
