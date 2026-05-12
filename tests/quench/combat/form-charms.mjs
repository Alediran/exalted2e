import { assertTestWorld }     from "../_helpers/world.mjs";
import { sweep, register }     from "../_helpers/cleanup.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";
import { createTempCharm }     from "../_helpers/charms.mjs";
import { stubXpConfirm }       from "../_helpers/dialogs.mjs";

// Poll for a condition with timeout and interval.
async function waitFor(condition, { timeout = 3000, interval = 50 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await condition()) return true;
    await new Promise(r => setTimeout(r, interval));
  }
  return false;
}

/** Fresh actor with enough motes for any Form test. */
async function setupActor() {
  const actor = await createTempCharacter({ name: "Form Tester" });
  await actor.update({
    "system.essence.value":          5,
    "system.motes.peripheral.value": 30,
    "system.motes.peripheral.max":   30,
    "system.motes.personal.value":   10,
    "system.motes.personal.max":     10,
    "system.willpower.value":        5,
    "system.willpower.max":          5
  });
  return actor;
}

/** Create a Form-type charm on the given actor with optional embedded AEs. */
async function createFormCharm(actor, { name = "Tiger Form", cost = {}, effects = [] } = {}) {
  const charm = await createTempCharm(actor, {
    name,
    charmType: "simple",
    duration:  "oneScene",
    keywords:  ["Form-type"],
    cost
  });
  if (effects.length) {
    await charm.createEmbeddedDocuments("ActiveEffect", effects);
  }
  return charm;
}

export function registerFormCharms(context) {
  const { describe, it, before, afterEach, assert } = context;

  describe("Form-type charm handling", function () {
    before(assertTestWorld);
    afterEach(sweep);

    // F01 — applyCharmAEs copies effects to actor with charmSource tag
    it("[F01] applyCharmAEs: copies charm effects to actor tagged with charmSource", async function () {
      const { applyCharmAEs } = await import("../../../module/combat/form-charms.mjs");
      const actor = await setupActor();
      const charm = await createFormCharm(actor, {
        effects: [{ name: "Test Soak Bonus", changes: [{ key: "system.soak.bashing", mode: 2, value: "3" }] }]
      });
      assert.equal(charm.effects.size, 1, "charm has one embedded effect");
      const effectsBefore = actor.effects.size;

      await applyCharmAEs(actor, charm, {});

      assert.equal(actor.effects.size, effectsBefore + 1, "one AE added to actor");
      const ae = actor.effects.find(e => e.flags?.exalted2e?.charmSource === charm.id);
      assert.ok(ae, "AE on actor has charmSource = charm.id");
      assert.equal(ae.name, "Test Soak Bonus", "AE name preserved");
    });

    // F02 — clearActorForms (via deactivateForm) deletes only the tagged AEs
    it("[F02] deactivateForm: deletes only AEs tagged with the given charmId", async function () {
      const { applyCharmAEs, deactivateForm } = await import("../../../module/combat/form-charms.mjs");
      const actor = await setupActor();
      const charm = await createFormCharm(actor, {
        effects: [{ name: "Soak AE", changes: [] }, { name: "Dice AE", changes: [] }]
      });
      await applyCharmAEs(actor, charm, {});
      // Add a control AE from a different source to prove isolation.
      const controlAEs = await actor.createEmbeddedDocuments("ActiveEffect", [{
        name: "Control AE",
        changes: [],
        flags: { exalted2e: { charmSource: "other-charm-id" } }
      }]);
      const controlAE = controlAEs[0];
      await charm.update({ "system.active": true });
      const countAfterApply = actor.effects.size;
      assert.ok(countAfterApply >= 2, `expected ≥ 2 AEs but got ${countAfterApply}`);

      await deactivateForm(charm);

      const remaining = actor.effects.filter(e => e.flags?.exalted2e?.charmSource === charm.id);
      assert.equal(remaining.length, 0, "all charmSource AEs removed");
      assert.ok(actor.effects.find(e => e.id === controlAE.id), "control AE from other source untouched");
    });

    // F03 — deactivateForm removes AEs and sets active=false
    it("[F03] deactivateForm: removes AEs and clears system.active", async function () {
      const { applyCharmAEs, deactivateForm } = await import("../../../module/combat/form-charms.mjs");
      const actor = await setupActor();
      const charm = await createFormCharm(actor, {
        effects: [{ name: "Form AE", changes: [] }]
      });
      await applyCharmAEs(actor, charm, {});
      await charm.update({ "system.active": true });
      assert.equal(charm.system.active, true, "charm active before deactivation");

      await deactivateForm(charm);

      assert.equal(charm.system.active, false, "charm inactive after deactivateForm");
      const remaining = actor.effects.filter(e => e.flags?.exalted2e?.charmSource === charm.id);
      assert.equal(remaining.length, 0, "charmSource AEs removed");
    });

    // F04 — clearActorForms sweeps all active Form charms
    it("[F04] clearActorForms: deactivates all active Form charms on actor", async function () {
      const { applyCharmAEs, clearActorForms } = await import("../../../module/combat/form-charms.mjs");
      const actor = await setupActor();
      const formA = await createFormCharm(actor, { name: "Form A", effects: [{ name: "A AE", changes: [] }] });
      const formB = await createFormCharm(actor, { name: "Form B", effects: [{ name: "B AE", changes: [] }] });
      await applyCharmAEs(actor, formA, {});
      await formA.update({ "system.active": true });
      await applyCharmAEs(actor, formB, {});
      await formB.update({ "system.active": true });

      await clearActorForms(actor);

      assert.equal(formA.system.active, false, "Form A deactivated");
      assert.equal(formB.system.active, false, "Form B deactivated");
      const remaining = actor.effects.filter(e => e.flags?.exalted2e?.charmSource != null);
      assert.equal(remaining.length, 0, "all Form AEs removed");
    });

    // F05 — activateCharm (Form-type): AEs propagated, active=true, motes spent
    it("[F05] activateCharm (Form-type): applies AEs from charm to actor", async function () {
      const actor = await setupActor();
      const charm = await createFormCharm(actor, {
        cost: { motes: 3 },
        effects: [{ name: "Snake Soak", changes: [{ key: "system.soak.bashing", mode: 2, value: "3" }] }]
      });
      const motesBefore = actor.system.motes.peripheral.value;

      await charm.activateCharm({ skipXpConfirm: true });

      assert.equal(charm.system.active, true, "charm.system.active is true");
      const ae = actor.effects.find(e => e.flags?.exalted2e?.charmSource === charm.id);
      assert.ok(ae, "AE tagged with charmSource");
      const charmAEs = actor.effects.filter(e => e.flags?.exalted2e?.charmSource === charm.id);
      assert.equal(charmAEs.length, 1, "one charmSource AE added to actor");
      assert.equal(actor.system.motes.peripheral.value, motesBefore - 3, "3m spent");
    });

    // F06 — swap confirm: old Form deactivated, new Form activated
    it("[F06] swap confirm: deactivates old Form and activates new one", async function () {
      const actor = await setupActor();
      const oldForm = await createFormCharm(actor, {
        name: "Tiger Form",
        effects: [{ name: "Tiger AE", changes: [] }]
      });
      const newForm = await createFormCharm(actor, {
        name: "Snake Form",
        effects: [{ name: "Snake AE", changes: [] }]
      });

      await oldForm.activateCharm({ skipXpConfirm: true });
      assert.equal(oldForm.system.active, true, "old Form active");

      stubXpConfirm([true]);
      await newForm.activateCharm({ skipXpConfirm: true });

      assert.equal(oldForm.system.active, false, "old Form deactivated");
      assert.equal(newForm.system.active, true,  "new Form activated");
      const oldAEs = actor.effects.filter(e => e.flags?.exalted2e?.charmSource === oldForm.id);
      const newAEs = actor.effects.filter(e => e.flags?.exalted2e?.charmSource === newForm.id);
      assert.equal(oldAEs.length, 0, "old Form AEs removed");
      assert.equal(newAEs.length, 1, "new Form AE applied");
    });

    // F07 — swap cancel: no state change
    it("[F07] swap cancel: no state change when user cancels swap", async function () {
      const actor = await setupActor();
      const oldForm = await createFormCharm(actor, {
        name: "Tiger Form",
        effects: [{ name: "Tiger AE", changes: [] }]
      });
      const newForm = await createFormCharm(actor, { name: "Snake Form" });

      await oldForm.activateCharm({ skipXpConfirm: true });
      const motesBefore = actor.system.motes.peripheral.value;

      stubXpConfirm([false]);
      await newForm.activateCharm({ skipXpConfirm: true });

      assert.equal(oldForm.system.active, true,  "old Form still active");
      assert.equal(newForm.system.active, false, "new Form NOT activated");
      assert.equal(actor.system.motes.peripheral.value, motesBefore, "no motes spent");
    });

    // F08 — toggle-off: AEs removed, active=false
    it("[F08] toggle-off Form: AEs removed and system.active set false", async function () {
      const actor = await setupActor();
      const charm = await createFormCharm(actor, {
        effects: [{ name: "Form AE", changes: [] }]
      });
      await charm.activateCharm({ skipXpConfirm: true });
      assert.equal(charm.system.active, true, "Form active after activation");
      const aeBefore = actor.effects.filter(e => e.flags?.exalted2e?.charmSource === charm.id).length;
      assert.equal(aeBefore, 1, "one Form AE on actor");

      await charm.activateCharm({ skipXpConfirm: true });

      assert.equal(charm.system.active, false, "Form inactive after toggle-off");
      const aeAfter = actor.effects.filter(e => e.flags?.exalted2e?.charmSource === charm.id).length;
      assert.equal(aeAfter, 0, "Form AEs removed on toggle-off");
    });

    // F09 — charm deletion: active Form's AEs are cleaned up
    it("[F09] Form charm deletion: AEs cleaned up when active Form-type charm is deleted", async function () {
      const actor = await setupActor();
      const charm = await createFormCharm(actor, {
        effects: [{ name: "Form AE", changes: [] }]
      });
      await charm.activateCharm({ skipXpConfirm: true });
      assert.equal(charm.system.active, true, "Form active after activation");
      const aeBefore = actor.effects.filter(e => e.flags?.exalted2e?.charmSource === charm.id).length;
      assert.equal(aeBefore, 1, "one Form AE on actor before deletion");

      await charm.delete();

      // Poll for cleanup since Foundry doesn't await _preDelete
      const cleaned = await waitFor(
        () => actor.effects.filter(e => e.flags?.exalted2e?.charmSource === charm.id).length === 0,
        { timeout: 3000, interval: 50 }
      );

      assert.ok(cleaned, "charm AEs cleaned up within timeout");
    });

    // F11 — buildCharmSynthAEs returns correct AE data for soakBonus
    it("[F11] buildCharmSynthAEs: returns AE data for charm with soakBonus enabled", async function () {
      const { buildCharmSynthAEs } = await import("../../../module/combat/form-charms.mjs");
      const actor = await setupActor();
      const charm = await createFormCharm(actor, { name: "Tiger Form Soak" });
      await charm.update({
        "system.soakBonus.enabled":    true,
        "system.soakBonus.bashing":    3,
        "system.soakBonus.lethal":     2,
        "system.soakBonus.aggravated": 0,
        "system.soakBonus.hardnessAdd": 1
      });

      const result = buildCharmSynthAEs(charm);

      assert.equal(result.length, 1, "returns one AE data object");
      const ae = result[0];
      assert.equal(ae.changes.length, 3, "three changes (aggravated=0 skipped)");
      const keys = ae.changes.map(c => c.key);
      assert.ok(keys.includes("system.bonuses.soakBashing"),   "soakBashing change present");
      assert.ok(keys.includes("system.bonuses.soakLethal"),    "soakLethal change present");
      assert.ok(keys.includes("system.bonuses.hardnessAdd"),   "hardnessAdd change present");
      assert.notOk(keys.includes("system.bonuses.soakAggravated"), "soakAggravated skipped (value 0)");
      const bashingChange = ae.changes.find(c => c.key === "system.bonuses.soakBashing");
      const lethalChange  = ae.changes.find(c => c.key === "system.bonuses.soakLethal");
      const hardnessChange = ae.changes.find(c => c.key === "system.bonuses.hardnessAdd");
      assert.equal(bashingChange.value,  "3", "bashing value is '3'");
      assert.equal(lethalChange.value,   "2", "lethal value is '2'");
      assert.equal(hardnessChange.value, "1", "hardnessAdd value is '1'");
      assert.equal(ae.flags?.exalted2e?.charmSource, charm.id, "charmSource tag set");
    });

    // F12 — applyCharmAEs with statBoost creates correct AE on actor
    it("[F12] applyCharmAEs: statBoost changes applied to actor as AE", async function () {
      const { applyCharmAEs } = await import("../../../module/combat/form-charms.mjs");
      const actor = await setupActor();
      const charm = await createFormCharm(actor, { name: "Strength Form" });
      await charm.update({
        "system.statBoost.enabled": true,
        "system.statBoost.changes": [{ path: "system.attributes.strength.value", value: "2" }]
      });
      const effectsBefore = actor.effects.size;

      await applyCharmAEs(actor, charm, {});

      assert.equal(actor.effects.size, effectsBefore + 1, "one AE added to actor");
      const ae = actor.effects.find(e => e.flags?.exalted2e?.charmSource === charm.id);
      assert.ok(ae, "AE tagged with charmSource = charm.id");
      const change = ae.changes.find(c => c.key === "system.attributes.strength.value");
      assert.ok(change, "change for system.attributes.strength.value present");
      assert.equal(change.value, "2", "change value is '2'");
    });

    // F10 — clearActorForms sweeps all active Forms and removes their AEs
    it("[F10] clearActorForms deactivates all active Forms and removes their AEs", async function () {
      const actor = await setupActor();
      register(actor);
      const charm1 = await createFormCharm(actor, { name: "Form One" });
      const charm2 = await createFormCharm(actor, { name: "Form Two" });
      register(charm1);
      register(charm2);

      // Directly apply AEs and set active to bypass the one-at-a-time guard
      const { applyCharmAEs, clearActorForms } = await import("../../../module/combat/form-charms.mjs");
      await applyCharmAEs(actor, charm1, {});
      await applyCharmAEs(actor, charm2, {});
      await charm1.update({ "system.active": true });
      await charm2.update({ "system.active": true });

      await clearActorForms(actor);

      assert.equal(
        actor.effects.filter(ae => ae.flags?.exalted2e?.charmSource != null).length,
        0,
        "All Form AEs removed"
      );
      const refreshed1 = actor.items.get(charm1.id);
      const refreshed2 = actor.items.get(charm2.id);
      assert.equal(refreshed1?.system?.active, false, "charm1 deactivated");
      assert.equal(refreshed2?.system?.active, false, "charm2 deactivated");
    });

    // F13 — non-Form isToggleable charm with soakBonus: AE tagged charmSource
    it("[F13] activateCharm (non-Form oneScene): soakBonus AE tagged charmSource appears on actor", async function () {
      const actor = await setupActor();
      const charm = await createTempCharm(actor, {
        name:      "Iron Skin Concentration",
        charmType: "simple",
        duration:  "oneScene",
        keywords:  [],
        cost:      {}
      });
      await charm.update({
        "system.soakBonus.enabled":    true,
        "system.soakBonus.bashing":    2,
        "system.soakBonus.lethal":     1,
        "system.soakBonus.aggravated": 0
      });
      await charm.activateCharm({ skipXpConfirm: true });

      assert.equal(charm.system.active, true, "charm.system.active is true after activation");
      const charmAEs = actor.effects.filter(e => e.flags?.exalted2e?.charmSource === charm.id);
      assert.equal(charmAEs.length, 1, "one charmSource AE added to actor");
      const ae = actor.effects.find(e => e.flags?.exalted2e?.charmSource === charm.id);
      assert.ok(ae, "AE tagged with charmSource = charm.id");
      const bashingChange = ae.changes.find(c => c.key === "system.bonuses.soakBashing");
      const lethalChange  = ae.changes.find(c => c.key === "system.bonuses.soakLethal");
      assert.ok(bashingChange, "soakBashing change present on AE");
      assert.equal(bashingChange.value, "2", "soakBashing value is '2'");
      assert.ok(lethalChange, "soakLethal change present on AE");
      assert.equal(lethalChange.value, "1", "soakLethal value is '1'");
    });

    // ── New AE synthesis: output shape ────────────────────────────────────────

    // F14 — dvBonus numeric → ADD changes on bonuses.dodgeBonus / bonuses.parryBonus
    it("[F14] buildCharmSynthAEs: dvBonus numeric produces ADD changes on bonuses.dodgeBonus/parryBonus", async function () {
      const { buildCharmSynthAEs } = await import("../../../module/combat/form-charms.mjs");
      const actor = await setupActor();
      const charm = await createTempCharm(actor, { name: "Iron Skin", charmType: "simple", duration: "oneScene", keywords: [], cost: {} });
      await charm.update({
        "system.dvBonus.enabled":     true,
        "system.dvBonus.dodgeBonus":  3,
        "system.dvBonus.parryBonus":  2
      });

      const result = buildCharmSynthAEs(charm);

      assert.equal(result.length, 1, "returns one AE data object");
      const ae = result[0];
      const keys = ae.changes.map(c => c.key);
      assert.ok(keys.includes("system.bonuses.dodgeBonus"), "dodgeBonus change present");
      assert.ok(keys.includes("system.bonuses.parryBonus"), "parryBonus change present");
      const dodge = ae.changes.find(c => c.key === "system.bonuses.dodgeBonus");
      const parry = ae.changes.find(c => c.key === "system.bonuses.parryBonus");
      assert.equal(dodge.value, "3", "dodgeBonus value is '3'");
      assert.equal(parry.value, "2", "parryBonus value is '2'");
      assert.equal(ae.flags?.exalted2e?.charmSource, charm.id, "charmSource tag set");
    });

    // F15 — dvBonus ignoreAllPenalties → dvBonusIgnore flag on AE
    it("[F15] buildCharmSynthAEs: dvBonus ignoreAllPenalties produces dvBonusIgnore flag", async function () {
      const { buildCharmSynthAEs } = await import("../../../module/combat/form-charms.mjs");
      const actor = await setupActor();
      const charm = await createTempCharm(actor, { name: "Perfect Guard", charmType: "simple", duration: "oneScene", keywords: [], cost: {} });
      await charm.update({
        "system.dvBonus.enabled":             true,
        "system.dvBonus.ignoreAllPenalties":  true
      });

      const result = buildCharmSynthAEs(charm);

      assert.equal(result.length, 1, "returns one AE data object even with no numeric bonus");
      const ae = result[0];
      const ignore = ae.flags?.exalted2e?.dvBonusIgnore;
      assert.ok(ignore, "dvBonusIgnore flag present");
      assert.equal(ignore.all, true, "ignore.all is true");
      assert.deepEqual(ignore.types, [], "ignore.types is empty array");
    });

    // F16 — rateBonus → ADD change on bonuses.rateBonus
    it("[F16] buildCharmSynthAEs: rateBonus produces ADD change on bonuses.rateBonus", async function () {
      const { buildCharmSynthAEs } = await import("../../../module/combat/form-charms.mjs");
      const actor = await setupActor();
      const charm = await createTempCharm(actor, { name: "Flurry Charm", charmType: "simple", duration: "oneScene", keywords: [], cost: {} });
      await charm.update({
        "system.rateBonus.enabled": true,
        "system.rateBonus.formula": "2"
      });

      const result = buildCharmSynthAEs(charm);

      assert.equal(result.length, 1, "returns one AE data object");
      const ae = result[0];
      const change = ae.changes.find(c => c.key === "system.bonuses.rateBonus");
      assert.ok(change, "rateBonus change present");
      assert.equal(change.value, "2", "rateBonus value is '2'");
      assert.equal(change.mode, 2, "mode is ADD (2)");
    });

    // F17 — motePoolBonus personal → ADD change on bonuses.motePersonal
    it("[F17] buildCharmSynthAEs: motePoolBonus personal produces ADD change on bonuses.motePersonal", async function () {
      const { buildCharmSynthAEs } = await import("../../../module/combat/form-charms.mjs");
      const actor = await setupActor();
      const charm = await createTempCharm(actor, { name: "Mote Expansion", charmType: "simple", duration: "oneScene", keywords: [], cost: {} });
      await charm.update({
        "system.motePoolBonus.enabled": true,
        "system.motePoolBonus.pool":    "personal",
        "system.motePoolBonus.amount":  5
      });

      const result = buildCharmSynthAEs(charm);

      assert.equal(result.length, 1, "returns one AE data object");
      const ae = result[0];
      const change = ae.changes.find(c => c.key === "system.bonuses.motePersonal");
      assert.ok(change, "motePersonal change present");
      assert.equal(change.value, "5", "motePersonal value is '5'");
    });

    // F18 — extraActions → extraActionsMax flag on AE
    it("[F18] buildCharmSynthAEs: extraActions produces extraActionsMax flag", async function () {
      const { buildCharmSynthAEs } = await import("../../../module/combat/form-charms.mjs");
      const actor = await setupActor();
      const charm = await createTempCharm(actor, { name: "Extra Action", charmType: "simple", duration: "oneScene", keywords: [], cost: {} });
      await charm.update({
        "system.extraActions.enabled":    true,
        "system.extraActions.maxFormula": "2"
      });

      const result = buildCharmSynthAEs(charm);

      assert.equal(result.length, 1, "returns one AE data object");
      const ae = result[0];
      assert.equal(ae.flags?.exalted2e?.extraActionsMax, 2, "extraActionsMax flag is 2");
      assert.equal(ae.changes.length, 0, "no ADD changes — flag-only AE");
    });

    // F19 — speedModifier → speedModifier flag on AE
    it("[F19] buildCharmSynthAEs: speedModifier produces speedModifier flag", async function () {
      const { buildCharmSynthAEs } = await import("../../../module/combat/form-charms.mjs");
      const actor = await setupActor();
      const charm = await createTempCharm(actor, { name: "Quick Step", charmType: "simple", duration: "oneScene", keywords: [], cost: {} });
      await charm.update({
        "system.speedModifier.enabled": true,
        "system.speedModifier.delta":   -2,
        "system.speedModifier.minimum": 3
      });

      const result = buildCharmSynthAEs(charm);

      assert.equal(result.length, 1, "returns one AE data object");
      const ae = result[0];
      const sm = ae.flags?.exalted2e?.speedModifier;
      assert.ok(sm, "speedModifier flag present");
      assert.equal(sm.delta,   -2, "delta is -2");
      assert.equal(sm.minimum,  3, "minimum is 3");
      assert.equal(ae.changes.length, 0, "no ADD changes — flag-only AE");
    });

    // ── Pipeline integration: AE accumulator reads ────────────────────────────

    // F14 (soak pipeline) — pipeline reads AE accumulator: actor totalSoak reflects charm AE
    it("[F14-soak] pipeline: actor totalSoak.bashing reflects soakBonus AE after activation", async function () {
      this.timeout(6000);
      const actor = await setupActor();
      const charm = await createTempCharm(actor, {
        name:      "Stone Skin Technique",
        charmType: "simple",
        duration:  "oneScene",
        keywords:  [],
        cost:      {}
      });
      await charm.update({
        "system.soakBonus.enabled": true,
        "system.soakBonus.bashing": 3
      });

      const soakBefore = actor.system.totalSoak?.bashing ?? 0;

      await charm.activateCharm({ skipXpConfirm: true });

      const settled = await waitFor(
        () => (actor.system.totalSoak?.bashing ?? 0) >= soakBefore + 3,
        { timeout: 2000, interval: 50 }
      );
      assert.ok(settled, `totalSoak.bashing increased by soakBonus (before=${soakBefore}, after=${actor.system.totalSoak?.bashing ?? 0})`);
    });

    // F20 — motePoolBonus charm raises mote max via accumulator
    it("[F20] pipeline: motePoolBonus charm raises actor mote max after activation", async function () {
      this.timeout(8000);
      const actor = await setupActor();
      const maxBefore = actor.system.motes.peripheral.max;
      const charm = await createTempCharm(actor, {
        name: "Mote Pool", charmType: "simple", duration: "oneScene", keywords: [], cost: {}
      });
      await charm.update({
        "system.motePoolBonus.enabled": true,
        "system.motePoolBonus.pool":    "peripheral",
        "system.motePoolBonus.amount":  4
      });

      await charm.activateCharm({ skipXpConfirm: true });

      const raised = await waitFor(
        () => actor.system.motes.peripheral.max >= maxBefore + 4,
        { timeout: 3000, interval: 50 }
      );
      assert.ok(raised, `peripheral mote max rose by 4 (was ${maxBefore}, now ${actor.system.motes.peripheral.max})`);
    });

    // F21 — rateBonus charm populates bonuses.rateBonus accumulator
    it("[F21] pipeline: rateBonus charm populates system.bonuses.rateBonus after activation", async function () {
      this.timeout(8000);
      const actor = await setupActor();
      const charm = await createTempCharm(actor, {
        name: "Rate Charm", charmType: "simple", duration: "oneScene", keywords: [], cost: {}
      });
      await charm.update({
        "system.rateBonus.enabled": true,
        "system.rateBonus.formula": "3"
      });

      await charm.activateCharm({ skipXpConfirm: true });

      const populated = await waitFor(
        () => (actor.system.bonuses?.rateBonus ?? 0) >= 3,
        { timeout: 3000, interval: 50 }
      );
      assert.ok(populated, `system.bonuses.rateBonus is ${actor.system.bonuses?.rateBonus} (expected ≥ 3)`);
    });

    // F23 — dvBonusIgnore pipeline: DV penalties are ignored when ignoreAllPenalties is active
    it("[F23] pipeline: dvBonusIgnore charm causes currentDodgeDV to ignore DV penalties", async function () {
      this.timeout(10000);
      const actor = await setupActor();

      // Establish a baseline DV with a penalty applied.
      await actor.applyDVPenalty("onslaught", 2, { label: "Test Penalty", sticky: true });
      const dvWithPenalty = await waitFor(
        () => actor.dvPenaltyTotal >= 2 ? actor.currentDodgeDV : false,
        { timeout: 2000, interval: 50 }
      );
      assert.ok(dvWithPenalty !== false, "DV penalty applied — baseline established");
      const dvBefore = actor.currentDodgeDV;

      const charm = await createTempCharm(actor, {
        name: "Iron Skin Ignore", charmType: "simple", duration: "oneScene", keywords: [], cost: {}
      });
      await charm.update({
        "system.dvBonus.enabled":            true,
        "system.dvBonus.ignoreAllPenalties": true
      });

      await charm.activateCharm({ skipXpConfirm: true });

      const ignored = await waitFor(
        () => actor.currentDodgeDV > dvBefore,
        { timeout: 3000, interval: 50 }
      );
      assert.ok(ignored, `currentDodgeDV rose after ignoreAllPenalties activated (was ${dvBefore}, now ${actor.currentDodgeDV})`);
      // With all penalties ignored the DV should equal the raw base (no reduction).
      assert.equal(actor.currentDodgeDV, actor.system.dodgeDV ?? 0,
        "currentDodgeDV equals raw base when all penalties ignored");
    });

    // F22 — dvBonus charm raises currentDodgeDV
    it("[F22] pipeline: dvBonus charm raises currentDodgeDV after activation", async function () {
      this.timeout(8000);
      const actor = await setupActor();
      const dvBefore = actor.currentDodgeDV;

      const charm = await createTempCharm(actor, {
        name: "Dodge Charm", charmType: "simple", duration: "oneScene", keywords: [], cost: {}
      });
      await charm.update({
        "system.dvBonus.enabled":    true,
        "system.dvBonus.dodgeBonus": 2,
        "system.dvPenalty":          0
      });

      await charm.activateCharm({ skipXpConfirm: true });

      const raised = await waitFor(
        () => actor.currentDodgeDV >= dvBefore + 2,
        { timeout: 3000, interval: 50 }
      );
      assert.ok(raised, `currentDodgeDV rose by 2 (was ${dvBefore}, now ${actor.currentDodgeDV})`);
    });
  });
}
