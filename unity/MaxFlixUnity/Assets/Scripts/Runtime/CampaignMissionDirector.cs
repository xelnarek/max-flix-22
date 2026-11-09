using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    /// <summary>
    /// Owns the three-sector Campaign route, boss-gated transitions, VIP orders
    /// and the final delivery condition. Progress is stored locally per device.
    /// </summary>
    public sealed class CampaignMissionDirector : MonoBehaviour
    {
        private const string UnlockedSectorKey = "maxFlizUnlockedSector";
        private const int RequiredVipOrders = 4;
        private const float SectorBStartX = 36f;
        private const float SectorCStartX = 116f;
        private const float FinishGateX = 201.2f;

        private PlayerController _player;
        private HudController _hud;
        private BoxCollider _sectorBGate;
        private BoxCollider _sectorCGate;
        private Renderer _sectorBGateRenderer;
        private Renderer _sectorCGateRenderer;
        private int _maxUnlockedSector = 1;
        private int _activeSector = 1;
        private int _vipOrdersCollected;
        private bool _finalWalczakDefeated;
        private bool _finalKingLetoDefeated;
        private bool _completed;
        private string _lastStatus = string.Empty;

        public int VipOrdersCollected { get { return _vipOrdersCollected; } }
        public int RequiredVipOrderCount { get { return RequiredVipOrders; } }
        public int MaxUnlockedSector { get { return _maxUnlockedSector; } }

        public void ConfigureGates(BoxCollider sectorBGate, BoxCollider sectorCGate)
        {
            _sectorBGate = sectorBGate;
            _sectorCGate = sectorCGate;
            _sectorBGateRenderer = sectorBGate != null ? sectorBGate.GetComponent<Renderer>() : null;
            _sectorCGateRenderer = sectorCGate != null ? sectorCGate.GetComponent<Renderer>() : null;
        }

        public void Initialize(PlayerController player, HudController hud)
        {
            _player = player;
            _hud = hud;
            _maxUnlockedSector = Mathf.Clamp(PlayerPrefs.GetInt(UnlockedSectorKey, 1), 1, 3);
            ApplyGateState();
            RefreshStatus(true);
        }

        private void Update()
        {
            if (_completed || _player == null || GameSession.Current == null
                || GameSession.Current.State != GameFlowState.Playing) return;

            float x = _player.transform.position.x;
            int nextSector = x < SectorBStartX ? 1 : x < SectorCStartX ? 2 : 3;
            if (nextSector != _activeSector)
            {
                _activeSector = nextSector;
                RefreshStatus(true);
            }
            TryCompleteDelivery(x);
        }

        public void OnEnemyDefeated(EnemyAgent enemy)
        {
            if (_completed || enemy == null) return;
            float x = enemy.transform.position.x;
            if (enemy.Kind == EnemyKind.BosmanKrakow && x < SectorBStartX)
            {
                UnlockSector(2);
            }
            else if (enemy.Kind == EnemyKind.KingLeto && x >= SectorBStartX && x < SectorCStartX)
            {
                UnlockSector(3);
            }
            else if (x >= SectorCStartX && enemy.Kind == EnemyKind.Walczak)
            {
                _finalWalczakDefeated = true;
                RefreshStatus(true);
            }
            else if (x >= SectorCStartX && enemy.Kind == EnemyKind.KingLeto)
            {
                _finalKingLetoDefeated = true;
                RefreshStatus(true);
            }
        }

        public void CollectVipOrder()
        {
            if (_completed || _vipOrdersCollected >= 5) return;
            _vipOrdersCollected++;
            if (GameSession.Current != null) GameSession.Current.Score += 50;
            RefreshStatus(true);
        }

        private void UnlockSector(int sector)
        {
            if (sector <= _maxUnlockedSector) return;
            _maxUnlockedSector = Mathf.Clamp(sector, 1, 3);
            PlayerPrefs.SetInt(UnlockedSectorKey, _maxUnlockedSector);
            PlayerPrefs.Save();
            ApplyGateState();
            RefreshStatus(true);
            if (_hud != null)
            {
                _hud.SetStatus(sector == 2
                    ? "SEKTOR B ODBLOKOWANY • BRAMA SHOWROOMU OTWARTA"
                    : "SEKTOR C ODBLOKOWANY • TERMINAL VIP DOSTĘPNY");
            }
        }

        private void ApplyGateState()
        {
            bool lockB = _maxUnlockedSector < 2;
            bool lockC = _maxUnlockedSector < 3;
            if (_sectorBGate != null) _sectorBGate.enabled = lockB;
            if (_sectorCGate != null) _sectorCGate.enabled = lockC;
            if (_sectorBGateRenderer != null) _sectorBGateRenderer.enabled = lockB;
            if (_sectorCGateRenderer != null) _sectorCGateRenderer.enabled = lockC;
        }

        private void RefreshStatus(bool force)
        {
            string objective;
            if (_activeSector == 1)
                objective = _maxUnlockedSector < 2 ? "BOSS: BOSMAN KRAKÓW" : "BRAMA B OTWARTA";
            else if (_activeSector == 2)
                objective = _maxUnlockedSector < 3 ? "BOSS: DYREKTOR WIDMO" : "BRAMA C OTWARTA";
            else
            {
                string bosses = (_finalWalczakDefeated ? "✓" : "NADZORCA ZERO")
                    + " / " + (_finalKingLetoDefeated ? "✓" : "DYREKTOR WIDMO");
                objective = "BOSSOWIE TERMINALU: " + bosses;
            }

            string value = "KAMPANIA • SEKTOR " + (_activeSector == 1 ? "A" : _activeSector == 2 ? "B" : "C")
                + " • " + objective + " • VIP " + _vipOrdersCollected + "/" + RequiredVipOrders;
            if (!force && value == _lastStatus) return;
            _lastStatus = value;
            if (_hud != null) _hud.SetStatus(value);
        }

        private void TryCompleteDelivery(float playerX)
        {
            if (playerX < FinishGateX) return;
            if (!_finalWalczakDefeated || !_finalKingLetoDefeated)
            {
                RefreshStatus(true);
                return;
            }
            if (_vipOrdersCollected < RequiredVipOrders)
            {
                RefreshStatus(true);
                return;
            }

            _completed = true;
            if (GameSession.Current != null)
            {
                GameSession.Current.Score += 500;
                GameSession.SetState(GameFlowState.Victory);
            }
            _hud?.PresentCampaignVictory(_vipOrdersCollected, RequiredVipOrders);
        }
    }
}
