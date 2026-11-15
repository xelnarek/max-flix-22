import type { CharacterId } from './types.ts';

export interface CharacterHitReactionProfile {
  readonly durationSeconds: number;
  readonly armRecoil: number;
  readonly armRoll: number;
  readonly torsoPitch: number;
  readonly torsoRoll: number;
  readonly headSnap: number;
  readonly toolKick: number;
}

/** Five operator-specific impact responses; cosmetic only, never combat balance. */
export const CHARACTER_HIT_REACTION_PROFILES: Readonly<Record<CharacterId, CharacterHitReactionProfile>> = Object.freeze({
  marcin: Object.freeze({ durationSeconds:0.36, armRecoil:0.38, armRoll:0.10, torsoPitch:0.055, torsoRoll:0.045, headSnap:0.07, toolKick:0.10 }),
  grzesiek: Object.freeze({ durationSeconds:0.42, armRecoil:0.58, armRoll:0.16, torsoPitch:0.13, torsoRoll:0.025, headSnap:0.11, toolKick:0.16 }),
  dawid: Object.freeze({ durationSeconds:0.34, armRecoil:0.34, armRoll:0.18, torsoPitch:0.045, torsoRoll:0.12, headSnap:0.045, toolKick:0.22 }),
  mateusz: Object.freeze({ durationSeconds:0.28, armRecoil:0.30, armRoll:0.12, torsoPitch:0.035, torsoRoll:0.085, headSnap:0.035, toolKick:0.08 }),
  piotr: Object.freeze({ durationSeconds:0.38, armRecoil:0.46, armRoll:0.14, torsoPitch:0.075, torsoRoll:0.15, headSnap:0.085, toolKick:0.19 }),
});

export function getCharacterHitReactionProfile(id: CharacterId): Readonly<CharacterHitReactionProfile> {
  return CHARACTER_HIT_REACTION_PROFILES[id] ?? CHARACTER_HIT_REACTION_PROFILES.marcin;
}
