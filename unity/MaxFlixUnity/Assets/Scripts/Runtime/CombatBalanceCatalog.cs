namespace MaxFlix.Unity.Runtime
{
    /// <summary>
    /// Shared combat tuning ported from src/combatBalance.ts and
    /// src/characterBalance.ts. Keep the original mode-specific cadence here
    /// so the Unity slice does not accidentally turn every operator into a
    /// 0.42-second machine gun.
    /// </summary>
    public static class CombatBalanceCatalog
    {
        public const float SurvivalOutgoingDamageMultiplier = 0.62f;
        public const float SurvivalIncomingDamageMultiplier = 1.30f;
        public const float SurvivalHitInvulnerabilitySeconds = 0.78f;

        public static float GetPrimaryAttackCooldown(OperatorId id, GameMode mode)
        {
            bool survival = mode == GameMode.Survival;
            switch (id)
            {
                case OperatorId.Marcin: return survival ? 2.10f : 1.05f;
                case OperatorId.Grzesiek: return survival ? 2.28f : 1.22f;
                case OperatorId.Dawid: return survival ? 2.08f : 1.14f;
                case OperatorId.Mateusz: return survival ? 2.00f : 1.10f;
                case OperatorId.Piotr: return survival ? 2.34f : 1.25f;
                default: return survival ? 2.10f : 1.05f;
            }
        }

        public static float GetAbilityCooldown(float baseSeconds, GameMode mode)
        {
            if (float.IsNaN(baseSeconds) || float.IsInfinity(baseSeconds)) return 0f;
            float safeBase = UnityEngine.Mathf.Max(0f, baseSeconds);
            return safeBase * (mode == GameMode.Survival ? 2f : 1.25f);
        }

        public static float ScaleCharacterBasicAttackDamage(float baseDamage, float multiplier)
        {
            if (float.IsNaN(baseDamage) || float.IsInfinity(baseDamage)) baseDamage = 0f;
            if (float.IsNaN(multiplier) || float.IsInfinity(multiplier)) multiplier = 1f;
            float safeDamage = UnityEngine.Mathf.Max(0f, baseDamage);
            float safeMultiplier = UnityEngine.Mathf.Clamp(multiplier, 0.5f, 1.8f);
            return UnityEngine.Mathf.Max(0f, UnityEngine.Mathf.Round(safeDamage * safeMultiplier * 10f) / 10f);
        }

        public static float ScaleOutgoingDamage(float amount, GameMode mode)
        {
            if (float.IsNaN(amount) || float.IsInfinity(amount)) return 0f;
            float safe = UnityEngine.Mathf.Max(0f, amount);
            return safe * (mode == GameMode.Survival ? SurvivalOutgoingDamageMultiplier : 1f);
        }

        public static float ScaleIncomingDamage(float amount, GameMode mode)
        {
            if (float.IsNaN(amount) || float.IsInfinity(amount)) return 0f;
            float safe = UnityEngine.Mathf.Max(0f, amount);
            return safe * (mode == GameMode.Survival ? SurvivalIncomingDamageMultiplier : 1f);
        }
    }
}
