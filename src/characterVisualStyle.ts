import type { CharacterId } from './types.ts';

export interface CharacterVisualStyle {
  gaitRate: number;
  strideAmplitude: number;
  armSwingAmplitude: number;
  forwardLean: number;
  sideLean: number;
  verticalBob: number;
  idleSway: number;
  idleBob: number;
  attackArmX: number;
  attackArmZ: number;
  offhandAttackX: number;
}

export const CHARACTER_VISUAL_STYLES: Readonly<Record<CharacterId, CharacterVisualStyle>> = Object.freeze({
  // Manager's controlled, compact stride.
  marcin: { gaitRate: 12.2, strideAmplitude: 0.47, armSwingAmplitude: 0.39, forwardLean: 0.045, sideLean: 0.035, verticalBob: 0.012, idleSway: 0.008, idleBob: 0.006, attackArmX: -1.42, attackArmZ: -0.10, offhandAttackX: -0.12 },
  // Heavy planted steps and a two-handed hammer throw.
  grzesiek: { gaitRate: 9.8, strideAmplitude: 0.43, armSwingAmplitude: 0.30, forwardLean: 0.135, sideLean: 0.045, verticalBob: 0.028, idleSway: 0.015, idleBob: 0.008, attackArmX: -1.96, attackArmZ: -0.28, offhandAttackX: -1.48 },
  // Taller, spring-loaded movement with a loose throwing arm.
  dawid: { gaitRate: 14.4, strideAmplitude: 0.66, armSwingAmplitude: 0.67, forwardLean: 0.025, sideLean: 0.075, verticalBob: 0.048, idleSway: 0.014, idleBob: 0.012, attackArmX: -1.62, attackArmZ: -0.62, offhandAttackX: -0.22 },
  // Fast compact sprint, pronounced forward lean and quick arm drive.
  mateusz: { gaitRate: 17.6, strideAmplitude: 0.76, armSwingAmplitude: 0.72, forwardLean: 0.19, sideLean: 0.12, verticalBob: 0.022, idleSway: 0.018, idleBob: 0.009, attackArmX: -2.05, attackArmZ: 0.26, offhandAttackX: -0.18 },
  // Veteran's measured march; wrench sweep is a little wider than the manager's cast.
  piotr: { gaitRate: 10.7, strideAmplitude: 0.46, armSwingAmplitude: 0.41, forwardLean: 0.055, sideLean: 0.03, verticalBob: 0.013, idleSway: 0.007, idleBob: 0.005, attackArmX: -1.55, attackArmZ: -0.38, offhandAttackX: -0.12 },
});

export function getCharacterVisualStyle(id: CharacterId): CharacterVisualStyle {
  return CHARACTER_VISUAL_STYLES[id] ?? CHARACTER_VISUAL_STYLES.marcin;
}

export const CHARACTER_VISUAL_ACCENT_COLORS: Readonly<Record<CharacterId, number>> = Object.freeze({
  marcin: 0x60a5fa,
  grzesiek: 0x4ade80,
  dawid: 0xfb923c,
  mateusz: 0xe879f9,
  piotr: 0xef4444,
});

export function getCharacterVisualAccentColor(id: CharacterId): number {
  return CHARACTER_VISUAL_ACCENT_COLORS[id] ?? CHARACTER_VISUAL_ACCENT_COLORS.marcin;
}
