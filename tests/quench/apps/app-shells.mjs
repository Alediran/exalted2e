import { register, sweep }       from "../_helpers/cleanup.mjs";
import { assertTestWorld }       from "../_helpers/world.mjs";
import { createTempCharacter }   from "../_helpers/actors.mjs";

import { MassCombatActionDialog } from "../../../module/apps/mass-combat-action-dialog.mjs";
import { ImportDialog }           from "../../../module/apps/import-dialog.mjs";
import { HeroMassCombatDialog }   from "../../../module/apps/hero-mass-combat-dialog.mjs";
import { JoinWarDialog }          from "../../../module/apps/join-war-dialog.mjs";

async function waitFor(predicate, { timeoutMs = 8000, intervalMs = 50 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await predicate();
    if (ok) return ok;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor: predicate never returned truthy within ${timeoutMs}ms`);
}

async function smokeRender(dlg, assert, label) {
  await dlg.render(true);
  await waitFor(() => dlg.rendered && !!dlg.element);
  try {
    assert.ok(dlg.element, `[APP] ${label} rendered an element`);
  } finally {
    await dlg.close();
  }
}

async function makeUnit() {
  const actor = await Actor.create({ name: "Q-APP-unit", type: "unit" });
  return register(actor);
}

export function registerAppShells(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("App shells (render)", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[APP] mass-combat-action renders", async () => {
      const unitActor = await makeUnit();
      await smokeRender(new MassCombatActionDialog({ unitActor }, () => {}), assert, "mass-combat-action");
    });

    it("[APP] import (item) renders", async () => {
      await smokeRender(new ImportDialog("item"), assert, "import-item");
    });

    it("[APP] import (actor) renders", async () => {
      await smokeRender(new ImportDialog("actor"), assert, "import-actor");
    });

    it("[APP] hero-mass-combat renders", async () => {
      const heroActor = await createTempCharacter({ name: "Q-APP-hero" });
      await smokeRender(new HeroMassCombatDialog({ heroActor }, () => {}), assert, "hero-mass-combat");
    });

    it("[APP] join-war renders", async () => {
      const unitActor = await makeUnit();
      await smokeRender(new JoinWarDialog({ combatant: { actor: unitActor }, combat: {} }, () => {}), assert, "join-war");
    });
  });
}
