import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getTerrainBonuses } from "../../module/helpers/terrain.mjs";

function makeBehavior({ type, disabled = false, system = {} }) {
  return { type, disabled, system };
}

function makeRegion(behaviors) {
  const regionDoc = { behaviors };
  for (const b of behaviors) b.parent = regionDoc;
  return regionDoc;
}

function makeToken(regionDocs) {
  const tokenDoc = { regions: new Set(regionDocs) };
  return { document: tokenDoc };
}

function makeActor(token) {
  return { getActiveTokens: () => (token ? [token] : []) };
}

describe("getTerrainBonuses", () => {
  let originalCanvas;

  beforeEach(() => {
    originalCanvas = globalThis.canvas;
  });

  afterEach(() => {
    globalThis.canvas = originalCanvas;
  });

  it("returns zeros when canvas is absent", () => {
    globalThis.canvas = null;
    expect(getTerrainBonuses(null, null)).toEqual({ attackerDiceBonus: 0, defenderDVBonus: 0, defenderSoakBonus: 0 });
  });

  it("returns zeros when no tokens are on the scene", () => {
    globalThis.canvas = { scene: { regions: [] } };
    const actor = { getActiveTokens: () => [] };
    expect(getTerrainBonuses(actor, actor)).toEqual({ attackerDiceBonus: 0, defenderDVBonus: 0, defenderSoakBonus: 0 });
  });

  it("returns zeros when no terrain modifier behaviors exist", () => {
    const region = makeRegion([makeBehavior({ type: "ex2e.hazardDamage", system: {} })]);
    const token  = makeToken([region]);
    const actor  = makeActor(token);
    globalThis.canvas = { scene: { regions: [region] } };
    expect(getTerrainBonuses(actor, actor)).toEqual({ attackerDiceBonus: 0, defenderDVBonus: 0, defenderSoakBonus: 0 });
  });

  it("skips disabled terrain behaviors", () => {
    const region = makeRegion([makeBehavior({ type: "ex2e.terrainModifier", disabled: true, system: { accuracyBonus: 3, dvBonus: 1, soakBonus: 2 } })]);
    const token  = makeToken([region]);
    const actor  = makeActor(token);
    globalThis.canvas = { scene: { regions: [region] } };
    expect(getTerrainBonuses(actor, actor)).toEqual({ attackerDiceBonus: 0, defenderDVBonus: 0, defenderSoakBonus: 0 });
  });

  it("applies accuracyBonus when attacker token is in region", () => {
    const region   = makeRegion([makeBehavior({ type: "ex2e.terrainModifier", system: { accuracyBonus: 2, dvBonus: 0, soakBonus: 0 } })]);
    const atkToken = makeToken([region]);
    const defToken = makeToken([]);
    globalThis.canvas = { scene: { regions: [region] } };
    const result = getTerrainBonuses(makeActor(atkToken), makeActor(defToken));
    expect(result.attackerDiceBonus).toBe(2);
    expect(result.defenderDVBonus).toBe(0);
    expect(result.defenderSoakBonus).toBe(0);
  });

  it("applies dvBonus and soakBonus when defender token is in region", () => {
    const region   = makeRegion([makeBehavior({ type: "ex2e.terrainModifier", system: { accuracyBonus: 0, dvBonus: 1, soakBonus: 3 } })]);
    const atkToken = makeToken([]);
    const defToken = makeToken([region]);
    globalThis.canvas = { scene: { regions: [region] } };
    const result = getTerrainBonuses(makeActor(atkToken), makeActor(defToken));
    expect(result.attackerDiceBonus).toBe(0);
    expect(result.defenderDVBonus).toBe(1);
    expect(result.defenderSoakBonus).toBe(3);
  });

  it("accumulates bonuses from multiple terrain regions", () => {
    const r1       = makeRegion([makeBehavior({ type: "ex2e.terrainModifier", system: { accuracyBonus: 2, dvBonus: 0, soakBonus: 0 } })]);
    const r2       = makeRegion([makeBehavior({ type: "ex2e.terrainModifier", system: { accuracyBonus: 1, dvBonus: 0, soakBonus: 0 } })]);
    const atkToken = makeToken([r1, r2]);
    globalThis.canvas = { scene: { regions: [r1, r2] } };
    const result = getTerrainBonuses(makeActor(atkToken), makeActor(makeToken([])));
    expect(result.attackerDiceBonus).toBe(3);
  });

  it("handles null actors gracefully", () => {
    const region = makeRegion([makeBehavior({ type: "ex2e.terrainModifier", system: { accuracyBonus: 2, dvBonus: 1, soakBonus: 1 } })]);
    globalThis.canvas = { scene: { regions: [region] } };
    expect(() => getTerrainBonuses(null, null)).not.toThrow();
    expect(getTerrainBonuses(null, null)).toEqual({ attackerDiceBonus: 0, defenderDVBonus: 0, defenderSoakBonus: 0 });
  });
});
