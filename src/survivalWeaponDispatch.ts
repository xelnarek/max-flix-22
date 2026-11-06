/** Find the next ready weapon in round-robin order. */
export function findNextReadyWeaponIndex(
  cooldowns: readonly number[],
  startIndex = 0,
): number {
  const count = cooldowns.length;
  if (count === 0) return -1;
  const safeStart = Number.isFinite(startIndex)
    ? ((Math.floor(startIndex) % count) + count) % count
    : 0;
  for (let offset = 0; offset < count; offset++) {
    const index = (safeStart + offset) % count;
    const cooldown = cooldowns[index];
    if (Number.isFinite(cooldown) && cooldown <= 0) return index;
  }
  return -1;
}

/** Move the dispatch cursor just beyond the weapon that was fired. */
export function getNextWeaponDispatchCursor(readyIndex: number, weaponCount: number): number {
  if (!Number.isFinite(weaponCount) || weaponCount <= 0) return 0;
  const count = Math.floor(weaponCount);
  if (!Number.isFinite(readyIndex) || readyIndex < 0) return 0;
  return (Math.floor(readyIndex) + 1) % count;
}
