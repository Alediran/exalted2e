export function computeHearthstoneMoteRegen(items) {
  const allItems = [...items];

  const socketedIds = new Set();
  for (const item of allItems) {
    const stones = item.system?.hearthstones;
    if (Array.isArray(stones)) {
      for (const id of stones) {
        if (id) socketedIds.add(id);
      }
    }
  }

  let total = 0;
  for (const item of allItems) {
    if (item.type === "hearthstone" && socketedIds.has(item.id)) {
      total += 2 * (item.system?.rating ?? 0); // 2 motes/hour per rating point
    }
  }
  return total;
}
