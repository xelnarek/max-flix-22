using System.Collections.Generic;
using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    /// <summary>
    /// World-space obstacle steering for the procedural warehouse layouts.
    /// The map is static during a run, so collider bounds are captured once and
    /// refreshed only when Campaign gates are opened/closed.
    /// </summary>
    [DisallowMultipleComponent]
    public sealed class EnemyNavigationWorld : MonoBehaviour
    {
        private const float DefaultLookAhead = 4.2f;
        private const float SpatialCellSize = 8f;
        private const float WaypointPadding = 0.55f;
        private const float Epsilon = 0.000001f;

        private static EnemyNavigationWorld _active;
        private Bounds[] _obstacles = new Bounds[0];
        private readonly Dictionary<Vector2Int, List<int>> _obstacleCells =
            new Dictionary<Vector2Int, List<int>>(128);
        private int[] _seenObstacleVersion = new int[0];
        private int _queryVersion;
        private Transform _worldRoot;

        public void Initialize(Transform worldRoot)
        {
            _worldRoot = worldRoot;
            _active = this;
            RefreshObstacles();
        }

        public static void RefreshActive()
        {
            if (_active != null) _active.RefreshObstacles();
        }

        public static Vector3 GetObstacleAvoidanceVector(
            Vector3 actorPosition,
            Vector3 targetPosition,
            int actorInstanceId,
            float clearance)
        {
            if (_active == null || _active._obstacles.Length == 0)
                return Vector3.zero;

            return _active.CalculateObstacleAvoidance(
                actorPosition, targetPosition, actorInstanceId, clearance);
        }

        public static bool HasClearLineToTarget(
            Vector3 actorPosition,
            Vector3 targetPosition,
            float clearance = 0.12f)
        {
            return _active == null || _active.HasClearPath(actorPosition, targetPosition, clearance);
        }

        private bool HasClearPath(Vector3 actorPosition, Vector3 targetPosition, float clearance)
        {
            if (_obstacles.Length == 0) return true;
            Vector2 origin = new Vector2(actorPosition.x, actorPosition.z);
            Vector2 target = new Vector2(targetPosition.x, targetPosition.z);
            Vector2 delta = target - origin;
            float distance = delta.magnitude;
            if (distance < Epsilon) return true;

            Vector2 direction = delta / distance;
            float safeClearance = Mathf.Max(0f, clearance);
            int minCellX = Mathf.FloorToInt((Mathf.Min(origin.x, target.x) - safeClearance) / SpatialCellSize);
            int maxCellX = Mathf.FloorToInt((Mathf.Max(origin.x, target.x) + safeClearance) / SpatialCellSize);
            int minCellZ = Mathf.FloorToInt((Mathf.Min(origin.y, target.y) - safeClearance) / SpatialCellSize);
            int maxCellZ = Mathf.FloorToInt((Mathf.Max(origin.y, target.y) + safeClearance) / SpatialCellSize);

            unchecked { _queryVersion++; }
            if (_queryVersion == 0)
            {
                System.Array.Clear(_seenObstacleVersion, 0, _seenObstacleVersion.Length);
                _queryVersion = 1;
            }

            for (int cellX = minCellX; cellX <= maxCellX; cellX++)
            {
                for (int cellZ = minCellZ; cellZ <= maxCellZ; cellZ++)
                {
                    if (!_obstacleCells.TryGetValue(new Vector2Int(cellX, cellZ), out List<int> candidates))
                        continue;

                    for (int candidateIndex = 0; candidateIndex < candidates.Count; candidateIndex++)
                    {
                        int index = candidates[candidateIndex];
                        if (index < 0 || index >= _obstacles.Length || _seenObstacleVersion[index] == _queryVersion)
                            continue;
                        _seenObstacleVersion[index] = _queryVersion;

                        Bounds obstacle = _obstacles[index];
                        float minX = obstacle.min.x - safeClearance;
                        float maxX = obstacle.max.x + safeClearance;
                        float minZ = obstacle.min.z - safeClearance;
                        float maxZ = obstacle.max.z + safeClearance;
                        if (origin.x >= minX && origin.x <= maxX
                            && origin.y >= minZ && origin.y <= maxZ)
                            return false;
                        if (TryRayBoxEntry(origin, direction, distance,
                            minX, maxX, minZ, maxZ, out _))
                            return false;
                    }
                }
            }

            return true;
        }

        private Vector3 CalculateObstacleAvoidance(
            Vector3 actorPosition,
            Vector3 targetPosition,
            int actorInstanceId,
            float clearance)
        {
            Vector2 origin = new Vector2(actorPosition.x, actorPosition.z);
            Vector2 target = new Vector2(targetPosition.x, targetPosition.z);
            Vector2 toTarget = target - origin;
            float targetDistance = toTarget.magnitude;
            if (targetDistance < Epsilon) return Vector3.zero;

            Vector2 direction = toTarget / targetDistance;
            float maxDistance = Mathf.Min(targetDistance, DefaultLookAhead);
            if (maxDistance < Epsilon) return Vector3.zero;

            float safeClearance = Mathf.Max(0f, clearance);
            Vector2 end = origin + direction * maxDistance;
            int minCellX = Mathf.FloorToInt((Mathf.Min(origin.x, end.x) - safeClearance) / SpatialCellSize);
            int maxCellX = Mathf.FloorToInt((Mathf.Max(origin.x, end.x) + safeClearance) / SpatialCellSize);
            int minCellZ = Mathf.FloorToInt((Mathf.Min(origin.y, end.y) - safeClearance) / SpatialCellSize);
            int maxCellZ = Mathf.FloorToInt((Mathf.Max(origin.y, end.y) + safeClearance) / SpatialCellSize);

            unchecked { _queryVersion++; }
            if (_queryVersion == 0)
            {
                System.Array.Clear(_seenObstacleVersion, 0, _seenObstacleVersion.Length);
                _queryVersion = 1;
            }

            int nearestIndex = -1;
            float nearestHitDistance = float.PositiveInfinity;
            float nearestMinX = 0f;
            float nearestMaxX = 0f;
            float nearestMinZ = 0f;
            float nearestMaxZ = 0f;

            for (int cellX = minCellX; cellX <= maxCellX; cellX++)
            {
                for (int cellZ = minCellZ; cellZ <= maxCellZ; cellZ++)
                {
                    if (!_obstacleCells.TryGetValue(new Vector2Int(cellX, cellZ), out List<int> candidates))
                        continue;

                    for (int candidateIndex = 0; candidateIndex < candidates.Count; candidateIndex++)
                    {
                        int i = candidates[candidateIndex];
                        if (i < 0 || i >= _obstacles.Length || _seenObstacleVersion[i] == _queryVersion)
                            continue;
                        _seenObstacleVersion[i] = _queryVersion;

                        Bounds obstacle = _obstacles[i];
                        float minX = obstacle.min.x - safeClearance;
                        float maxX = obstacle.max.x + safeClearance;
                        float minZ = obstacle.min.z - safeClearance;
                        float maxZ = obstacle.max.z + safeClearance;

                        if (origin.x >= minX && origin.x <= maxX
                            && origin.y >= minZ && origin.y <= maxZ)
                        {
                            return GetInsideObstacleEscape(origin, minX, maxX, minZ, maxZ, actorInstanceId);
                        }

                        if (!TryRayBoxEntry(origin, direction, maxDistance,
                            minX, maxX, minZ, maxZ, out float hitDistance))
                            continue;

                        if (hitDistance >= nearestHitDistance) continue;
                        nearestIndex = i;
                        nearestHitDistance = hitDistance;
                        nearestMinX = minX;
                        nearestMaxX = maxX;
                        nearestMinZ = minZ;
                        nearestMaxZ = maxZ;
                    }
                }
            }

            if (nearestIndex < 0) return Vector3.zero;

            Vector2 corner0 = new Vector2(nearestMinX - WaypointPadding, nearestMinZ - WaypointPadding);
            Vector2 corner1 = new Vector2(nearestMinX - WaypointPadding, nearestMaxZ + WaypointPadding);
            Vector2 corner2 = new Vector2(nearestMaxX + WaypointPadding, nearestMinZ - WaypointPadding);
            Vector2 corner3 = new Vector2(nearestMaxX + WaypointPadding, nearestMaxZ + WaypointPadding);
            Vector2 waypoint = (actorInstanceId & 1) == 0 ? corner0 : corner3;
            float bestRouteLength = float.PositiveInfinity;
            for (int i = 0; i < 4; i++)
            {
                int cornerIndex;
                if ((actorInstanceId & 1) == 0)
                    cornerIndex = i == 0 ? 0 : i == 1 ? 2 : i == 2 ? 1 : 3;
                else
                    cornerIndex = i == 0 ? 3 : i == 1 ? 1 : i == 2 ? 2 : 0;

                Vector2 corner = cornerIndex == 0 ? corner0
                    : cornerIndex == 1 ? corner1
                    : cornerIndex == 2 ? corner2 : corner3;
                float routeLength = Vector2.Distance(origin, corner) + Vector2.Distance(target, corner);
                if (routeLength >= bestRouteLength - Epsilon) continue;
                bestRouteLength = routeLength;
                waypoint = corner;
            }

            Vector2 steering = waypoint - origin;
            if (steering.sqrMagnitude < Epsilon) return Vector3.zero;
            float strength = Mathf.Max(0.85f, 1.55f - nearestHitDistance * 0.08f);
            steering = steering.normalized * strength;
            return new Vector3(steering.x, 0f, steering.y);
        }

        private void RefreshObstacles()
        {
            if (_worldRoot == null)
            {
                _obstacles = new Bounds[0];
                return;
            }

            Collider[] colliders = _worldRoot.GetComponentsInChildren<Collider>(true);
            List<Bounds> bounds = new List<Bounds>(colliders.Length);
            for (int i = 0; i < colliders.Length; i++)
            {
                Collider collider = colliders[i];
                if (collider == null || !collider.enabled || collider.isTrigger) continue;
                if (collider.GetComponentInParent<PlayerController>() != null
                    || collider.GetComponentInParent<EnemyAgent>() != null)
                    continue;

                Bounds value = collider.bounds;
                // Ignore floor tiles/markings and overhead trusses. Keep only
                // objects whose volume blocks an upright warehouse actor.
                if (value.max.y < 0.82f || value.min.y > 2.25f || value.size.y < 0.55f)
                    continue;
                // The outer perimeter is a hard world bound, not a routeable
                // obstacle; steering should never send enemies around it.
                if (value.size.x > 140f || value.size.z > 60f)
                    continue;

                bounds.Add(value);
            }

            _obstacles = bounds.ToArray();
            _obstacleCells.Clear();
            _seenObstacleVersion = new int[_obstacles.Length];
            _queryVersion = 0;

            for (int i = 0; i < _obstacles.Length; i++)
            {
                Bounds obstacle = _obstacles[i];
                int minCellX = Mathf.FloorToInt(obstacle.min.x / SpatialCellSize);
                int maxCellX = Mathf.FloorToInt(obstacle.max.x / SpatialCellSize);
                int minCellZ = Mathf.FloorToInt(obstacle.min.z / SpatialCellSize);
                int maxCellZ = Mathf.FloorToInt(obstacle.max.z / SpatialCellSize);
                for (int cellX = minCellX; cellX <= maxCellX; cellX++)
                {
                    for (int cellZ = minCellZ; cellZ <= maxCellZ; cellZ++)
                    {
                        Vector2Int key = new Vector2Int(cellX, cellZ);
                        if (!_obstacleCells.TryGetValue(key, out List<int> bucket))
                        {
                            bucket = new List<int>(8);
                            _obstacleCells.Add(key, bucket);
                        }
                        bucket.Add(i);
                    }
                }
            }
        }

        private static Vector3 GetInsideObstacleEscape(
            Vector2 origin,
            float minX,
            float maxX,
            float minZ,
            float maxZ,
            int actorInstanceId)
        {
            float left = origin.x - minX;
            float right = maxX - origin.x;
            float back = origin.y - minZ;
            float forward = maxZ - origin.y;
            float minimum = Mathf.Min(Mathf.Min(left, right), Mathf.Min(back, forward));
            int selected = -1;
            for (int i = 0; i < 4; i++)
            {
                float distance = i == 0 ? left : i == 1 ? right : i == 2 ? back : forward;
                if (Mathf.Abs(distance - minimum) >= 0.0001f) continue;
                if ((actorInstanceId & 1) == 0)
                {
                    if (selected < 0) selected = i;
                }
                else
                {
                    selected = i;
                }
            }
            if (selected < 0) selected = 0;
            switch (selected)
            {
                case 0: return Vector3.left * 1.7f;
                case 1: return Vector3.right * 1.7f;
                case 2: return Vector3.back * 1.7f;
                default: return Vector3.forward * 1.7f;
            }
        }

        private static bool TryRayBoxEntry(
            Vector2 origin,
            Vector2 direction,
            float maxDistance,
            float minX,
            float maxX,
            float minZ,
            float maxZ,
            out float entryDistance)
        {
            float entry = 0f;
            float exit = maxDistance;
            if (!ClipAxis(origin.x, direction.x, minX, maxX, ref entry, ref exit)
                || !ClipAxis(origin.y, direction.y, minZ, maxZ, ref entry, ref exit))
            {
                entryDistance = 0f;
                return false;
            }

            entryDistance = Mathf.Max(0f, entry);
            return entry >= -Epsilon && entryDistance <= maxDistance;
        }

        private static bool ClipAxis(
            float position,
            float velocity,
            float minimum,
            float maximum,
            ref float entry,
            ref float exit)
        {
            if (Mathf.Abs(velocity) < Epsilon)
                return position >= minimum && position <= maximum;

            float near = (minimum - position) / velocity;
            float far = (maximum - position) / velocity;
            if (near > far)
            {
                float swap = near;
                near = far;
                far = swap;
            }

            entry = Mathf.Max(entry, near);
            exit = Mathf.Min(exit, far);
            return exit >= entry;
        }

        private void OnDestroy()
        {
            if (_active == this) _active = null;
            _worldRoot = null;
            _obstacles = new Bounds[0];
            _obstacleCells.Clear();
            _seenObstacleVersion = new int[0];
            _queryVersion = 0;
        }
    }
}
