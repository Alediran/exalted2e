import { cleanupOnAfter } from "./cleanup.mjs";

/**
 * Replace `SorceryCastDialog.prompt` with a queue-based stub. Each call
 * shifts the next return value from `returnSequence`; if the queue is
 * exhausted, throws a clear error so tests fail loudly instead of
 * resolving `undefined`. The original method is restored via
 * `cleanupOnAfter`.
 *
 * Returns the queue (a fresh array) so tests can inspect remaining
 * entries if desired.
 *
 * @param {Array<object|null>} returnSequence — values prompt() will return
 *   in order. `{ ok: true, ... }` for confirm, `{ ok: false }` for cancel,
 *   or `null` for "user closed the dialog".
 */
export async function stubSorceryCastDialog(returnSequence = []) {
  const { SorceryCastDialog } = await import(
    "../../../module/dialogs/sorcery-cast-dialog.mjs"
  );
  const queue = [...returnSequence];
  const orig = SorceryCastDialog.prompt;
  cleanupOnAfter(() => { SorceryCastDialog.prompt = orig; });
  SorceryCastDialog.prompt = async (..._args) => {
    if (queue.length === 0) {
      throw new Error(
        "stubSorceryCastDialog: queue exhausted — test queued fewer "
        + "returns than the production code requested."
      );
    }
    return queue.shift();
  };
  return queue;
}

/**
 * Generic dialog stub. Replaces `DialogClass.prompt` with a queue-based
 * stub for any dialog with a static prompt method. Same semantics as
 * `stubSorceryCastDialog` but parameterized.
 */
export function stubDialog(DialogClass, { returnSequence } = {}) {
  if (!DialogClass || typeof DialogClass.prompt !== "function") {
    throw new Error("stubDialog: DialogClass.prompt is not a function");
  }
  const queue = [...(returnSequence ?? [])];
  const orig = DialogClass.prompt;
  cleanupOnAfter(() => { DialogClass.prompt = orig; });
  DialogClass.prompt = async (..._args) => {
    if (queue.length === 0) {
      throw new Error(
        `stubDialog: queue exhausted for ${DialogClass.name} — test queued `
        + "fewer returns than the production code requested."
      );
    }
    return queue.shift();
  };
  return queue;
}
