import { beforeEach, describe, it, expect, vi } from "vitest";
import { ExaltedActor } from "../../module/documents/actor.mjs";

/**
 * Build a synthetic actor with the read-side surface ExaltedActor's
 * pool-helper methods consume. `update`, `applyDVPenalty`, and effect
 * `update` are vi.fn() recorders so tests can inspect calls.
 */
function makeFakeActor({
  type = "character",
  personal  = { value: 5, max: 10 },
  peripheral = { value: 8, max: 20 },
  effects = []
} = {}) {
  return {
    type,
    system: { motes: { personal, peripheral } },
    effects,
    update:          vi.fn().mockResolvedValue(true),
    applyDVPenalty:  vi.fn().mockResolvedValue({ id: "ae-onslaught-new" })
  };
}

beforeEach(() => {
  ui.notifications.warn.mockClear();
});

describe("ExaltedActor.spendMotes", () => {
  it("debits the primary pool when it has enough motes", async () => {
    const actor = makeFakeActor({
      personal:   { value: 5, max: 10 },
      peripheral: { value: 8, max: 20 }
    });
    const result = await ExaltedActor.prototype.spendMotes.call(actor, 3, "peripheral");
    expect(actor.update).toHaveBeenCalledWith({
      "system.motes.peripheral.value": 5,
      "system.motes.personal.value":   5
    });
    expect(result).toEqual({
      fromPrimary:   3,
      fromSecondary: 0,
      primaryPool:   "peripheral",
      secondaryPool: "personal"
    });
  });

  it("overflows into the secondary pool when primary is short", async () => {
    const actor = makeFakeActor({
      personal:   { value: 5, max: 10 },
      peripheral: { value: 4, max: 20 }
    });
    const result = await ExaltedActor.prototype.spendMotes.call(actor, 7, "peripheral");
    expect(actor.update).toHaveBeenCalledWith({
      "system.motes.peripheral.value": 0,
      "system.motes.personal.value":   2
    });
    expect(result).toEqual({
      fromPrimary:   4,
      fromSecondary: 3,
      primaryPool:   "peripheral",
      secondaryPool: "personal"
    });
  });

  it("returns null and warns when combined funds are insufficient", async () => {
    const actor = makeFakeActor({
      personal:   { value: 1, max: 10 },
      peripheral: { value: 2, max: 20 }
    });
    const result = await ExaltedActor.prototype.spendMotes.call(actor, 10, "peripheral");
    expect(result).toBeNull();
    expect(actor.update).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalledTimes(1);
  });

  it("overflows from personal into peripheral when pool='personal'", async () => {
    const actor = makeFakeActor({
      personal:   { value: 4, max: 10 },
      peripheral: { value: 0, max: 20 }
    });
    const result = await ExaltedActor.prototype.spendMotes.call(actor, 3, "personal");
    expect(actor.update).toHaveBeenCalledWith({
      "system.motes.personal.value":   1,
      "system.motes.peripheral.value": 0
    });
    expect(result).toEqual({
      fromPrimary:   3,
      fromSecondary: 0,
      primaryPool:   "personal",
      secondaryPool: "peripheral"
    });
  });

  it("returns null without updating for non-character actors", async () => {
    const actor = makeFakeActor({ type: "npc" });
    const result = await ExaltedActor.prototype.spendMotes.call(actor, 5, "peripheral");
    expect(result).toBeNull();
    expect(actor.update).not.toHaveBeenCalled();
    expect(ui.notifications.warn).not.toHaveBeenCalled();
  });
});

describe("ExaltedActor.recoverMotes", () => {
  it("adds motes up to the pool max", async () => {
    const actor = makeFakeActor({
      peripheral: { value: 5, max: 20 }
    });
    await ExaltedActor.prototype.recoverMotes.call(actor, 3, "peripheral");
    expect(actor.update).toHaveBeenCalledWith({
      "system.motes.peripheral.value": 8
    });
  });

  it("clamps recovery at the pool max", async () => {
    const actor = makeFakeActor({
      peripheral: { value: 18, max: 20 }
    });
    await ExaltedActor.prototype.recoverMotes.call(actor, 10, "peripheral");
    expect(actor.update).toHaveBeenCalledWith({
      "system.motes.peripheral.value": 20
    });
  });

  it("is a no-op for non-character actors", async () => {
    const actor = makeFakeActor({ type: "npc" });
    const result = await ExaltedActor.prototype.recoverMotes.call(actor, 5, "peripheral");
    expect(result).toBeUndefined();
    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("ExaltedActor.addOnslaught", () => {
  it("delegates to applyDVPenalty when no onslaught AE exists", async () => {
    const actor = makeFakeActor({ effects: [] });
    await ExaltedActor.prototype.addOnslaught.call(actor);
    expect(actor.applyDVPenalty).toHaveBeenCalledWith(
      "onslaught", 1,
      expect.objectContaining({ icon: "icons/svg/hazard.svg" })
    );
  });

  it("increments value on an existing onslaught AE", async () => {
    const existingAE = {
      disabled: false,
      flags: { exalted2e: { dvPenalty: { type: "onslaught", value: 2 } } },
      update: vi.fn().mockResolvedValue(true)
    };
    const actor = makeFakeActor({ effects: [existingAE] });
    const result = await ExaltedActor.prototype.addOnslaught.call(actor);
    expect(existingAE.update).toHaveBeenCalledWith(
      expect.objectContaining({
        "flags.exalted2e.dvPenalty.value": 3
      })
    );
    expect(result).toBe(existingAE);
    expect(actor.applyDVPenalty).not.toHaveBeenCalled();
  });
});
