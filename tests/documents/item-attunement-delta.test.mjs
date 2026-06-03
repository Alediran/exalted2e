import { describe, it, expect, vi } from "vitest";
import { ExaltedItem } from "../../module/documents/item.mjs";

/**
 * Build a synthetic item bound to a fake actor with a peripheral pool.
 * The fakeItem's `system` carries the artifact / attuned / cost fields
 * Item._preUpdate reads to compute the delta.
 */
function makeFakeItem({
  itemType        = "weapon",
  artifact        = true,
  attuned         = false,
  attunementCost  = 5,
  peripheralValue = 20,
  peripheralMax   = 20
} = {}) {
  const actor = {
    type: "character",
    system: { motes: { peripheral: { value: peripheralValue, max: peripheralMax } } },
    update: vi.fn().mockResolvedValue(true)
  };
  return {
    actor,
    type: itemType,
    system: { artifact, attuned, attunementCost }
  };
}

describe("ExaltedItem._preUpdate (artifact attunement)", () => {
  it("debits peripheral by attunementCost when attuned flips true", async () => {
    const item = makeFakeItem({
      attuned: false, attunementCost: 5,
      peripheralValue: 20, peripheralMax: 20
    });
    await ExaltedItem.prototype._preUpdate.call(
      item, { system: { attuned: true } }, {}, "user-id"
    );
    expect(item.actor.update).toHaveBeenCalledWith({
      "system.motes.peripheral.value": 15
    });
  });

  it("returns motes when attuned flips false (clamped at max)", async () => {
    const item = makeFakeItem({
      attuned: true, attunementCost: 5,
      peripheralValue: 15, peripheralMax: 20
    });
    await ExaltedItem.prototype._preUpdate.call(
      item, { system: { attuned: false } }, {}, "user-id"
    );
    expect(item.actor.update).toHaveBeenCalledWith({
      "system.motes.peripheral.value": 20
    });
  });

  it("applies a delta when attunementCost changes on an attuned artifact", async () => {
    const item = makeFakeItem({
      attuned: true, attunementCost: 5,
      peripheralValue: 15, peripheralMax: 20
    });
    await ExaltedItem.prototype._preUpdate.call(
      item, { system: { attunementCost: 7 } }, {}, "user-id"
    );
    expect(item.actor.update).toHaveBeenCalledWith({
      "system.motes.peripheral.value": 13
    });
  });

  it("does not touch the pool when artifact is false (early return)", async () => {
    const item = makeFakeItem({
      artifact: false, attuned: false, attunementCost: 5,
      peripheralValue: 20, peripheralMax: 20
    });
    await ExaltedItem.prototype._preUpdate.call(
      item, { system: { attuned: true } }, {}, "user-id"
    );
    expect(item.actor.update).not.toHaveBeenCalled();
  });

  it("commits from the pool named by options.attunePool, bypassing the dialog", async () => {
    // Both pools funded — without the bypass option this would open the
    // interactive pool-choice dialog. The explicit option routes to personal
    // and must never block.
    const actor = {
      type: "character",
      system: { motes: {
        peripheral: { value: 20, max: 20 },
        personal:   { value: 13, max: 13 }
      } },
      update: vi.fn().mockResolvedValue(true)
    };
    const item = {
      actor,
      type: "weapon",
      system: { artifact: true, attuned: false, attunementCost: 5 },
      getFlag: () => undefined
    };
    await ExaltedItem.prototype._preUpdate.call(
      item, { system: { attuned: true } }, { attunePool: "personal" }, "user-id"
    );
    expect(actor.update).toHaveBeenCalledWith({
      "system.motes.personal.value": 8
    });
  });

  it("does not prompt on a cost change to an already-attuned artifact (defaults peripheral)", async () => {
    // oldAttuned === true → not a fresh attune → no dialog even with both pools.
    const actor = {
      type: "character",
      system: { motes: {
        peripheral: { value: 15, max: 20 },
        personal:   { value: 13, max: 13 }
      } },
      update: vi.fn().mockResolvedValue(true)
    };
    const item = {
      actor,
      type: "weapon",
      system: { artifact: true, attuned: true, attunementCost: 5 },
      getFlag: () => undefined
    };
    await ExaltedItem.prototype._preUpdate.call(
      item, { system: { attunementCost: 7 } }, {}, "user-id"
    );
    // delta +2 → peripheral drops 15 → 13
    expect(actor.update).toHaveBeenCalledWith({
      "system.motes.peripheral.value": 13
    });
  });
});
