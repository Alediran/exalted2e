import { sweep }               from "../_helpers/cleanup.mjs";
import { assertTestWorld }     from "../_helpers/world.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";
import { runMigrations }       from "../../../module/migration/runner.mjs";

const SCOPE   = "exalted2e";
const SETTING = "systemMigrationVersion";

export function registerMigrationRunner(context) {
  const { describe, it, assert, before, beforeEach, afterEach } = context;

  describe("Migration runner", () => {
    let origVersion;
    let origConfirm;

    before(() => {
      assertTestWorld();
      origVersion = game.settings.get(SCOPE, SETTING);
    });

    // Auto-confirm the backup dialog, restoring it after every test so the
    // stub never leaks out of this batch.
    beforeEach(() => {
      origConfirm = foundry.applications.api.DialogV2.confirm;
      foundry.applications.api.DialogV2.confirm = async () => true;
    });

    afterEach(async () => {
      foundry.applications.api.DialogV2.confirm = origConfirm;
      await sweep();
      await game.settings.set(SCOPE, SETTING, origVersion);
    });

    it("[MIG-1] back-fills unarmed + charm uid and bumps the version", async () => {
      // Stored version older than the baseline step so it runs.
      await game.settings.set(SCOPE, SETTING, "1.0.0");

      // createTempCharacter auto-registers the actor for cleanup via sweep().
      const actor = await createTempCharacter({ name: "Q-Migration-Actor" });

      // createTempCharacter seeds an unarmed weapon — delete it to recreate the stale state.
      const unarmed = actor.items.filter(i => i.type === "weapon" && i.getFlag("exalted2e", "unarmed"));
      if (unarmed.length) await actor.deleteEmbeddedDocuments("Item", unarmed.map(i => i.id));

      // A charm with no charmUid. The preCreateItem hook auto-assigns a
      // charmUid on creation, so clear it afterwards to recreate the
      // pre-pipeline stale state the migration is meant to fix.
      const [charm] = await actor.createEmbeddedDocuments("Item", [{ name: "Q-Mig-Charm", type: "charm" }]);
      await charm.update({ "system.charmUid": "" });

      const result = await runMigrations();

      assert.isTrue(result.migrated, "migration reported success");
      assert.equal(game.settings.get(SCOPE, SETTING), game.system.version, "version bumped to current");
      assert.isTrue(
        actor.items.some(i => i.type === "weapon" && i.getFlag("exalted2e", "unarmed")),
        "unarmed weapon was back-filled");
      assert.ok(actor.items.get(charm.id)?.system.charmUid, "charm received a charmUid");
    });

    it("[MIG-2] no-op when already at current version", async () => {
      await game.settings.set(SCOPE, SETTING, game.system.version);
      const result = await runMigrations();
      assert.isFalse(result.migrated, "nothing migrated");
      assert.equal(result.reason, "up-to-date", "reason is up-to-date");
    });
  });
}
