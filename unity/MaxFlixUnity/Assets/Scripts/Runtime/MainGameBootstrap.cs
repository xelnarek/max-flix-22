using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    public sealed class MainGameBootstrap : MonoBehaviour
    {
        private static MainGameBootstrap _instance;

        public static GameMode StartupMode { get; private set; } = GameMode.Campaign;
        public static OperatorId StartupOperator { get; private set; } = OperatorId.Marcin;
        public static WarehouseMapId StartupMap { get; private set; } = WarehouseMapId.WarehouseB4;

        public static void ConfigureNextRun(GameMode mode, OperatorId operatorId, WarehouseMapId mapId)
        {
            StartupMode = mode;
            StartupOperator = operatorId;
            StartupMap = mapId;
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void InstallRuntime()
        {
            if (FindFirstObjectByType<MainGameBootstrap>() != null) return;
            GameObject entry = new GameObject("Max Flix Unity Runtime");
            entry.AddComponent<MainGameBootstrap>();
        }

        private void Awake()
        {
            if (_instance != null && _instance != this)
            {
                Destroy(gameObject);
                return;
            }

            _instance = this;
            DontDestroyOnLoad(gameObject);

            GameSession.Begin(StartupMode, StartupOperator, StartupMap);
            PlayerController player = WarehouseWorldFactory.BuildB4Slice();
            HudController hud = HudController.Create(player);
            player.Initialize(OperatorCatalog.Get(GameSession.Current.SelectedOperator), hud.Joystick, hud);

            hud.SetStatus("KOMPLEKS B4 • PRÓBA SILNIKA UNITY");
        }

        private void OnDestroy()
        {
            if (_instance == this) _instance = null;
        }
    }
}
