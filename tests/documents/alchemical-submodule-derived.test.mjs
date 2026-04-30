import { describe, it, expect } from "vitest";
import { ExaltedActor } from "../../module/documents/actor.mjs";
import { makeCharacterSystem } from "../_helpers/make-actor.mjs";

/**
 * Build a minimal synthetic actor suitable for calling
 * `_prepareAlchemicalDerived` directly.
 *
 * `itemsList` is a plain array; the helper wraps it with the `filter`
 * and `get` methods that the method under test requires.
 */
function makeFakeAlchemicalActor(systemOverrides = {}, itemsList = []) {
  const itemMap = new Map(itemsList.map(i => [i.id, i]));
  const items = Object.assign([...itemsList], {
    filter: fn => itemsList.filter(fn),
    get:    id => itemMap.get(id)
  });
  return {
    type: "character",
    system: makeCharacterSystem({ exaltType: "alchemical", ...systemOverrides }),
    items,
    effects: []
  };
}

/** Minimal submodule charm item for tests. */
function makeSubmodule(overrides = {}) {
  return {
    id: "submod-1",
    type: "charm",
    system: {
      isSubmodule:       true,
      charmType:         "permanent",
      active:            false,
      parentCharmId:     "parent-1",
      // Submodule requirements use the existing charm fields:
      // `essence` (min essence), `ability` (attribute key), `minAbility` (min dots)
      essence:           1,
      ability:           "",
      minAbility:        0,
      requirementsMet:   undefined,
      parentInstalled:   undefined,
      effectivelyActive: undefined,
      ...overrides
    }
  };
}

/** Minimal parent charm item for tests. */
function makeParentCharm(overrides = {}) {
  return {
    id: "parent-1",
    type: "charm",
    system: {
      isSubmodule:      false,
      installed:        true,
      installedSlotType: "general",
      ...overrides
    }
  };
}

describe("ExaltedActor._prepareAlchemicalDerived — submodule state", () => {
  it("Test A: permanent submodule with parent installed and requirements met → effectivelyActive = true", () => {
    const parent  = makeParentCharm({ installed: true });
    const submod  = makeSubmodule({
      charmType:  "permanent",
      parentCharmId: "parent-1",
      essence:    1,
      minAbility: 0
    });
    const actor = makeFakeAlchemicalActor(
      { essence: { value: 3, max: 3 } },
      [parent, submod]
    );

    ExaltedActor.prototype._prepareAlchemicalDerived.call(actor, actor.system);

    expect(submod.system.requirementsMet).toBe(true);
    expect(submod.system.parentInstalled).toBe(true);
    expect(submod.system.effectivelyActive).toBe(true);
  });

  it("Test B: parent not installed → effectivelyActive = false", () => {
    const parent = makeParentCharm({ installed: false });
    const submod = makeSubmodule({
      charmType:  "permanent",
      parentCharmId: "parent-1",
      essence:    1,
      minAbility: 0
    });
    const actor = makeFakeAlchemicalActor(
      { essence: { value: 3, max: 3 } },
      [parent, submod]
    );

    ExaltedActor.prototype._prepareAlchemicalDerived.call(actor, actor.system);

    expect(submod.system.requirementsMet).toBe(true);
    expect(submod.system.parentInstalled).toBe(false);
    expect(submod.system.effectivelyActive).toBe(false);
  });

  it("Test C: essence requirement not met → requirementsMet = false, effectivelyActive = false", () => {
    const parent = makeParentCharm({ installed: true });
    const submod = makeSubmodule({
      charmType:  "permanent",
      parentCharmId: "parent-1",
      essence:    3,
      minAbility: 0
    });
    const actor = makeFakeAlchemicalActor(
      { essence: { value: 2, max: 2 } },
      [parent, submod]
    );

    ExaltedActor.prototype._prepareAlchemicalDerived.call(actor, actor.system);

    expect(submod.system.requirementsMet).toBe(false);
    expect(submod.system.effectivelyActive).toBe(false);
  });

  it("no attribute requirement (minAbility = 0) is always satisfied regardless of ability key", () => {
    const parent = makeParentCharm({ installed: true });
    const submod = makeSubmodule({
      charmType:  "permanent",
      parentCharmId: "parent-1",
      essence:    1,
      ability:    "strength",
      minAbility: 0
    });
    const actor = makeFakeAlchemicalActor(
      { essence: { value: 3, max: 3 } },
      [parent, submod]
    );

    ExaltedActor.prototype._prepareAlchemicalDerived.call(actor, actor.system);

    expect(submod.system.requirementsMet).toBe(true);
    expect(submod.system.effectivelyActive).toBe(true);
  });
});
