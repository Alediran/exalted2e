import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ACTORS_DIR = join(__dirname, "../../../../modules/exalted2e-compendium/src/packs/actors");

const EARTH_SPIRITS_FOLDER = "e1e3000000000001";

function loadJSON(basename) {
  return JSON.parse(readFileSync(join(ACTORS_DIR, `${basename}.json`), "utf-8"));
}

const ACTOR_EXPECTATIONS = {
  "quicksilver-queen": { itemCount: 22, essence: 7, willpowerMax: 11, motesMax: 145 },
  "the-kukla":         { itemCount:  3, essence: 10, willpowerMax: 10, motesMax: 2000 },
  "kuklas-guardian":   { itemCount: 26, essence:  8, willpowerMax:  9, motesMax:  160 },
};

const ACTOR_NAMES = Object.keys(ACTOR_EXPECTATIONS);
const actors = Object.fromEntries(ACTOR_NAMES.map(n => [n, loadJSON(n)]));

describe("Earth Spirits — actor JSON files", () => {
  for (const name of ACTOR_NAMES) {
    const actor    = actors[name];
    const expected = ACTOR_EXPECTATIONS[name];

    describe(name, () => {
      it("_key is consistent with _id", () => {
        expect(actor._key).toBe(`!actors!${actor._id}`);
      });

      it("belongs to the Earth Spirits folder", () => {
        expect(actor.folder).toBe(EARTH_SPIRITS_FOLDER);
      });

      it("is type npc / npcType elemental", () => {
        expect(actor.type).toBe("npc");
        expect(actor.system.npcType).toBe("elemental");
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
        for (const field of ["joinBattle", "dodgeDV", "parryDV"]) {
          expect(c[field], `combat.${field}`).toBeGreaterThanOrEqual(0);
        }
      });

      it("soak values are non-negative", () => {
        const { bashing, lethal, aggravated } = actor.system.combat.soak;
        expect(bashing).toBeGreaterThanOrEqual(0);
        expect(lethal).toBeGreaterThanOrEqual(0);
        expect(aggravated).toBeGreaterThanOrEqual(0);
        expect(bashing).toBeGreaterThanOrEqual(lethal);
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

      it("all embedded items are charms with a string charmUid", () => {
        for (const item of actor.items) {
          expect(item.type, `item ${item._id} type`).toBe("charm");
          expect(typeof item.system.charmUid, `item ${item._id} charmUid`).toBe("string");
        }
      });

      it("all embedded items have correct _key format", () => {
        for (const item of actor.items) {
          expect(item._key, `item ${item._id} _key`).toBe(`!actors.items!${actor._id}.${item._id}`);
        }
      });

      it("all embedded items have folder: null", () => {
        for (const item of actor.items) {
          expect(item.folder, `item ${item._id} folder`).toBeNull();
        }
      });

      it("biography and summoning are strings", () => {
        expect(typeof actor.system.biography).toBe("string");
        expect(typeof actor.system.summoning).toBe("string");
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

    it("no actor _id collides with any embedded item _id", () => {
      const actorIds = new Set(ACTOR_NAMES.map(n => actors[n]._id));
      for (const name of ACTOR_NAMES) {
        for (const item of actors[name].items) {
          expect(actorIds.has(item._id), `item ${item._id} collides with an actor _id`).toBe(false);
        }
      }
    });
  });

  describe("Quicksilver Queen", () => {
    it("has non-empty biography", () => {
      expect(actors["quicksilver-queen"].system.biography.length).toBeGreaterThan(0);
    });

    it("has non-empty notes", () => {
      expect(actors["quicksilver-queen"].system.notes.length).toBeGreaterThan(0);
    });
  });

  describe("The Kukla", () => {
    it("has Essence 10", () => {
      expect(actors["the-kukla"].system.essence.value).toBe(10);
    });

    it("has non-empty biography", () => {
      expect(actors["the-kukla"].system.biography.length).toBeGreaterThan(0);
    });

    it("has non-empty powers describing its kaiju-scale sample powers", () => {
      const powers = actors["the-kukla"].system.powers;
      expect(powers).toContain("Benthic Wave Strike");
      expect(powers).toContain("Great Justice Retribution");
    });

    it("summoning text warns against summoning", () => {
      expect(actors["the-kukla"].system.summoning.length).toBeGreaterThan(0);
    });
  });

  describe("Kukla's Guardian", () => {
    it("has Essence 8", () => {
      expect(actors["kuklas-guardian"].system.essence.value).toBe(8);
    });

    it("has Dexterity and Strength at 8", () => {
      const attrs = actors["kuklas-guardian"].system.attributes;
      expect(attrs.dexterity.value).toBe(8);
      expect(attrs.strength.value).toBe(8);
    });

    it("has non-empty summoning explaining guardian-replacement mechanic", () => {
      const summoning = actors["kuklas-guardian"].system.summoning;
      expect(summoning.length).toBeGreaterThan(0);
      expect(summoning).toContain("Guardian");
    });
  });
});
