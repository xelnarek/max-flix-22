#if UNITY_EDITOR
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine.SceneManagement;

namespace MaxFlix.Unity.Editor
{
    [InitializeOnLoad]
    public static class BootstrapSceneInstaller
    {
        private const string ScenePath = "Assets/Scenes/Bootstrap.unity";

        static BootstrapSceneInstaller()
        {
            EditorApplication.delayCall += EnsureBootstrapScene;
        }

        [MenuItem("Max Flix/Repair Bootstrap Scene and Build Settings")]
        public static void EnsureBootstrapScene()
        {
            Directory.CreateDirectory("Assets/Scenes");

            if (!File.Exists(ScenePath))
            {
                Scene scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                EditorSceneManager.SaveScene(scene, ScenePath);
                UnityEngine.Debug.Log("[Max Flix] Created the Unity bootstrap scene.");
            }

            var buildScenes = new List<EditorBuildSettingsScene>(EditorBuildSettings.scenes);
            bool found = false;
            foreach (EditorBuildSettingsScene buildScene in buildScenes)
            {
                if (buildScene.path != ScenePath) continue;
                found = true;
                buildScene.enabled = true;
                break;
            }

            if (!found) buildScenes.Insert(0, new EditorBuildSettingsScene(ScenePath, true));
            EditorBuildSettings.scenes = buildScenes.ToArray();
        }
    }
}
#endif
