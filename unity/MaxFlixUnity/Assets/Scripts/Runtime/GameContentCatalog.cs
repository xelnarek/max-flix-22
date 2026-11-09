using System.Collections.Generic;
using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    public sealed class SurvivalSecretDefinition
    {
        public string Id;
        public string DisplayName;
        public Vector2 Position;
        public SurvivalSecretStyle Style;
    }

    public sealed class SurvivalMapProfile
    {
        public WarehouseMapId Id;
        public string DisplayName;
        public string Subtitle;
        public string Description;
        public float EnemyHealthMultiplier;
        public float EnemySpeedMultiplier;
        public float XpMultiplier;
        public Color BackgroundColor;
        public Color FogColor;
        public Color FloorColor;
        public Color WallColor;
        public Color AccentColor;
        public IReadOnlyList<SurvivalSecretDefinition> Secrets;
    }

    public sealed class SurvivalWeaponProfile
    {
        public SurvivalWeaponKind Id;
        public string DisplayName;
        public Color AccentColor;
    }

    /// <summary>
    /// Stable content identifiers and baseline map modifiers ported from
    /// src/survivalMaps.ts and src/survivalDamageStats.ts.
    /// </summary>
    public static class GameContentCatalog
    {
        private static readonly IReadOnlyDictionary<WarehouseMapId, SurvivalMapProfile> Maps =
            new Dictionary<WarehouseMapId, SurvivalMapProfile>
            {
                {
                    WarehouseMapId.WarehouseB4,
                    new SurvivalMapProfile
                    {
                        Id = WarehouseMapId.WarehouseB4,
                        DisplayName = "Magazyn B4",
                        Subtitle = "Wielki skład paletowy",
                        Description = "Klasyczna hala B4. Gęste regały, boczne doki i otwarta środkowa aleja. Równe warunki bez modyfikatorów przeciwników.",
                        EnemyHealthMultiplier = 1f,
                        EnemySpeedMultiplier = 1f,
                        XpMultiplier = 1f,
                        BackgroundColor = Hex(0x080f1c),
                        FogColor = Hex(0x080f1c),
                        FloorColor = Hex(0xffffff),
                        WallColor = Hex(0x1c2c3d),
                        AccentColor = Hex(0xf59e0b),
                        Secrets = new[]
                        {
                            Secret("golden_wz", "Złota WZ-tka", -48f, 6.5f, SurvivalSecretStyle.Wz),
                            Secret("b4_archive", "Tajna kaseta B4", 1.5f, -13.2f, SurvivalSecretStyle.Cassette),
                            Secret("bronze_capybara", "Kapibara z brązu", 48f, -6.5f, SurvivalSecretStyle.Capybara),
                            Secret("oniric_dream", "Oniryczny sen", -27f, 2.4f, SurvivalSecretStyle.RabbitHole)
                        }
                    }
                },
                {
                    WarehouseMapId.ContainerTerminal,
                    new SurvivalMapProfile
                    {
                        Id = WarehouseMapId.ContainerTerminal,
                        DisplayName = "Port Kontenerowy 17",
                        Subtitle = "Plac przeładunkowy",
                        Description = "Kolorowe kontenery tworzą szerokie slalomy, a suwnica góruje nad otwartą strefą przeładunku. Wrogowie są o 8% szybsi i o 6% mniej wytrzymali; eliminacje dają +12% XP.",
                        EnemyHealthMultiplier = 0.94f,
                        EnemySpeedMultiplier = 1.08f,
                        XpMultiplier = 1.12f,
                        BackgroundColor = Hex(0x101a28),
                        FogColor = Hex(0x172536),
                        FloorColor = Hex(0xc8d2dc),
                        WallColor = Hex(0x26394c),
                        AccentColor = Hex(0xfb923c),
                        Secrets = new[]
                        {
                            Secret("manifest_17", "Tajny manifest 17", -50f, 5.2f, SurvivalSecretStyle.Wz),
                            Secret("captains_tape", "Kaseta kapitana portu", 0f, 15.2f, SurvivalSecretStyle.Cassette),
                            Secret("dock_capybara", "Kapibara dokerów", 50f, -5.2f, SurvivalSecretStyle.Capybara),
                            Secret("oniric_dream", "Oniryczny sen", 28f, -1.8f, SurvivalSecretStyle.RabbitHole)
                        }
                    }
                },
                {
                    WarehouseMapId.ColdStorage,
                    new SurvivalMapProfile
                    {
                        Id = WarehouseMapId.ColdStorage,
                        DisplayName = "Chłodnia Zero",
                        Subtitle = "Komora mroźnicza",
                        Description = "Błękitna chłodnia z agregatami, rurami chłodniczymi i lodowymi pasami na posadzce. Wrogowie są o 10% wolniejsi, o 12% wytrzymalsi, a eliminacje dają +12% XP.",
                        EnemyHealthMultiplier = 1.12f,
                        EnemySpeedMultiplier = 0.90f,
                        XpMultiplier = 1.12f,
                        BackgroundColor = Hex(0x061725),
                        FogColor = Hex(0x0a2638),
                        FloorColor = Hex(0xc5f0ff),
                        WallColor = Hex(0x17364a),
                        AccentColor = Hex(0x67e8f9),
                        Secrets = new[]
                        {
                            Secret("frozen_wz", "Zamarznięta WZ-tka", -50f, -5.2f, SurvivalSecretStyle.Wz),
                            Secret("cold_archive", "Kaseta z komory -18°C", 0f, -15.2f, SurvivalSecretStyle.Cassette),
                            Secret("ice_capybara", "Lodowa kapibara", 50f, 5.2f, SurvivalSecretStyle.Capybara),
                            Secret("oniric_dream", "Oniryczny sen", -28f, -1.5f, SurvivalSecretStyle.RabbitHole)
                        }
                    }
                },
                {
                    WarehouseMapId.NightSorting,
                    new SurvivalMapProfile
                    {
                        Id = WarehouseMapId.NightSorting,
                        DisplayName = "Sortownia Widmowa",
                        Subtitle = "Nocna strefa skanerów",
                        Description = "Fioletowa sortownia pod neonowymi bramkami. Pulsujące pasy świetlne i skanery rozbijają monotonię hali. Przeciwnicy poruszają się o 4% szybciej, a eliminacje dają +15% XP.",
                        EnemyHealthMultiplier = 0.98f,
                        EnemySpeedMultiplier = 1.04f,
                        XpMultiplier = 1.15f,
                        BackgroundColor = Hex(0x090817),
                        FogColor = Hex(0x17132b),
                        FloorColor = Hex(0x30223d),
                        WallColor = Hex(0x362047),
                        AccentColor = Hex(0xf472b6),
                        Secrets = new[]
                        {
                            Secret("night_manifest", "Manifest po północy", -50f, 5.2f, SurvivalSecretStyle.Wz),
                            Secret("ghost_cassette", "Kaseta z nocnej zmiany", 0f, 15.2f, SurvivalSecretStyle.Cassette),
                            Secret("neon_capybara", "Kapibara neonów", 50f, -5.2f, SurvivalSecretStyle.Capybara),
                            Secret("oniric_dream", "Oniryczny sen", 27f, 2f, SurvivalSecretStyle.RabbitHole)
                        }
                    }
                }
            };

        private static readonly IReadOnlyDictionary<SurvivalWeaponKind, SurvivalWeaponProfile> Weapons =
            new Dictionary<SurvivalWeaponKind, SurvivalWeaponProfile>
            {
                { SurvivalWeaponKind.PalletCannon, Weapon(SurvivalWeaponKind.PalletCannon, "Działo paletowe", 0xf59e0b) },
                { SurvivalWeaponKind.DiamondSaw, Weapon(SurvivalWeaponKind.DiamondSaw, "Tarcza diamentowa", 0x22d3ee) },
                { SurvivalWeaponKind.GlueMine, Weapon(SurvivalWeaponKind.GlueMine, "Mina Mapei", 0xa78bfa) },
                { SurvivalWeaponKind.KfcBomber, Weapon(SurvivalWeaponKind.KfcBomber, "Kubełek bombowy", 0xef4444) },
                { SurvivalWeaponKind.PiorunDrone, Weapon(SurvivalWeaponKind.PiorunDrone, "Dron Piorun", 0x38bdf8) },
                { SurvivalWeaponKind.ForkliftBolter, Weapon(SurvivalWeaponKind.ForkliftBolter, "Wyrzutnia sztaplarki", 0xf97316) },
                { SurvivalWeaponKind.ScannerPulse, Weapon(SurvivalWeaponKind.ScannerPulse, "Impuls skanera", 0x67e8f9) },
                { SurvivalWeaponKind.OrbitBlades, Weapon(SurvivalWeaponKind.OrbitBlades, "Ostrza orbitalne", 0x84cc16) },
                { SurvivalWeaponKind.CalacattaShards, Weapon(SurvivalWeaponKind.CalacattaShards, "Odłamki Calacatta", 0xe2e8f0) },
                { SurvivalWeaponKind.SteamBomb, Weapon(SurvivalWeaponKind.SteamBomb, "Bomba parowa", 0x94a3b8) },
                { SurvivalWeaponKind.ForkliftHorn, Weapon(SurvivalWeaponKind.ForkliftHorn, "Klakson sztaplarki", 0xfbbf24) },
                { SurvivalWeaponKind.WzBoomerang, Weapon(SurvivalWeaponKind.WzBoomerang, "Bumerang WZ", 0x34d399) }
            };

        public static IReadOnlyCollection<SurvivalMapProfile> SurvivalMaps
        {
            get { return (IReadOnlyCollection<SurvivalMapProfile>)Maps.Values; }
        }

        public static IReadOnlyCollection<SurvivalWeaponProfile> SurvivalWeapons
        {
            get { return (IReadOnlyCollection<SurvivalWeaponProfile>)Weapons.Values; }
        }

        public static SurvivalMapProfile GetMap(WarehouseMapId id)
        {
            if (Maps.TryGetValue(id, out SurvivalMapProfile profile)) return profile;
            return Maps[WarehouseMapId.WarehouseB4];
        }

        public static SurvivalWeaponProfile GetWeapon(SurvivalWeaponKind id)
        {
            if (Weapons.TryGetValue(id, out SurvivalWeaponProfile profile)) return profile;
            return Weapons[SurvivalWeaponKind.PalletCannon];
        }

        private static SurvivalSecretDefinition Secret(string id, string name, float x, float z, SurvivalSecretStyle style)
        {
            return new SurvivalSecretDefinition
            {
                Id = id,
                DisplayName = name,
                Position = new Vector2(x, z),
                Style = style
            };
        }

        private static SurvivalWeaponProfile Weapon(SurvivalWeaponKind id, string name, uint rgb)
        {
            return new SurvivalWeaponProfile
            {
                Id = id,
                DisplayName = name,
                AccentColor = Hex(rgb)
            };
        }

        private static Color Hex(uint rgb)
        {
            return new Color(
                ((rgb >> 16) & 0xff) / 255f,
                ((rgb >> 8) & 0xff) / 255f,
                (rgb & 0xff) / 255f,
                1f
            );
        }
    }
}
