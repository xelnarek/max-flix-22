import type { EnemyType } from './types.ts';

export interface EnemyMeleeTelegraphProfile {
  readonly windupSeconds: number;
  /** Additional distance at which the enemy commits to a melee swing. */
  readonly reachMeters: number;
  readonly laneWidth: number;
  readonly color: number;
  readonly cooldownSeconds: number;
  readonly warningText: string;
  readonly missText: string;
}

const PROFILES: Readonly<Partial<Record<EnemyType, EnemyMeleeTelegraphProfile>>> = Object.freeze({
  customer: {
    windupSeconds: 0.48, reachMeters: 0.72, laneWidth: 1.25, color: 0xf97316, cooldownSeconds: 1.35,
    warningText: 'KLIENT ZAMACHUJE TECZKĄ — ODSKOCZ!', missText: 'UNIK! TECZKA MINĘŁA CIĘ!',
  },
  architect: {
    windupSeconds: 0.58, reachMeters: 0.58, laneWidth: 1.05, color: 0xa78bfa, cooldownSeconds: 1.55,
    warningText: 'ARCHITEKT PRZYGOTOWUJE RZUT PRÓBNIKIEM!', missText: 'UNIK! PRÓBNIK NIE TRAFIŁ!',
  },
  inspector: {
    windupSeconds: 0.44, reachMeters: 0.50, laneWidth: 0.96, color: 0x38bdf8, cooldownSeconds: 1.30,
    warningText: 'INSPEKTOR PODNOSI PAŁKĘ BHP — USTĄP!', missText: 'UNIK! KONTROLA CHYBIONA!',
  },
  kurier: {
    windupSeconds: 0.36, reachMeters: 0.88, laneWidth: 0.92, color: 0xf97316, cooldownSeconds: 1.25,
    warningText: 'KURIER RUSZA Z PACZKĄ — ZEJDŹ Z TORU!', missText: 'UNIK! PACZKA POLECIAŁA OBOK!',
  },
  monter: {
    windupSeconds: 0.51, reachMeters: 0.72, laneWidth: 1.35, color: 0x22c55e, cooldownSeconds: 1.40,
    warningText: 'MONTER PODNOSI CIĘŻKIE NARZĘDZIE!', missText: 'UNIK! NARZĘDZIE UDERZYŁO W POWIETRZE!',
  },
  sztaplar_szalony: {
    windupSeconds: 0.60, reachMeters: 1.05, laneWidth: 1.75, color: 0xfacc15, cooldownSeconds: 1.65,
    warningText: 'SZALONY SZTAPLAR BIORZE ROZBIEG — ODSKOCZ!', missText: 'UNIK! SZTAPLAR PRZESTRZELIŁ!',
  },
  elite_walczak_guard: {
    windupSeconds: 0.56, reachMeters: 0.88, laneWidth: 1.60, color: 0xf43f5e, cooldownSeconds: 1.50,
    warningText: 'ELITARNY STRAŻNIK ZAMACHUJE SIĘ — BLOK / UNIK!', missText: 'UNIK! STRAŻNIK NIE DOSIĘGNĄŁ!',
  },
  zombie_pracownik: {
    windupSeconds: 0.64, reachMeters: 0.92, laneWidth: 1.45, color: 0x84cc16, cooldownSeconds: 1.70,
    warningText: 'ZOMBIE ZBIERA SIŁY DO SZARPANIA!', missText: 'UNIK! ZOMBIE CHWYCIŁ POWIETRZE!',
  },
  mutant_gamma_forklift: {
    windupSeconds: 0.62, reachMeters: 1.08, laneWidth: 1.85, color: 0x4ade80, cooldownSeconds: 1.75,
    warningText: 'MUTANT ŁADUJE CIĘŻKI CIOS — UCIEKAJ Z LINII!', missText: 'UNIK! MUTANT NIE TRAFIŁ!',
  },
  radioactive_pip: {
    windupSeconds: 0.54, reachMeters: 0.82, laneWidth: 1.35, color: 0xa3e635, cooldownSeconds: 1.60,
    warningText: 'PIP WYKONUJE SKAŻONY ZAMACH — ODSKOCZ!', missText: 'UNIK! PIP NIE DOSIĘGNĄŁ!',
  },
});

export function getEnemyMeleeTelegraphProfile(
  type: EnemyType,
): Readonly<EnemyMeleeTelegraphProfile> | null {
  return PROFILES[type] ?? null;
}
