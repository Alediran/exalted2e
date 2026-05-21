import { describe, it, expect } from "vitest";
import { slotCostOf, canEquipToSlot } from "../../module/helpers/equip-slots.mjs";

function makeWeapon({ slot = "hands", equipped = false, tags = [], modes = null } = {}) {
  return {
    id: Math.random().toString(36).slice(2),
    system: {
      slot,
      equipped,
      modes: modes ?? [{ tags }]
    }
  };
}

function makeArmor({ slot = "armor", equipped = false } = {}) {
  return { id: Math.random().toString(36).slice(2), system: { slot, equipped, modes: undefined } };
}

function makeActor({ slots = { hands: 2, feet: 1, armor: 1, head: 1 }, items = [] } = {}) {
  return {
    system: { slots },
    items: { [Symbol.iterator]: () => items[Symbol.iterator]() }
  };
}

// ── slotCostOf ───────────────────────────────────────────────────────────────

describe("slotCostOf", () => {
  it("returns 1 for a one-handed weapon in hands slot", () => {
    const item = makeWeapon({ slot: "hands", tags: [] });
    expect(slotCostOf(item, "hands")).toBe(1);
  });

  it("returns 2 for a two-handed weapon in hands slot", () => {
    const item = makeWeapon({ slot: "hands", tags: ["Two-handed"] });
    expect(slotCostOf(item, "hands")).toBe(2);
  });

  it("returns 1 for armor even if Two-handed tag were somehow present", () => {
    const item = makeWeapon({ slot: "armor", tags: ["Two-handed"] });
    expect(slotCostOf(item, "armor")).toBe(1);
  });

  it("returns 1 for slot 'none'", () => {
    const item = makeWeapon({ slot: "none", tags: [] });
    expect(slotCostOf(item, "none")).toBe(1);
  });

  it("returns 2 when Two-handed tag is on any mode (not just first)", () => {
    const item = {
      id: "x",
      system: {
        slot: "hands",
        equipped: false,
        modes: [{ tags: [] }, { tags: ["Two-handed"] }]
      }
    };
    expect(slotCostOf(item, "hands")).toBe(2);
  });

  it("returns 1 when modes array is empty", () => {
    const item = { id: "x", system: { slot: "hands", equipped: false, modes: [] } };
    expect(slotCostOf(item, "hands")).toBe(1);
  });

  it("returns 1 when modes is undefined", () => {
    const item = { id: "x", system: { slot: "hands", equipped: false, modes: undefined } };
    expect(slotCostOf(item, "hands")).toBe(1);
  });
});

// ── canEquipToSlot ───────────────────────────────────────────────────────────

describe("canEquipToSlot", () => {
  it("allows equipping a one-handed weapon when both hand slots are free", () => {
    const item  = makeWeapon({ slot: "hands" });
    const actor = makeActor({ items: [] });
    expect(canEquipToSlot(actor, item, item.id)).toBe(true);
  });

  it("allows equipping a one-handed weapon when one hand slot is already occupied", () => {
    const equipped = makeWeapon({ slot: "hands", equipped: true });
    const item     = makeWeapon({ slot: "hands" });
    const actor    = makeActor({ items: [equipped] });
    expect(canEquipToSlot(actor, item, item.id)).toBe(true);
  });

  it("blocks equipping a one-handed weapon when both hand slots are occupied", () => {
    const e1   = makeWeapon({ slot: "hands", equipped: true });
    const e2   = makeWeapon({ slot: "hands", equipped: true });
    const item = makeWeapon({ slot: "hands" });
    const actor = makeActor({ items: [e1, e2] });
    expect(canEquipToSlot(actor, item, item.id)).toBe(false);
  });

  it("allows equipping a two-handed weapon when both hand slots are free", () => {
    const item  = makeWeapon({ slot: "hands", tags: ["Two-handed"] });
    const actor = makeActor({ items: [] });
    expect(canEquipToSlot(actor, item, item.id)).toBe(true);
  });

  it("blocks equipping a two-handed weapon when one hand slot is already occupied", () => {
    const equipped = makeWeapon({ slot: "hands", equipped: true });
    const item     = makeWeapon({ slot: "hands", tags: ["Two-handed"] });
    const actor    = makeActor({ items: [equipped] });
    expect(canEquipToSlot(actor, item, item.id)).toBe(false);
  });

  it("allows equipping armor when armor slot is free", () => {
    const item  = makeArmor({ slot: "armor" });
    const actor = makeActor({ items: [] });
    expect(canEquipToSlot(actor, item, item.id)).toBe(true);
  });

  it("blocks equipping armor when armor slot is occupied", () => {
    const equipped = makeArmor({ slot: "armor", equipped: true });
    const item     = makeArmor({ slot: "armor" });
    const actor    = makeActor({ items: [equipped] });
    expect(canEquipToSlot(actor, item, item.id)).toBe(false);
  });

  it("always allows equipping when slot is 'none'", () => {
    const item  = { id: "x", system: { slot: "none", equipped: false } };
    const actor = makeActor({ items: [] });
    expect(canEquipToSlot(actor, item, item.id)).toBe(true);
  });

  it("always allows equipping when slot is missing", () => {
    const item  = { id: "x", system: { equipped: false } };
    const actor = makeActor({ items: [] });
    expect(canEquipToSlot(actor, item, item.id)).toBe(true);
  });

  it("always allows equipping when actor has no slots (NPC)", () => {
    const item  = makeWeapon({ slot: "hands" });
    const actor = makeActor({ slots: undefined, items: [] });
    expect(canEquipToSlot(actor, item, item.id)).toBe(true);
  });

  it("does not count the item itself when it is already in the equipped list (re-equip guard)", () => {
    const item  = makeWeapon({ slot: "hands", equipped: true });
    const other = makeWeapon({ slot: "hands", equipped: true });
    // actor has item + other both in the list; when toggling item, it should not count itself
    const actor = makeActor({ items: [item, other] });
    expect(canEquipToSlot(actor, item, item.id)).toBe(true);
  });

  it("does not count items in a different slot toward capacity", () => {
    const helmet = { id: "h1", system: { slot: "head", equipped: true } };
    const item   = makeArmor({ slot: "armor" });
    const actor  = makeActor({ items: [helmet] });
    expect(canEquipToSlot(actor, item, item.id)).toBe(true);
  });

  it("does not count unequipped items toward capacity", () => {
    const unequipped = makeWeapon({ slot: "hands", equipped: false });
    const item       = makeWeapon({ slot: "hands", tags: ["Two-handed"] });
    const actor      = makeActor({ items: [unequipped] });
    expect(canEquipToSlot(actor, item, item.id)).toBe(true);
  });
});
