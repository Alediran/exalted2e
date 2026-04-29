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

/**
 * Stub `AttackDialog.prompt` — the attacker-side roll dialog rollAttack
 * opens to collect stunt / excellency / supplemental-charm picks.
 *
 * Each entry resolves an i-th call. Real return shape (from
 * AttackDialog.#onConfirmAttack):
 *   { pool, stunt, advancesMotivation, rewardKind, moteType,
 *     firstExcDice, secondExcSucc, charmIds }
 * Or `null` to model "user cancelled" (the dialog's _onClose path).
 *
 * For most tests a minimal `{ stunt: 0, firstExcDice: 0, secondExcSucc: 0,
 *   charmIds: [], moteType: "peripheral" }` is sufficient — production
 * code reads what it needs and ignores the rest.
 */
export async function stubAttackDialog(returnSequence = []) {
  const { AttackDialog } = await import(
    "../../../module/rolls/attack-dialog.mjs"
  );
  return stubDialog(AttackDialog, { returnSequence });
}

/**
 * Stub `Step2DefenseDialog.prompt` — the defender-side step-2 dialog
 * for picking reflexive charms (Perfect Parry / Perfect Dodge / etc.)
 * and excellency dice.
 *
 * Real return shape:
 *   { charmIds, firstExcDice, secondExcSucc, moteType }
 * Or `null` for "no defensive charms — let the attack resolve".
 */
export async function stubStep2Defense(returnSequence = []) {
  const { Step2DefenseDialog } = await import(
    "../../../module/dialogs/step2-defense-dialog.mjs"
  );
  return stubDialog(Step2DefenseDialog, { returnSequence });
}

/**
 * Stub `CounterattackDialog.prompt` — the Step-9 counterattack picker.
 *
 * Real return shape:
 *   { charmId, weaponId, modeIndex }
 * Or `null` for "no counterattack".
 */
export async function stubCounterattack(returnSequence = []) {
  const { CounterattackDialog } = await import(
    "../../../module/dialogs/counterattack-dialog.mjs"
  );
  return stubDialog(CounterattackDialog, { returnSequence });
}

/**
 * Stub `foundry.applications.api.DialogV2.confirm` — the XP-spend
 * confirmation that activateCharm pops when `cost.xp > 0`. Each call
 * shifts the next boolean from `answers`. Throws on queue exhaustion
 * (same load-bearing convention as the other stubs).
 *
 * Restores the original via cleanupOnAfter. Tests that don't want to
 * exercise the confirm path can pass `{ skipXpConfirm: true }` to
 * activateCharm directly instead of using this stub.
 *
 * @param {boolean[]} answers — confirm/cancel return values, in order.
 */
export function stubXpConfirm(answers = []) {
  const queue = [...answers];
  const DialogV2 = foundry.applications.api.DialogV2;
  const orig = DialogV2.confirm;
  cleanupOnAfter(() => { DialogV2.confirm = orig; });
  DialogV2.confirm = async (..._args) => {
    if (queue.length === 0) {
      throw new Error(
        "stubXpConfirm: queue exhausted — test queued fewer answers "
        + "than the production code requested."
      );
    }
    return queue.shift();
  };
  return queue;
}
