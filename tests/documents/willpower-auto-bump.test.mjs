import { describe, it, expect } from "vitest";
import { ExaltedActor } from "../../module/documents/actor.mjs";

/**
 * Build a synthetic actor for direct `_preUpdate` invocation. Includes the
 * minimum surface the WP-auto-bump logic reads: virtues, willpower, type.
 */
function makeFakeActor({
  virtues = { compassion: 1, conviction: 1, temperance: 1, valor: 1 },
  willpowerMax = 10,
  willpowerValue = 5
} = {}) {
  return {
    type: "character",
    system: {
      exaltType: "solar",
      caste:     "",
      virtues: {
        compassion: { value: virtues.compassion, current: virtues.compassion },
        conviction: { value: virtues.conviction, current: virtues.conviction },
        temperance: { value: virtues.temperance, current: virtues.temperance },
        valor:      { value: virtues.valor,      current: virtues.valor }
      },
      willpower: { value: willpowerValue, max: willpowerMax },
      attributes: {},
      abilities:  {},
      purchaseLocked: false
    }
  };
}

describe("ExaltedActor._preUpdate willpower auto-bump", () => {
  it("bumps willpower.max when raising a virtue creates a higher floor", async () => {
    // Starting state: willpower.max = 2, virtues all 1 (floor = 2). User
    // raises Compassion 1 → 3. New floor = 3 + 1 = 4. WP must auto-bump.
    const actor = makeFakeActor({
      virtues: { compassion: 1, conviction: 1, temperance: 1, valor: 1 },
      willpowerMax: 2
    });
    const changed = { system: { virtues: { compassion: { value: 3 } } } };
    await ExaltedActor.prototype._preUpdate.call(actor, changed, {}, "user-id");
    expect(changed.system.willpower?.max).toBe(4);
  });

  it("does NOT bump willpower.max when stored max already exceeds new floor", async () => {
    // Stored WP = 7, virtues raise to floor 5 → no bump needed.
    const actor = makeFakeActor({
      virtues: { compassion: 1, conviction: 1, temperance: 1, valor: 1 },
      willpowerMax: 7
    });
    const changed = { system: { virtues: { compassion: { value: 3 }, conviction: { value: 2 } } } };
    await ExaltedActor.prototype._preUpdate.call(actor, changed, {}, "user-id");
    // newFloor = 3 + 2 = 5; 5 < 7, so willpower.max should NOT be added to changed
    expect(changed.system.willpower?.max).toBeUndefined();
  });

  it("uses the two highest virtues, not just the changed one", async () => {
    // Stored: compassion 4, conviction 3, others 1. Stored WP = 5.
    // User raises Valor to 4 → new sorted virtues = [4, 4, 3, 1]; floor = 8. Bump.
    const actor = makeFakeActor({
      virtues: { compassion: 4, conviction: 3, temperance: 1, valor: 1 },
      willpowerMax: 5
    });
    const changed = { system: { virtues: { valor: { value: 4 } } } };
    await ExaltedActor.prototype._preUpdate.call(actor, changed, {}, "user-id");
    expect(changed.system.willpower?.max).toBe(8);
  });

  it("does not change willpower.max on caste-only updates", async () => {
    const actor = makeFakeActor({
      virtues: { compassion: 1, conviction: 1, temperance: 1, valor: 1 },
      willpowerMax: 5
    });
    const changed = { system: { caste: "dawn" } };
    await ExaltedActor.prototype._preUpdate.call(actor, changed, {}, "user-id");
    // Floor = 2, current max = 5; no bump.
    expect(changed.system.willpower?.max).toBeUndefined();
  });
});
