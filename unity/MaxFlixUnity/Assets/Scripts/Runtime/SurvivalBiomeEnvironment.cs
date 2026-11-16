using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    /// <summary>
    /// Smooth global ambience for the four connected Survival sectors.
    /// Material and gameplay changes are spatial; this component blends fog,
    /// ambient lighting and the key light without swapping scenes or cameras.
    /// </summary>
    [DisallowMultipleComponent]
    public sealed class SurvivalBiomeEnvironment : MonoBehaviour
    {
        private const float RefreshIntervalSeconds = 0.12f;
        private const float BlendSharpness = 3.8f;

        private Transform _player;
        private Light _keyLight;
        private float _elapsedSinceRefresh;

        public void Initialize(Transform player)
        {
            _player = player;
            Light[] lights = GetComponentsInChildren<Light>();
            for (int i = 0; i < lights.Length; i++)
            {
                if (lights[i] != null && lights[i].type == LightType.Directional)
                {
                    _keyLight = lights[i];
                    break;
                }
            }

            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogStartDistance = 32f;
            RenderSettings.fogEndDistance = 82f;
            ApplyBlend(1f);
        }

        private void LateUpdate()
        {
            if (_player == null) return;
            _elapsedSinceRefresh += Time.deltaTime;
            if (_elapsedSinceRefresh < RefreshIntervalSeconds) return;
            float elapsed = _elapsedSinceRefresh;
            _elapsedSinceRefresh = 0f;
            float blend = 1f - Mathf.Exp(-BlendSharpness * elapsed);
            ApplyBlend(blend);
        }

        private void ApplyBlend(float blend)
        {
            if (_player == null) return;
            SurvivalBiomeBlendWeights weights = SurvivalWorldLayout.GetBlendWeights(
                _player.position.x, _player.position.z);

            Color sky = BlendColor(
                GameContentCatalog.GetMap(WarehouseMapId.WarehouseB4).BackgroundColor,
                GameContentCatalog.GetMap(WarehouseMapId.ContainerTerminal).BackgroundColor,
                GameContentCatalog.GetMap(WarehouseMapId.ColdStorage).BackgroundColor,
                GameContentCatalog.GetMap(WarehouseMapId.NightSorting).BackgroundColor,
                weights);
            Color fog = BlendColor(
                GameContentCatalog.GetMap(WarehouseMapId.WarehouseB4).FogColor,
                GameContentCatalog.GetMap(WarehouseMapId.ContainerTerminal).FogColor,
                GameContentCatalog.GetMap(WarehouseMapId.ColdStorage).FogColor,
                GameContentCatalog.GetMap(WarehouseMapId.NightSorting).FogColor,
                weights);
            Color wall = BlendColor(
                GameContentCatalog.GetMap(WarehouseMapId.WarehouseB4).WallColor,
                GameContentCatalog.GetMap(WarehouseMapId.ContainerTerminal).WallColor,
                GameContentCatalog.GetMap(WarehouseMapId.ColdStorage).WallColor,
                GameContentCatalog.GetMap(WarehouseMapId.NightSorting).WallColor,
                weights);
            Color accent = BlendColor(
                GameContentCatalog.GetMap(WarehouseMapId.WarehouseB4).AccentColor,
                GameContentCatalog.GetMap(WarehouseMapId.ContainerTerminal).AccentColor,
                GameContentCatalog.GetMap(WarehouseMapId.ColdStorage).AccentColor,
                GameContentCatalog.GetMap(WarehouseMapId.NightSorting).AccentColor,
                weights);

            Color targetSky = Color.Lerp(sky, Color.white, 0.24f);
            Color targetEquator = Color.Lerp(wall, accent, 0.12f);
            Color targetGround = Color.Lerp(sky, Color.black, 0.18f);
            RenderSettings.ambientSkyColor = Color.Lerp(RenderSettings.ambientSkyColor, targetSky, blend);
            RenderSettings.ambientEquatorColor = Color.Lerp(RenderSettings.ambientEquatorColor, targetEquator, blend);
            RenderSettings.ambientGroundColor = Color.Lerp(RenderSettings.ambientGroundColor, targetGround, blend);
            RenderSettings.fogColor = Color.Lerp(RenderSettings.fogColor, fog, blend);
            if (_keyLight != null)
                _keyLight.color = Color.Lerp(_keyLight.color, Color.Lerp(new Color(1f, 0.86f, 0.68f), accent, 0.10f), blend);
        }

        private static Color BlendColor(
            Color warehouseB4,
            Color containerTerminal,
            Color coldStorage,
            Color nightSorting,
            SurvivalBiomeBlendWeights weights)
        {
            float total = Mathf.Max(0.0001f, weights.Total);
            return (
                warehouseB4 * weights.WarehouseB4
                + containerTerminal * weights.ContainerTerminal
                + coldStorage * weights.ColdStorage
                + nightSorting * weights.NightSorting
            ) / total;
        }
    }
}
