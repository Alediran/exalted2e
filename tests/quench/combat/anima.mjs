import { register, sweep }       from "../_helpers/cleanup.mjs";
import { assertTestWorld }         from "../_helpers/world.mjs";
import { createTempCharacter }     from "../_helpers/actors.mjs";

async function waitFor(predicate, { timeoutMs = 2000, intervalMs = 25 } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const ok = await predicate();
    if (ok) return ok;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor: predicate never returned truthy within ${timeoutMs}ms`);
}

function findFluxCard(actorId) {
  return Array.from(game.messages.values()).reverse()
    .find(m => m.flags?.exalted2e?.dbFlux?.actorId === actorId) ?? null;
}

export function registerAnima(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("Anima Banner system", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    // ── scenePeripheral increment rules ──────────────────────────────────────

    it("[158] peripheral spend increments scenePeripheral by the drawn amount", async () => {
      const actor = await createTempCharacter({ name: "Q-Anima-PeriSpend" });
      await actor.update({
        "system.exaltType":                "solar",
        "system.essence.value":            2,
        "system.motes.peripheral.value":   33,
        "system.motes.peripheral.max":     33,
        "system.scenePeripheral":          0
      });
      await actor.spendMotes(5, "peripheral");
      assert.equal(actor.system.scenePeripheral, 5, "scenePeripheral incremented by 5");
    });

    it("[159] pure personal spend with no overflow does not increment scenePeripheral", async () => {
      const actor = await createTempCharacter({ name: "Q-Anima-PurePersonal" });
      await actor.update({
        "system.exaltType":              "solar",
        "system.essence.value":          2,
        "system.motes.personal.value":   10,
        "system.motes.personal.max":     10,
        "system.scenePeripheral":        0
      });
      await actor.spendMotes(3, "personal");
      assert.equal(actor.system.scenePeripheral, 0, "pure personal spend: no scenePeripheral change");
    });

    it("[160] personal spend that overflows to peripheral increments scenePeripheral by overflow only", async () => {
      const actor = await createTempCharacter({ name: "Q-Anima-Overflow" });
      await actor.update({
        "system.exaltType":              "solar",
        "system.essence.value":          2,
        "system.motes.personal.value":   2,
        "system.motes.personal.max":     13,
        "system.motes.peripheral.value": 33,
        "system.motes.peripheral.max":   33,
        "system.scenePeripheral":        0
      });
      // spend 5 personal: 2 from personal, 3 overflow to peripheral
      await actor.spendMotes(5, "personal");
      assert.equal(actor.system.scenePeripheral, 3, "scenePeripheral incremented by overflow amount (3)");
    });

    // ── Tier derivation ──────────────────────────────────────────────────────

    it("[161] anima tier resolves correctly for each spend threshold", async () => {
      const actor = await createTempCharacter({ name: "Q-Anima-Tiers" });
      await actor.update({ "system.exaltType": "solar" });

      await actor.update({ "system.scenePeripheral": 0 });
      assert.equal(actor.system.anima, "none",    "sp=0  → none");

      await actor.update({ "system.scenePeripheral": 1 });
      assert.equal(actor.system.anima, "dim",     "sp=1  → dim");

      await actor.update({ "system.scenePeripheral": 4 });
      assert.equal(actor.system.anima, "glowing", "sp=4  → glowing");

      await actor.update({ "system.scenePeripheral": 8 });
      assert.equal(actor.system.anima, "burning", "sp=8  → burning");

      await actor.update({ "system.scenePeripheral": 11 });
      assert.equal(actor.system.anima, "bonfire", "sp=11 → bonfire");

      await actor.update({ "system.scenePeripheral": 16 });
      assert.equal(actor.system.anima, "totemic", "sp=16 → totemic");
    });

    it("[162] mortal actor always resolves to 'none' regardless of scenePeripheral", async () => {
      const actor = await createTempCharacter({ name: "Q-Anima-Mortal" });
      await actor.update({ "system.exaltType": "mortal", "system.scenePeripheral": 20 });
      assert.equal(actor.system.anima, "none", "mortal stays at none even at sp=20");
    });

    // ── endCombat reset ──────────────────────────────────────────────────────

    it("[163] endCombat scene-change fade: Burning → Glowing, Glowing → Dim", async () => {
      const a1 = await createTempCharacter({ name: "Q-Anima-EndC-1" });
      const a2 = await createTempCharacter({ name: "Q-Anima-EndC-2" });
      await a1.update({ "system.exaltType": "solar", "system.scenePeripheral": 10 });
      await a2.update({ "system.exaltType": "solar", "system.scenePeripheral": 5  });
      const combat = await Combat.create({ scene: game.scenes.active?.id });
      register(combat);
      await combat.createEmbeddedDocuments("Combatant", [
        { actorId: a1.id },
        { actorId: a2.id },
      ]);
      // super.endCombat() shows an "End Encounter?" confirm dialog; auto-confirm it.
      const DV2 = foundry.applications.api.DialogV2;
      const origConfirm = DV2.confirm.bind(DV2);
      DV2.confirm = () => Promise.resolve(true);
      try {
        await combat.endCombat();
      } finally {
        DV2.confirm = origConfirm;
      }
      assert.equal(a1.system.scenePeripheral, 7, "a1 faded from Burning (10) to Glowing (7)");
      assert.equal(a2.system.scenePeripheral, 3, "a2 faded from Glowing (5) to Dim (3)");
    });

    it("[164] endCombat scene-change fade: Bonfire and Totemic both land at Burning", async () => {
      const a1 = await createTempCharacter({ name: "Q-Fade-Bonfire" });
      const a2 = await createTempCharacter({ name: "Q-Fade-Totemic" });
      await a1.update({ "system.exaltType": "solar", "system.scenePeripheral": 12 });
      await a2.update({ "system.exaltType": "solar", "system.scenePeripheral": 20 });
      const combat = await Combat.create({ scene: game.scenes.active?.id });
      register(combat);
      await combat.createEmbeddedDocuments("Combatant", [
        { actorId: a1.id },
        { actorId: a2.id },
      ]);
      const DV2 = foundry.applications.api.DialogV2;
      const origConfirm = DV2.confirm.bind(DV2);
      DV2.confirm = () => Promise.resolve(true);
      try {
        await combat.endCombat();
      } finally {
        DV2.confirm = origConfirm;
      }
      assert.equal(a1.system.scenePeripheral, 10, "Bonfire (sp=12) → Burning (sp=10)");
      assert.equal(a2.system.scenePeripheral, 10, "Totemic (sp=20) → Burning (sp=10)");
    });

    it("[165] endCombat scene-change fade: Dim is unchanged", async () => {
      const actor = await createTempCharacter({ name: "Q-Fade-Dim" });
      await actor.update({ "system.exaltType": "solar", "system.scenePeripheral": 2 });
      const combat = await Combat.create({ scene: game.scenes.active?.id });
      register(combat);
      await combat.createEmbeddedDocuments("Combatant", [{ actorId: actor.id }]);
      const DV2 = foundry.applications.api.DialogV2;
      const origConfirm = DV2.confirm.bind(DV2);
      DV2.confirm = () => Promise.resolve(true);
      try {
        await combat.endCombat();
      } finally {
        DV2.confirm = origConfirm;
      }
      assert.equal(actor.system.scenePeripheral, 2, "Dim (sp=2) stays at 2");
    });

    it("[166] Totemic drops to Bonfire on Finish Turn when no peripheral spent", async () => {
      const actor = await createTempCharacter({ name: "Q-Fade-TotNoSpend" });
      await actor.update({
        "system.exaltType":              "solar",
        "system.essence.value":          5,
        "system.motes.peripheral.value": 30,
        "system.scenePeripheral":        16
      });
      const combat = await Combat.create({ scene: game.scenes.active?.id });
      register(combat);
      await combat.createEmbeddedDocuments("Combatant", [{ actorId: actor.id }]);
      // startCombat stamps peripheralAtActionStart = 16 on the first combatant.
      await combat.startCombat();
      await combat.advanceCurrentByTicks(5);
      assert.equal(actor.system.scenePeripheral, 15, "sp dropped from Totemic (16) to Bonfire (15)");
    });

    it("[167] Totemic stays when peripheral is spent during the action", async () => {
      const actor = await createTempCharacter({ name: "Q-Fade-TotSpend" });
      await actor.update({
        "system.exaltType":              "solar",
        "system.essence.value":          5,
        "system.motes.peripheral.value": 30,
        "system.scenePeripheral":        16
      });
      const combat = await Combat.create({ scene: game.scenes.active?.id });
      register(combat);
      await combat.createEmbeddedDocuments("Combatant", [{ actorId: actor.id }]);
      // startCombat stamps peripheralAtActionStart = 16.
      await combat.startCombat();
      // Spend 3 peripheral → scenePeripheral rises to 19 (> startSp of 16).
      await actor.spendMotes(3, "peripheral");
      assert.equal(actor.system.scenePeripheral, 19, "peripheral spend raised sp to 19");
      await combat.advanceCurrentByTicks(5);
      assert.equal(actor.system.scenePeripheral, 19, "sp stays at 19 — Totemic not dropped");
    });

    // ── DB Flux card detection ────────────────────────────────────────────────

    it("[168] DB flux card is posted when a terrestrial spend crosses into burning", async () => {
      const actor = await createTempCharacter({ name: "Q-Anima-Flux-Burn" });
      await actor.update({
        "system.exaltType":              "terrestrial",
        "system.essence.value":          3,
        "system.motes.peripheral.value": 33,
        "system.motes.peripheral.max":   33,
        "system.scenePeripheral":        7
      });
      const startCount = game.messages.size;
      await actor.update(
        { "system.scenePeripheral": 8 },
        { scenePeripheralBefore: 7 }
      );
      await waitFor(() => game.messages.size > startCount);
      const msg = findFluxCard(actor.id);
      assert.ok(msg, "flux card posted");
      register(msg);
      assert.equal(msg.flags.exalted2e.dbFlux.tier, "burning", "tier is burning");
    });

    it("[169] DB flux card posts again on bonfire entry and again on totemic entry", async () => {
      const actor = await createTempCharacter({ name: "Q-Anima-Flux-Scale" });
      await actor.update(
        { "system.exaltType": "terrestrial", "system.essence.value": 3, "system.scenePeripheral": 10 },
        { scenePeripheralBefore: 10 }
      );

      // bonfire transition
      const countBefore = game.messages.size;
      await actor.update(
        { "system.scenePeripheral": 11 },
        { scenePeripheralBefore: 10 }
      );
      await waitFor(() => game.messages.size > countBefore);
      const bonfireMsg = findFluxCard(actor.id);
      assert.ok(bonfireMsg, "bonfire card posted");
      register(bonfireMsg);
      assert.equal(bonfireMsg.flags.exalted2e.dbFlux.tier, "bonfire", "bonfire card tier");

      // totemic transition
      const countBeforeT = game.messages.size;
      await actor.update(
        { "system.scenePeripheral": 16 },
        { scenePeripheralBefore: 11 }
      );
      await waitFor(() => game.messages.size > countBeforeT);
      const totemicMsg = findFluxCard(actor.id);
      assert.ok(totemicMsg, "totemic card posted");
      register(totemicMsg);
      assert.equal(totemicMsg.flags.exalted2e.dbFlux.tier, "totemic", "totemic card tier");
    });

    it("[170] non-terrestrial at same spend values does NOT receive a flux card", async () => {
      const actor = await createTempCharacter({ name: "Q-Anima-Flux-Solar" });
      await actor.update({
        "system.exaltType":    "solar",
        "system.scenePeripheral": 7
      });
      const startCount = game.messages.size;
      await actor.update(
        { "system.scenePeripheral": 8 },
        { scenePeripheralBefore: 7 }
      );
      await new Promise(r => setTimeout(r, 150));
      assert.equal(game.messages.size, startCount, "no flux card for solar");
    });

  });
}
