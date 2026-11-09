using System;
using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    public enum GameMode
    {
        Campaign = 0,
        Survival = 1,
        PvP = 2
    }

    public enum GameFlowState
    {
        Boot = 0,
        MainMenu = 1,
        Loading = 2,
        Playing = 3,
        Paused = 4,
        LevelUp = 5,
        Victory = 6,
        GameOver = 7,
        PvpLobby = 8,
        PvpMatchEnd = 9
    }

    public enum OperatorId
    {
        Marcin = 0,
        Grzesiek = 1,
        Dawid = 2,
        Mateusz = 3,
        Piotr = 4
    }

    public enum WarehouseMapId
    {
        WarehouseB4 = 0,
        ContainerTerminal = 1,
        ColdStorage = 2,
        NightSorting = 3
    }

    public enum SurvivalSecretStyle
    {
        Wz = 0,
        Cassette = 1,
        Capybara = 2,
        RabbitHole = 3
    }

    public enum CollectibleKind
    {
        Grout = 0,
        TileBox = 1,
        Coffee = 2,
        VipItem = 3,
        Espresso = 4,
        Magnet = 5,
        GoldenCutter = 6,
        KfcBucket = 7,
        Carrara = 8,
        EasterEgg = 9
    }

    public enum PerkKind
    {
        Hardhat = 0,
        VibramBoots = 1,
        OrderMagnet = 2,
        EspressoBoost = 3,
        KfcBucket = 4,
        GoldenPaleciak = 5,
        StretchArmor = 6,
        AttackHaste = 7,
        ArcDrone = 8,
        XpSurge = 9,
        DamageWard = 10,
        ForkliftHorn = 11,
        NightShiftEspresso = 12,
        GoldenWz = 13,
        PalletGuard = 14
    }

    public enum SurvivalWeaponKind
    {
        PalletCannon = 0,
        DiamondSaw = 1,
        GlueMine = 2,
        KfcBomber = 3,
        PiorunDrone = 4,
        ForkliftBolter = 5,
        ScannerPulse = 6,
        OrbitBlades = 7,
        CalacattaShards = 8,
        SteamBomb = 9,
        ForkliftHorn = 10,
        WzBoomerang = 11
    }

    public enum EnemyKind
    {
        Customer = 0,
        Walczak = 1,
        Forklift = 2,
        Architect = 3,
        Inspector = 4,
        AgvRobot = 5,
        Handlowiec = 6,
        Monter = 7,
        PiorunDrone = 8,
        EliteWalczakGuard = 9,
        Kurier = 10,
        ItalianVendor = 11,
        CrazyStacker = 12,
        KingLeto = 13,
        PanRoman = 14,
        Serwisant = 15,
        BosmanKrakow = 16,
        ZombieWorker = 17,
        Pomazaniec = 18,
        Sebix = 19,
        MutantGammaForklift = 20,
        RadioactivePip = 21,
        CyberSalesman = 22
    }

    [Serializable]
    public sealed class OperatorProfile
    {
        public OperatorId Id;
        public string DisplayName;
        public string Role;
        public string ClassName;
        public Color PrimaryColor;
        public Color SecondaryColor;
        public float MoveSpeed;
        public float JumpForce;
        public int MaxHealth;
        public float BasicAttackDamageMultiplier;
        public float DamageTakenMultiplier;
        public float AbilityCooldownSeconds;
        public string PassiveName;
        public string AbilityName;
        public float GaitFrequency;
        public float Stride;
        public float ArmSwing;
        public float AttackDurationSeconds;
    }

    [Serializable]
    public sealed class RunSnapshot
    {
        public GameMode Mode;
        public GameFlowState State;
        public OperatorId SelectedOperator;
        public WarehouseMapId SelectedMap;
        public int Score;
        public int Coins;
        public int Kills;
        public int BossesDefeated;
        public int HighestWave;
        public float ElapsedSeconds;
    }

    public static class GameSession
    {
        public static RunSnapshot Current { get; private set; } = CreateDefault();

        public static void Begin(GameMode mode, OperatorId operatorId, WarehouseMapId mapId)
        {
            Current = new RunSnapshot
            {
                Mode = mode,
                State = GameFlowState.Playing,
                SelectedOperator = operatorId,
                SelectedMap = mapId
            };
        }

        public static void SetState(GameFlowState state)
        {
            if (Current == null) Current = CreateDefault();
            Current.State = state;
        }

        public static void AddElapsedTime(float deltaSeconds)
        {
            if (Current == null || float.IsNaN(deltaSeconds) || float.IsInfinity(deltaSeconds) || deltaSeconds <= 0f) return;
            Current.ElapsedSeconds += deltaSeconds;
        }

        private static RunSnapshot CreateDefault()
        {
            return new RunSnapshot
            {
                Mode = GameMode.Campaign,
                State = GameFlowState.Boot,
                SelectedOperator = OperatorId.Marcin,
                SelectedMap = WarehouseMapId.WarehouseB4
            };
        }
    }
}
