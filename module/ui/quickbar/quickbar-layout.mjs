/**
 * Pure layout helpers for the combat quick bar. Framework-free so they can be
 * unit-tested without Foundry: they operate on plain descriptors
 * `{ key, group }`, never on DOM. The DOM-bridging lives in the
 * dock-/radial-layout modules.
 */

/** Canonical left-to-right segment order for the Dock style. */
export const QB_GROUPS = ["offense", "movement", "magic", "utility", "turn"];

/** Action/button key → group. Anything absent defaults to "utility". */
export const QB_GROUP_OF = {
  // offense
  attack: "offense", draw: "offense",
  hold: "offense", crush: "offense", throw: "offense", release: "offense",
  clinchHold: "offense", clinchCrush: "offense", clinchThrow: "offense",
  // movement
  move: "movement", dash: "movement", rise: "movement", jump: "movement",
  // magic
  cast: "magic", simpleCharm: "magic", thaumaturgy: "magic",
  // utility
  guard: "utility", aim: "utility", coordinate: "utility",
  shapeshift: "utility", inactive: "utility", flurry: "utility",
  // turn
  finish: "turn", massGuard: "turn", abort: "turn",
};

const _groupOf = (descriptor) => {
  const g = descriptor.group;
  return QB_GROUPS.includes(g) ? g : "utility";
};

/**
 * Group descriptors into ordered segments for the Dock style.
 * @param {Array<{key:string, group?:string}>} descriptors
 * @returns {Array<{group:string, items:Array}>}  segments in QB_GROUPS order,
 *   empty groups omitted, input order preserved within each group.
 */
export function groupForDock(descriptors) {
  const byGroup = new Map(QB_GROUPS.map(g => [g, []]));
  for (const dsc of descriptors) byGroup.get(_groupOf(dsc)).push(dsc);
  return QB_GROUPS
    .map(group => ({ group, items: byGroup.get(group) }))
    .filter(seg => seg.items.length > 0);
}

/** Structural controls that must always stay on the visible bar, never the
 *  radial overflow: Attack and Finish are always present, and Abort is the
 *  one-click affordance shown during an abortable mid-action window. */
const QB_ALWAYS_BAR = new Set(["attack", "finish", "abort"]);

/**
 * Split descriptors into the always-visible bar and the radial overflow.
 * Attack, Finish, and Abort are always in the bar; a descriptor is in the bar
 * if its key is in `pinnedKeys`, otherwise in the radial.
 *
 * Bar order: Attack first → the pinned keys in `pinnedKeys` order (so the user
 * can rearrange them) → any remaining always-bar controls (Finish, Abort) in
 * descriptor order. Radial keeps descriptor order.
 * @param {Array<{key:string}>} descriptors
 * @param {string[]} pinnedKeys
 * @returns {{bar:Array, radial:Array}}
 */
export function partitionForRadial(descriptors, pinnedKeys) {
  const pinnedOrder = pinnedKeys ?? [];
  const pinnedSet = new Set(pinnedOrder);
  const byKey = new Map(descriptors.map(d => [d.key, d]));

  const radial = descriptors.filter(d => !(QB_ALWAYS_BAR.has(d.key) || pinnedSet.has(d.key)));

  const bar = [];
  const used = new Set();
  const push = (d) => { if (d && !used.has(d.key)) { bar.push(d); used.add(d.key); } };

  push(byKey.get("attack"));                 // Attack always leads.
  for (const key of pinnedOrder) push(byKey.get(key)); // pinned, in saved order.
  for (const d of descriptors) {             // remaining always-bar (Finish, Abort).
    if (QB_ALWAYS_BAR.has(d.key)) push(d);
  }
  return { bar, radial };
}
