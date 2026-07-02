import { vi, describe, it, expect, beforeEach } from "vitest";
import { registerDocuments } from "../../module/setup/register-documents.mjs";
import { ExaltedActor }     from "../../module/documents/actor.mjs";
import { ExaltedItem }      from "../../module/documents/item.mjs";
import { ExaltedCombat }    from "../../module/documents/combat.mjs";
import { CharacterData }    from "../../module/data/actor/character-data.mjs";
import { NpcData }          from "../../module/data/actor/npc-data.mjs";
import { CharmData }        from "../../module/data/item/charm-data.mjs";
import { WeaponData }       from "../../module/data/item/weapon-data.mjs";
import { HazardDamageBehaviorType }    from "../../module/data/region-behaviors/hazard-damage.mjs";
import { TerrainModifierBehaviorType } from "../../module/data/region-behaviors/terrain-modifier.mjs";
import { EX2E }             from "../../module/config.mjs";

// IDs that registerDocuments() deletes from CONFIG.statusEffects
const STRIPPED_IDS = [
  "invisible", "frozen", "burning",
  "silence", "marked", "targeted", "target",
  "holyShield", "magicShield", "coldShield", "fireShield",
  "bless", "eye", "downgrade", "upgrade",
  "degen", "regen", "curse", "shock",
];

// IDs that should be enriched with exalted2e flags
const ENRICHED_IDS = ["prone", "stun", "blind", "deaf", "restrain", "fly", "poison", "disease"];

function makeStatusEffects() {
  const effects = Object.assign([], {
    prone:    { id: "prone",    name: "Prone",     flags: {} },
    stun:     { id: "stun",    name: "Stun",      flags: {} },
    blind:    { id: "blind",   name: "Blind",     flags: {} },
    deaf:     { id: "deaf",    name: "Deaf",      flags: {} },
    restrain: { id: "restrain",name: "Restrain",  flags: {} },
    fly:      { id: "fly",     name: "Fly",       flags: {} },
    poison:   { id: "poison",  name: "Poison",    flags: {} },
    disease:  { id: "disease", name: "Disease",   flags: {} },
  });
  for (const id of STRIPPED_IDS) effects[id] = { id };
  return effects;
}

describe("registerDocuments", () => {
  beforeEach(() => {
    globalThis.CONFIG = {
      Actor:          { documentClass: null, dataModels: {} },
      Item:           { documentClass: null, dataModels: {} },
      Combat:         { documentClass: null, initiative: {}, initiativeIcon: {} },
      RegionBehavior: { dataModels: {} },
      statusEffects:  makeStatusEffects(),
    };
    game.exalted2e = undefined;
  });

  // ── Document classes ──────────────────────────────────────────────────────

  it("assigns ExaltedActor as Actor documentClass", () => {
    registerDocuments();
    expect(CONFIG.Actor.documentClass).toBe(ExaltedActor);
  });

  it("assigns ExaltedItem as Item documentClass", () => {
    registerDocuments();
    expect(CONFIG.Item.documentClass).toBe(ExaltedItem);
  });

  it("assigns ExaltedCombat as Combat documentClass", () => {
    registerDocuments();
    expect(CONFIG.Combat.documentClass).toBe(ExaltedCombat);
  });

  // ── Initiative ────────────────────────────────────────────────────────────

  it("sets initiative formula to '0' with 0 decimals", () => {
    registerDocuments();
    expect(CONFIG.Combat.initiative).toEqual({ formula: "0", decimals: 0 });
  });

  it("sets d10 initiative icon paths", () => {
    registerDocuments();
    expect(CONFIG.Combat.initiativeIcon.icon).toContain("d10.svg");
    expect(CONFIG.Combat.initiativeIcon.hover).toContain("d10");
  });

  // ── Actor data models ─────────────────────────────────────────────────────

  it("registers character, npc, unit, vehicle actor data models", () => {
    registerDocuments();
    expect(CONFIG.Actor.dataModels.character).toBe(CharacterData);
    expect(CONFIG.Actor.dataModels.npc).toBe(NpcData);
    expect(CONFIG.Actor.dataModels.unit).toBeDefined();
    expect(CONFIG.Actor.dataModels.vehicle).toBeDefined();
  });

  // ── Item data models ──────────────────────────────────────────────────────

  it("registers charm and weapon item data models", () => {
    registerDocuments();
    expect(CONFIG.Item.dataModels.charm).toBe(CharmData);
    expect(CONFIG.Item.dataModels.weapon).toBe(WeaponData);
  });

  it("registers all 32 item data model types", () => {
    registerDocuments();
    const expectedTypes = [
      "charm", "spell", "weapon", "armor", "background", "intimacy",
      "meritflaw", "knack", "virtueflaw", "combo", "form", "animapower",
      "urge", "destiny", "resplendency", "equipment", "hearthstone",
      "martialartsstyle", "poison", "disease", "drug", "mutation",
      "manse", "manse-power", "familiar", "cult", "command", "followers",
      "thaum-art", "procedure", "ammo", "malados",
    ];
    for (const type of expectedTypes) {
      expect(CONFIG.Item.dataModels[type], `missing item type: ${type}`).toBeDefined();
    }
  });

  // ── Region behavior models ────────────────────────────────────────────────

  it("registers hazardDamage region behavior", () => {
    registerDocuments();
    expect(CONFIG.RegionBehavior.dataModels.hazardDamage).toBe(HazardDamageBehaviorType);
  });

  it("registers terrainModifier region behavior", () => {
    registerDocuments();
    expect(CONFIG.RegionBehavior.dataModels.terrainModifier).toBe(TerrainModifierBehaviorType);
  });

  // ── EX2E config ───────────────────────────────────────────────────────────

  it("exposes EX2E on CONFIG.EX2E", () => {
    registerDocuments();
    expect(CONFIG.EX2E).toBe(EX2E);
  });

  it("exposes EX2E on game.exalted2e", () => {
    registerDocuments();
    expect(game.exalted2e.EX2E).toBe(EX2E);
  });

  it("exposes gmRollPool function on game.exalted2e", () => {
    registerDocuments();
    expect(typeof game.exalted2e.gmRollPool).toBe("function");
  });

  // ── Status effects — stripped ─────────────────────────────────────────────

  it("removes Foundry built-in status effects that have no 2e meaning", () => {
    registerDocuments();
    for (const id of STRIPPED_IDS) {
      expect(CONFIG.statusEffects[id], `expected ${id} to be removed`).toBeUndefined();
    }
  });

  // ── Status effects — enriched ─────────────────────────────────────────────

  it("enriches prone with externalPenalty flag", () => {
    registerDocuments();
    expect(CONFIG.statusEffects.prone.flags.exalted2e.externalPenalty.value).toBe(1);
    expect(CONFIG.statusEffects.prone.flags.exalted2e.externalPenalty.type).toBe("physical");
  });

  it("enriches stun with externalPenalty of 4", () => {
    registerDocuments();
    expect(CONFIG.statusEffects.stun.flags.exalted2e.externalPenalty.value).toBe(4);
    expect(CONFIG.statusEffects.stun.flags.exalted2e.externalPenalty.type).toBe("all");
  });

  it("enriches blind with blind flag and penalty", () => {
    registerDocuments();
    const f = CONFIG.statusEffects.blind.flags.exalted2e;
    expect(f.blind).toBe(true);
    expect(f.externalPenalty.value).toBe(2);
  });

  it("enriches restrain with grappled flag", () => {
    registerDocuments();
    expect(CONFIG.statusEffects.restrain.flags.exalted2e.grappled).toBe(true);
  });

  it("enriches fly with flying flag", () => {
    registerDocuments();
    expect(CONFIG.statusEffects.fly.flags.exalted2e.flying).toBe(true);
  });

  // ── Status effects — custom additions ─────────────────────────────────────

  it("adds lightCover and heavyCover custom statuses", () => {
    registerDocuments();
    expect(CONFIG.statusEffects.lightCover).toBeDefined();
    expect(CONFIG.statusEffects.heavyCover).toBeDefined();
  });

  it("lightCover dvBonus grants +1 dodge", () => {
    registerDocuments();
    expect(CONFIG.statusEffects.lightCover.flags.exalted2e.dvBonus.dodge).toBe(1);
  });

  it("adds heightAdvantage and crippled custom statuses", () => {
    registerDocuments();
    expect(CONFIG.statusEffects.heightAdvantage).toBeDefined();
    expect(CONFIG.statusEffects.crippled).toBeDefined();
  });

  it("pushes unit mass-combat statuses onto the array", () => {
    registerDocuments();
    const ids = CONFIG.statusEffects.map(e => e.id);
    expect(ids).toContain("unit-hesitating");
    expect(ids).toContain("unit-engaged");
    expect(ids).toContain("unit-disbanded");
  });
});
