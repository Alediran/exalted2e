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
    system: { motes: { personal, peripheral }, scenePeripheral: 0 },
    effects,
    items:           { some: () => false },
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
    expect(actor.update).toHaveBeenCalledWith(
      {
        "system.motes.peripheral.value": 5,
        "system.motes.personal.value":   5,
        "system.scenePeripheral":        3
      },
      { scenePeripheralBefore: 0 }
    );
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
    expect(actor.update).toHaveBeenCalledWith(
      {
        "system.motes.peripheral.value": 0,
        "system.motes.personal.value":   2,
        "system.scenePeripheral":        4
      },
      { scenePeripheralBefore: 0 }
    );
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
    expect(actor.update).toHaveBeenCalledWith(
      {
        "system.motes.personal.value":   1,
        "system.motes.peripheral.value": 0,
        "system.scenePeripheral":        0
      },
      { scenePeripheralBefore: 0 }
    );
    expect(result).toEqual({
      fromPrimary:   3,
      fromSecondary: 0,
      primaryPool:   "personal",
      secondaryPool: "peripheral"
    });
  });

  it("returns null silently for unknown actor types", async () => {
    const actor = makeFakeActor({ type: "vehicle" });
    const result = await ExaltedActor.prototype.spendMotes.call(actor, 5, "peripheral");
    expect(result).toBeNull();
    expect(actor.update).not.toHaveBeenCalled();
    expect(ui.notifications.warn).not.toHaveBeenCalled();
  });

  it("debits flat motes for NPC actors", async () => {
    const actor = {
      type: "npc",
      system: { motes: { value: 20, max: 40 } },
      update: vi.fn().mockResolvedValue(true)
    };
    const result = await ExaltedActor.prototype.spendMotes.call(actor, 5, "peripheral");
    expect(actor.update).toHaveBeenCalledWith({ "system.motes.value": 15 });
    expect(result).toEqual({ fromPrimary: 5, fromSecondary: 0, primaryPool: "motes", secondaryPool: "motes" });
  });

  it("warns and returns null when NPC has insufficient motes", async () => {
    const actor = {
      type: "npc",
      system: { motes: { value: 3, max: 40 } },
      update: vi.fn().mockResolvedValue(true)
    };
    const result = await ExaltedActor.prototype.spendMotes.call(actor, 5, "peripheral");
    expect(result).toBeNull();
    expect(actor.update).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalledWith("EX2E.NotEnoughMotes");
  });

  it("drains overdrive before peripheral when spending Peripheral", async () => {
    const actor = makeFakeActor({
      personal:   { value: 5, max: 10 },
      peripheral: { value: 8, max: 20, overdrive: 10 }
    });
    const result = await ExaltedActor.prototype.spendMotes.call(actor, 4, "peripheral");
    expect(actor.update).toHaveBeenCalledWith(
      {
        "system.motes.peripheral.value":    8,
        "system.motes.personal.value":      5,
        "system.motes.peripheral.overdrive": 6,
        "system.scenePeripheral":           4
      },
      { scenePeripheralBefore: 0 }
    );
    expect(result).toEqual({
      fromPrimary:   4,
      fromSecondary: 0,
      primaryPool:   "peripheral",
      secondaryPool: "personal"
    });
  });

  it("uses overdrive then regular peripheral when overdrive is insufficient", async () => {
    const actor = makeFakeActor({
      personal:   { value: 5, max: 10 },
      peripheral: { value: 8, max: 20, overdrive: 3 }
    });
    const result = await ExaltedActor.prototype.spendMotes.call(actor, 7, "peripheral");
    expect(actor.update).toHaveBeenCalledWith(
      {
        "system.motes.peripheral.value":    4,
        "system.motes.personal.value":      5,
        "system.motes.peripheral.overdrive": 0,
        "system.scenePeripheral":           7
      },
      { scenePeripheralBefore: 0 }
    );
    expect(result).toEqual({
      fromPrimary:   7,
      fromSecondary: 0,
      primaryPool:   "peripheral",
      secondaryPool: "personal"
    });
  });

  it("counts overdrive in the total available motes check", async () => {
    const actor = makeFakeActor({
      personal:   { value: 1, max: 10 },
      peripheral: { value: 2, max: 20, overdrive: 10 }
    });
    const result = await ExaltedActor.prototype.spendMotes.call(actor, 10, "peripheral");
    expect(result).not.toBeNull();
    expect(actor.update).toHaveBeenCalled();
  });

  it("does not drain overdrive when spending Personal motes", async () => {
    const actor = makeFakeActor({
      personal:   { value: 5, max: 10 },
      peripheral: { value: 8, max: 20, overdrive: 10 }
    });
    await ExaltedActor.prototype.spendMotes.call(actor, 3, "personal");
    const [updateArg] = actor.update.mock.calls[0];
    expect(updateArg["system.motes.peripheral.overdrive"]).toBeUndefined();
  });

  it("skips overdrive drain when allowOverdrive is false", async () => {
    const actor = makeFakeActor({
      personal:   { value: 5, max: 10 },
      peripheral: { value: 8, max: 20, overdrive: 10 }
    });
    await ExaltedActor.prototype.spendMotes.call(actor, 4, "peripheral", { allowOverdrive: false });
    const [updateArg] = actor.update.mock.calls[0];
    expect(updateArg["system.motes.peripheral.value"]).toBe(4);
    expect(updateArg["system.motes.peripheral.overdrive"]).toBeUndefined();
  });

  it("excludes overdrive from available total when allowOverdrive is false", async () => {
    const actor = makeFakeActor({
      personal:   { value: 1, max: 10 },
      peripheral: { value: 2, max: 20, overdrive: 10 }
    });
    const result = await ExaltedActor.prototype.spendMotes.call(actor, 10, "peripheral", { allowOverdrive: false });
    expect(result).toBeNull();
    expect(actor.update).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalledTimes(1);
  });
});

describe("ExaltedActor.addOverdriveMotes", () => {
  it("adds motes to the overdrive pool", async () => {
    const actor = makeFakeActor({
      peripheral: { value: 8, max: 20, overdrive: 5 }
    });
    await ExaltedActor.prototype.addOverdriveMotes.call(actor, 3);
    expect(actor.update).toHaveBeenCalledWith({
      "system.motes.peripheral.overdrive": 8
    });
  });

  it("clamps overdrive at 25", async () => {
    const actor = makeFakeActor({
      peripheral: { value: 8, max: 20, overdrive: 22 }
    });
    await ExaltedActor.prototype.addOverdriveMotes.call(actor, 10);
    expect(actor.update).toHaveBeenCalledWith({
      "system.motes.peripheral.overdrive": 25
    });
  });

  it("is a no-op when already at 25", async () => {
    const actor = makeFakeActor({
      peripheral: { value: 8, max: 20, overdrive: 25 }
    });
    await ExaltedActor.prototype.addOverdriveMotes.call(actor, 5);
    expect(actor.update).not.toHaveBeenCalled();
  });

  it("is a no-op for non-character actors", async () => {
    const actor = makeFakeActor({ type: "npc" });
    await ExaltedActor.prototype.addOverdriveMotes.call(actor, 5);
    expect(actor.update).not.toHaveBeenCalled();
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

describe("ExaltedActor._applyArmorSoak", () => {
  it("sets armorSoak and totalSoak when armor is equipped", () => {
    const equippedArmor = {
      type: "armor",
      system: {
        equipped: true,
        effectiveSoak: { bashing: 3, lethal: 2, aggravated: 1 },
        effectiveHardness: 2,
        effectiveMobilityPenalty: -1
      },
      name: "Lamellar Armor"
    };
    const actor = {
      items: { find: vi.fn().mockReturnValue(equippedArmor) }
    };
    const systemData = {
      naturalSoak: { bashing: 1, lethal: 1, aggravated: 0 }
    };

    ExaltedActor.prototype._applyArmorSoak.call(actor, systemData);

    expect(systemData.armorSoak).toEqual({
      bashing: 3,
      lethal: 2,
      aggravated: 1
    });
    expect(systemData.totalSoak).toEqual({
      bashing: 4,
      lethal: 3,
      aggravated: 1
    });
    expect(systemData.hardness).toBe(2);
    expect(systemData.mobilityPenalty).toBe(-1);
    expect(systemData.armorName).toBe("Lamellar Armor");
  });

  it("sets armorSoak to zero when no armor is equipped", () => {
    const actor = {
      items: { find: vi.fn().mockReturnValue(undefined) }
    };
    const systemData = {
      naturalSoak: { bashing: 1, lethal: 1, aggravated: 0 }
    };

    ExaltedActor.prototype._applyArmorSoak.call(actor, systemData);

    expect(systemData.armorSoak).toEqual({
      bashing: 0,
      lethal: 0,
      aggravated: 0
    });
    expect(systemData.totalSoak).toEqual({
      bashing: 1,
      lethal: 1,
      aggravated: 0
    });
    expect(systemData.hardness).toBe(0);
    expect(systemData.mobilityPenalty).toBe(0);
    expect(systemData.armorName).toBeNull();
  });

  it("defaults armorSoak to zero when armor is missing, even with no naturalSoak", () => {
    const actor = {
      items: { find: vi.fn().mockReturnValue(undefined) }
    };
    const systemData = {
      naturalSoak: { bashing: 2, lethal: 1, aggravated: 0 }
    };

    ExaltedActor.prototype._applyArmorSoak.call(actor, systemData);

    expect(systemData.armorSoak).toEqual({
      bashing: 0,
      lethal: 0,
      aggravated: 0
    });
    expect(systemData.totalSoak).toEqual({
      bashing: 2,
      lethal: 1,
      aggravated: 0
    });
  });
});
