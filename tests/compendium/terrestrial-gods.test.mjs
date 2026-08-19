import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ACTORS_DIR  = join(__dirname, "../../../../modules/exalted2e-compendium/src/packs/actors");
const CHARMS_DIR  = join(__dirname, "../../../../modules/exalted2e-compendium/src/packs/charms");

const TERRESTRIAL_GODS_FOLDER = "c1d2e3f400000001";
const EIDOLA_FOLDER           = "a1b2c3d4e5f60017";
const BLESSINGS_FOLDER        = "a1b2c3d4e5f60015";

const ACTOR_NAMES = [
  "city-god",
  "disease-god",
  "dream-fly",
  "dryad",
  "forest-walker",
  "least-god",
  "life-tree",
  "mask",
];

const NEW_CHARM_NAMES = [
  "spirit-camouflage",
  "spirit-benediction",
];

function loadJSON(dir, basename) {
  return JSON.parse(readFileSync(join(dir, `${basename}.json`), "utf-8"));
}

// Load synchronously at module level — no Foundry APIs used.
const actors = Object.fromEntries(ACTOR_NAMES.map(n => [n, loadJSON(ACTORS_DIR, n)]));
const charms = Object.fromEntries(NEW_CHARM_NAMES.map(n => [n, loadJSON(CHARMS_DIR, n)]));

// ---------------------------------------------------------------------------
// Per-actor expectations used in the parametric loop
// ---------------------------------------------------------------------------
const ACTOR_EXPECTATIONS = {
  "city-god":      { itemCount: 20, essence: 3, willpowerMax: 6, motesMax: 70 },
  "disease-god":   { itemCount: 13, essence: 2, willpowerMax: 5, motesMax: 35 },
  "dream-fly":     { itemCount: 17, essence: 2, willpowerMax: 6, motesMax: 50 },
  "dryad":         { itemCount:  9, essence: 2, willpowerMax: 6, motesMax: 50 },
  "forest-walker": { itemCount: 25, essence: 4, willpowerMax: 6, motesMax: 80 },
  "least-god":     { itemCount:  1, essence: 1, willpowerMax: 3, motesMax: 25 },
  "life-tree":     { itemCount: 14, essence: 3, willpowerMax: 7, motesMax: 65 },
  "mask":          { itemCount: 13, essence: 2, willpowerMax: 6, motesMax: 60 },
};

// ---------------------------------------------------------------------------
// Actor tests
// ---------------------------------------------------------------------------
describe("Terrestrial Gods — actor JSON files", () => {
  for (const name of ACTOR_NAMES) {
    const actor = actors[name];
    const expected = ACTOR_EXPECTATIONS[name];

    describe(name, () => {
      it("_key is consistent with _id", () => {
        expect(actor._key).toBe(`!actors!${actor._id}`);
      });

      it("belongs to the Terrestrial Gods folder", () => {
        expect(actor.folder).toBe(TERRESTRIAL_GODS_FOLDER);
      });

      it("is type npc / npcType god", () => {
        expect(actor.type).toBe("npc");
        expect(actor.system.npcType).toBe("god");
      });

      it(`has Essence ${expected.essence}`, () => {
        expect(actor.system.essence.value).toBe(expected.essence);
      });

      it(`has Willpower max ${expected.willpowerMax}`, () => {
        expect(actor.system.willpower.max).toBe(expected.willpowerMax);
      });

      it(`has mote pool max ${expected.motesMax}`, () => {
        expect(actor.system.motes.max).toBe(expected.motesMax);
      });

      it("has all required combat fields as non-negative numbers", () => {
        const c = actor.system.combat;
        for (const field of ["joinBattle", "dodgeDV", "parryDV", "dodgeMDV", "parryMDV"]) {
          expect(c[field], `combat.${field}`).toBeGreaterThanOrEqual(0);
        }
      });

      it("soak values are non-negative", () => {
        const { bashing, lethal, aggravated } = actor.system.combat.soak;
        expect(bashing).toBeGreaterThanOrEqual(0);
        expect(lethal).toBeGreaterThanOrEqual(0);
        expect(aggravated).toBeGreaterThanOrEqual(0);
      });

      it("health levels are all non-negative", () => {
        const { zero, one, two, four } = actor.system.health.levels;
        expect(zero).toBeGreaterThanOrEqual(0);
        expect(one).toBeGreaterThanOrEqual(0);
        expect(two).toBeGreaterThanOrEqual(0);
        expect(four).toBeGreaterThanOrEqual(0);
      });

      it(`has exactly ${expected.itemCount} embedded items`, () => {
        expect(actor.items).toHaveLength(expected.itemCount);
      });

      it("embedded item _ids are unique within the actor", () => {
        const ids = actor.items.map(i => i._id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it("all embedded items are charms with a non-empty charmUid", () => {
        for (const item of actor.items) {
          expect(item.type, `item ${item._id} type`).toBe("charm");
          expect(typeof item.system.charmUid, `item ${item._id} charmUid type`).toBe("string");
          expect(item.system.charmUid.length, `item ${item._id} charmUid length`).toBeGreaterThan(0);
        }
      });

      it("all embedded items have folder: null", () => {
        for (const item of actor.items) {
          expect(item.folder, `item ${item._id} folder`).toBeNull();
        }
      });

      it("embedded item _ids do not collide with actor _id", () => {
        for (const item of actor.items) {
          expect(item._id).not.toBe(actor._id);
        }
      });
    });
  }

  describe("cross-actor uniqueness", () => {
    it("all actor _ids are unique", () => {
      const ids = ACTOR_NAMES.map(n => actors[n]._id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("all embedded item _ids are unique across all actors", () => {
      const all = ACTOR_NAMES.flatMap(n => actors[n].items.map(i => i._id));
      expect(new Set(all).size).toBe(all.length);
    });
  });
});

// ---------------------------------------------------------------------------
// New spirit charm files
// ---------------------------------------------------------------------------
describe("New spirit charm files", () => {
  for (const name of NEW_CHARM_NAMES) {
    const charm = charms[name];

    describe(name, () => {
      it("_key is consistent with _id", () => {
        expect(charm._key).toBe(`!items!${charm._id}`);
      });

      it("is a spirit charm", () => {
        expect(charm.type).toBe("charm");
        expect(charm.system.exaltType).toBe("spirit");
      });

      it("charmUid matches _id", () => {
        expect(charm.system.charmUid).toBe(charm._id);
      });

      it("has non-empty cost formula and description", () => {
        expect(charm.system.cost.formula.length).toBeGreaterThan(0);
        expect(charm.system.description.length).toBeGreaterThan(0);
      });

      it("has essence >= 1 and a string ability", () => {
        expect(charm.system.essence).toBeGreaterThanOrEqual(1);
        expect(typeof charm.system.ability).toBe("string");
      });

      it("keywords is an array", () => {
        expect(Array.isArray(charm.system.keywords)).toBe(true);
      });
    });
  }

  it("camouflage is in the Eidola folder", () => {
    expect(charms["spirit-camouflage"].folder).toBe(EIDOLA_FOLDER);
  });

  it("benediction is in the Blessings/Sendings folder", () => {
    expect(charms["spirit-benediction"].folder).toBe(BLESSINGS_FOLDER);
  });

  it("camouflage and benediction have distinct _ids", () => {
    expect(charms["spirit-camouflage"]._id).not.toBe(charms["spirit-benediction"]._id);
  });

  // Verify the specific IDs assigned this session
  it("camouflage has the expected ID c500000000000056", () => {
    expect(charms["spirit-camouflage"]._id).toBe("c500000000000056");
  });

  it("benediction has the expected ID c500000000000057", () => {
    expect(charms["spirit-benediction"]._id).toBe("c500000000000057");
  });
});
