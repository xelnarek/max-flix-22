using System;
using System.Collections.Generic;
using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    [Flags]
    public enum SurvivalBiomeEdge
    {
        None = 0,
        West = 1,
        East = 2,
        North = 4,
        South = 8
    }

    public enum SurvivalWorldTransitionKind
    {
        LoadingApron = 0,
        ColdAirlock = 1,
        ScannerTransfer = 2,
        FrozenConveyor = 3
    }

    [Serializable]
    public sealed class SurvivalBiomeZone
    {
        public WarehouseMapId MapId;
        public Vector2 Center;
        public SurvivalBiomeEdge OpenEdges;

        public SurvivalBiomeZone(WarehouseMapId mapId, float centerX, float centerZ, SurvivalBiomeEdge openEdges)
        {
            MapId = mapId;
            Center = new Vector2(centerX, centerZ);
            OpenEdges = openEdges;
        }
    }

    [Serializable]
    public sealed class SurvivalWorldTransition
    {
        public string Id;
        public WarehouseMapId From;
        public WarehouseMapId To;
        public Vector2 Center;
        public bool RunsAlongX;
        public float Width;
        public float Length;
        public SurvivalWorldTransitionKind Kind;

        public SurvivalWorldTransition(
            string id,
            WarehouseMapId from,
            WarehouseMapId to,
            float centerX,
            float centerZ,
            bool runsAlongX,
            float width,
            float length,
            SurvivalWorldTransitionKind kind)
        {
            Id = id;
            From = from;
            To = to;
            Center = new Vector2(centerX, centerZ);
            RunsAlongX = runsAlongX;
            Width = width;
            Length = length;
            Kind = kind;
        }
    }

    public struct SurvivalBiomeBlendWeights
    {
        public float WarehouseB4;
        public float ContainerTerminal;
        public float ColdStorage;
        public float NightSorting;

        public float Total
        {
            get { return WarehouseB4 + ContainerTerminal + ColdStorage + NightSorting; }
        }

        public float For(WarehouseMapId id)
        {
            switch (id)
            {
                case WarehouseMapId.ContainerTerminal: return ContainerTerminal;
                case WarehouseMapId.ColdStorage: return ColdStorage;
                case WarehouseMapId.NightSorting: return NightSorting;
                default: return WarehouseB4;
            }
        }
    }

    /// <summary>
    /// Canonical Unity-side topology contract for the live Three.js Survival
    /// mega-world. This data is intentionally independent of scene generation:
    /// WarehouseWorldFactory must compose these four zones before the Unity
    /// Survival mode can be considered at feature parity.
    /// </summary>
    public static class SurvivalWorldLayout
    {
        public const float MinX = -120f;
        public const float MaxX = 120f;
        public const float MinZ = -40f;
        public const float MaxZ = 40f;
        public const float BlendHalfWidth = 11f;

        private static readonly SurvivalBiomeZone[] ZoneData =
        {
            new SurvivalBiomeZone(WarehouseMapId.WarehouseB4, -60f, -20f,
                SurvivalBiomeEdge.East | SurvivalBiomeEdge.South),
            new SurvivalBiomeZone(WarehouseMapId.ContainerTerminal, 60f, -20f,
                SurvivalBiomeEdge.West | SurvivalBiomeEdge.South),
            new SurvivalBiomeZone(WarehouseMapId.ColdStorage, 60f, 20f,
                SurvivalBiomeEdge.East | SurvivalBiomeEdge.North),
            new SurvivalBiomeZone(WarehouseMapId.NightSorting, -60f, 20f,
                SurvivalBiomeEdge.West | SurvivalBiomeEdge.North)
        };

        private static readonly SurvivalWorldTransition[] TransitionData =
        {
            new SurvivalWorldTransition("b4-to-port", WarehouseMapId.WarehouseB4,
                WarehouseMapId.ContainerTerminal, 0f, -20f, true, 22f, 40f,
                SurvivalWorldTransitionKind.LoadingApron),
            new SurvivalWorldTransition("port-to-cold", WarehouseMapId.ContainerTerminal,
                WarehouseMapId.ColdStorage, 60f, 0f, false, 22f, 120f,
                SurvivalWorldTransitionKind.ColdAirlock),
            new SurvivalWorldTransition("night-to-b4", WarehouseMapId.NightSorting,
                WarehouseMapId.WarehouseB4, -60f, 0f, false, 22f, 120f,
                SurvivalWorldTransitionKind.ScannerTransfer),
            new SurvivalWorldTransition("cold-to-night", WarehouseMapId.ColdStorage,
                WarehouseMapId.NightSorting, 0f, 20f, true, 22f, 40f,
                SurvivalWorldTransitionKind.FrozenConveyor)
        };

        public static IReadOnlyList<SurvivalBiomeZone> Zones
        {
            get { return ZoneData; }
        }

        public static IReadOnlyList<SurvivalWorldTransition> Transitions
        {
            get { return TransitionData; }
        }

        public static bool Contains(float x, float z)
        {
            return IsFinite(x) && IsFinite(z)
                && x >= MinX && x <= MaxX && z >= MinZ && z <= MaxZ;
        }

        public static WarehouseMapId GetBiomeAtPosition(float x, float z)
        {
            bool east = IsFinite(x) && x >= 0f;
            bool south = IsFinite(z) && z >= 0f;
            if (south) return east ? WarehouseMapId.ColdStorage : WarehouseMapId.NightSorting;
            return east ? WarehouseMapId.ContainerTerminal : WarehouseMapId.WarehouseB4;
        }

        public static SurvivalBiomeBlendWeights GetBlendWeights(float x, float z)
        {
            float safeX = IsFinite(x) ? x : -BlendHalfWidth;
            float safeZ = IsFinite(z) ? z : -BlendHalfWidth;
            float east = SmoothStep((safeX + BlendHalfWidth) / (BlendHalfWidth * 2f));
            float south = SmoothStep((safeZ + BlendHalfWidth) / (BlendHalfWidth * 2f));

            return new SurvivalBiomeBlendWeights
            {
                WarehouseB4 = (1f - east) * (1f - south),
                ContainerTerminal = east * (1f - south),
                ColdStorage = east * south,
                NightSorting = (1f - east) * south
            };
        }

        private static float SmoothStep(float value)
        {
            float t = Mathf.Clamp01(value);
            return t * t * (3f - 2f * t);
        }

        private static bool IsFinite(float value)
        {
            return !float.IsNaN(value) && !float.IsInfinity(value);
        }
    }
}
