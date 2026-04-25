import { describe, it, expect } from "vitest";
import { NpcData } from "../../module/data/actor/npc-data.mjs";
import { makeNpcSystem } from "../_helpers/make-actor.mjs";

function _prepDerivedData(system) {
  const data = Object.create(NpcData.prototype);
  Object.assign(data, system);
  data.prepareDerivedData();
  return data;
}

describe("NpcData.prepareDerivedData", () => {
  it("totalDamage clamps at totalBoxes", () => {
    const sys = makeNpcSystem({
      health: { bashing: 5, lethal: 5, aggravated: 5, totalBoxes: 7 }
    });
    const result = _prepDerivedData(sys);
    expect(result.health.totalDamage).toBe(7);
  });

  it("incapacitated true when totalDamage reaches totalBoxes", () => {
    const sys = makeNpcSystem({
      health: { bashing: 7, lethal: 0, aggravated: 0, totalBoxes: 7 }
    });
    const result = _prepDerivedData(sys);
    expect(result.health.incapacitated).toBe(true);
  });

  it("incapacitated false when totalDamage less than totalBoxes", () => {
    const sys = makeNpcSystem({
      health: { bashing: 3, lethal: 1, aggravated: 0, totalBoxes: 7 }
    });
    const result = _prepDerivedData(sys);
    expect(result.health.totalDamage).toBe(4);
    expect(result.health.incapacitated).toBe(false);
  });
});
