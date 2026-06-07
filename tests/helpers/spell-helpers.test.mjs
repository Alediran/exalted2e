import { describe, it, expect } from "vitest";
import { CIRCLE_KEY_BY_TRADITION, circleChoicesFor } from "../../module/helpers/spell-helpers.mjs";

const loc = k => k; // identity localizer

describe("circleChoicesFor", () => {
  it("sorcery → 3 circles, value 1..3", () => {
    expect(circleChoicesFor("sorcery", loc)).toEqual([
      { value: 1, label: "EX2E.CircleTerrestrial" },
      { value: 2, label: "EX2E.CircleCelestial" },
      { value: 3, label: "EX2E.CircleSolar" },
    ]);
  });
  it("necromancy → its 3 circles", () => {
    expect(circleChoicesFor("necromancy", loc).map(c => c.label))
      .toEqual(["EX2E.CircleShadowlands", "EX2E.CircleLabyrinth", "EX2E.CircleVoid"]);
  });
  it("weaving → 2 circles", () => {
    expect(circleChoicesFor("weaving", loc).map(c => c.value)).toEqual([1, 2]);
  });
  it("unknown tradition falls back to sorcery", () => {
    expect(circleChoicesFor("nope", loc)).toEqual(circleChoicesFor("sorcery", loc));
  });
  it("exposes the tradition→circle key map", () => {
    expect(CIRCLE_KEY_BY_TRADITION.sorcery[1]).toBe("EX2E.CircleTerrestrial");
  });
});
