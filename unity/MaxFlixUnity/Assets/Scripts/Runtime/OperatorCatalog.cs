using System.Collections.Generic;
using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    public static class OperatorCatalog
    {
        private static readonly IReadOnlyDictionary<OperatorId, OperatorProfile> Profiles =
            new Dictionary<OperatorId, OperatorProfile>
            {
                {
                    OperatorId.Marcin,
                    new OperatorProfile
                    {
                        Id = OperatorId.Marcin,
                        DisplayName = "Operator 01",
                        Role = "Specjalista logistyki",
                        ClassName = "KIEROWNIK OPANCERZONY",
                        PrimaryColor = Hex(0x1e3a8a),
                        SecondaryColor = Hex(0xf59e0b),
                        MoveSpeed = 6.9f,
                        JumpForce = 8.4f,
                        MaxHealth = 5,
                        BasicAttackDamageMultiplier = 1.05f,
                        DamageTakenMultiplier = 0.82f,
                        AbilityCooldownSeconds = 17.0f,
                        PassiveName = "Mistrz Zaklęć ERP",
                        AbilityName = "KONWÓJ WZ-404! DO BOJU!"
                    }
                },
                {
                    OperatorId.Grzesiek,
                    new OperatorProfile
                    {
                        Id = OperatorId.Grzesiek,
                        DisplayName = "Operator 02",
                        Role = "Specjalista walki wręcz",
                        ClassName = "MŁOT MAGAZYNU",
                        PrimaryColor = Hex(0x16a34a),
                        SecondaryColor = Hex(0x22c55e),
                        MoveSpeed = 7.5f,
                        JumpForce = 7.8f,
                        MaxHealth = 4,
                        BasicAttackDamageMultiplier = 1.28f,
                        DamageTakenMultiplier = 0.92f,
                        AbilityCooldownSeconds = 12.0f,
                        PassiveName = "Hantla 44 cm — Rzut Siłacza",
                        AbilityName = "Ścisk Zagłady 44cm + Tryb Tarana"
                    }
                },
                {
                    OperatorId.Dawid,
                    new OperatorProfile
                    {
                        Id = OperatorId.Dawid,
                        DisplayName = "Operator 03",
                        Role = "Specjalista kontroli obszaru",
                        ClassName = "AKROBATA KONTROLI",
                        PrimaryColor = Hex(0xd97706),
                        SecondaryColor = Hex(0xb45309),
                        MoveSpeed = 7.9f,
                        JumpForce = 10.5f,
                        MaxHealth = 4,
                        BasicAttackDamageMultiplier = 1.12f,
                        DamageTakenMultiplier = 1.00f,
                        AbilityCooldownSeconds = 13.0f,
                        PassiveName = "Rolka Stretch — Owinięcie Problemu",
                        AbilityName = "Salwa Marmurowa Wielkiego Formatu"
                    }
                },
                {
                    OperatorId.Mateusz,
                    new OperatorProfile
                    {
                        Id = OperatorId.Mateusz,
                        DisplayName = "Operator 04",
                        Role = "Specjalista systemów elektrycznych",
                        ClassName = "ELEKTRYCZNY SPEEDRUNNER",
                        PrimaryColor = Hex(0x7c3aed),
                        SecondaryColor = Hex(0xec4899),
                        MoveSpeed = 9.6f,
                        JumpForce = 9.5f,
                        MaxHealth = 3,
                        BasicAttackDamageMultiplier = 0.88f,
                        DamageTakenMultiplier = 1.08f,
                        AbilityCooldownSeconds = 16.0f,
                        PassiveName = "Paralizator — Impuls Trzech Elektrod",
                        AbilityName = "KOCIA ARMIA ONLINE • 3× MIAU-CRITICAL"
                    }
                },
                {
                    OperatorId.Piotr,
                    new OperatorProfile
                    {
                        Id = OperatorId.Piotr,
                        DisplayName = "Operator 05",
                        Role = "Specjalista wsparcia taktycznego",
                        ClassName = "WETERAN B4",
                        PrimaryColor = Hex(0xef4444),
                        SecondaryColor = Hex(0xfacc15),
                        MoveSpeed = 8.5f,
                        JumpForce = 9.2f,
                        MaxHealth = 4,
                        BasicAttackDamageMultiplier = 1.18f,
                        DamageTakenMultiplier = 0.95f,
                        AbilityCooldownSeconds = 16.5f,
                        PassiveName = "Weteran B4 — Droga Powrotna",
                        AbilityName = "Rytuał MafiKapibar — Pentagram B4"
                    }
                }
            };

        public static OperatorProfile Get(OperatorId id)
        {
            if (Profiles.TryGetValue(id, out OperatorProfile profile)) return profile;
            return Profiles[OperatorId.Marcin];
        }

        public static IEnumerable<OperatorProfile> All
        {
            get { return Profiles.Values; }
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
