import { describe, it, expect } from "vitest";
import {
  validateCanCast,
  planSorceryCommit,
  buildShapeDeclaration,
  buildContinueShapeDeclaration,
  buildCastDeclaration
} from "../../module/combat/sorcery-math.mjs";

// ── validateCanCast ──────────────────────────────────────────────────
describe("validateCanCast", () => {
  function actor({ sorceryInit = 0, necromancyInit = 0, peripheral = 0, personal = 0, willpower = 0 } = {}) {
    return {
      system: {
        sorcery:    { initiation: sorceryInit },
        necromancy: { initiation: necromancyInit },
        motes:      { peripheral: { value: peripheral }, personal: { value: personal } },
        willpower:  { value: willpower }
      }
    };
  }
  function spell({ tradition = "sorcery", circle = 1, motes = 15, wp = 1 } = {}) {
    return { system: { tradition, circle, cost: { motes, willpower: wp } } };
  }

  it("ok when all conditions are met (sorcery)", () => {
    expect(validateCanCast({
      actor: actor({ sorceryInit: 1, peripheral: 20, willpower: 5 }),
      spell: spell({ tradition: "sorcery", circle: 1, motes: 15, wp: 1 })
    })).toEqual({ ok: true });
  });

  it("ok when all conditions are met (necromancy)", () => {
    expect(validateCanCast({
      actor: actor({ necromancyInit: 2, peripheral: 25, willpower: 3 }),
      spell: spell({ tradition: "necromancy", circle: 2, motes: 20, wp: 2 })
    })).toEqual({ ok: true });
  });

  it("rejects insufficient sorcery initiation", () => {
    expect(validateCanCast({
      actor: actor({ sorceryInit: 1, peripheral: 50, willpower: 10 }),
      spell: spell({ tradition: "sorcery", circle: 3 })
    })).toEqual({ ok: false, reason: "insufficient-initiation" });
  });

  it("rejects insufficient necromancy initiation", () => {
    expect(validateCanCast({
      actor: actor({ necromancyInit: 0, peripheral: 50, willpower: 10 }),
      spell: spell({ tradition: "necromancy", circle: 1 })
    })).toEqual({ ok: false, reason: "insufficient-initiation" });
  });

  it("cross-tradition: necromancer-only actor, sorcery spell → insufficient-initiation", () => {
    expect(validateCanCast({
      actor: actor({ sorceryInit: 0, necromancyInit: 3, peripheral: 50, willpower: 10 }),
      spell: spell({ tradition: "sorcery", circle: 1 })
    })).toEqual({ ok: false, reason: "insufficient-initiation" });
  });

  it("rejects insufficient motes (peripheral + personal both too low)", () => {
    expect(validateCanCast({
      actor: actor({ sorceryInit: 1, peripheral: 5, personal: 5, willpower: 10 }),
      spell: spell({ motes: 15 })
    })).toEqual({ ok: false, reason: "insufficient-motes" });
  });

  it("ok when peripheral alone is short but personal covers the gap", () => {
    expect(validateCanCast({
      actor: actor({ sorceryInit: 1, peripheral: 10, personal: 8, willpower: 5 }),
      spell: spell({ motes: 15 })
    })).toEqual({ ok: true });
  });

  it("rejects insufficient willpower", () => {
    expect(validateCanCast({
      actor: actor({ sorceryInit: 1, peripheral: 20, willpower: 0 }),
      spell: spell({ wp: 1 })
    })).toEqual({ ok: false, reason: "insufficient-willpower" });
  });
});

// ── planSorceryCommit ────────────────────────────────────────────────
describe("planSorceryCommit", () => {
  function action({ spellId = "S", completed = 0, total = 1 } = {}) {
    return {
      actionKey: "sorcery",
      state: {
        spellId,
        completedShapeActions: completed,
        totalShapeActions: total
      }
    };
  }

  it("pending = sorceryShape, sameSpell, completed < total → continue", () => {
    expect(planSorceryCommit({
      action: action({ completed: 0, total: 2 }),
      pending: { actionKey: "sorceryShape", spellId: "S" },
      flurry: null
    })).toEqual({ kind: "continue" });
  });

  it("pending = sorceryShape, different spellId → interrupt", () => {
    expect(planSorceryCommit({
      action: action({ spellId: "S" }),
      pending: { actionKey: "sorceryShape", spellId: "OTHER" },
      flurry: null
    })).toEqual({ kind: "interrupt" });
  });

  it("pending = sorceryShape, sameSpell, completed === total → interrupt (invalid: should cast)", () => {
    expect(planSorceryCommit({
      action: action({ completed: 2, total: 2 }),
      pending: { actionKey: "sorceryShape", spellId: "S" },
      flurry: null
    })).toEqual({ kind: "interrupt" });
  });

  it("pending = sorceryCast, sameSpell, completed === total → cast", () => {
    expect(planSorceryCommit({
      action: action({ completed: 2, total: 2 }),
      pending: { actionKey: "sorceryCast", spellId: "S" },
      flurry: null
    })).toEqual({ kind: "cast" });
  });

  it("pending = sorceryCast, sameSpell, completed < total → interrupt (invalid: shaping incomplete)", () => {
    expect(planSorceryCommit({
      action: action({ completed: 1, total: 2 }),
      pending: { actionKey: "sorceryCast", spellId: "S" },
      flurry: null
    })).toEqual({ kind: "interrupt" });
  });

  it("pending = attack → interrupt", () => {
    expect(planSorceryCommit({
      action: action(),
      pending: { actionKey: "attack" },
      flurry: null
    })).toEqual({ kind: "interrupt" });
  });

  it("flurry truthy → interrupt", () => {
    expect(planSorceryCommit({
      action: action(),
      pending: null,
      flurry: { actions: [] }
    })).toEqual({ kind: "interrupt" });
  });

  it("nothing pending and no flurry → noop", () => {
    expect(planSorceryCommit({ action: action(), pending: null, flurry: null }))
      .toEqual({ kind: "noop" });
  });
});

// ── buildShapeDeclaration ────────────────────────────────────────────
describe("buildShapeDeclaration", () => {
  it("Terrestrial: speed 5, dvMod 2, abortable, includes spellId", () => {
    const decl = buildShapeDeclaration({
      spell: { id: "S1", name: "Test Spell", system: { circle: 1 } }
    });
    expect(decl).toEqual({
      actionKey: "sorceryShape",
      spellId:   "S1",
      labelKey:  "EX2E.SpellCastShapingLabel",
      labelArgs: { spell: "Test Spell" },
      speed:     5,
      dvPenalty: 2,
      abortable: true
    });
  });

  it("Celestial: dvMod 3", () => {
    const decl = buildShapeDeclaration({
      spell: { id: "S2", name: "X", system: { circle: 2 } }
    });
    expect(decl.dvPenalty).toBe(3);
  });

  it("Solar: dvMod 4", () => {
    const decl = buildShapeDeclaration({
      spell: { id: "S3", name: "X", system: { circle: 3 } }
    });
    expect(decl.dvPenalty).toBe(4);
  });
});

// ── buildContinueShapeDeclaration ────────────────────────────────────
describe("buildContinueShapeDeclaration", () => {
  it("reads spellId/circle from action.state; abortable", () => {
    const decl = buildContinueShapeDeclaration({
      action: {
        state: {
          spellId: "S1",
          spellName: "Test Spell",
          circle: 2,
          totalShapeActions: 2,
          completedShapeActions: 1
        }
      }
    });
    expect(decl).toEqual({
      actionKey: "sorceryShape",
      spellId:   "S1",
      labelKey:  "EX2E.SpellCastShapingLabel",
      labelArgs: { spell: "Test Spell" },
      speed:     5,
      dvPenalty: 3,
      abortable: true
    });
  });
});

// ── buildCastDeclaration ─────────────────────────────────────────────
describe("buildCastDeclaration", () => {
  it("Cast: speed 5, dvMod 0, NOT abortable, includes spellId", () => {
    const decl = buildCastDeclaration({
      action: {
        state: { spellId: "S1", spellName: "Test Spell" }
      }
    });
    expect(decl).toEqual({
      actionKey: "sorceryCast",
      spellId:   "S1",
      labelKey:  "EX2E.SpellCastReleaseLabel",
      labelArgs: { spell: "Test Spell" },
      speed:     5,
      dvPenalty: 0,
      abortable: false
    });
  });
});

// ── validateCanCast — weaving ────────────────────────────────────────
describe("validateCanCast — weaving", () => {
  function alchActor({ weavingInit = 0, clarity = 0, peripheral = 0, personal = 0, willpower = 0 } = {}) {
    return {
      system: {
        exaltType: "alchemical",
        weaving:   { initiation: weavingInit },
        sorcery:   { initiation: 0 },
        necromancy:{ initiation: 0 },
        splat:     { alchemical: { clarity: { total: clarity } } },
        motes:     { peripheral: { value: peripheral }, personal: { value: personal } },
        willpower: { value: willpower }
      }
    };
  }
  function weavingSpell({ circle = 1, minimumClarity = 0, motes = 10, wp = 1 } = {}) {
    return { system: { tradition: "weaving", circle, minimumClarity, cost: { motes, willpower: wp } } };
  }

  it("ok when Alchemical + initiation >= circle + clarity >= minimumClarity", () => {
    expect(validateCanCast({
      actor: alchActor({ weavingInit: 2, clarity: 3, peripheral: 15, willpower: 2 }),
      spell: weavingSpell({ circle: 2, minimumClarity: 2, motes: 10, wp: 1 })
    })).toEqual({ ok: true });
  });

  it("blocks Alchemical with weaving.initiation < circle", () => {
    expect(validateCanCast({
      actor: alchActor({ weavingInit: 1, clarity: 5, peripheral: 15, willpower: 2 }),
      spell: weavingSpell({ circle: 2 })
    })).toEqual({ ok: false, reason: "insufficient-initiation" });
  });

  it("blocks Alchemical with clarity < minimumClarity", () => {
    expect(validateCanCast({
      actor: alchActor({ weavingInit: 2, clarity: 1, peripheral: 15, willpower: 2 }),
      spell: weavingSpell({ circle: 1, minimumClarity: 3 })
    })).toEqual({ ok: false, reason: "insufficient-clarity" });
  });

  it("blocks non-Alchemical from weaving spell", () => {
    const solar = {
      system: {
        exaltType: "solar",
        sorcery:   { initiation: 3 },
        motes:     { peripheral: { value: 30 }, personal: { value: 10 } },
        willpower: { value: 5 }
      }
    };
    expect(validateCanCast({
      actor: solar,
      spell: weavingSpell({ circle: 1 })
    })).toMatchObject({ ok: false });
  });

  it("Alchemical with sorcery.initiation=0 cannot cast sorcery", () => {
    const alch = {
      system: {
        exaltType: "alchemical",
        sorcery:   { initiation: 0 },
        necromancy:{ initiation: 0 },
        weaving:   { initiation: 0 },
        motes:     { peripheral: { value: 30 }, personal: { value: 10 } },
        willpower: { value: 5 }
      }
    };
    expect(validateCanCast({
      actor: alch,
      spell: { system: { tradition: "sorcery", circle: 1, cost: { motes: 10, willpower: 1 } } }
    })).toEqual({ ok: false, reason: "insufficient-initiation" });
  });

  it("Alchemical with sorcery.initiation=1 (Eclipse-granted) can cast sorcery", () => {
    const alch = {
      system: {
        exaltType: "alchemical",
        sorcery:   { initiation: 1 },
        necromancy:{ initiation: 0 },
        weaving:   { initiation: 0 },
        motes:     { peripheral: { value: 30 }, personal: { value: 10 } },
        willpower: { value: 5 }
      }
    };
    expect(validateCanCast({
      actor: alch,
      spell: { system: { tradition: "sorcery", circle: 1, cost: { motes: 10, willpower: 1 } } }
    })).toEqual({ ok: true });
  });
});
