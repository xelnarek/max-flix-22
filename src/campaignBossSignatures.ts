import type { CampaignStageId } from './campaignProgression.ts';

export type CampaignBossProjectileKind = 'penalty' | 'dyscyplinarka' | 'clipboard' | 'spark';
export type CampaignBossPattern =
  | 'ramp_sweep'
  | 'container_crossfire'
  | 'frost_manifest'
  | 'scanner_sweep'
  | 'audit_combo';

export interface CampaignBossSignature {
  stageId: CampaignStageId;
  title: string;
  callout: string;
  warning: string;
  pattern: CampaignBossPattern;
  projectileKind: CampaignBossProjectileKind;
  intervalSeconds: number;
  windupSeconds: number;
  initialDelaySeconds: number;
  maxShots: number;
}

export interface CampaignBossVolley {
  projectileKind: CampaignBossProjectileKind;
  angleOffsets: number[];
  lateralSpacing: number;
}

/** Distinct, readable boss attack identities for the five compact Campaign stages. */
export const CAMPAIGN_BOSS_SIGNATURES: Readonly<Record<CampaignStageId, CampaignBossSignature>> = {
  b4_intro: {
    stageId: 'b4_intro',
    title: 'Nadzorca Rampy',
    callout: 'KONTROLA LINII RAMPY',
    warning: 'Nadzorca blokuje aleję wachlarzem nakazów — zejdź z linii!',
    pattern: 'ramp_sweep',
    projectileKind: 'penalty',
    intervalSeconds: 15.2,
    windupSeconds: 1.08,
    initialDelaySeconds: 8.0,
    maxShots: 3,
  },
  port_17: {
    stageId: 'port_17',
    title: 'Dyrektor Widmo',
    callout: 'KRZYŻOWY OSTRZAŁ KONTENERÓW',
    warning: 'Dyrektor zamyka dwie alejki naraz — zmień pozycję między salwami!',
    pattern: 'container_crossfire',
    projectileKind: 'dyscyplinarka',
    intervalSeconds: 16.0,
    windupSeconds: 1.18,
    initialDelaySeconds: 8.4,
    maxShots: 2,
  },
  cold_zero: {
    stageId: 'cold_zero',
    title: 'Bosman Kraków',
    callout: 'WACHLARZ ODPRAWY',
    warning: 'Bosman wysyła szeroki wachlarz dokumentów — unikaj środka natarcia!',
    pattern: 'frost_manifest',
    projectileKind: 'clipboard',
    intervalSeconds: 18.0,
    windupSeconds: 1.36,
    initialDelaySeconds: 8.8,
    maxShots: 5,
  },
  night_sorting: {
    stageId: 'night_sorting',
    title: 'Nadzorca Zero',
    callout: 'POTRÓJNY SKANER',
    warning: 'Nadzorca ustawia trzy wiązki skanera — odskocz poza ich korytarze!',
    pattern: 'scanner_sweep',
    projectileKind: 'spark',
    intervalSeconds: 14.8,
    windupSeconds: 0.98,
    initialDelaySeconds: 7.6,
    maxShots: 3,
  },
  final_audit: {
    stageId: 'final_audit',
    title: 'Dyrektor Ostateczny',
    callout: 'AUDYT KOMBINOWANY',
    warning: 'Dyrektor zmienia wzorzec ataku — przygotuj się na następną sekwencję!',
    pattern: 'audit_combo',
    projectileKind: 'dyscyplinarka',
    intervalSeconds: 13.4,
    windupSeconds: 1.08,
    initialDelaySeconds: 8.2,
    maxShots: 5,
  },
} as const;

export function getCampaignBossSignature(stageId: CampaignStageId): CampaignBossSignature {
  return CAMPAIGN_BOSS_SIGNATURES[stageId];
}

function sanitizeVolleyIndex(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function boundedOffsets(values: readonly number[], phase: number): number[] {
  const spread = phase >= 2 ? 1.12 : 1;
  return values.slice(0, 5).map((value) => {
    const scaled = value * spread;
    return Math.max(-0.72, Math.min(0.72, scaled));
  });
}

/**
 * Return a deterministic attack arrangement. The final boss alternates a wide
 * paperwork fan with a narrow electric crossfire instead of repeating one volley.
 */
export function getCampaignBossVolley(
  signature: CampaignBossSignature,
  volleyIndex: number,
  phase = 1,
): CampaignBossVolley {
  const index = sanitizeVolleyIndex(volleyIndex);
  switch (signature.pattern) {
    case 'ramp_sweep':
      return {
        projectileKind: 'penalty',
        angleOffsets: boundedOffsets([-0.28, 0, 0.28], phase),
        lateralSpacing: 0.22,
      };
    case 'container_crossfire':
      return {
        projectileKind: 'dyscyplinarka',
        angleOffsets: boundedOffsets([-0.44, 0.44], phase),
        lateralSpacing: 0.62,
      };
    case 'frost_manifest':
      return {
        projectileKind: 'clipboard',
        angleOffsets: boundedOffsets([-0.58, -0.29, 0, 0.29, 0.58], phase),
        lateralSpacing: 0.14,
      };
    case 'scanner_sweep':
      return {
        projectileKind: 'spark',
        angleOffsets: boundedOffsets([-0.37, 0, 0.37], phase),
        lateralSpacing: 0.46,
      };
    case 'audit_combo':
      return index % 2 === 0
        ? {
          projectileKind: 'dyscyplinarka',
          angleOffsets: boundedOffsets([-0.52, -0.26, 0, 0.26, 0.52], phase),
          lateralSpacing: 0.18,
        }
        : {
          projectileKind: 'spark',
          angleOffsets: boundedOffsets([-0.47, 0.47], phase),
          lateralSpacing: 0.68,
        };
  }
}
