#if UNITY_EDITOR
using System;
using System.Linq;
using System.Reflection;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace MaxFlix.Unity.Editor
{
    [InitializeOnLoad]
    public static class UnityProjectSetup
    {
        static UnityProjectSetup()
        {
            // Apply the rendering and input setup on first editor load so the
            // project cannot silently remain on the built-in renderer.
            // The menu item remains available as a manual repair command.
            EditorApplication.delayCall += ConfigureRenderingAndInput;
        }

        private const string SettingsFolder = "Assets/Settings";
        private const string UrpMenuItem = "Assets/Create/Rendering/URP Asset (with Universal Renderer)";
        private const int NewInputSystemBackend = 1;
        private const string AndroidApplicationId = "pl.paleciaki.magazynchaosu";

        [MenuItem("Max Flix/Configure URP and New Input System")]
        public static void ConfigureRenderingAndInput()
        {
            EnsureSettingsFolder();
            ConfigureApplicationIdentity();

            UniversalRenderPipelineAsset pipeline = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(
                SettingsFolder + "/MaxFlix_URP.asset");

            if (pipeline == null)
            {
                DefaultAsset folder = AssetDatabase.LoadAssetAtPath<DefaultAsset>(SettingsFolder);
                Selection.activeObject = folder;
                if (!EditorApplication.ExecuteMenuItem(UrpMenuItem))
                {
                    Debug.LogError("[Max Flix] Unity could not run the URP asset creation command. Create Assets/Settings/MaxFlix_URP.asset using Assets > Create > Rendering > URP Asset (with Universal Renderer), then run this menu again.");
                    return;
                }

                AssetDatabase.Refresh();
                string[] guids = AssetDatabase.FindAssets("t:UniversalRenderPipelineAsset", new[] { SettingsFolder });
                if (guids.Length == 0)
                {
                    Debug.LogError("[Max Flix] URP asset creation returned without an asset. Create one manually and run this menu again.");
                    return;
                }

                string createdPath = AssetDatabase.GUIDToAssetPath(guids[0]);
                if (createdPath != SettingsFolder + "/MaxFlix_URP.asset")
                {
                    string moveError = AssetDatabase.MoveAsset(createdPath, SettingsFolder + "/MaxFlix_URP.asset");
                    if (!string.IsNullOrEmpty(moveError))
                    {
                        Debug.LogWarning("[Max Flix] Could not rename the created URP asset: " + moveError);
                    }
                }

                pipeline = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(
                    SettingsFolder + "/MaxFlix_URP.asset");
                if (pipeline == null)
                {
                    string[] retryGuids = AssetDatabase.FindAssets("t:UniversalRenderPipelineAsset", new[] { SettingsFolder });
                    if (retryGuids.Length > 0)
                        pipeline = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(AssetDatabase.GUIDToAssetPath(retryGuids[0]));
                }
            }

            if (pipeline == null)
            {
                Debug.LogError("[Max Flix] URP asset is missing. The game is not configured for URP yet.");
                return;
            }

            GraphicsSettings.defaultRenderPipeline = pipeline;
            EditorUtility.SetDirty(pipeline);
            ConfigureWebGraphicsApis();

            bool inputConfigured = ConfigureNewInputSystem();
            AssetDatabase.SaveAssets();

            if (inputConfigured)
            {
                Debug.Log("[Max Flix] URP is active. Web builds prefer WebGPU with WebGL 2 fallback, and Active Input Handling uses the New Input System. Restart the Editor when prompted.");
            }
            else
            {
                Debug.LogWarning("[Max Flix] URP is configured, but Active Input Handling could not be changed automatically. Set Project Settings > Player > Other Settings > Active Input Handling to Input System Package (New), then restart the Editor.");
            }
        }

        private static void ConfigureApplicationIdentity()
        {
            PlayerSettings.companyName = "Paleciaki";
            PlayerSettings.productName = "Paleciaki! Magazyn Chaosu";
            PlayerSettings.bundleVersion = "0.2.0";
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, AndroidApplicationId);

            // Match the existing Android application identity and prepare a Play-compatible 64-bit player.
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel26;
            PlayerSettings.Android.targetSdkVersion = AndroidSdkVersions.AndroidApiLevel36;

            // The game is designed around a landscape playfield on desktop and mobile.
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.LandscapeLeft;
            PlayerSettings.allowedAutorotateToPortrait = false;
            PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
            PlayerSettings.allowedAutorotateToLandscapeLeft = true;
            PlayerSettings.allowedAutorotateToLandscapeRight = true;
        }

        private static void ConfigureWebGraphicsApis()
        {
            // Prefer WebGPU on capable browsers, retaining OpenGLES3 as the
            // WebGL 2 fallback for browsers and devices without WebGPU support.
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.WebGL, false);
            PlayerSettings.SetGraphicsAPIs(
                BuildTarget.WebGL,
                new[] { GraphicsDeviceType.WebGPU, GraphicsDeviceType.OpenGLES3 });
        }

        private static void EnsureSettingsFolder()
        {
            if (!AssetDatabase.IsValidFolder(SettingsFolder))
            {
                if (!AssetDatabase.IsValidFolder("Assets/Settings"))
                    AssetDatabase.CreateFolder("Assets", "Settings");
            }
        }

        private static bool ConfigureNewInputSystem()
        {
            PlayerSettings settings = GetGlobalPlayerSettings();
            if (settings == null)
            {
                settings = Resources.FindObjectsOfTypeAll<PlayerSettings>().FirstOrDefault();
            }
            if (settings == null) return false;

            SerializedObject serializedSettings = new SerializedObject(settings);
            SerializedProperty activeInputHandler = serializedSettings.FindProperty("activeInputHandler");
            if (activeInputHandler == null) return false;

            activeInputHandler.intValue = NewInputSystemBackend;
            serializedSettings.ApplyModifiedProperties();
            return true;
        }

        // Unity 6.6 stores global Player Settings behind Build Profiles. This
        // reflection is deliberately isolated here and falls back to the classic
        // PlayerSettings object in Editor versions where that indirection differs.
        private static PlayerSettings GetGlobalPlayerSettings()
        {
            Type buildProfileType = AppDomain.CurrentDomain.GetAssemblies()
                .Select(assembly => assembly.GetType("UnityEditor.Build.Profile.BuildProfile"))
                .FirstOrDefault(type => type != null);

            if (buildProfileType == null) return null;

            const BindingFlags StaticPrivate = BindingFlags.Static | BindingFlags.NonPublic;
            const BindingFlags InstancePrivate = BindingFlags.Instance | BindingFlags.NonPublic;

            FieldInfo globalSettingsField = buildProfileType.GetField("s_GlobalPlayerSettings", StaticPrivate);
            PlayerSettings settings = globalSettingsField?.GetValue(null) as PlayerSettings;

            MethodInfo getActiveProfile = buildProfileType.GetMethod(
                "GetActiveBuildProfile",
                BindingFlags.Public | BindingFlags.Static);
            object activeProfile = getActiveProfile?.Invoke(null, null);
            if (activeProfile != null)
            {
                FieldInfo overrideField = buildProfileType.GetField("m_PlayerSettings", InstancePrivate);
                PlayerSettings overrideSettings = overrideField?.GetValue(activeProfile) as PlayerSettings;
                if (overrideSettings != null) settings = overrideSettings;
            }

            return settings;
        }
    }
}
#endif
