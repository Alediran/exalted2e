import { assertTestWorld }                from "../_helpers/world.mjs";
import { sweep }                          from "../_helpers/cleanup.mjs";
import { createTempCharacter }            from "../_helpers/actors.mjs";
import { createTempCharm }                from "../_helpers/charms.mjs";
import { stubXpConfirm }                  from "../_helpers/dialogs.mjs";
import { lastChatMessage,
         chatMessageByFlag }              from "../_helpers/messages.mjs";

/**
 * Wait until `predicate` returns truthy or `timeoutMs` elapses. Same
 * pattern as sorcery-shaping-smoke's waitFor; useful for waiting on
 * chat log re-renders without relying on hook ordering.
 */
async function waitFor(predicate, { timeoutMs = 2000, intervalMs = 25 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return false;
}

/**
 * Find the rendered `.btn-reverse-charm` DOM element for a given
 * ChatMessage. Returns null if the chat log hasn't rendered the message
 * yet (caller should waitFor first).
 */
function findReverseButton(messageId) {
  const root = document.querySelector(
    `[data-message-id="${messageId}"]`
  );
  return root?.querySelector?.(".btn-reverse-charm") ?? null;
}

/**
 * Dispatch a click on the reverse-charm button for the given message,
 * polling for the rendered DOM and for the `reversed` flag flip
 * afterwards. Returns true on success.
 */
async function clickReverseButton(message) {
  const ok = await waitFor(() => !!findReverseButton(message.id));
  if (!ok) throw new Error("clickReverseButton: button never rendered");
  const btn = findReverseButton(message.id);
  btn.click();
  // The handler is async; wait for the message flag to flip.
  await waitFor(() =>
    !!game.messages.get(message.id)?.flags?.exalted2e?.charmActivation?.reversed
  );
  return true;
}

/** Build a charm-owning actor with pools sized so refund tests aren't clamped. */
async function setupCharmActor({ peripheral = 30, personal = 10, wp = 5, xp = 30 } = {}) {
  const actor = await createTempCharacter({ name: "Charmer" });
  await actor.update({
    "system.essence.value":           5,         // motes.*.max headroom
    "system.motes.peripheral.value":  peripheral,
    "system.motes.peripheral.max":    peripheral,
    "system.motes.personal.value":    personal,
    "system.motes.personal.max":      personal,
    "system.willpower.value":         wp,
    "system.willpower.max":           wp,
    "system.experience.value":        xp,
    "system.experience.total":        xp
  });
  return actor;
}

export function registerCharmActivation(context) {
  const { describe, it, before, afterEach, assert } = context;

  describe("charm activation lifecycle", function () {
    before(assertTestWorld);
    afterEach(sweep);

    // 1. Spends motes from peripheral first; ledger records breakdown.
    it("[55] spends motes (peripheral first); ledger records moteBreakdown", async function () {
      const actor = await setupCharmActor();
      const charm = await createTempCharm(actor, {
        cost: { motes: 5 }, duration: "instant"
      });
      const ok = await charm.activateCharm({ skipXpConfirm: true });
      assert.equal(ok, true, "activation succeeded");
      assert.equal(actor.system.motes.peripheral.value, 25, "peripheral 30→25");
      assert.equal(actor.system.motes.personal.value,   10, "personal untouched");

      const card = chatMessageByFlag("charmActivation",
        v => v?.charmId === charm.id);
      assert.ok(card, "activation card posted");
      const ledger = card.flags.exalted2e.charmActivation.ledger;
      assert.equal(ledger.moteBreakdown.fromPrimary,   5);
      assert.equal(ledger.moteBreakdown.fromSecondary, 0);
      assert.equal(ledger.moteBreakdown.primaryPool,   "peripheral");
      assert.equal(ledger.moteBreakdown.secondaryPool, "personal");
    });

    // 2. Overflows peripheral → personal; both pool values change.
    it("[56] overflows peripheral→personal; ledger records the split", async function () {
      const actor = await setupCharmActor({ peripheral: 2, personal: 10 });
      const charm = await createTempCharm(actor, {
        cost: { motes: 5 }, duration: "instant"
      });
      await charm.activateCharm({ skipXpConfirm: true });
      assert.equal(actor.system.motes.peripheral.value, 0, "peripheral drained");
      assert.equal(actor.system.motes.personal.value,   7, "personal 10−3=7");
      const ledger = lastChatMessage().flags.exalted2e.charmActivation.ledger;
      assert.equal(ledger.moteBreakdown.fromPrimary,   2);
      assert.equal(ledger.moteBreakdown.fromSecondary, 3);
    });

    // 3. Spends willpower; actor's wp.value decremented.
    it("[57] spends willpower", async function () {
      const actor = await setupCharmActor();
      const charm = await createTempCharm(actor, {
        cost: { willpower: 2 }, duration: "instant"
      });
      await charm.activateCharm({ skipXpConfirm: true });
      assert.equal(actor.system.willpower.value, 3, "wp 5−2=3");
      const ledger = lastChatMessage().flags.exalted2e.charmActivation.ledger;
      assert.equal(ledger.willpower, 2);
    });

    // 4. Spends typed health damage; ledger records bashing/lethal counts.
    it("[58] spends typed health damage (lethal)", async function () {
      const actor = await setupCharmActor();
      // Snapshot lethal box count BEFORE activation so we can verify damage applied.
      const lethalBefore = actor.system.health?.lethal ?? 0;
      const charm = await createTempCharm(actor, {
        cost: { lethalHealth: 1 }, duration: "instant"
      });
      await charm.activateCharm({ skipXpConfirm: true });
      const lethalAfter = actor.system.health?.lethal ?? 0;
      assert.equal(lethalAfter - lethalBefore, 1, "1 lethal box added");
      const ledger = lastChatMessage().flags.exalted2e.charmActivation.ledger;
      assert.equal(ledger.lethal, 1);
    });

    // 5. Spends XP after confirm; ledger records xp.
    it("[59] spends XP after confirm", async function () {
      const actor = await setupCharmActor();
      const charm = await createTempCharm(actor, {
        cost: { xp: 3 }, duration: "instant"
      });
      stubXpConfirm([true]);  // confirm yes
      await charm.activateCharm();
      assert.equal(actor.system.experience.value, 27, "xp 30−3=27");
      const ledger = lastChatMessage().flags.exalted2e.charmActivation.ledger;
      assert.equal(ledger.xp, 3);
    });

    // 6. Cancelled XP confirm: no resources spent, no chat card.
    it("[60] cancelled XP confirm: no spend, no chat card, returns false", async function () {
      const actor = await setupCharmActor();
      const charm = await createTempCharm(actor, {
        cost: { motes: 5, willpower: 1, xp: 3 }, duration: "instant"
      });
      const messagesBefore = game.messages.size;
      stubXpConfirm([false]);  // cancel
      const ok = await charm.activateCharm();
      assert.equal(ok, false, "activation aborted");
      assert.equal(actor.system.motes.peripheral.value, 30, "motes untouched");
      assert.equal(actor.system.willpower.value,         5, "wp untouched");
      assert.equal(actor.system.experience.value,       30, "xp untouched");
      assert.equal(game.messages.size, messagesBefore,
        "no chat card created");
    });

    // 7. Reverse refunds exactly per source pool (peripheral overflow case).
    it("[61] reverse refunds across both pools after a peripheral→personal overflow", async function () {
      const actor = await setupCharmActor({ peripheral: 2, personal: 10 });
      const charm = await createTempCharm(actor, {
        cost: { motes: 5 }, duration: "instant"
      });
      await charm.activateCharm({ skipXpConfirm: true });
      assert.equal(actor.system.motes.peripheral.value, 0);
      assert.equal(actor.system.motes.personal.value,   7);

      const card = chatMessageByFlag("charmActivation",
        v => v?.charmId === charm.id);
      await clickReverseButton(card);

      assert.equal(actor.system.motes.peripheral.value, 2,
        "peripheral fully restored to original 2");
      assert.equal(actor.system.motes.personal.value, 10,
        "personal fully restored to original 10");
      const reloaded = game.messages.get(card.id);
      assert.equal(reloaded.flags.exalted2e.charmActivation.reversed, true,
        "ledger reversed flag flipped");
    });

    // 8. Reverse on already-reversed activation is a no-op.
    it("[62] reverse on already-reversed activation is a no-op", async function () {
      const actor = await setupCharmActor();
      const charm = await createTempCharm(actor, {
        cost: { motes: 5 }, duration: "instant"
      });
      await charm.activateCharm({ skipXpConfirm: true });
      const card = chatMessageByFlag("charmActivation",
        v => v?.charmId === charm.id);
      await clickReverseButton(card);
      const peripheralAfterFirst = actor.system.motes.peripheral.value;
      // Second click — handler short-circuits because record.reversed===true.
      const btn = document.querySelector(
        `[data-message-id="${card.id}"] .btn-reverse-charm`
      );
      btn?.click();   // no-op; button is disabled but handler also guards
      // Give it a beat in case the handler runs anyway, then verify nothing
      // moved.
      await new Promise(r => setTimeout(r, 50));
      assert.equal(actor.system.motes.peripheral.value, peripheralAfterFirst,
        "peripheral didn't double-refund");
    });
  });
}
