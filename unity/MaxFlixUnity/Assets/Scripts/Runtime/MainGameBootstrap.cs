using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    public sealed class MainGameBootstrap : MonoBehaviour
    {
        private static MainGameBootstrap _instance;
        private MainMenuController _menu;
        private HudController _hud;
        private GameMode _lastMode = GameMode.Survival;
        private OperatorId _lastOperator = OperatorId.Marcin;
        private WarehouseMapId _lastMap = WarehouseMapId.WarehouseB4;

        public static GameMode StartupMode { get; private set; } = GameMode.Survival;
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
            ShowMainMenu();
        }

        public void StartRun(GameMode mode, OperatorId operatorId, WarehouseMapId mapId)
        {
            if (mode == GameMode.PvP) return;

            Time.timeScale = 1f;
            if (_menu != null)
            {
                Destroy(_menu.gameObject);
                _menu = null;
            }
            if (_hud != null)
            {
                Destroy(_hud.gameObject);
                _hud = null;
            }

            WarehouseWorldFactory.DestroyCurrentWorld();
            ConfigureNextRun(mode, operatorId, mapId);
            _lastMode = mode;
            _lastOperator = operatorId;
            _lastMap = mapId;

            GameSession.Begin(mode, operatorId, mapId);
            PlayerController player = WarehouseWorldFactory.BuildB4Slice();
            _hud = HudController.Create(
                player,
                RestartLastRun,
                ReturnToMainMenu
            );
            player.Initialize(OperatorCatalog.Get(operatorId), _hud.Joystick, _hud);

            SurvivalMapProfile map = GameContentCatalog.GetMap(mapId);
            _hud.SetStatus(mode == GameMode.Survival
                ? "SURVIVAL • " + map.DisplayName.ToUpperInvariant() + " • ZMIANA 01"
                : "TRENING B4 • " + OperatorCatalog.Get(operatorId).ClassName);
        }

        public void RestartLastRun()
        {
            StartRun(_lastMode, _lastOperator, _lastMap);
        }

        public void ReturnToMainMenu()
        {
            Time.timeScale = 1f;
            if (_hud != null)
            {
                Destroy(_hud.gameObject);
                _hud = null;
            }
            WarehouseWorldFactory.DestroyCurrentWorld();
            ShowMainMenu();
        }

        private void ShowMainMenu()
        {
            Time.timeScale = 1f;
            GameSession.SetState(GameFlowState.MainMenu);
            if (_menu != null) Destroy(_menu.gameObject);
            _menu = MainMenuController.Create(this, StartupMode, StartupOperator, StartupMap);
        }

        private void OnDestroy()
        {
            if (_instance == this)
            {
                Time.timeScale = 1f;
                _instance = null;
            }
        }
    }
}
