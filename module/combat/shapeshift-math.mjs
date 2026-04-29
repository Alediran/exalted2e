/**
 * Compute the mote cost of shapeshifting to a target form.
 *
 *   target === ""                    → 1 mote (human guise — true form)
 *   target === spiritShapeFormId     → 1 mote (spirit shape — true form)
 *     when spiritShapeFormId is non-empty
 *   any other non-empty form id      → 3 motes (Heart's Blood)
 *
 * Pure helper — no Foundry dependencies. Used by ShapeshiftDialog (option
 * list construction) and ActionQuickbar._handleShapeshift (cost charged).
 *
 * @param {object} input
 * @param {string} input.targetFormId       form id the user is shifting to
 * @param {string} [input.spiritShapeFormId] the Lunar's designated spirit shape
 * @returns {number} mote cost (1 or 3)
 */
export function computeShapeshiftCost({ targetFormId = "", spiritShapeFormId = "" } = {}) {
  if (!targetFormId) return 1;
  if (spiritShapeFormId && targetFormId === spiritShapeFormId) return 1;
  return 3;
}
