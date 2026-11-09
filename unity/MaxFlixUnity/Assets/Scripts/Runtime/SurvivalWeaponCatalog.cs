using System;
using System.Collections.Generic;
using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    public enum SurvivalUpgradeRarity
    {
        Common = 0,
        Rare = 1,
        Epic = 2,
        Legendary = 3
    }

    [Serializable]
    public sealed class SurvivalWeaponProfile
    {
        public SurvivalWeaponKind Id;
        public string DisplayName;
        public string EvolvedName;
        public string Description;
        public string Icon;
        public float BaseCooldown;
        public float UnlockAfterSeconds;
        public Color Color;
        public string EvolutionPassive;
    }

    public sealed class SurvivalUpgradeCard
    {
        public string Id;
        public string Title;
        public string Description;
        public string Icon;
        public SurvivalUpgradeRarity Rarity;
        public float Strength;
        public SurvivalWeaponKind Weapon;
        public bool HasWeapon;
    }

    /// <summary>
    /// Source-aligned weapon list, unlock schedule, rarity and reload progression.
    /// The runtime behaviors are implemented in SurvivalWeaponController.
    /// </summary>
    public static class SurvivalWeaponCatalog
    {
        private static readonly SurvivalWeaponProfile[] Profiles =
        {
            Make(SurvivalWeaponKind.PalletCannon, "Działo paletowe", "PALETA GIGA", "Precyzyjny pocisk z kontrolowaną falą uderzeniową.", "▰", 8.6f, 30f, new Color(0.96f, 0.62f, 0.04f), "damage"),
            Make(SurvivalWeaponKind.DiamondSaw, "Tarcza diamentowa", "TARCZA RYKOSZETU", "Ostrze przebija linię przeciwników i odbija się od granicy areny.", "◈", 9.7f, 55f, new Color(0.13f, 0.83f, 0.92f), "range"),
            Make(SurvivalWeaponKind.GlueMine, "Mina Mapei", "MAPEI BLACKOUT", "Mina obszarowa spowalniająca i rozbijająca szyk wrogów.", "●", 11.3f, 80f, new Color(0.65f, 0.49f, 0.98f), "magnet"),
            Make(SurvivalWeaponKind.KfcBomber, "Kubełek bombowy", "KUBEŁEK FURII", "Pocisk obszarowy z efektem podpalenia celów.", "✦", 12.7f, 105f, new Color(0.94f, 0.27f, 0.27f), "scavenger"),
            Make(SurvivalWeaponKind.PiorunDrone, "Dron Piorun", "PIORUN CHAIN MK II", "Szybki pocisk samonaprowadzający z dodatkowym przebiciem.", "⬡", 10.4f, 130f, new Color(0.22f, 0.74f, 0.97f), "drone"),
            Make(SurvivalWeaponKind.ForkliftBolter, "Nitownica UDT", "NITOWNICA OBLĘŻNICZA", "Wąski, bardzo szybki pocisk przebijający kilka celów.", "⟡", 7.0f, 155f, new Color(0.98f, 0.75f, 0.14f), "rapid"),
            Make(SurvivalWeaponKind.ScannerPulse, "Impuls skanera B4", "SKANER TOTALNY", "Namierzający impuls przebijający zwartą formację.", "⌁", 9.0f, 180f, new Color(0.40f, 0.91f, 0.97f), "range"),
            Make(SurvivalWeaponKind.OrbitBlades, "Wirujące tarcze", "ORBITALNA STREFA BHP", "Ostrza krążące wokół operatora i chroniące bliski dystans.", "⚙", 14.5f, 205f, new Color(0.53f, 0.94f, 0.68f), "armor"),
            Make(SurvivalWeaponKind.CalacattaShards, "Odłamki Calacatty", "BURZA WIELKIEGO FORMATU", "Ciężkie odłamki gresu lecące wachlarzem i przebijające kilka celów.", "◇", 12.0f, 230f, new Color(0.90f, 0.91f, 0.94f), "damage"),
            Make(SurvivalWeaponKind.SteamBomb, "Bomba Parowa", "KOCIOŁ B4", "Ciśnieniowy pocisk tworzący strefę spowolnienia.", "◉", 13.5f, 255f, new Color(0.49f, 0.83f, 0.98f), "regen"),
            Make(SurvivalWeaponKind.ForkliftHorn, "Klakson Sztaplarki", "ALARM CAŁEJ HALI", "Fala dźwiękowa odrzuca i ogłusza wrogów wokół operatora.", "≋", 17.0f, 280f, new Color(0.98f, 0.57f, 0.24f), "armor"),
            Make(SurvivalWeaponKind.WzBoomerang, "WZ-Bumerang", "PROTOKÓŁ POWROTU", "Magiczna WZ-tka przecina linię wrogów i wraca do operatora.", "↶", 13.0f, 305f, new Color(0.96f, 0.72f, 0.18f), "growth")
        };

        private static readonly string[] PassiveIds =
        {
            "damage", "rapid", "critical", "critical_damage", "boots", "magnet",
            "reinforced", "medkit", "range", "growth", "armor"
        };

        public static SurvivalWeaponProfile[] GetAll()
        {
            return (SurvivalWeaponProfile[])Profiles.Clone();
        }

        public static SurvivalWeaponProfile Get(SurvivalWeaponKind id)
        {
            for (int i = 0; i < Profiles.Length; i++)
                if (Profiles[i].Id == id) return Profiles[i];
            return Profiles[0];
        }

        public static bool TryParse(string value, out SurvivalWeaponKind id)
        {
            string normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
            switch (normalized)
            {
                case "pallet_cannon": id = SurvivalWeaponKind.PalletCannon; return true;
                case "diamond_saw": id = SurvivalWeaponKind.DiamondSaw; return true;
                case "glue_mine": id = SurvivalWeaponKind.GlueMine; return true;
                case "kfc_bomber": id = SurvivalWeaponKind.KfcBomber; return true;
                case "piorun_drone": id = SurvivalWeaponKind.PiorunDrone; return true;
                case "forklift_bolter": id = SurvivalWeaponKind.ForkliftBolter; return true;
                case "scanner_pulse": id = SurvivalWeaponKind.ScannerPulse; return true;
                case "orbit_blades": id = SurvivalWeaponKind.OrbitBlades; return true;
                case "calacatta_shards": id = SurvivalWeaponKind.CalacattaShards; return true;
                case "steam_bomb": id = SurvivalWeaponKind.SteamBomb; return true;
                case "forklift_horn": id = SurvivalWeaponKind.ForkliftHorn; return true;
                case "wz_boomerang": id = SurvivalWeaponKind.WzBoomerang; return true;
                default: id = SurvivalWeaponKind.PalletCannon; return false;
            }
        }

        public static float GetUnlockSeconds(SurvivalWeaponKind id) { return Get(id).UnlockAfterSeconds; }

        public static float GetReloadSeconds(SurvivalWeaponKind id, int level, bool evolved, float multiplier = 1f)
        {
            SurvivalWeaponProfile profile = Get(id);
            int levelIndex = Mathf.Clamp(level - 1, 0, 4);
            float levelFactor = Mathf.Max(0.88f, 1f - levelIndex * 0.03f);
            return profile.BaseCooldown * levelFactor * (evolved ? 0.90f : 1f) * Mathf.Clamp(multiplier, 0.72f, 1.5f);
        }

        public static float GetDispatchInterval() { return 1.05f; }

        public static int GetInitialLevel(SurvivalUpgradeRarity rarity)
        {
            if (rarity == SurvivalUpgradeRarity.Legendary) return 3;
            if (rarity == SurvivalUpgradeRarity.Epic) return 2;
            return 1;
        }

        public static int GetUpgradeSteps(SurvivalUpgradeRarity rarity)
        {
            return rarity == SurvivalUpgradeRarity.Legendary ? 2 : 1;
        }

        public static SurvivalUpgradeRarity RollRarity(float randomValue, int level)
        {
            float roll = float.IsNaN(randomValue) || float.IsInfinity(randomValue) ? 0.5f : Mathf.Clamp(randomValue, 0f, 0.999999f);
            int safeLevel = Mathf.Max(1, level);
            float progressionBonus = Mathf.Min(0.025f, (safeLevel - 1) * 0.001f);
            if (roll < 0.01f + progressionBonus) return SurvivalUpgradeRarity.Legendary;
            if (roll < 0.08f + progressionBonus * 1.4f) return SurvivalUpgradeRarity.Epic;
            if (roll < 0.30f + progressionBonus * 1.2f) return SurvivalUpgradeRarity.Rare;
            return SurvivalUpgradeRarity.Common;
        }

        public static SurvivalUpgradeRarity GetPromotionRarityFloor(int level)
        {
            if (level < 5 || level % 5 != 0) return SurvivalUpgradeRarity.Common;
            if (level == 5) return SurvivalUpgradeRarity.Rare;
            if (level < 20) return SurvivalUpgradeRarity.Epic;
            return SurvivalUpgradeRarity.Legendary;
        }

        public static float GetRarityStrength(SurvivalUpgradeRarity rarity)
        {
            switch (rarity)
            {
                case SurvivalUpgradeRarity.Rare: return 1.20f;
                case SurvivalUpgradeRarity.Epic: return 1.45f;
                case SurvivalUpgradeRarity.Legendary: return 1.75f;
                default: return 1f;
            }
        }

        public static string GetRarityLabel(SurvivalUpgradeRarity rarity)
        {
            switch (rarity)
            {
                case SurvivalUpgradeRarity.Rare: return "RZADKA";
                case SurvivalUpgradeRarity.Epic: return "EPICKA";
                case SurvivalUpgradeRarity.Legendary: return "LEGENDARNA";
                default: return "ZWYKŁA";
            }
        }

        public static SurvivalUpgradeRarity ApplyRarityFloor(SurvivalUpgradeRarity rarity, SurvivalUpgradeRarity floor)
        {
            return (SurvivalUpgradeRarity)Mathf.Max((int)rarity, (int)floor);
        }

        public static int GetXpRequirement(int level)
        {
            int current = Mathf.Max(1, level);
            if (current == 1) return 9;
            if (current == 2) return 15;
            return Mathf.Max(12, Mathf.RoundToInt((10f + current * 3f) * 0.90f));
        }

        public static string GetRankName(int level)
        {
            if (level >= 25) return "LEGENDA B4";
            if (level >= 20) return "KIEROWNIK";
            if (level >= 15) return "BRYGADZISTA";
            if (level >= 10) return "SPECJALISTA";
            if (level >= 5) return "OPERATOR";
            return "NOWICJUSZ";
        }

        public static string GetNextRankName(int level)
        {
            if (level < 5) return "OPERATOR";
            if (level < 10) return "SPECJALISTA";
            if (level < 15) return "BRYGADZISTA";
            if (level < 20) return "KIEROWNIK";
            if (level < 25) return "LEGENDA B4";
            return "MISTRZOSTWO B4";
        }

        public static bool IsPromotion(int level)
        {
            return level > 1 && level % 5 == 0;
        }

        public static string[] GetPassiveIds()
        {
            return (string[])PassiveIds.Clone();
        }

        private static SurvivalWeaponProfile Make(
            SurvivalWeaponKind id, string name, string evolvedName, string description, string icon,
            float cooldown, float unlockAfter, Color color, string evolutionPassive)
        {
            return new SurvivalWeaponProfile
            {
                Id = id,
                DisplayName = name,
                EvolvedName = evolvedName,
                Description = description,
                Icon = icon,
                BaseCooldown = cooldown,
                UnlockAfterSeconds = unlockAfter,
                Color = color,
                EvolutionPassive = evolutionPassive
            };
        }
    }
}
