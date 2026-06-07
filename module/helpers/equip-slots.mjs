/**
 * Returns the number of slot-units an item occupies when equipped.
 * Two-handed weapons count as 2; everything else counts as 1.
 * slot is the slot key the item is being equipped to ("hands", "armor", etc.).
 */
export function slotCostOf(item, slot) {
  if (slot !== "hands") return 1;
  const modes = item.system?.modes;
  if (Array.isArray(modes) && modes.some(m => Array.isArray(m.tags) && m.tags.includes("Two-handed"))) return 2;
  return 1;
}

/**
 * Returns true when the actor has room to equip item into its designated slot.
 * Always returns true when:
 *   - slot is "none" or missing
 *   - actor has no slots definition (e.g. NPC)
 */
export function canEquipToSlot(actor, item, itemId) {
  const slot     = item.system?.slot;
  const capacity = actor.system?.slots?.[slot];
  if (!slot || slot === "none" || capacity === undefined) return true;

  const cost  = slotCostOf(item, slot);
  const inUse = [...actor.items]
    .filter(i => i.id !== itemId && i.system?.equipped && i.system?.slot === slot)
    .reduce((sum, i) => sum + slotCostOf(i, slot), 0);

  return inUse + cost <= capacity;
}

/**
 * Build the hearthstone-slot rows for a socketable item's sheet. Each row is
 * `{ index, filled, stoneId, stoneName, stoneRating }`. A slot whose id has no
 * matching hearthstone on the parent actor renders empty.
 */
export function buildSocketedSlots(item) {
  const count      = item.system?.hearthstoneSlots ?? 0;
  const ids        = item.system?.hearthstones ?? [];
  const actorItems = item.parent ? [...item.parent.items] : [];
  return Array.from({ length: count }, (_, i) => {
    const id    = ids[i] ?? "";
    const stone = id ? actorItems.find(s => s.id === id && s.type === "hearthstone") : null;
    return { index: i, filled: !!stone, stoneId: id, stoneName: stone?.name ?? "", stoneRating: stone?.system?.rating ?? 0 };
  });
}
