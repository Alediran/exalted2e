import { sweep }           from "../_helpers/cleanup.mjs";
import { assertTestWorld } from "../_helpers/world.mjs";
import { validateCanCast } from "../../../module/combat/sorcery-math.mjs";

/**
 * Construct a minimal Alchemical actor stub for validateCanCast.
 *
 * @param {object} [opts]
 * @param {number} [opts.weavingInit=0]
 * @param {number} [opts.sorceryInit=0]
 * @param {number} [opts.clarity=0]
 * @param {number} [opts.peripheral=30]
 * @param {number} [opts.personal=10]
 * @param {number} [opts.willpower=5]
 */
function alchActor({
  weavingInit = 0,
  sorceryInit = 0,
  clarity     = 0,
  peripheral  = 30,
  personal    = 10,
  willpower   = 5
} = {}) {
  return {
    system: {
      exaltType:  "alchemical",
      weaving:    { initiation: weavingInit },
      sorcery:    { initiation: sorceryInit },
      necromancy: { initiation: 0 },
      splat:      { alchemical: { clarity: { total: clarity } } },
      motes:      { peripheral: { value: peripheral }, personal: { value: personal } },
      willpower:  { value: willpower }
    }
  };
}

/**
 * Construct a minimal weaving spell stub.
 *
 * @param {object} [opts]
 * @param {number} [opts.circle=1]
 * @param {number} [opts.minimumClarity=0]
 * @param {number} [opts.motes=5]
 * @param {number} [opts.wp=1]
 */
function weavingSpell({
  circle         = 1,
  minimumClarity = 0,
  motes          = 5,
  wp             = 1
} = {}) {
  return {
    system: {
      tradition:      "weaving",
      circle,
      minimumClarity,
      cost: { motes, willpower: wp }
    }
  };
}

export function registerWeavingTests(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("Weaving protocols", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    // [236] Alchemical with weaving.initiation >= circle can cast
    it("[236] Alchemical with weaving.initiation >= circle can cast", () => {
      const result = validateCanCast({
        actor: alchActor({ weavingInit: 2, clarity: 3, peripheral: 15, willpower: 2 }),
        spell: weavingSpell({ circle: 2, minimumClarity: 2, motes: 10, wp: 1 })
      });
      assert.ok(result.ok, "expected ok: true");
    });

    // [237] Alchemical with weaving.initiation < circle is blocked (insufficient-initiation)
    it("[237] Alchemical with weaving.initiation < circle is blocked (insufficient-initiation)", () => {
      const result = validateCanCast({
        actor: alchActor({ weavingInit: 1, clarity: 5, peripheral: 15, willpower: 2 }),
        spell: weavingSpell({ circle: 2 })
      });
      assert.equal(result.ok, false, "expected ok: false");
      assert.equal(result.reason, "insufficient-initiation");
    });

    // [238] Alchemical with clarity < minimumClarity is blocked (insufficient-clarity)
    it("[238] Alchemical with clarity < minimumClarity is blocked (insufficient-clarity)", () => {
      const result = validateCanCast({
        actor: alchActor({ weavingInit: 2, clarity: 1, peripheral: 15, willpower: 2 }),
        spell: weavingSpell({ circle: 1, minimumClarity: 3 })
      });
      assert.equal(result.ok, false, "expected ok: false");
      assert.equal(result.reason, "insufficient-clarity");
    });

    // [239] Alchemical with clarity >= minimumClarity passes clarity check (ok: true)
    it("[239] Alchemical with clarity >= minimumClarity passes clarity check (ok: true)", () => {
      const result = validateCanCast({
        actor: alchActor({ weavingInit: 1, clarity: 3, peripheral: 15, willpower: 2 }),
        spell: weavingSpell({ circle: 1, minimumClarity: 3 })
      });
      assert.ok(result.ok, "expected ok: true when clarity exactly equals minimumClarity");
    });

    // [240] Non-Alchemical cannot cast a weaving spell (ok: false)
    it("[240] Non-Alchemical cannot cast a weaving spell (ok: false)", () => {
      const solar = {
        system: {
          exaltType:  "solar",
          sorcery:    { initiation: 3 },
          necromancy: { initiation: 0 },
          motes:      { peripheral: { value: 30 }, personal: { value: 10 } },
          willpower:  { value: 5 }
        }
      };
      const result = validateCanCast({
        actor: solar,
        spell: weavingSpell({ circle: 1 })
      });
      assert.equal(result.ok, false, "expected ok: false for non-Alchemical");
    });

    // [241] Alchemical with sorcery.initiation === 0 cannot cast sorcery (insufficient-initiation)
    it("[241] Alchemical with sorcery.initiation === 0 cannot cast sorcery (insufficient-initiation)", () => {
      const result = validateCanCast({
        actor: alchActor({ weavingInit: 2, sorceryInit: 0, clarity: 5, peripheral: 30, willpower: 5 }),
        spell: { system: { tradition: "sorcery", circle: 1, cost: { motes: 10, willpower: 1 } } }
      });
      assert.equal(result.ok, false, "expected ok: false");
      assert.equal(result.reason, "insufficient-initiation");
    });

    // [242] Alchemical with sorcery.initiation > 0 (Eclipse-granted) can cast sorcery (ok: true)
    it("[242] Alchemical with sorcery.initiation > 0 (Eclipse-granted) can cast sorcery (ok: true)", () => {
      const result = validateCanCast({
        actor: alchActor({ weavingInit: 0, sorceryInit: 1, clarity: 0, peripheral: 30, willpower: 5 }),
        spell: { system: { tradition: "sorcery", circle: 1, cost: { motes: 10, willpower: 1 } } }
      });
      assert.ok(result.ok, "expected ok: true for Eclipse-granted sorcery");
    });
  });
}
