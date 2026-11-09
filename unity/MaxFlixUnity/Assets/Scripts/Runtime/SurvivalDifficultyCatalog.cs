using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    public struct SurvivalDifficultyProfile
    {
        public float EnemyHealthMultiplier;
        public float EnemySpeedMultiplier;
        public float SpawnIntervalSeconds;
        public int ExtraGroupSize;
        public float EnemyAbilityRateMultiplier;
    }

    /// <summary>
    /// Exact formula port of src/survivalDifficulty.ts and the Survival
    /// director's live-enemy/group caps. The quality tier can be changed by
    /// adaptive performance monitoring without changing the gameplay curve.
    /// </summary>
    public static class SurvivalDifficultyCatalog
    {
        public static SurvivalDifficultyProfile GetProfile(int wave)
        {
            int currentWave = Mathf.Max(1, wave);
            int waveIndex = currentWave - 1;
            return new SurvivalDifficultyProfile
            {
                EnemyHealthMultiplier = 1.28f + Mathf.Min(2.1f, waveIndex * 0.085f),
                EnemySpeedMultiplier = 1f + Mathf.Min(0.55f, waveIndex * 0.018f),
                SpawnIntervalSeconds = Mathf.Max(3f, 5.5f - waveIndex * 0.11f),
                ExtraGroupSize = Mathf.Min(6, Mathf.FloorToInt(waveIndex / 3f)),
                EnemyAbilityRateMultiplier = Mathf.Round((1.10f + Mathf.Min(0.60f, waveIndex * 0.02f)) * 100f) / 100f
            };
        }

        public static int GetLiveEnemyCap(bool isMobile, int adaptiveTier)
        {
            if (!isMobile) return 34;
            int tier = Mathf.Clamp(adaptiveTier, 0, 2);
            return tier >= 2 ? 13 : tier == 1 ? 16 : 18;
        }

        public static int GetGroupLimit(bool isMobile, int adaptiveTier)
        {
            if (!isMobile) return 7;
            int tier = Mathf.Clamp(adaptiveTier, 0, 2);
            return tier >= 2 ? 3 : tier == 1 ? 4 : 5;
        }

        public static int GetGroupSize(int wave, SurvivalDifficultyProfile profile, bool isMobile, int adaptiveTier, int remainingCapacity)
        {
            int waveGroup = 3 + Mathf.FloorToInt(Mathf.Max(1, wave) * 0.34f) + profile.ExtraGroupSize;
            return Mathf.Max(0, Mathf.Min(GetGroupLimit(isMobile, adaptiveTier), waveGroup, remainingCapacity));
        }
    }

    public struct SurvivalHordeProfile
    {
        public int EnemyCount;
        public float DurationSeconds;
        public float SpawnIntervalSeconds;
        public float InitialRadius;
        public float FinalRadius;
    }

    public static class SurvivalHordeCatalog
    {
        public static SurvivalHordeProfile GetProfile(bool isMobile)
        {
            return new SurvivalHordeProfile
            {
                EnemyCount = isMobile ? 12 : 16,
                DurationSeconds = 18f,
                SpawnIntervalSeconds = 0.48f,
                InitialRadius = 13.4f,
                FinalRadius = 6.8f
            };
        }

        public static float GetContractingRadius(float elapsed, SurvivalHordeProfile profile)
        {
            float t = Mathf.Clamp01(elapsed / Mathf.Max(0.01f, profile.DurationSeconds));
            float eased = t * t * (3f - 2f * t);
            return Mathf.Lerp(profile.InitialRadius, profile.FinalRadius, eased);
        }
    }
}
