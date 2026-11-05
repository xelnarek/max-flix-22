export type SurvivalCoalitionRole = 'bruiser' | 'flanker' | 'ranged' | 'support';

export interface SurvivalCoalitionCandidate {
  id: string;
  type: string;
  x: number;
  z: number;
  state: string;
  maxHp?: number;
}

export interface SurvivalCoalitionOrder {
  enemyId: string;
  squadId: number;
  leaderId: string;
  isLeader: boolean;
  role: SurvivalCoalitionRole;
  slot: number;
  flankAngle: number;
  preferredRadius: number;
  orbitSign: number;
  squadSize: number;
}

const ROLE_ORDER: Record<SurvivalCoalitionRole, number> = {
  bruiser: 0,
  flanker: 1,
  ranged: 2,
  support: 3,
};

const finite = (value: number): boolean => Number.isFinite(value);

export function getSurvivalCoalitionRole(type: string): SurvivalCoalitionRole {
  if (
    type === 'sztaplar_szalony' ||
    type === 'elite_walczak_guard' ||
    type === 'agv_robot' ||
    type === 'sebix_m'
  ) return 'bruiser';

  if (type === 'inspector') return 'support';

  if (
    type === 'handlowiec' ||
    type === 'przedstawiciel_włoski' ||
    type === 'pan_roman' ||
    type === 'serwisant' ||
    type === 'pomazaniec' ||
    type === 'bosman_krakow'
  ) return 'ranged';

  return 'flanker';
}

/**
 * Build low-frequency squad orders for Survival's wave director.
 *
 * Each coalition has a leader, a central bruiser, alternating left/right
 * flankers, ranged cover and a rear support position. The planner is pure and
 * deterministic so the engine can rebuild it at 5-6 Hz rather than per frame.
 */
export function buildSurvivalCoalitionOrders(
  candidates: readonly SurvivalCoalitionCandidate[],
  playerX: number,
  playerZ: number,
  heading: number,
  maxActive: number,
  squadSize = 4,
): SurvivalCoalitionOrder[] {
  if (!finite(playerX) || !finite(playerZ) || !finite(heading)) return [];

  const activeCap = finite(maxActive) ? Math.max(0, Math.min(12, Math.floor(maxActive))) : 0;
  if (activeCap === 0) return [];

  const safeSquadSize = finite(squadSize)
    ? Math.max(2, Math.min(5, Math.floor(squadSize)))
    : 4;

  const seen = new Set<string>();
  const eligible = candidates
    .filter((candidate) => {
      if (
        !candidate.id ||
        seen.has(candidate.id) ||
        candidate.state === 'defeated' ||
        !finite(candidate.x) ||
        !finite(candidate.z)
      ) return false;
      seen.add(candidate.id);
      return true;
    })
    .map((candidate) => ({
      candidate,
      distance: Math.hypot(candidate.x - playerX, candidate.z - playerZ),
      role: getSurvivalCoalitionRole(candidate.type),
    }))
    .filter((entry) => finite(entry.distance))
    .sort((a, b) => a.distance - b.distance || a.candidate.id.localeCompare(b.candidate.id))
    .slice(0, activeCap);

  const orders: SurvivalCoalitionOrder[] = [];

  for (let offset = 0, squadId = 0; offset < eligible.length; offset += safeSquadSize, squadId++) {
    const squad = eligible.slice(offset, offset + safeSquadSize);
    if (squad.length === 0) continue;

    const centerX = squad.reduce((sum, member) => sum + member.candidate.x, 0) / squad.length;
    const centerZ = squad.reduce((sum, member) => sum + member.candidate.z, 0) / squad.length;
    const centerDistance = Math.hypot(centerX - playerX, centerZ - playerZ);
    const baseAngle = centerDistance > 0.35
      ? Math.atan2(centerX - playerX, centerZ - playerZ)
      : heading;

    // A bruiser normally leads the push. If a squad has no bruiser, its
    // strongest living unit becomes the coordinator instead.
    const leader = [...squad].sort((a, b) =>
      ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
      (b.candidate.maxHp ?? 0) - (a.candidate.maxHp ?? 0) ||
      a.distance - b.distance ||
      a.candidate.id.localeCompare(b.candidate.id)
    )[0];

    const roleIndexes: Record<SurvivalCoalitionRole, number> = {
      bruiser: 0,
      flanker: 0,
      ranged: 0,
      support: 0,
    };

    const roleSorted = [...squad].sort((a, b) =>
      ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
      a.candidate.id.localeCompare(b.candidate.id)
    );

    for (const member of roleSorted) {
      const roleIndex = roleIndexes[member.role]++;
      let angularOffset = 0;
      let preferredRadius = 3.2;
      let orbitSign = roleIndex % 2 === 0 ? 1 : -1;

      if (member.role === 'bruiser') {
        // The heavy unit commits to the front and creates a clear pressure point.
        angularOffset = (roleIndex - (squad.filter((item) => item.role === 'bruiser').length - 1) / 2) * 0.24;
        preferredRadius = 2.45 + roleIndex * 0.28;
      } else if (member.role === 'flanker') {
        // Alternate the two sides; additional flankers form a second staggered row.
        orbitSign = roleIndex % 2 === 0 ? -1 : 1;
        angularOffset = orbitSign * (0.78 + Math.floor(roleIndex / 2) * 0.22);
        preferredRadius = 3.35 + Math.floor(roleIndex / 2) * 0.48;
      } else if (member.role === 'ranged') {
        // Ranged units hold the back arc and do not all run into melee range.
        angularOffset = Math.PI + (roleIndex - (squad.filter((item) => item.role === 'ranged').length - 1) / 2) * 0.34;
        preferredRadius = 7.35 + Math.abs(roleIndex) * 0.36;
      } else {
        // Support remains behind the squad with room to keep its allies grouped.
        angularOffset = Math.PI * 0.78 + roleIndex * 0.28;
        preferredRadius = 5.65 + roleIndex * 0.42;
      }

      orders.push({
        enemyId: member.candidate.id,
        squadId,
        leaderId: leader.candidate.id,
        isLeader: member.candidate.id === leader.candidate.id,
        role: member.role,
        slot: orders.length,
        flankAngle: baseAngle + angularOffset,
        preferredRadius,
        orbitSign,
        squadSize: squad.length,
      });
    }
  }

  return orders;
}
