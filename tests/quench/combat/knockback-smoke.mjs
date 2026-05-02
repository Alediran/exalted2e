import { renderAttackCardContent } from "../../../module/rolls/exalted-roll.mjs";
import { ExaltedRoll }             from "../../../module/rolls/exalted-roll.mjs";
import { assertTestWorld, getTestScene } from "../_helpers/world.mjs";
import { sweep, cleanupOnAfter, register } from "../_helpers/cleanup.mjs";
import { createTempCharacter }     from "../_helpers/actors.mjs";
import { placeToken }              from "../_helpers/scenes.mjs";

/**
 * Poll until predicate returns truthy or `timeoutMs` elapses.
 * Used to await async click handlers that have no completion signal.
 */
async function waitFor(predicate, { timeoutMs = 3000, intervalMs = 50 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor: predicate never returned truthy within ${timeoutMs}ms`);
}

/** Find the rendered chat-card element for a given message id. */
function findCardElement(messageId) {
  return document.querySelector(`[data-message-id="${messageId}"] .ex2e-attack-card`);
}

/**
 * Wait for `message.content` to stop changing for `stableMs` milliseconds.
 *
 * The auto-apply click handler runs multiple `message.update({content})` calls
 * (damage section + chain re-render + outer card-rebuild). Polling for the
 * knockback flag tells us the chain ran, but doesn't tell us whether a later
 * outer update has already overwritten content. Asserting on a stable content
 * value catches the Task 5 race regardless of which write is last.
 */
async function waitForContentStable(message, { stableMs = 250, timeoutMs = 2000 } = {}) {
  let lastContent  = message.content;
  let lastChangeAt = Date.now();
  const deadline   = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 50));
    if (message.content !== lastContent) {
      lastContent  = message.content;
      lastChangeAt = Date.now();
    } else if (Date.now() - lastChangeAt >= stableMs) {
      return;
    }
  }
}

/**
 * Override the autoApplyDamage system setting for the duration of one
 * test. Restores via cleanupOnAfter.
 */
function overrideAutoApply(value) {
  const orig = game.settings.get;
  game.settings.get = (sys, key) =>
    (sys === "exalted2e" && key === "autoApplyDamage") ? value : orig.call(game.settings, sys, key);
  cleanupOnAfter(() => { game.settings.get = orig; });
}

/**
 * Build the chat card content + flags shape for an attack whose defense has
 * already been resolved and which is ready to roll damage (the `.btn-roll-damage`
 * button is present in the rendered card).
 *
 * Shape driven by `computeAttackOutcome` in `module/rolls/attack-math.mjs`:
 *   - `attack.defense` must be set → `defenseChosen = true`
 *   - `threshold = max(0, successes − defense.dv)` → with dv=0: threshold = successes
 *   - `rawDamagePool = threshold + weaponDamage` (addStrength=false) = 7 + 5 = 12
 *   - `hit = true`, `hardnessStops = false`, no Third Exc / counterattack
 *     → `showResolution = true`, `showRollDamage = true`
 *   - Template renders `.btn-roll-damage` with `data-damage-pool="12"` on the card
 *
 * @param {object} opts
 * @param {Actor}  opts.attacker
 * @param {Actor}  opts.target
 */
async function buildPostDamageMessage({ attacker, target }) {
  const attack = {
    actorId:    attacker.id,
    targetId:   target.id,
    weaponId:   null,
    abilityKey: "melee",
    successes:  7,
    defense:    { type: "manual", dv: 0 },
    weaponDamage:   5,
    addStrength:    false,
    damageType:     "lethal",
    targetSoak:     0,
    targetHardness: 0
  };
  const content = await renderAttackCardContent(attack);
  const message = await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content,
    flags: { exalted2e: { attack } }
  });
  register(message);
  return message;
}

export function registerKnockbackSmoke(context) {
  const { describe, it, before, afterEach, assert } = context;

  describe("knockback chain (smoke E2E)", function () {
    before(assertTestWorld);
    afterEach(sweep);

    // S1: Auto-apply path — happy-path E2E coverage.
    //
    // Historical context: a prior session (Task 5 of the knockback plan)
    // fixed an ordering race where the auto-apply path's outer
    // `message.update({content: card.outerHTML})` overwrote the chain's
    // re-rendered content. We attempted to use this test as a regression
    // guard for that race, but Foundry v13's chat-render pipeline patches
    // the `.ex2e-attack-card` element in-place when the chain updates
    // content, so `card.outerHTML` at the outer update already contains
    // the chain's sub-block — the buggy ordering doesn't manifest as
    // missing-content in v13. The test instead serves as E2E coverage:
    // confirm the auto-apply path actually invokes the chain end-to-end
    // (damage applied, token moved, AE created, content re-rendered).
    it("[11] auto-apply path runs the chain end-to-end", async function () {
      // Stub strategy:
      //   • The damage roll uses `new Roll(formula).evaluate()` directly —
      //     NOT ExaltedRoll.rollPool. We stub Roll.prototype.evaluate to
      //     inject 5 dice all showing face 7 (= 5 lethal successes) so
      //     rawDamage is deterministically non-zero regardless of luck.
      //   • The knockdown-resist roll goes through ExaltedRoll.rollPool.
      //     We stub that to 0 successes (auto-fail → Prone applied).
      //   Both stubs are cleaned up via cleanupOnAfter.
      const origEvaluate = Roll.prototype.evaluate;
      Roll.prototype.evaluate = async function () {
        // Inject five dice showing 7 (one success each → rawDamage = 5)
        this.terms = [{
          results: [7, 7, 7, 7, 7].map(face => ({ result: face, active: true }))
        }];
        return this;
      };
      cleanupOnAfter(() => { Roll.prototype.evaluate = origEvaluate; });

      // Force knockdown auto-fail for deterministic Prone application.
      const origRoll = ExaltedRoll.rollPool;
      ExaltedRoll.rollPool = async () => ({ successes: 0 });
      cleanupOnAfter(() => { ExaltedRoll.rollPool = origRoll; });

      overrideAutoApply(true);

      const attacker = await createTempCharacter({ name: "AttackerS1" });
      const defender = await createTempCharacter({
        name: "DefenderS1", sta: 1, res: 0, dex: 1, ath: 0
      });
      const scene = getTestScene();
      await placeToken(attacker, scene, { x: 0, y: 0 });
      const defToken = await placeToken(defender, scene, { x: 100, y: 0 });
      const startX = defToken.x;
      const startLethal = defender.system.health.lethal ?? 0;

      const message = await buildPostDamageMessage({ attacker, target: defender });

      // Wait for the renderChatMessageHTML hook to attach handlers.
      await waitFor(() => !!findCardElement(message.id));
      const card = findCardElement(message.id);
      const rollDamageBtn = card.querySelector(".btn-roll-damage");
      assert.ok(rollDamageBtn, "roll-damage button should be present pre-click");

      rollDamageBtn.click();

      // Wait for the chain to finish populating the resolution flag.
      await waitFor(() => !!message.flags?.exalted2e?.attack?.knockback);

      const resolution = message.flags.exalted2e.attack.knockback;
      assert.ok(resolution.fired, "knockback fired");
      assert.equal(resolution.knockdownResolution, "auto-knocked-down");
      assert.notEqual(defToken.x, startX, "token moved");
      assert.notEqual(defender.system.health.lethal, startLethal, "damage applied");

      // Prone status is applied by an AE-creation pipeline that may resolve
      // slightly after the chain's _persistAndRerender completes.
      await waitFor(() => defender.statuses.has("prone"), { timeoutMs: 1000 });
      assert.ok(defender.statuses.has("prone"), "Prone applied");

      // The critical regression check: final card content includes the
      // knockback-resolution sub-block CSS class (confirmed in
      // templates/chat/attack-result.hbs line ~190). If the race bug
      // returns, an outer message.update({content: card.outerHTML}) runs
      // AFTER the chain's re-render and overwrites the resolution sub-block.
      //
      // We must wait for content to STABILIZE before asserting — the flag
      // gets set in the middle of the buggy handler (chain runs first,
      // outer update runs after), so polling for the flag alone resolves
      // before the bug has had time to manifest. Stability polling reads
      // the FINAL content regardless of where the chain runs in the
      // handler.
      await waitForContentStable(message);
      assert.ok(
        message.content.includes("knockback-resolution"),
        "final card content should include the chain's .knockback-resolution sub-block"
      );
    });

    // S2: Manual-apply path — covers the .btn-apply-damage handler.
    it("[12] manual-apply path runs the chain after the user clicks Apply Damage", async function () {
      // Same stub strategy as S1:
      //   • Roll.prototype.evaluate → 5 dice showing face 7 (rawDamage=5).
      //   • ExaltedRoll.rollPool → 0 successes (knockdown auto-fail → Prone).
      const origEvaluate = Roll.prototype.evaluate;
      Roll.prototype.evaluate = async function () {
        this.terms = [{
          results: [7, 7, 7, 7, 7].map(face => ({ result: face, active: true }))
        }];
        return this;
      };
      cleanupOnAfter(() => { Roll.prototype.evaluate = origEvaluate; });

      const origRoll = ExaltedRoll.rollPool;
      ExaltedRoll.rollPool = async () => ({ successes: 0 });
      cleanupOnAfter(() => { ExaltedRoll.rollPool = origRoll; });

      overrideAutoApply(false);

      const attacker = await createTempCharacter({ name: "AttackerS2" });
      const defender = await createTempCharacter({
        name: "DefenderS2", sta: 1, res: 0, dex: 1, ath: 0
      });
      const scene = getTestScene();
      await placeToken(attacker, scene, { x: 0, y: 0 });
      const defToken = await placeToken(defender, scene, { x: 100, y: 0 });
      const startX = defToken.x;
      const startLethal = defender.system.health.lethal ?? 0;

      const message = await buildPostDamageMessage({ attacker, target: defender });

      // First click rolls damage but doesn't auto-apply (setting=false).
      await waitFor(() => !!findCardElement(message.id));
      const card1 = findCardElement(message.id);
      card1.querySelector(".btn-roll-damage")?.click();

      // Wait for the apply-damage button to appear in the re-rendered card.
      await waitFor(() => {
        const c = findCardElement(message.id);
        return !!c?.querySelector(".btn-apply-damage");
      });

      // Click Apply Damage.
      const card2 = findCardElement(message.id);
      card2.querySelector(".btn-apply-damage").click();

      await waitFor(() => !!message.flags?.exalted2e?.attack?.knockback);

      const resolution = message.flags.exalted2e.attack.knockback;
      assert.ok(resolution.fired, "knockback fired");
      assert.notEqual(defToken.x, startX, "token moved");
      assert.notEqual(defender.system.health.lethal, startLethal, "damage applied via manual button");

      // Prone status is applied by an AE-creation pipeline that may resolve
      // slightly after the chain's _persistAndRerender completes.
      await waitFor(() => defender.statuses.has("prone"), { timeoutMs: 1000 });
      assert.ok(defender.statuses.has("prone"), "Prone applied");
    });
  });
}
