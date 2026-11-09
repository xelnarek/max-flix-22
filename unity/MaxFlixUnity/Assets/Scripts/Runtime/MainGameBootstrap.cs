using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    public sealed class MainGameBootstrap : MonoBehaviour
    {
        private static MainGameBootstrap _instance;

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

            GameSession.Begin(GameMode.Campaign, OperatorId.Marcin, WarehouseMapId.WarehouseB4);
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
