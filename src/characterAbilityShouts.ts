import type { CharacterId } from './types.ts';

export const CHARACTER_ABILITY_SHOUTS: Readonly<Record<CharacterId, readonly string[]>> = Object.freeze({
  marcin: [
    'WZ-404, ruszaj! Priorytet: czysta aleja!',
    'Kierownik zatwierdził tryb bojowy!',
    'ERP, zamknij zlecenie: eliminacja!',
    'Konwój na pozycję! Bez podpisu nie odjeżdżamy!',
  ],
  grzesiek: [
    'Czterdzieści cztery centymetry! TERAZ!',
    'Pięć pięści, pięć powodów do ucieczki!',
    'Ramię napięte — magazyn zaraz drży!',
    'Nie ma litości, jest progres na bicepsie!',
  ],
  dawid: [
    'Gres premium w locie! Odsunąć się!',
    'Format 120 na 280 — prosto w problem!',
    'Fuga poczeka, salwa nie!',
    'Ja wiem lepiej! Marmur, prowadź!',
  ],
  mateusz: [
    'Multiwersum, wejście na serwer! Każdy ma swój cel!',
    'Pięciu bohaterów, jeden raid! Wchodzimy!',
    'Avengers i Liga — czas na team fight!',
    'Respawn wsparcia! Panowie, flankować!',
  ],
  piotr: [
    'Rodzina B4, zamknąć im drogę!',
    'Pentagram aktywny. Kapibary, do roboty!',
    'Interesy rodziny właśnie wchodzą na halę!',
    'Don Kapibara wzywa. Bez dyskusji!',
  ],
});

export interface SelectedCharacterAbilityShout {
  readonly text: string;
  readonly index: number;
}

/** Select a voice-bubble callout without repeating the previous line immediately. */
export function selectCharacterAbilityShout(
  characterId: CharacterId,
  roll: number,
  previousIndex = -1,
): SelectedCharacterAbilityShout {
  const lines = CHARACTER_ABILITY_SHOUTS[characterId] ?? CHARACTER_ABILITY_SHOUTS.marcin;
  const safeRoll = Number.isFinite(roll) ? Math.max(0, Math.min(0.999999999, roll)) : 0.5;
  let index = Math.min(lines.length - 1, Math.floor(safeRoll * lines.length));
  if (lines.length > 1 && index === previousIndex) index = (index + 1) % lines.length;
  return { text: lines[index], index };
}
