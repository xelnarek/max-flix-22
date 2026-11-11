#if UNITY_EDITOR
using System.Collections.Generic;
using System.Linq;
using MaxFlix.Unity.Runtime;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace MaxFlix.Unity.Editor
{
    /// <summary>
    /// Stops player builds when the staged CC0 GLB roster was not imported
    /// as skinned Unity assets by the pinned glTFast Editor importer.
    /// </summary>
    public sealed class GobkitAssetImportAudit : IPreprocessBuildWithReport
    {
        public int callbackOrder { get { return -1000; } }

        public void OnPreprocessBuild(BuildReport report)
        {
            ValidateImportedRigs(true);
        }

        [MenuItem("Max Flix/Validate imported CC0 character rigs")]
        public static void ValidateFromMenu()
        {
            ValidateImportedRigs(false);
        }

        private static void ValidateImportedRigs(bool failBuild)
        {
            List<string> failures = new List<string>();
            foreach (string modelId in GobkitActorCatalog.RequiredModelIds)
            {
                string path = GobkitActorCatalog.GetAssetPath(modelId);
                GameObject prefab = AssetDatabase.LoadAssetAtPath<GameObject>(path);
                if (prefab == null)
                {
                    failures.Add(modelId + ": missing or not imported as a GameObject at " + path);
                    continue;
                }

                SkinnedMeshRenderer[] renderers = prefab.GetComponentsInChildren<SkinnedMeshRenderer>(true);
                if (renderers == null || renderers.Length == 0)
                    failures.Add(modelId + ": imported asset has no SkinnedMeshRenderer.");

                string[] requiredClips = { "Idle", "Walk", "Run", "Death", "Hit" };
                string[] importedClips = AssetDatabase.LoadAllAssetsAtPath(path)
                    .OfType<AnimationClip>()
                    .Select(clip => clip.name)
                    .ToArray();
                foreach (string clipName in requiredClips)
                {
                    if (!importedClips.Contains(clipName))
                        failures.Add(modelId + ": missing imported animation clip " + clipName + ".");
                }
            }

            if (failures.Count > 0)
            {
                string message = "[Max Flix] CC0 rig import audit failed. Run `node scripts/fetch-gobkit-assets.mjs --strict --unity`, allow Unity to import the files, then validate again:\n - "
                    + string.Join("\n - ", failures);
                if (failBuild) throw new BuildFailedException(message);
                Debug.LogError(message);
                return;
            }

            Debug.Log("[Max Flix] CC0 rig import audit passed: " + GobkitActorCatalog.RequiredModelIds.Count + " skinned GLB rigs imported.");
        }
    }
}
#endif
