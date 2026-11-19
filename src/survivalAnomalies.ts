import type { SurvivalAnomalyModifiers } from './survivalAnomaliesTypes.ts';

export type SurvivalAnomalyId =
  | 'bhp_audit'
  | 'warehouse_overtime'
  | 'oil_spill'
  | 'scanner_static'
  | 'short_staff'
  | 'golden_delivery'
  | 'coffee_overdrive'
  | 'broken_scales'
  | 'safety_bonus'
  | 'inventory_lock'
  | 'overflow_loading'
  | 'maintenance_window';

export interface SurvivalAnomaly {
  readonly id: SurvivalAnomalyId;
  readonly title: string;
  readonly description: string;
  readonly durationSeconds: number;
  readonly remainingSeconds: number;
}

export interface SurvivalAnomalyState {
  readonly active: SurvivalAnomaly | null;
  readonly nextAt: number;
  readonly sequence: number;
  readonly recentIds: readonly SurvivalAnomalyId[];
}

export interface SurvivalAnomalyResult {
  readonly state: SurvivalAnomalyState;
  readonly started: SurvivalAnomaly | null;
  readonly expired: SurvivalAnomaly | null;
}

interface SurvivalAnomalyTemplate {
  readonly id: SurvivalAnomalyId;
  readonly title: string;
  readonly description: string;
  readonly weight: number;
  readonly modifiers: SurvivalAnomalyModifiers;
}

const NEUTRAL: SurvivalAnomalyModifiers = Object.freeze({
  enemyHealthMultiplier: 1,
  enemyAbilityRateMultiplier: 1,
  spawnIntervalMultiplier: 1,
  enemyGroupSizeBonus: 0,
  playerDamageDealtMultiplier: 1,
  playerDamageTakenMultiplier: 1,
  playerMoveMultiplier: 1,
  attackCooldownMultiplier: 1,
  abilityCooldownMultiplier: 1,
  abilityDurationMultiplier: 1,
  xpDropChanceMultiplier: 1,
  xpValueMultiplier: 1,
  xpPickupMultiplier: 1,
});

const TEMPLATES: readonly SurvivalAnomalyTemplate[] = Object.freeze([
  {
    id: 'bhp_audit',
    title: 'NIEZAPOWIEDZIANY AUDYT BHP',
    description: 'Kontrola zbroi! Nowe jednostki mają więcej zdrowia, a podstawowe ataki operatora zadają mniej obrażeń',
    weight: 15,
    modifiers: { ...NEUTRAL, enemyHealthMultiplier: 1.22, playerDamageDealtMultiplier: 0.90 },
  },
  {
    id: 'warehouse_overtime',
    title: 'NADGODZINY NA MAGAZYNIE',
    description: 'Brygadzista zarządził nadgodziny. Specjalne akcje wrogów wracają szybciej i przyjeżdżają większe grupy',
    weight: 14,
    modifiers: { ...NEUTRAL, enemyAbilityRateMultiplier: 1.22, spawnIntervalMultiplier: 0.91, enemyGroupSizeBonus: 1 },
  },
  {
    id: 'oil_spill',
    title: 'ROZLANA OLIWA NA ALEJCE',
    description: 'Podłoże jest śliskie. Operator porusza się wolniej, a utrzymanie dystansu wymaga większej precyzji',
    weight: 12,
    modifiers: { ...NEUTRAL, playerMoveMultiplier: 0.82, playerDamageTakenMultiplier: 1.06 },
  },
  {
    id: 'scanner_static',
    title: 'ZAKŁÓCENIA SKANERA ERP',
    description: 'Terminal gubi sygnał. Ataki podstawowe i umiejętności ładują się wolniej',
    weight: 11,
    modifiers: { ...NEUTRAL, attackCooldownMultiplier: 1.14, abilityCooldownMultiplier: 1.12, abilityDurationMultiplier: 0.92 },
  },
  {
    id: 'short_staff',
    title: 'BRAKI KADROWE',
    description: 'Na zmianie brakuje ludzi, więc dostawy są częstsze. Uważaj na większe grupy i trzymaj otwartą drogę odwrotu',
    weight: 10,
    modifiers: { ...NEUTRAL, spawnIntervalMultiplier: 0.84, enemyGroupSizeBonus: 1, enemyHealthMultiplier: 1.08 },
  },
  {
    id: 'golden_delivery',
    title: 'ZŁOTA DOSTAWA Z CENTRALI',
    description: 'Szczęście dopisało! Kryształy wypadają częściej i mają większą wartość',
    weight: 10,
    modifiers: { ...NEUTRAL, xpDropChanceMultiplier: 1.60, xpValueMultiplier: 1.18, xpPickupMultiplier: 1.12 },
  },
  {
    id: 'coffee_overdrive',
    title: 'KAWA Z AUTOMATU B4',
    description: 'Podwójne espresso! Operator porusza się szybciej i odzyskuje tempo ataku, ale nie zwiększa obrażeń',
    weight: 8,
    modifiers: { ...NEUTRAL, playerMoveMultiplier: 1.08, attackCooldownMultiplier: 0.90, abilityCooldownMultiplier: 0.94 },
  },
  {
    id: 'broken_scales',
    title: 'USZKODZONA WAGA PALETOWA',
    description: 'Alarm przeciążenia! Wrogowie częściej uruchamiają specjalne akcje, a ich trafienia są groźniejsze',
    weight: 7,
    modifiers: { ...NEUTRAL, enemyAbilityRateMultiplier: 1.16, playerDamageTakenMultiplier: 1.18 },
  },
  {
    id: 'safety_bonus',
    title: 'PREMIA ZA BEZPIECZEŃSTWO',
    description: 'Inspektor przyznał premię. Operator otrzymuje chwilowo lepszą ochronę, ale ataki są odrobinę słabsze',
    weight: 7,
    modifiers: { ...NEUTRAL, playerDamageTakenMultiplier: 0.84, playerDamageDealtMultiplier: 0.94 },
  },
  {
    id: 'inventory_lock',
    title: 'INWENTARYZACJA NA PEŁNYM OBROTACH',
    description: 'Blokada magazynu! Przeciwnicy są wytrzymalsi, a operator wolniej ładuje umiejętność specjalną',
    weight: 6,
    modifiers: { ...NEUTRAL, enemyHealthMultiplier: 1.14, abilityCooldownMultiplier: 1.16, playerMoveMultiplier: 0.92 },
  },
  {
    id: 'overflow_loading',
    title: 'PRZECIĄŻONY ZAŁADUNEK',
    description: 'Alarm na rampie! Większe grupy przyjeżdżają szybciej, przeciwnicy częściej używają specjalnych akcji i mocniej uderzają. W zamian kryształy XP wypadają częściej i mają wyższą wartość.',
    weight: 6,
    modifiers: {
      ...NEUTRAL,
      enemyHealthMultiplier: 1.16,
      enemyAbilityRateMultiplier: 1.12,
      spawnIntervalMultiplier: 0.88,
      enemyGroupSizeBonus: 2,
      playerDamageTakenMultiplier: 1.12,
      xpDropChanceMultiplier: 1.28,
      xpValueMultiplier: 1.28,
    },
  },
  {
    id: 'maintenance_window',
    title: 'OKNO SERWISOWE B4',
    description: 'Serwis odciąża linię. Wrogowie nacierają rzadziej i wolniej reagują, a operator zyskuje krótsze odnowienie ataków i umiejętności oraz lepszą ochronę.',
    weight: 6,
    modifiers: {
      ...NEUTRAL,
      enemyHealthMultiplier: 0.94,
      enemyAbilityRateMultiplier: 0.88,
      spawnIntervalMultiplier: 1.16,
      enemyGroupSizeBonus: -1,
      playerDamageDealtMultiplier: 1.08,
      playerDamageTakenMultiplier: 0.86,
      attackCooldownMultiplier: 0.94,
      abilityCooldownMultiplier: 0.92,
      abilityDurationMultiplier: 1.06,
      xpPickupMultiplier: 1.12,
    },
  },
] as const);

const TEMPLATE_BY_ID = new Map<SurvivalAnomalyId, SurvivalAnomalyTemplate>(
  TEMPLATES.map((template) => [template.id, template] as const),
);

function clampRoll(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(0.999999999, value)) : 0.5;
}

function selectTemplate(roll: number, recentIds: readonly SurvivalAnomalyId[]): SurvivalAnomalyTemplate {
  const recent = recentIds.slice(-2);
  const eligible = TEMPLATES.filter((template) => !recent.includes(template.id));
  const pool = eligible.length > 0 ? eligible : TEMPLATES;
  const totalWeight = pool.reduce((sum, template) => sum + template.weight, 0);
  const target = clampRoll(roll) * totalWeight;
  let cumulative = 0;
  for (const template of pool) {
    cumulative += template.weight;
    if (target < cumulative) return template;
  }
  return pool[pool.length - 1];
}

export function createSurvivalAnomalyState(): SurvivalAnomalyState {
  return { active: null, nextAt: 42, sequence: 0, recentIds: [] };
}

/** Advance one weighted anomaly clock using caller-supplied RNG rolls. */
export function advanceSurvivalAnomaly(
  state: SurvivalAnomalyState,
  elapsedSeconds: number,
  deltaSeconds: number,
  selectionRoll = 0.5,
  durationRoll = 0.5,
  gapRoll = 0.5,
): SurvivalAnomalyResult {
  const elapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
  const dt = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
  if (state.active) {
    const remainingSeconds = Math.max(0, state.active.remainingSeconds - dt);
    if (remainingSeconds > 0) {
      return {
        state: { ...state, active: { ...state.active, remainingSeconds } },
        started: null,
        expired: null,
      };
    }
    return {
      state: {
        ...state,
        active: null,
        nextAt: elapsed + 24 + clampRoll(gapRoll) * 18,
      },
      started: null,
      expired: state.active,
    };
  }

  if (elapsed < state.nextAt) return { state, started: null, expired: null };
  const template = selectTemplate(selectionRoll, state.recentIds);
  const durationSeconds = 20 + clampRoll(durationRoll) * 10;
  const active: SurvivalAnomaly = {
    id: template.id,
    title: template.title,
    description: template.description,
    durationSeconds,
    remainingSeconds: durationSeconds,
  };
  const recentIds = [...state.recentIds, active.id].slice(-2);
  return {
    state: { ...state, active, sequence: state.sequence + 1, recentIds },
    started: active,
    expired: null,
  };
}

export function getSurvivalAnomalyModifiers(state: SurvivalAnomalyState): SurvivalAnomalyModifiers {
  if (!state.active) return NEUTRAL;
  return TEMPLATE_BY_ID.get(state.active.id)?.modifiers ?? NEUTRAL;
}

export function getSurvivalAnomalyDefinition(id: SurvivalAnomalyId): SurvivalAnomalyTemplate | undefined {
  return TEMPLATE_BY_ID.get(id);
}
