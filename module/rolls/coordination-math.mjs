/** Coordinated-attack pool: Charisma + War. Missing traits count as 0. */
export function coordinationPool(sys) {
  return (sys?.attributes?.charisma?.value ?? 0) + (sys?.abilities?.war?.value ?? 0);
}

/** Coordination difficulty = floor(participants / 2); participants floored at 2. */
export function coordinationDifficulty(participants) {
  return Math.floor(Math.max(2, participants) / 2);
}
