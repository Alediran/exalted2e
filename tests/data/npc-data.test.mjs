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

describe("NpcData schema caps", () => {
  it("allows motes.max up to 2000", () => {
    const schema = NpcData.defineSchema();
    expect(schema.motes.fields.max.options.max).toBe(2000);
  });
  it("allows soak.bashing up to 80", () => {
    const schema = NpcData.defineSchema();
    expect(schema.combat.fields.soak.fields.bashing.options.max).toBe(80);
  });
  it("allows soak.lethal up to 60", () => {
    const schema = NpcData.defineSchema();
    expect(schema.combat.fields.soak.fields.lethal.options.max).toBe(60);
  });
  it("allows joinBattle up to 40", () => {
    const schema = NpcData.defineSchema();
    expect(schema.combat.fields.joinBattle.options.max).toBe(40);
  });
  it("allows pools.combat up to 50", () => {
    const schema = NpcData.defineSchema();
    expect(schema.pools.fields.combat.options.max).toBe(50);
  });
  it("allows health damage values up to 500", () => {
    const schema = NpcData.defineSchema();
    expect(schema.health.fields.bashing.options.max).toBe(500);
    expect(schema.health.fields.lethal.options.max).toBe(500);
    expect(schema.health.fields.aggravated.options.max).toBe(500);
  });
  it("has woundPenalty in combat schema with initial 0 and max 4", () => {
    const schema = NpcData.defineSchema();
    expect(schema.combat.fields.woundPenalty.options.initial).toBe(0);
    expect(schema.combat.fields.woundPenalty.options.max).toBe(4);
  });
});

describe("NpcData.prepareDerivedData wound penalty", () => {
  it("mirrors combat.woundPenalty onto health.woundPenalty", () => {
    const sys = makeNpcSystem({
      combat: { joinBattle: 4, dodgeDV: 2, parryDV: 2, dodgeMDV: 2, parryMDV: 2,
                soak: { bashing: 3, lethal: 1, aggravated: 0 }, hardness: 0, woundPenalty: 3 }
    });
    const result = _prepDerivedData(sys);
    expect(result.health.woundPenalty).toBe(3);
  });

  it("health.woundPenalty is 0 when not set", () => {
    const sys = makeNpcSystem();
    const result = _prepDerivedData(sys);
    expect(result.health.woundPenalty).toBe(0);
  });
});

describe("NpcData schema — identity fields", () => {
  it("npcType defaults to 'god'", () => {
    const schema = NpcData.defineSchema();
    expect(schema.npcType.options.initial).toBe("god");
  });

  it("npcType is a non-blank StringField", () => {
    const schema = NpcData.defineSchema();
    expect(schema.npcType.options.blank).toBe(false);
  });

  it("summoning field exists with initial ''", () => {
    const schema = NpcData.defineSchema();
    expect(schema.summoning).toBeDefined();
    expect(schema.summoning.options.initial).toBe("");
  });

  it("summoning is independent of sanctum", () => {
    const schema = NpcData.defineSchema();
    expect(schema.summoning).not.toBe(schema.sanctum);
  });
});

describe("NpcData attacks schema", () => {
  it("has attacks ArrayField", () => {
    const schema = NpcData.defineSchema();
    expect(schema.attacks).toBeDefined();
  });
  it("attack element has name, pool, damage, speed, rate subfields", () => {
    const schema     = NpcData.defineSchema();
    const elemFields = schema.attacks.fields.fields;
    expect(elemFields.name).toBeDefined();
    expect(elemFields.pool).toBeDefined();
    expect(elemFields.damage).toBeDefined();
    expect(elemFields.speed).toBeDefined();
    expect(elemFields.rate).toBeDefined();
  });
  it("attack pool allows up to 50", () => {
    const schema     = NpcData.defineSchema();
    const elemFields = schema.attacks.fields.fields;
    expect(elemFields.pool.options.max).toBe(50);
  });
});
