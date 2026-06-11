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
 * if its key is in `pinnedKeys`, otherwise in the radial. Order is preserved.
 * @param {Array<{key:string}>} descriptors
 * @param {string[]} pinnedKeys
 * @returns {{bar:Array, radial:Array}}
 */
export function partitionForRadial(descriptors, pinnedKeys) {
  const pinned = new Set(pinnedKeys ?? []);
  const bar = [];
  const radial = [];
  for (const dsc of descriptors) {
    if (QB_ALWAYS_BAR.has(dsc.key) || pinned.has(dsc.key)) bar.push(dsc);
    else radial.push(dsc);
  }
  return { bar, radial };
}
