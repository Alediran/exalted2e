import { MIGRATIONS } from "./migrations.mjs";
import { unarmedWeaponData } from "./unarmed-weapon.mjs";

/**
 * Migration runner. The version helpers below are pure (Vitest-tested);
 * runMigrations() (at the bottom) is the Foundry-bound orchestrator.
 */

/** Pure semver "a strictly newer than b" (x.y.z; missing parts = 0). */
export function isNewerVersion(a, b) {
  const pa = String(a ?? "0").split(".").map(n => parseInt(n, 10) || 0);
  const pb = String(b ?? "0").split(".").map(n => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

/**
 * Steps whose version is newer than `stored` and not newer than `current`,
 * sorted ascending. Empty/falsy `stored` is treated as "0" so pre-pipeline
 * worlds run the baseline.
 */
export function selectPendingMigrations(stored, current, migrations) {
  const from = stored || "0";
  return migrations
    .filter(m => isNewerVersion(m.version, from) && !isNewerVersion(m.version, current))
    .sort((a, b) => {
      if (isNewerVersion(a.version, b.version)) return 1;
      if (isNewerVersion(b.version, a.version)) return -1;
      return 0;
    });
}

const SCOPE = "exalted2e";
const SETTING = "systemMigrationVersion";

/** Apply one step's `item` transform to a single Item document. */
async function _migrateItemDoc(item, step, failures) {
  try {
    if (!step.item) return;
    const update = step.item(item);
    if (update) await item.update(update);
  } catch (err) {
    console.error(`[exalted2e migration] item ${item?.name} (${item?.id}) failed`, err);
    failures.push({ store: "item", id: item?.id, err });
  }
}

/** Apply one step to a single Actor document (its `actor` signal + owned items). */
async function _migrateActorDoc(actor, step, failures) {
  try {
    if (step.actor) {
      const signal = step.actor(actor);
      if (signal?.createUnarmed) {
        await actor.createEmbeddedDocuments("Item", [unarmedWeaponData()]);
      }
    }
    if (step.item) {
      const updates = [];
      for (const item of actor.items) {
        const update = step.item(item);
        if (update) updates.push({ _id: item.id, ...update });
      }
      if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
    }
  } catch (err) {
    console.error(`[exalted2e migration] actor ${actor?.name} (${actor?.id}) failed`, err);
    failures.push({ store: "actor", id: actor?.id, err });
  }
}

/** Sweep all four stores for a single migration step. */
async function _applyStep(step, failures) {
  for (const actor of game.actors) {
    await _migrateActorDoc(actor, step, failures);
  }
  for (const item of game.items) {
    await _migrateItemDoc(item, step, failures);
  }
  for (const scene of game.scenes) {
    for (const token of scene.tokens) {
      if (token.actorLink) continue;
      const actor = token.actor;
      if (actor) await _migrateActorDoc(actor, step, failures);
    }
  }
  for (const pack of game.packs) {
    if (pack.metadata.packageType !== "world") continue;
    if (pack.metadata.type !== "Actor" && pack.metadata.type !== "Item") continue;
    const wasLocked = pack.locked;
    try {
      if (wasLocked) await pack.configure({ locked: false });
      const docs = await pack.getDocuments();
      for (const doc of docs) {
        if (pack.metadata.type === "Actor") await _migrateActorDoc(doc, step, failures);
        else await _migrateItemDoc(doc, step, failures);
      }
    } catch (err) {
      // Per-pack isolation, mirroring the per-document guards: one bad pack
      // never aborts the whole sweep.
      console.error(`[exalted2e migration] pack ${pack.metadata.name} failed`, err);
      failures.push({ store: "pack", id: pack.metadata.name, err });
    } finally {
      if (wasLocked) await pack.configure({ locked: true });
    }
  }
}

/**
 * Run all pending migrations forward-only. GM-only (caller guards). Bumps
 * systemMigrationVersion only on a fully clean sweep; otherwise leaves it so
 * the run retries next load.
 */
export async function runMigrations() {
  const stored  = game.settings.get(SCOPE, SETTING);
  const current = game.system.version;

  // Fresh world: nothing to migrate, just stamp the current version.
  if (!stored && game.actors.size === 0 && game.items.size === 0 && game.scenes.size === 0) {
    await game.settings.set(SCOPE, SETTING, current);
    return { migrated: false, reason: "fresh-world" };
  }

  const pending = selectPendingMigrations(stored, current, MIGRATIONS);
  if (pending.length === 0) return { migrated: false, reason: "up-to-date" };

  const proceed = await foundry.applications.api.DialogV2.confirm({
    window:  { title: game.i18n.localize("EX2E.Migration.BackupTitle") },
    content: `<p>${game.i18n.localize("EX2E.Migration.BackupBody")}</p>`,
  });
  if (!proceed) return { migrated: false, reason: "declined" };

  const notif = ui.notifications.info(game.i18n.localize("EX2E.Migration.Running"), { permanent: true });
  const failures = [];

  try {
    for (const step of pending) await _applyStep(step, failures);
  } catch (err) {
    if (notif != null) ui.notifications.remove?.(notif);
    console.error("[exalted2e migration] run aborted", err);
    ui.notifications.error(game.i18n.localize("EX2E.Migration.Failed"));
    return { migrated: false, reason: "error", error: err };
  }

  if (notif != null) ui.notifications.remove?.(notif);

  if (failures.length > 0) {
    console.warn(`[exalted2e migration] completed with ${failures.length} issue(s)`, failures);
    ui.notifications.warn(game.i18n.format("EX2E.Migration.Issues", { count: failures.length }));
    return { migrated: false, reason: "issues", failures };
  }

  await game.settings.set(SCOPE, SETTING, current);
  console.log(`[exalted2e migration] migrated ${stored || "(none)"} -> ${current}`);
  ui.notifications.info(game.i18n.localize("EX2E.Migration.Complete"));
  return { migrated: true, version: current };
}
