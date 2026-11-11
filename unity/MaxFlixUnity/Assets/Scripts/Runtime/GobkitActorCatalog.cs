using System.Collections.Generic;

namespace MaxFlix.Unity.Runtime
{
    /// <summary>
    /// Stable mapping between legacy actor IDs and validated CC0 Gobkit rigs.
    /// These are import references only; runtime attachment and Animator
    /// retargeting remain a separate migration stage.
    /// </summary>
    public static class GobkitActorCatalog
    {
        private static readonly string[] RequiredModels =
        {
            "storemanager", "firechief", "stockclerk", "baggagehandler", "securityguard",
            "foodcourier", "shoplifter", "salesrep", "officemanager", "hazmattech",
            "stitchedbrute", "bloodironjuggernaut", "nightwitch", "androidcommander",
            "werewolfcaptain", "forcibleentryfirefighter", "bloodirongrunt"
        };

        public static IReadOnlyList<string> RequiredModelIds { get { return RequiredModels; } }

        public static string GetOperatorModelId(OperatorId id)
        {
            switch (id)
            {
                case OperatorId.Marcin: return "storemanager";
                case OperatorId.Grzesiek: return "firechief";
                case OperatorId.Dawid: return "stockclerk";
                case OperatorId.Mateusz: return "baggagehandler";
                case OperatorId.Piotr: return "securityguard";
                default: return "storemanager";
            }
        }

        public static string GetEnemyModelId(EnemyKind id)
        {
            switch (id)
            {
                case EnemyKind.Customer: return "shoplifter";
                case EnemyKind.Walczak: return "werewolfcaptain";
                case EnemyKind.Architect: return "officemanager";
                case EnemyKind.Inspector: return "hazmattech";
                case EnemyKind.Handlowiec: return "salesrep";
                case EnemyKind.Monter: return "forcibleentryfirefighter";
                case EnemyKind.EliteWalczakGuard: return "bloodirongrunt";
                case EnemyKind.Kurier: return "foodcourier";
                case EnemyKind.ItalianVendor: return "storemanager";
                case EnemyKind.CrazyStacker: return "baggagehandler";
                case EnemyKind.KingLeto: return "bloodironjuggernaut";
                case EnemyKind.PanRoman: return "stockclerk";
                case EnemyKind.Serwisant: return "firechief";
                case EnemyKind.BosmanKrakow: return "securityguard";
                case EnemyKind.ZombieWorker: return "stitchedbrute";
                case EnemyKind.Sebix: return "bloodirongrunt";
                case EnemyKind.MutantGammaForklift: return "bloodironjuggernaut";
                case EnemyKind.RadioactivePip: return "nightwitch";
                case EnemyKind.CyberSalesman: return "androidcommander";
                case EnemyKind.Forklift:
                case EnemyKind.AgvRobot:
                case EnemyKind.PiorunDrone:
                case EnemyKind.Pomazaniec:
                    return null;
                default:
                    return null;
            }
        }

        public static string GetAssetPath(string modelId)
        {
            if (!IsRequiredModel(modelId)) return null;
            return "Assets/Resources/Characters/Gobkit/" + modelId + ".glb";
        }

        public static bool IsRequiredModel(string modelId)
        {
            if (string.IsNullOrWhiteSpace(modelId)) return false;
            for (int i = 0; i < RequiredModels.Length; i++)
                if (RequiredModels[i] == modelId) return true;
            return false;
        }
    }
}
