/** Circle i18n key per spellcasting tradition + circle number (1-indexed). */
export const CIRCLE_KEY_BY_TRADITION = {
  sorcery:    { 1: "EX2E.CircleTerrestrial", 2: "EX2E.CircleCelestial", 3: "EX2E.CircleSolar"   },
  necromancy: { 1: "EX2E.CircleShadowlands", 2: "EX2E.CircleLabyrinth", 3: "EX2E.CircleVoid"    },
  weaving:    { 1: "EX2E.CircleManMachine",  2: "EX2E.CircleGodMachine"                         },
};

/** Circle dropdown options for a tradition: `[{ value, label }]`. Unknown → sorcery. */
export function circleChoicesFor(tradition, localize) {
  const map = CIRCLE_KEY_BY_TRADITION[tradition] ?? CIRCLE_KEY_BY_TRADITION.sorcery;
  return Object.entries(map).map(([num, key]) => ({ value: Number(num), label: localize(key) }));
}
