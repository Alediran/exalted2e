/**
 * Resplendent Paradox table (the second Sidereal Paradox source) and its
 * dice-sum helper. Pure module — no Foundry globals — so it is unit-testable.
 * Each row mirrors a line of the Resplendent Paradox table; `dice` reflects the
 * table's value (additive rows carry their "+N" amount).
 */
export const RESPLENDENT_PARADOX_TRIGGERS = [
  { key: "out_of_character",       labelKey: "EX2E.RParadoxOutOfCharacter",      dice: 1 },
  { key: "dozen_destinies_month",  labelKey: "EX2E.RParadoxDozenDestinies",      dice: 1 },
  { key: "anima_glowing",          labelKey: "EX2E.RParadoxAnimaGlowing",        dice: 1 },
  { key: "anima_burning",          labelKey: "EX2E.RParadoxAnimaBurning",        dice: 2 },
  { key: "confusing_meeting_self", labelKey: "EX2E.RParadoxConfusingSelf",       dice: 1 },
  { key: "confusing_meeting_other",labelKey: "EX2E.RParadoxConfusingOther",      dice: 2 },
  { key: "concludes_imitating",    labelKey: "EX2E.RParadoxConcludesImitating",  dice: 1 },
  { key: "concludes_supernatural", labelKey: "EX2E.RParadoxConcludesSupernatural", dice: 2 },
];

const _DICE_BY_KEY = new Map(RESPLENDENT_PARADOX_TRIGGERS.map(t => [t.key, t.dice]));

/**
 * Sum the Paradox dice for a list of selected trigger keys.
 * Unknown keys are ignored; empty/undefined → 0.
 * @param {string[]} [keys]
 * @returns {number}
 */
export function sumResplendentParadoxDice(keys) {
  if (!Array.isArray(keys)) return 0;
  return keys.reduce((sum, k) => sum + (_DICE_BY_KEY.get(k) ?? 0), 0);
}
