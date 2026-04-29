import { beforeEach, describe, it, expect, vi } from "vitest";
import { ExaltedItem } from "../../module/documents/item.mjs";

/**
 * Build a synthetic item with a parent actor. The actor exposes the
 * methods _spendActivationCosts calls: spendMotes, applyDamage, update.
 * All are vi.fn() recorders. The actor's system carries baseline
 * willpower/experience values.
 */
function makeFakeItem({
  willpower  = 5,
  experience = 20,
  spendMotesResult = { fromPrimary: 0, fromSecondary: 0, primaryPool: "peripheral", secondaryPool: "personal" }
} = {}) {
  const actor = {
    type: "character",
    system: {
      willpower:  { value: willpower, max: willpower },
      experience: { value: experience, total: experience }
    },
    spendMotes:  vi.fn().mockResolvedValue(spendMotesResult),
    applyDamage: vi.fn().mockResolvedValue(true),
    update:      vi.fn().mockResolvedValue(true)
  };
  return { actor, name: "Q-Charm" };
}

beforeEach(() => {
  foundry.applications.api.DialogV2.confirm.mockClear();
  foundry.applications.api.DialogV2.confirm.mockResolvedValue(true);
});

describe("ExaltedItem._spendActivationCosts", () => {
  it("spends motes only when only motes are configured", async () => {
    const item = makeFakeItem({
      spendMotesResult: { fromPrimary: 4, fromSecondary: 0, primaryPool: "peripheral", secondaryPool: "personal" }
    });
    const result = await ExaltedItem.prototype._spendActivationCosts.call(item, { motes: 4 });
    expect(item.actor.spendMotes).toHaveBeenCalledWith(4, "peripheral");
    expect(item.actor.update).not.toHaveBeenCalled();
    expect(item.actor.applyDamage).not.toHaveBeenCalled();
    expect(result).toEqual({
      moteBreakdown: { fromPrimary: 4, fromSecondary: 0, primaryPool: "peripheral", secondaryPool: "personal" },
      willpower:  0,
      bashing:    0,
      lethal:     0,
      aggravated: 0,
      xp:         0
    });
  });

  it("decrements willpower via actor.update when willpower cost is set", async () => {
    const item = makeFakeItem({ willpower: 5 });
    const result = await ExaltedItem.prototype._spendActivationCosts.call(item, { willpower: 2 });
    expect(item.actor.update).toHaveBeenCalledWith({ "system.willpower.value": 3 });
    expect(result.willpower).toBe(2);
  });

  it("calls applyDamage('bashing', n) for bashing health cost", async () => {
    const item = makeFakeItem();
    const result = await ExaltedItem.prototype._spendActivationCosts.call(item, { bashingHealth: 1 });
    expect(item.actor.applyDamage).toHaveBeenCalledWith(1, "bashing");
    expect(result.bashing).toBe(1);
  });

  it("returns null without further changes when spendMotes returns null", async () => {
    const item = makeFakeItem();
    item.actor.spendMotes.mockResolvedValueOnce(null);
    const result = await ExaltedItem.prototype._spendActivationCosts.call(item, { motes: 99, willpower: 2 });
    expect(result).toBeNull();
    expect(item.actor.update).not.toHaveBeenCalled();
  });

  it("returns null when DialogV2.confirm is rejected for an XP cost", async () => {
    const item = makeFakeItem({ experience: 10 });
    foundry.applications.api.DialogV2.confirm.mockResolvedValueOnce(false);
    const result = await ExaltedItem.prototype._spendActivationCosts.call(item, { xp: 3 });
    expect(result).toBeNull();
    expect(item.actor.update).not.toHaveBeenCalled();
  });

  it("bypasses the XP confirm dialog when skipXpConfirm: true is passed", async () => {
    const item = makeFakeItem({ experience: 10 });
    const result = await ExaltedItem.prototype._spendActivationCosts.call(
      item, { xp: 3 }, { skipXpConfirm: true }
    );
    expect(foundry.applications.api.DialogV2.confirm).not.toHaveBeenCalled();
    expect(item.actor.update).toHaveBeenCalledWith({ "system.experience.value": 7 });
    expect(result.xp).toBe(3);
  });
});
