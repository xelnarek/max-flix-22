#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.Linq;
using MaxFlix.Unity.Runtime;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace MaxFlix.Unity.Editor
{
    /// <summary>
    /// Fails a Unity Player build when core project settings or stable
    /// source-data contracts drift. The four-biome world is now wired into the
    /// runtime factory, but only a real Editor build and device playtest can
    /// validate collision, navigation, visual blending and release behaviour.
    /// </summary>
    public sealed class UnityProjectReadinessAudit : IPreprocessBuildWithReport
    {
        private const string AndroidApplicationId = "pl.paleciaki.magazynchaosu";
        private const string BootstrapScenePath = "Assets/Scenes/Bootstrap.unity";

        public int callbackOrder { get { return -900; } }

        public void OnPreprocessBuild(BuildReport report)
        {
            Validate(true, report.summary.platform);
        }

        [MenuItem("Max Flix/Run migration readiness audit")]
        public static void ValidateFromMenu()
        {
            Validate(false, null);
        }

        private static void Validate(bool failBuild, BuildTarget? target)
        {
            List<string> failures = new List<string>();
            Check(
                GraphicsSettings.defaultRenderPipeline is UniversalRenderPipelineAsset,
                "Universal Render Pipeline is not assigned in Graphics Settings.",
                failures);

            bool bootstrapEnabled = EditorBuildSettings.scenes.Any(
                scene => scene.enabled && scene.path == BootstrapScenePath);
            Check(bootstrapEnabled,
                "Bootstrap scene is missing or disabled in Build Settings. Run Max Flix > Repair Bootstrap Scene and Build Settings.",
                failures);

            Check(PlayerSettings.companyName == "Paleciaki",
                "Company name must remain Paleciaki.", failures);
            Check(PlayerSettings.productName == "Warehouse MaDDnes",
                "Product name does not match the shipping app identity.", failures);
            Check(PlayerSettings.GetApplicationIdentifier(NamedBuildTarget.Android) == AndroidApplicationId,
                "Android application ID must remain " + AndroidApplicationId + ".", failures);
            Check(PlayerSettings.GetScriptingBackend(NamedBuildTarget.Android) == ScriptingImplementation.IL2CPP,
                "Android scripting backend must be IL2CPP.", failures);
            Check((PlayerSettings.Android.targetArchitectures & AndroidArchitecture.ARM64) != 0,
                "Android ARM64 architecture is not enabled.", failures);
            Check(PlayerSettings.Android.minSdkVersion == AndroidSdkVersions.AndroidApiLevel26,
                "Android minimum API must remain 26.", failures);
            Check(PlayerSettings.Android.targetSdkVersion == AndroidSdkVersions.AndroidApiLevel36,
                "Android target API must remain 36.", failures);
            Check(!PlayerSettings.runInBackground && !PlayerSettings.Android.predictiveBackSupport,
                "Keep Run In Background and Android Predictive Back disabled together; Unity 6000.6.8f1 has a known resume/back issue.",
                failures);
            Check(PlayerSettings.Android.optimizedFramePacing,
                "Android optimized frame pacing should remain enabled.", failures);
            Check(PlayerSettings.defaultInterfaceOrientation == UIOrientation.LandscapeLeft,
                "The primary player orientation must remain landscape.", failures);
            Check(!PlayerSettings.allowedAutorotateToPortrait && !PlayerSettings.allowedAutorotateToPortraitUpsideDown,
                "Portrait auto-rotation must remain disabled.", failures);

            Check(OperatorCatalog.All.Count() == Enum.GetValues(typeof(OperatorId)).Length,
                "OperatorCatalog does not cover every stable OperatorId.", failures);
            Check(GameContentCatalog.SurvivalMaps.Count == Enum.GetValues(typeof(WarehouseMapId)).Length,
                "GameContentCatalog does not cover every stable Survival map ID.", failures);
            Check(GameContentCatalog.SurvivalWeapons.Count == Enum.GetValues(typeof(SurvivalWeaponKind)).Length,
                "GameContentCatalog does not cover every stable Survival weapon ID.", failures);
            Check(SurvivalWeaponCatalog.GetAll().Length == Enum.GetValues(typeof(SurvivalWeaponKind)).Length,
                "SurvivalWeaponCatalog does not cover every stable Survival weapon ID.", failures);
            Check(EnemyArchetypeCatalog.GetAll().Length == Enum.GetValues(typeof(EnemyKind)).Length,
                "EnemyArchetypeCatalog does not cover every stable EnemyKind.", failures);
            Check(SurvivalWorldLayout.Zones.Count == 4 && SurvivalWorldLayout.Transitions.Count == 4,
                "Unity's Survival topology contract must contain four zones and four adjacent transitions.", failures);

            Check(
                SurvivalWorldLayout.GetBiomeAtPosition(-60f, -20f) == WarehouseMapId.WarehouseB4
                && SurvivalWorldLayout.GetBiomeAtPosition(60f, -20f) == WarehouseMapId.ContainerTerminal
                && SurvivalWorldLayout.GetBiomeAtPosition(60f, 20f) == WarehouseMapId.ColdStorage
                && SurvivalWorldLayout.GetBiomeAtPosition(-60f, 20f) == WarehouseMapId.NightSorting,
                "Survival biome quadrants do not match the live Three.js world.", failures);
            Check(
                SurvivalWorldLayout.Zones.Any(z => z.MapId == WarehouseMapId.ColdStorage
                    && z.Center == new Vector2(60f, 20f)
                    && (z.OpenEdges & SurvivalBiomeEdge.West) == SurvivalBiomeEdge.West
                    && (z.OpenEdges & SurvivalBiomeEdge.North) == SurvivalBiomeEdge.North)
                && SurvivalWorldLayout.Zones.Any(z => z.MapId == WarehouseMapId.NightSorting
                    && z.Center == new Vector2(-60f, 20f)
                    && (z.OpenEdges & SurvivalBiomeEdge.East) == SurvivalBiomeEdge.East
                    && (z.OpenEdges & SurvivalBiomeEdge.North) == SurvivalBiomeEdge.North),
                "Survival north-biome positions or reciprocal portal openings do not match the source layout.", failures);
            Check(
                SurvivalWorldLayout.Transitions.Any(t => t.Id == "b4-to-port"
                    && t.From == WarehouseMapId.WarehouseB4 && t.To == WarehouseMapId.ContainerTerminal
                    && t.Center == new Vector2(0f, -20f) && t.Width == 22f)
                && SurvivalWorldLayout.Transitions.Any(t => t.Id == "port-to-cold"
                    && t.From == WarehouseMapId.ContainerTerminal && t.To == WarehouseMapId.ColdStorage
                    && t.Center == new Vector2(60f, 0f) && t.Width == 22f)
                && SurvivalWorldLayout.Transitions.Any(t => t.Id == "cold-to-night"
                    && t.From == WarehouseMapId.ColdStorage && t.To == WarehouseMapId.NightSorting
                    && t.Center == new Vector2(0f, 20f) && t.Width == 22f)
                && SurvivalWorldLayout.Transitions.Any(t => t.Id == "night-to-b4"
                    && t.From == WarehouseMapId.NightSorting && t.To == WarehouseMapId.WarehouseB4
                    && t.Center == new Vector2(-60f, 0f) && t.Width == 22f),
                "Survival transition endpoints or 22 m blend-band widths do not match the source layout.", failures);

            Check(
                Mathf.Abs(SurvivalWorldLayout.BiomeHalfWidth * 2f - 120f) < 0.001f
                && Mathf.Abs(SurvivalWorldLayout.BiomeHalfDepth * 2f - 40f) < 0.001f
                && SurvivalWorldLayout.Contains(-120f, -40f)
                && SurvivalWorldLayout.Contains(120f, 40f)
                && !SurvivalWorldLayout.Contains(120.1f, 0f),
                "The connected Survival world must tile the exact 240 × 80 m outer bounds.", failures);
            Check(
                SurvivalWorldLayout.GetZoneCenter(WarehouseMapId.WarehouseB4) == new Vector2(-60f, -20f)
                && SurvivalWorldLayout.GetZoneCenter(WarehouseMapId.ContainerTerminal) == new Vector2(60f, -20f)
                && SurvivalWorldLayout.GetZoneCenter(WarehouseMapId.ColdStorage) == new Vector2(60f, 20f)
                && SurvivalWorldLayout.GetZoneCenter(WarehouseMapId.NightSorting) == new Vector2(-60f, 20f),
                "Biome spawn centres must match the source world quadrants.", failures);

            SurvivalBiomeBlendWeights hub = SurvivalWorldLayout.GetBlendWeights(0f, 0f);
            Check(
                Mathf.Abs(hub.Total - 1f) < 0.0001f
                && Mathf.Abs(hub.WarehouseB4 - 0.25f) < 0.0001f
                && Mathf.Abs(hub.ContainerTerminal - 0.25f) < 0.0001f
                && Mathf.Abs(hub.ColdStorage - 0.25f) < 0.0001f
                && Mathf.Abs(hub.NightSorting - 0.25f) < 0.0001f,
                "Four-way Survival biome blend must be normalized at the world hub.", failures);

            if (target.HasValue && target.Value == BuildTarget.WebGL)
            {
                GraphicsDeviceType[] apis = PlayerSettings.GetGraphicsAPIs(BuildTarget.WebGL);
                Check(apis.Length >= 2
                    && apis[0] == GraphicsDeviceType.WebGPU
                    && apis.Contains(GraphicsDeviceType.OpenGLES3),
                    "Web builds must prefer WebGPU and retain the WebGL 2/OpenGLES3 fallback.", failures);
            }

            if (failures.Count > 0)
            {
                string message = "[Max Flix] Unity migration readiness audit failed:\n - "
                    + string.Join("\n - ", failures);
                if (failBuild) throw new BuildFailedException(message);
                Debug.LogError(message);
                return;
            }

            Debug.Log("[Max Flix] Unity project configuration and stable catalog contracts passed.");

            // A green configuration audit is not a release approval. The
            // Editor build and real-device runtime path remain mandatory.
            Debug.LogWarning(
                "[Max Flix] CUTOVER BLOCKER: the connected Survival mega-world is wired in source but still needs "
                + "a real Unity Editor compile, visual/collision/navigation playtest and sustained device QA. "
                + "Rig attachment/retargeting, PvP, account/cloud services, ads/UMP and full secrets/events also remain.");
        }

        private static void Check(bool condition, string failure, List<string> failures)
        {
            if (!condition) failures.Add(failure);
        }
    }
}
#endif
