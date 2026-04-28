/**
 * Per-test cleanup registry. Append-only stack swept in reverse so that
 * embedded children delete before their parents and arbitrary teardown
 * callbacks (e.g., function-stub restoration) run last-in-first-out.
 *
 * Wire each Quench batch's `afterEach(sweep)` to flush the stack between
 * tests. Failures during sweep are logged and swallowed — sweep keeps
 * going so a single bad doc doesn't strand the rest.
 */

const stack = []; // entries: { kind: "doc", doc } | { kind: "fn", fn }

/**
 * Queue a Foundry document for `doc.delete()` during sweep.
 * Returns the same `doc` so call-sites can chain: `return register(doc);`.
 */
export function register(doc) {
  if (doc) stack.push({ kind: "doc", doc });
  return doc;
}

/**
 * Queue an arbitrary teardown callback. Useful for restoring monkey-patched
 * functions (e.g., ExaltedRoll.rollPool) without leaking state across tests.
 */
export function cleanupOnAfter(fn) {
  if (typeof fn === "function") stack.push({ kind: "fn", fn });
}

/**
 * Drain the stack in reverse order. Per-entry errors are caught and logged.
 */
export async function sweep() {
  while (stack.length) {
    const entry = stack.pop();
    try {
      if (entry.kind === "doc") {
        if (entry.doc?.delete) await entry.doc.delete();
      } else {
        await entry.fn();
      }
    } catch (err) {
      console.warn("exalted2e | quench cleanup failed", entry, err);
    }
  }
}
