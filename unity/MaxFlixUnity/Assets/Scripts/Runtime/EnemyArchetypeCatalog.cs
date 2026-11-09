using System;
using System.Collections.Generic;
using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    public enum EnemyBehaviorStyle
    {
        MeleeChaser = 0,
        PatrolRammer = 1,
        Ranged = 2,
        Support = 3,
        Charger = 4,
        Boss = 5,
        HazardOnly = 6
    }

    [Serializable]
    public sealed class EnemyArchetypeProfile
    {
        public EnemyKind Id;
        public string DisplayName;
        public int BaseHealth;
        public float MoveSpeed;
        public float AttackInterval;
        public float AttackRange;
        public float AggroRange;
        public float AttackDamage;
        public EnemyBehaviorStyle Behavior;
        public Color AccentColor;
        public bool IsBoss;
        public bool IsHazardOnly;
        public int MinimumSurvivalWave;
        public float MinimumSurvivalElapsedSeconds;
        public int SurvivalSpawnWeight;
    }

    /// <summary>
    /// Enemy roster derived from the legacy enemy creation routines and
    /// src/survivalEnemySpawns.ts. Values labelled as combat cadence are
    /// first-pass Unity tuning; source HP/speed and Survival unlock weights
    /// are retained separately from the provisional AI behavior.
    /// </summary>
    public static class EnemyArchetypeCatalog
    {
        private static readonly Dictionary<EnemyKind, EnemyArchetypeProfile> Profiles =
            new Dictionary<EnemyKind, EnemyArchetypeProfile>
            {
                { EnemyKind.Customer, Make(EnemyKind.Customer, "Klient", 2, 1.8f, 1.55f, 1.55f, 16f, 1f, EnemyBehaviorStyle.MeleeChaser, new Color(0.78f, 0.20f, 0.18f), false, false) },
                { EnemyKind.Walczak, Make(EnemyKind.Walczak, "Nadzorca Zero", 10, 3.2f, 1.25f, 1.8f, 28f, 2f, EnemyBehaviorStyle.Boss, new Color(0.96f, 0.62f, 0.12f), true, false) },
                { EnemyKind.Forklift, Make(EnemyKind.Forklift, "Sztaplarka / zagrożenie", 0, 0f, 2f, 2f, 0f, 0f, EnemyBehaviorStyle.HazardOnly, new Color(0.96f, 0.62f, 0.12f), false, true) },
                { EnemyKind.Architect, Make(EnemyKind.Architect, "Architekt", 3, 2.2f, 1.7f, 8f, 18f, 1f, EnemyBehaviorStyle.Ranged, new Color(0.49f, 0.58f, 0.68f), false, false, 4, 0f, 8) },
                { EnemyKind.Inspector, Make(EnemyKind.Inspector, "Inspektor", 3, 2.0f, 2.5f, 7f, 17f, 1f, EnemyBehaviorStyle.Support, new Color(0.23f, 0.51f, 0.86f), false, false, 1, 0f, 10) },
                { EnemyKind.AgvRobot, Make(EnemyKind.AgvRobot, "Robot AGV", 2, 2.6f, 1.5f, 1.7f, 18f, 1f, EnemyBehaviorStyle.PatrolRammer, new Color(0.22f, 0.72f, 0.92f), false, false, 7, 0f, 6) },
                { EnemyKind.Handlowiec, Make(EnemyKind.Handlowiec, "Handlowiec", 3, 2.8f, 1.8f, 8f, 19f, 1f, EnemyBehaviorStyle.Ranged, new Color(0.56f, 0.35f, 0.88f), false, false, 1, 0f, 10) },
                { EnemyKind.Monter, Make(EnemyKind.Monter, "Monter", 4, 2.2f, 1.45f, 1.7f, 17f, 1f, EnemyBehaviorStyle.MeleeChaser, new Color(0.10f, 0.65f, 0.52f), false, false, 1, 0f, 11) },
                { EnemyKind.PiorunDrone, Make(EnemyKind.PiorunDrone, "Dron Piorun", 2, 3.5f, 1.25f, 10f, 22f, 1f, EnemyBehaviorStyle.Ranged, new Color(0.12f, 0.83f, 0.85f), false, false, 6, 0f, 6) },
                { EnemyKind.EliteWalczakGuard, Make(EnemyKind.EliteWalczakGuard, "Elitarny Strażnik Walczaka", 5, 2.4f, 1.2f, 1.8f, 20f, 1.5f, EnemyBehaviorStyle.Charger, new Color(0.96f, 0.25f, 0.37f), false, false, 8, 0f, 5) },
                { EnemyKind.Kurier, Make(EnemyKind.Kurier, "Kurier", 2, 4.5f, 1.35f, 1.55f, 18f, 1f, EnemyBehaviorStyle.MeleeChaser, new Color(0.14f, 0.72f, 0.57f), false, false, 1, 0f, 14) },
                { EnemyKind.ItalianVendor, Make(EnemyKind.ItalianVendor, "Przedstawiciel włoski", 3, 2.6f, 1.85f, 7f, 18f, 1f, EnemyBehaviorStyle.Ranged, new Color(0.90f, 0.38f, 0.24f), false, false, 5, 70f, 8) },
                { EnemyKind.CrazyStacker, Make(EnemyKind.CrazyStacker, "Szalony operator paleciaka", 4, 3.5f, 1.3f, 1.9f, 19f, 1.5f, EnemyBehaviorStyle.Charger, new Color(0.95f, 0.48f, 0.12f), false, false, 1, 0f, 12) },
                { EnemyKind.KingLeto, Make(EnemyKind.KingLeto, "Dyrektor Widmo", 12, 3.8f, 1.1f, 2f, 30f, 2f, EnemyBehaviorStyle.Boss, new Color(0.66f, 0.30f, 0.90f), true, false) },
                { EnemyKind.PanRoman, Make(EnemyKind.PanRoman, "Pan Roman", 4, 3.2f, 1.6f, 7f, 20f, 1f, EnemyBehaviorStyle.Ranged, new Color(0.12f, 0.57f, 0.78f), false, false, 7, 0f, 6) },
                { EnemyKind.Serwisant, Make(EnemyKind.Serwisant, "Serwisant B4u", 3, 2.6f, 2.1f, 6.5f, 18f, 1f, EnemyBehaviorStyle.Support, new Color(0.08f, 0.70f, 0.82f), false, false, 6, 0f, 8) },
                { EnemyKind.BosmanKrakow, Make(EnemyKind.BosmanKrakow, "Bosman Kraków", 8, 2.4f, 1.25f, 1.9f, 24f, 2f, EnemyBehaviorStyle.Boss, new Color(0.06f, 0.63f, 0.91f), true, false) },
                { EnemyKind.ZombieWorker, Make(EnemyKind.ZombieWorker, "Magazynier-Zombie", 2, 4.1f, 1.3f, 1.5f, 17f, 1f, EnemyBehaviorStyle.MeleeChaser, new Color(0.52f, 0.80f, 0.20f), false, false, 1, 0f, 15) },
                { EnemyKind.Pomazaniec, Make(EnemyKind.Pomazaniec, "Pomazaniec", 4, 3.5f, 1.2f, 1.8f, 20f, 1.5f, EnemyBehaviorStyle.Charger, new Color(0.94f, 0.24f, 0.40f), false, false) },
                { EnemyKind.Sebix, Make(EnemyKind.Sebix, "Operator Turbo", 14, 1.65f, 1.05f, 2.1f, 28f, 2.2f, EnemyBehaviorStyle.Boss, new Color(0.97f, 0.34f, 0.15f), true, false) },
                { EnemyKind.MutantGammaForklift, Make(EnemyKind.MutantGammaForklift, "Mutant Gamma-Sztaplarka", 7, 3.6f, 1.1f, 2.0f, 22f, 2f, EnemyBehaviorStyle.Boss, new Color(0.22f, 0.92f, 0.35f), true, false, 2, 90f, 4) },
                { EnemyKind.RadioactivePip, Make(EnemyKind.RadioactivePip, "Radioaktywny Inspektor PIP", 6, 3.2f, 2.3f, 7.5f, 20f, 1.25f, EnemyBehaviorStyle.Support, new Color(0.65f, 0.93f, 0.17f), false, false, 3, 150f, 4) },
                { EnemyKind.CyberSalesman, Make(EnemyKind.CyberSalesman, "Cyber-Handlowiec 3.0", 5, 4.5f, 1.35f, 8f, 23f, 1.35f, EnemyBehaviorStyle.Ranged, new Color(0.18f, 0.90f, 0.93f), false, false, 4, 210f, 3) }
            };

        private static readonly EnemyKind[] SurvivalRoster =
        {
            EnemyKind.ZombieWorker, EnemyKind.Kurier, EnemyKind.CrazyStacker,
            EnemyKind.Monter, EnemyKind.Inspector, EnemyKind.Handlowiec,
            EnemyKind.Customer, EnemyKind.Architect, EnemyKind.ItalianVendor,
            EnemyKind.Serwisant, EnemyKind.PiorunDrone, EnemyKind.AgvRobot,
            EnemyKind.PanRoman, EnemyKind.EliteWalczakGuard, EnemyKind.MutantGammaForklift,
            EnemyKind.RadioactivePip, EnemyKind.CyberSalesman
        };

        public static EnemyArchetypeProfile Get(EnemyKind id)
        {
            if (Profiles.TryGetValue(id, out EnemyArchetypeProfile profile)) return profile;
            return Profiles[EnemyKind.Customer];
        }

        public static EnemyArchetypeProfile[] GetAll()
        {
            EnemyArchetypeProfile[] result = new EnemyArchetypeProfile[Profiles.Count];
            Profiles.Values.CopyTo(result, 0);
            return result;
        }

        public static EnemyArchetypeProfile[] GetSurvivalEligible(int wave, float elapsedSeconds)
        {
            int safeWave = Mathf.Max(1, wave);
            float safeElapsed = float.IsNaN(elapsedSeconds) || float.IsInfinity(elapsedSeconds)
                ? 0f : Mathf.Max(0f, elapsedSeconds);
            List<EnemyArchetypeProfile> eligible = new List<EnemyArchetypeProfile>(SurvivalRoster.Length);
            foreach (EnemyKind id in SurvivalRoster)
            {
                EnemyArchetypeProfile profile = Get(id);
                if (safeWave >= profile.MinimumSurvivalWave
                    && safeElapsed >= profile.MinimumSurvivalElapsedSeconds)
                    eligible.Add(profile);
            }
            return eligible.ToArray();
        }

        public static EnemyKind ChooseSurvivalSpawnType(int wave, float elapsedSeconds, float roll)
        {
            EnemyArchetypeProfile[] eligible = GetSurvivalEligible(wave, elapsedSeconds);
            if (eligible.Length == 0) return EnemyKind.ZombieWorker;
            int totalWeight = 0;
            foreach (EnemyArchetypeProfile profile in eligible) totalWeight += profile.SurvivalSpawnWeight;
            float safeRoll = float.IsNaN(roll) || float.IsInfinity(roll) ? 0.5f : Mathf.Clamp(roll, 0f, 0.9999999f);
            float target = safeRoll * totalWeight;
            int cumulative = 0;
            foreach (EnemyArchetypeProfile profile in eligible)
            {
                cumulative += profile.SurvivalSpawnWeight;
                if (target < cumulative) return profile.Id;
            }
            return eligible[eligible.Length - 1].Id;
        }

        private static EnemyArchetypeProfile Make(
            EnemyKind id, string displayName, int hp, float speed,
            float attackInterval, float attackRange, float aggroRange,
            float damage, EnemyBehaviorStyle behavior, Color color,
            bool boss, bool hazard,
            int minWave = 1, float minElapsed = 0f, int spawnWeight = 0)
        {
            return new EnemyArchetypeProfile
            {
                Id = id,
                DisplayName = displayName,
                BaseHealth = hp,
                MoveSpeed = speed,
                AttackInterval = attackInterval,
                AttackRange = attackRange,
                AggroRange = aggroRange,
                AttackDamage = damage,
                Behavior = behavior,
                AccentColor = color,
                IsBoss = boss,
                IsHazardOnly = hazard,
                MinimumSurvivalWave = minWave,
                MinimumSurvivalElapsedSeconds = minElapsed,
                SurvivalSpawnWeight = spawnWeight
            };
        }
    }
}
