/**
 * Tally d10 successes from a dice array.
 *
 * Exalted 2e dice rules:
 *   - 10 → 2 successes ("double success")
 *   - 7, 8, 9 → 1 success
 *   - 1 → counts toward botch but not toward successes
 *   - everything else → miss (no successes, no botch contribution)
 *
 * Accepts either an array of raw numbers (as `ExaltedRollResult` uses after
 * a fresh `Roll.evaluate()`) OR an array of `{face, succs, cls}` objects
 * (as the chat-reroll handler uses when re-tallying a previously-annotated
 * dice list). Reads `.face` if the element is an object, otherwise treats
 * the element as the face value.
 *
 * Returns the raw success count (before external-penalty adjustment or
 * second-Excellency addition), the 1s count, and a fresh `details` array
 * of `{face, succs, cls}` objects. Callers are responsible for deciding
 * whether to overwrite in-place or use the returned details directly.
 *
 * @param {Array<number | {face: number}>} dice
 * @returns {{ rawSuccesses: number, ones: number, details: Array<{face: number, succs: number, cls: string}> }}
 */
export function countSuccesses(dice, targetNumber = 7) {
  let rawSuccesses = 0;
  let ones = 0;
  const details = [];

  for (const item of dice) {
    const face = typeof item === "number" ? item : item.face;
    let succs = 0;
    let cls   = "miss";
    if (face === 10) {
      succs = 2;
      cls   = "double-success";
      rawSuccesses += 2;
    } else if (face >= targetNumber && face < 10) {
      succs = 1;
      cls   = "success";
      rawSuccesses += 1;
    } else if (face === 1) {
      cls = "one";
      ones += 1;
    }
    details.push({ face, succs, cls });
  }

  return { rawSuccesses, ones, details };
}
