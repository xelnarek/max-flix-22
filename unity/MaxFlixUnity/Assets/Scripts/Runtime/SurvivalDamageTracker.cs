using System;
using System.Collections.Generic;
using System.Text;
using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    /// <summary>
    /// Per-run Survival damage ledger. Records only health actually removed
    /// after mode scaling and shields, so the post-run percentages sum to the
    /// effective damage dealt rather than attempted overkill.
    /// </summary>
    public static class SurvivalDamageTracker
    {
        private static readonly Dictionary<SurvivalWeaponKind, float> WeaponDamage =
            new Dictionary<SurvivalWeaponKind, float>();

        private static float _operatorDamage;
        private static float _totalDamage;

        public static float TotalDamage { get { return _totalDamage; } }
        public static float OperatorDamage { get { return _operatorDamage; } }

        public static void Reset()
        {
            WeaponDamage.Clear();
            _operatorDamage = 0f;
            _totalDamage = 0f;
        }

        public static void RecordOperatorDamage(float amount)
        {
            float safe = SafeAmount(amount);
            if (safe <= 0f) return;
            _operatorDamage += safe;
            _totalDamage += safe;
        }

        public static void RecordWeaponDamage(SurvivalWeaponKind weapon, float amount)
        {
            float safe = SafeAmount(amount);
            if (safe <= 0f) return;
            WeaponDamage.TryGetValue(weapon, out float current);
            WeaponDamage[weapon] = current + safe;
            _totalDamage += safe;
        }

        public static float GetWeaponDamage(SurvivalWeaponKind weapon)
        {
            return WeaponDamage.TryGetValue(weapon, out float value) ? value : 0f;
        }

        public static string BuildSummary(int maximumLines = 5)
        {
            if (_totalDamage <= 0.01f) return "Brak zarejestrowanych obrażeń.";

            List<KeyValuePair<string, float>> rows = new List<KeyValuePair<string, float>>();
            if (_operatorDamage > 0.01f)
                rows.Add(new KeyValuePair<string, float>("Operator i umiejętności", _operatorDamage));

            foreach (KeyValuePair<SurvivalWeaponKind, float> entry in WeaponDamage)
            {
                SurvivalWeaponProfile profile = SurvivalWeaponCatalog.Get(entry.Key);
                rows.Add(new KeyValuePair<string, float>(profile.DisplayName, entry.Value));
            }

            rows.Sort((a, b) => b.Value.CompareTo(a.Value));
            StringBuilder result = new StringBuilder("OBRAŻENIA WG ŹRÓDŁA");
            int count = Mathf.Clamp(maximumLines, 1, 8);
            for (int i = 0; i < Mathf.Min(count, rows.Count); i++)
            {
                float percent = rows[i].Value / _totalDamage * 100f;
                result.Append("\n").Append(rows[i].Key)
                    .Append("  •  ").Append(rows[i].Value.ToString("0.0"))
                    .Append("  (").Append(percent.ToString("0")).Append("%)");
            }
            if (rows.Count > count)
            {
                float rest = 0f;
                for (int i = count; i < rows.Count; i++) rest += rows[i].Value;
                result.Append("\nPozostałe źródła  •  ").Append(rest.ToString("0.0"))
                    .Append("  (").Append((rest / _totalDamage * 100f).ToString("0")).Append("%)");
            }
            result.Append("\nŁĄCZNIE  •  ").Append(_totalDamage.ToString("0.0"));
            return result.ToString();
        }

        private static float SafeAmount(float amount)
        {
            if (float.IsNaN(amount) || float.IsInfinity(amount)) return 0f;
            return Mathf.Max(0f, amount);
        }
    }
}
