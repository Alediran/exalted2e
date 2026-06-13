/**
 * item-lifecycle.mjs — Item and ActiveEffect lifecycle hook registrations.
 *
 * Extracted from module/exalted2e.mjs. Registered once at top level via
 * registerItemLifecycleHooks(), called from the entry point at the position
 * of the earliest moved hook.
 */

import { ex2eCan } from "../helpers/permissions.mjs";
import { canLearnCelestialMA, canLearnSiderealMA } from "../helpers/ma-validation.mjs";

export function registerItemLifecycleHooks() {

  // When a health-grant charm with multiple options is dropped onto an actor,
  // immediately prompt the player to pick which option applies to this instance.
  Hooks.on("createItem", async (item, _options, userId) => {
    if (userId !== game.user.id) return;
    if (item.type !== "charm") return;
    if (!(item.parent instanceof Actor)) return;
    const hg = item.system?.healthGrant;
    if (!hg?.enabled || (hg.options?.length ?? 0) <= 1) return;

    const rows = hg.options.map((opt, i) => {
      const parts = [
        opt.zero  ? `${opt.zero}×(−0)` : "",
        opt.one   ? `${opt.one}×(−1)`  : "",
        opt.two   ? `${opt.two}×(−2)`  : "",
        opt.dying ? `${opt.dying}×(Inc)` : ""
      ].filter(Boolean).join(", ");
      const label = opt.label ? `<strong>${opt.label}</strong> — ${parts}` : parts;
      return `<label style="display:block;margin:4px 0;cursor:pointer">
      <input type="radio" name="hgChoice" value="${i}" ${i === 0 ? "checked" : ""}> ${label}
    </label>`;
    }).join("");

    const chosen = await foundry.applications.api.DialogV2.wait({
      window:      { title: game.i18n.format("EX2E.HGPickTitle", { name: item.name }) },
      content:     `<div style="padding:8px">${rows}</div>`,
      buttons:     [{
        action:    "confirm",
        label:     game.i18n.localize("EX2E.Confirm"),
        default:   true,
        callback:  (_ev, _btn, dialog) =>
          parseInt(dialog.element.querySelector("input[name=hgChoice]:checked")?.value ?? "0")
      }],
      rejectClose: false
    });

    if (chosen == null) return;
    await item.update({ "system.healthGrant.selectedOption": chosen });
  });

  // When a soak-option charm with multiple configurations is dropped onto an actor,
  // immediately prompt the player to pick which configuration applies to this instance.
  Hooks.on("createItem", async (item, _options, userId) => {
    if (userId !== game.user.id) return;
    if (item.type !== "charm") return;
    if (!(item.parent instanceof Actor)) return;
    const sb = item.system?.soakBonus;
    if (!sb?.enabled || (sb.options?.length ?? 0) <= 1) return;

    const rows = sb.options.map((opt, i) => {
      const parts = [
        opt.bashing     ? `+${opt.bashing}B soak`      : "",
        opt.lethal      ? `+${opt.lethal}L soak`        : "",
        opt.aggravated  ? `+${opt.aggravated}A soak`    : "",
        opt.hardnessAdd ? `+${opt.hardnessAdd} Hardness` : "",
      ].filter(Boolean).join(", ");
      const label = opt.label ? `<strong>${opt.label}</strong> — ${parts}` : parts;
      return `<label style="display:block;margin:4px 0;cursor:pointer">
      <input type="radio" name="sbChoice" value="${i}" ${i === 0 ? "checked" : ""}> ${label}
    </label>`;
    }).join("");

    const chosen = await foundry.applications.api.DialogV2.wait({
      window:      { title: game.i18n.format("EX2E.SoakOptionPickTitle", { name: item.name }) },
      content:     `<div style="padding:8px"><p>${game.i18n.localize("EX2E.SoakOptionPickPrompt")}</p>${rows}</div>`,
      buttons:     [{
        action:    "confirm",
        label:     game.i18n.localize("EX2E.Confirm"),
        default:   true,
        callback:  (_ev, _btn, dialog) =>
          parseInt(dialog.element.querySelector("input[name=sbChoice]:checked")?.value ?? "0")
      }],
      rejectClose: false
    });

    if (chosen == null) return;
    await item.update({ "system.soakBonus.selectedOption": chosen });
  });

  // Gate the deletion of effects flagged `gmOnlyRemoval`. Flaws seeded
  // from the effects compendium (Creature of Darkness and friends) cannot
  // be shaken off by the player on whose sheet they live — only the GM
  // can clear them. `preDelete*` hooks cancel by returning false.
  Hooks.on("preDeleteActiveEffect", (effect, options, userId) => {
    const user = game.users.get(userId);
    if (ex2eCan("protectedEffects", user)) return;
    if (!effect.flags?.exalted2e?.gmOnlyRemoval) return;
    ui.notifications.warn(game.i18n.localize("EX2E.EffectGMOnlyRemoval"));
    return false;
  });

  // Tear down a charm-spawned weapon when its tracking ActiveEffect is
  // deleted — whether that happens because the charm was toggled off, the
  // Effects tab trashed it, or Foundry's duration system expired it. We
  // also flip the charm's `active` back to false so the toggleable state
  // doesn't lie about having live effects.
  Hooks.on("deleteActiveEffect", async (effect, _options, userId) => {
    if (userId !== game.user.id) return;

    // ── Greater Sign deferred permanent cost ─────────────────────────────
    const pc = effect.flags?.exalted2e?.permanentCost;
    if (pc && !effect.flags.exalted2e.reversed) {
      const pcActor = effect.parent;
      if (pcActor) {
        const updates = {};
        if (pc.essence   > 0) updates["system.essence.value"]  = Math.max(1, (pcActor.system.essence?.value  ?? 1) - pc.essence);
        if (pc.willpower > 0) updates["system.willpower.max"]  = Math.max(1, (pcActor.system.willpower?.max  ?? 1) - pc.willpower);
        if (Object.keys(updates).length) await pcActor.update(updates);
        const sourceItemId = effect.flags.exalted2e.sourceItem;
        if (sourceItemId) {
          const item = pcActor.items.get(sourceItemId);
          if (item?.system.active) await item.update({ "system.active": false });
        }
      }
    }

    const charmId = effect.flags?.exalted2e?.charmSource;
    if (!charmId) return;
    const actor = effect.parent;
    if (!actor || !actor.deleteEmbeddedDocuments) return;
    const weaponIds = actor.items
      .filter(i => i.type === "weapon" && i.getFlag("exalted2e", "charmSource") === charmId)
      .map(i => i.id);
    if (weaponIds.length) await actor.deleteEmbeddedDocuments("Item", weaponIds);
    const charm = actor.items.get(charmId);
    if (charm?.system?.active && !charm._isBeingDeleted) await charm.update({ "system.active": false });
  });

  /**
   * When an effect-wrapper item is dropped onto an actor, hijack the
   * creation: spawn the wrapper's embedded ActiveEffects directly on the
   * actor and cancel the item creation itself. Keeps the actor sheet from
   * accumulating bookkeeping "merit/flaw" entries that only exist to
   * carry the real effect payload.
   */
  Hooks.on("preCreateItem", (item, data, options, userId) => {
    if (userId !== game.user.id) return;

    // Assign a stable charmUid on any new charm that doesn't already have
    // one. Fires for both world-level and actor-embedded charms. Imports
    // from a compendium carry the source's uid forward, which is exactly
    // what we want — prereqs stay linked across the copy.
    if (item.type === "charm" && !data.system?.charmUid) {
      item.updateSource({ "system.charmUid": foundry.utils.randomID() });
    }
    // Same treatment for spells so prereq / cross-reference plumbing we add
    // later can rely on a stable id.
    if (item.type === "spell" && !data.system?.spellUid) {
      item.updateSource({ "system.spellUid": foundry.utils.randomID() });
    }

    // ── Heretical charm gate ──────────────────────────────────────────────────
    // Heretical charms are GSP-created and exclusive to Infernal exalts.
    const hereticalParent = item.parent;
    if (item.type === "charm" &&
        hereticalParent instanceof Actor &&
        item.system.keywords?.includes("Heretical") &&
        hereticalParent.system.exaltType !== "infernal") {
      ui.notifications.warn(
        game.i18n.format("EX2E.HereticalCharmForbidden", { name: item.name })
      );
      return false;
    }

    // ── Native charm gate ─────────────────────────────────────────────────────
    // Native charms belong exclusively to their original exalt tradition.
    // Eclipse, Moonshadow, and Fiend castes cannot learn them even at the
    // doubled foreign-charm XP rate.
    const nativeParent = item.parent;
    if (item.type === "charm" &&
        nativeParent instanceof Actor &&
        item.system.keywords?.includes("Native") &&
        ["eclipse", "moonshadow", "fiend"].includes(nativeParent.system.caste)) {
      ui.notifications.warn(
        game.i18n.format("EX2E.NativeCharmForbidden", { name: item.name })
      );
      return false;
    }

    // ── DB Celestial MA gate ──────────────────────────────────────────────────
    // Terrestrial exalts require Celestial MA initiation to learn Celestial
    // Martial Arts charms.
    const celestialMAParent = item.parent;
    if (item.type === "charm" &&
        celestialMAParent instanceof Actor &&
        item.system?.martialArtsTier === "celestial" &&
        celestialMAParent.system?.exaltType === "terrestrial") {
      if (!game.user.isGM && !canLearnCelestialMA(celestialMAParent)) {
        ui.notifications.warn(game.i18n.localize("EX2E.NoDBCelestialMAInitiation"));
        return false;
      }
    }

    // ── Sidereal MA gate ──────────────────────────────────────────────────────
    // Learning a Sidereal Martial Arts charm requires mastery of a Celestial
    // Martial Arts style first.
    const siderealMAParent = item.parent;
    if (item.type === "charm" &&
        siderealMAParent instanceof Actor &&
        item.system?.martialArtsTier === "sidereal") {
      if (!game.user.isGM && !canLearnSiderealMA(siderealMAParent)) {
        ui.notifications.warn(game.i18n.localize("EX2E.NoSiderealMAGate"));
        return false;
      }
    }

    // ── Sorcery / Necromancy initiation gate ─────────────────────────────────
    // Any spell requires a charm that grants initiation at that tradition and
    // circle or higher. This applies to all exalt types — natural access for
    // Solar / Sidereal / Abyssal etc. is represented by them having access to
    // the appropriate initiation charms in the compendium, not by bypassing
    // this check in code.
    const spellParent = item.parent;
    if (item.type === "spell" &&
        spellParent instanceof Actor &&
        spellParent.type === "character") {
      const circle    = item.system.circle    ?? 1;
      const tradition = item.system.tradition ?? "sorcery";
      // system.[tradition].initiation is derived by _applyCharmInitiation — it
      // already reflects any active initiation charm, plus direct DB writes used
      // by tests and macros. Checking the derived value is simpler and covers both.
      const hasInitiation = (spellParent.system?.[tradition]?.initiation ?? 0) >= circle;
      if (!hasInitiation) {
        const tradKey   = `EX2E.Tradition${tradition.charAt(0).toUpperCase()}${tradition.slice(1)}`;
        const tradLabel = game.i18n.localize(tradKey);
        ui.notifications.warn(
          game.i18n.format("EX2E.SpellInitiationRequired", {
            name: item.name,
            tradition: tradLabel,
            circle
          })
        );
        return false;
      }
    }

    // ── Purchase Mode: XP-costing items on locked actors ──────────────────
    // Flag the item so the async createItem hook below can run the
    // confirmation flow. preCreateItem is synchronous; we can't `await`
    // a dialog here, so the item lands with a pending flag and the
    // post-create handler either strips the flag (on confirm) or
    // deletes the item (on cancel). Briefly visible but functional.
    const parentActor = item.parent;
    if (parentActor?.type === "character" &&
        parentActor.system?.purchaseLocked &&
        ["charm", "spell", "knack", "background"].includes(item.type) &&
        !options.exalted2e?.mergedGrant &&
        !(item.system?.mergedIds?.length)) {
      item.updateSource({ "flags.exalted2e.pendingPurchaseConfirm": true });
    }

    // ── Combo UID remap ───────────────────────────────────────────────────────
    // When a combo is imported from a compendium onto an actor that has charms
    // with different UIDs (same names, different source), remap broken UIDs by
    // matching the stored charmNames against the actor's owned charms.
    if (item.type === "combo" && item.parent instanceof Actor) {
      const targetActor = item.parent;
      const uids  = (data.system?.charmUids  ?? []);
      const names = (data.system?.charmNames ?? []);
      if (names.length > 0) {
        const actorUidSet = new Set(
          targetActor.items.filter(i => i.type === "charm")
            .map(i => i.system?.charmUid).filter(Boolean)
        );
        const nameToUid = new Map();
        for (const owned of targetActor.items) {
          if (owned.type !== "charm" || !owned.system?.charmUid) continue;
          nameToUid.set(owned.name.toLowerCase(), owned.system.charmUid);
        }
        const remapped = uids.map((uid, i) => {
          if (actorUidSet.has(uid)) return uid;
          const name = names[i] ?? "";
          return name ? (nameToUid.get(name.toLowerCase()) ?? uid) : uid;
        });
        item.updateSource({ "system.charmUids": remapped });
      }
    }

    const actor = item.parent;
    if (!actor) return;
    const isWrapper = data.flags?.exalted2e?.effectWrapper
                   ?? item.getFlag("exalted2e", "effectWrapper");
    if (!isWrapper) return;

    const effects = (data.effects ?? []).map(e => {
      const clone = foundry.utils.deepClone(e);
      delete clone._id;
      return clone;
    });
    if (effects.length > 0) {
      // Fire-and-forget: preCreate hooks are synchronous. The creation
      // happens off the critical path, and cancelling below prevents the
      // wrapper item itself from ever landing on the actor.
      actor.createEmbeddedDocuments("ActiveEffect", effects);
      const label = game.i18n.localize(item.name ?? "");
      ui.notifications.info(game.i18n.format("EX2E.EffectAppliedFromWrapper", {
        name:  label,
        actor: actor.name
      }));
    }
    return false;
  });

  /**
   * Purchase Mode — post-persist confirmation for XP-costing item
   * additions. The sync preCreateItem hook flagged the item as pending;
   * here we run the async Purchase-confirm dialog and either strip the
   * flag (on confirm + apply XP + log entry) or delete the item outright.
   */
  Hooks.on("createItem", async (item, options, userId) => {
    if (userId !== game.user.id) return;
    if (!item.getFlag("exalted2e", "pendingPurchaseConfirm")) return;
    const parent = item.parent;
    if (!parent) {
      await item.unsetFlag("exalted2e", "pendingPurchaseConfirm");
      return;
    }

    const { PurchaseConfirmDialog } = await import("../dialogs/purchase-confirm-dialog.mjs");
    const { computeXpCost } = await import("../helpers/xp-costs.mjs");

    const change = {
      kind:     "item",
      path:     `item:${item.type}`,
      oldValue: null,
      newValue: null,
      item
    };
    const costResult = computeXpCost(parent, change);
    const result = await PurchaseConfirmDialog.prompt({
      actor:        parent,
      change:       {
        traitLabel: costResult.description,
        oldValue:   "—",
        newValue:   "Added"
      },
      initialXp:    costResult.xp,
      initialNote:  "",
      showStubHint: !costResult.confident,
      description:  costResult.description
    });

    if (result === null) {
      await item.delete();
      return;
    }

    const entry = {
      timestamp:  Date.now(),
      userId:     game.user.id,
      userName:   game.user.name,
      traitPath:  change.path,
      traitLabel: costResult.description,
      oldValue:   "—",
      newValue:   "Added",
      xpCost:     result.xpCost,
      note:       result.note
    };
    await parent.update({
      "system.purchaseLog":      [...(parent.system.purchaseLog ?? []), entry],
      "system.experience.value": (parent.system.experience.value ?? 0) - result.xpCost
    });
    await item.unsetFlag("exalted2e", "pendingPurchaseConfirm");
  });

  // Auto-grant all Merged siblings when any one version of a merged charm is
  // added to an actor. Skips charms the actor already owns and suppresses the
  // XP-purchase confirmation for the automatically added copies.
  Hooks.on("createItem", async (item, options, userId) => {
    if (userId !== game.user.id) return;
    if (item.type !== "charm") return;
    if (options.exalted2e?.mergedGrant) return;
    const actor = item.parent;
    if (!actor || actor.documentName !== "Actor") return;

    const mergedIds = item.system.mergedIds ?? [];
    if (!mergedIds.length) return;

    const existingUids = new Set(
      actor.items.filter(i => i.type === "charm").map(i => i.system.charmUid).filter(Boolean)
    );

    for (const mergedId of mergedIds) {
      if (!mergedId || existingUids.has(mergedId)) continue;
      let sourceDoc = null;
      for (const pack of game.packs.filter(p => p.documentName === "Item")) {
        try { sourceDoc = await pack.getDocument(mergedId); } catch { /* not in this pack */ }
        if (sourceDoc) break;
      }
      if (!sourceDoc) continue;
      await actor.createEmbeddedDocuments("Item", [sourceDoc.toObject()], {
        exalted2e: { mergedGrant: true }
      });
    }
  });

  const _maStyleCreationInFlight = new Set();
  Hooks.on("createItem", async (item, options, userId) => {
    if (userId !== game.user.id) return;
    if (item.type !== "charm") return;
    const styleName = item.system?.martialArtsStyleName;
    if (!styleName || item.system?.ability !== "martialarts") return;
    const actor = item.parent;
    if (!actor || actor.documentName !== "Actor") return;

    const key = `${actor.id}:${styleName}`;
    if (_maStyleCreationInFlight.has(key)) return;
    if (actor.items.some(i => i.type === "martialartsstyle" && i.name === styleName)) return;

    _maStyleCreationInFlight.add(key);
    try {
      let styleSource = null;
      for (const pack of game.packs) {
        if (pack.documentName !== "Item") continue;
        const index = await pack.getIndex({ fields: ["name", "type"] });
        const entry = index.find(e => e.type === "martialartsstyle" && e.name === styleName);
        if (entry) {
          const doc = await pack.getDocument(entry._id);
          styleSource = doc.toObject();
          delete styleSource._id;
          break;
        }
      }

      if (!styleSource) {
        styleSource = {
          name:   styleName,
          type:   "martialartsstyle",
          system: {
            tier: item.system.martialArtsTier || "terrestrial"
          }
        };
      }

      await actor.createEmbeddedDocuments("Item", [styleSource]);
    } finally {
      _maStyleCreationInFlight.delete(key);
    }
  });

  // Gate deletion of items flagged `gmOnlyRemoval` — mirrors preDeleteActiveEffect.
  Hooks.on("preDeleteItem", (item, options, userId) => {
    const user = game.users.get(userId);
    if (ex2eCan("protectedEffects", user)) return;
    if (!item.flags?.exalted2e?.gmOnlyRemoval) return;
    ui.notifications.warn(game.i18n.localize("EX2E.ItemGMOnlyRemoval"));
    return false;
  });

  /**
   * Purchase Mode — block deletion of XP-costing items while the owning
   * actor is locked. GM toggles the lock off to remove items intentionally.
   */
  Hooks.on("preDeleteItem", (item, options, userId) => {
    if (userId !== game.user.id) return;
    const parent = item.parent;
    if (parent?.type !== "character") return;
    if (!parent.system?.purchaseLocked) return;
    if (!["charm", "spell", "knack", "background"].includes(item.type)) return;
    // Allow deletion of items still awaiting purchase confirmation —
    // this is the cancellation cleanup fired by the createItem hook,
    // not a user-initiated delete from the sheet.
    if (item.getFlag("exalted2e", "pendingPurchaseConfirm")) return;
    ui.notifications.warn(game.i18n.format("EX2E.PurchaseLockedItemDelete", {
      item: item.name
    }));
    return false;
  });

  // ── Resplendent Destiny — auto-end when Endurance reaches 0 ─────────────────
  // Mirrors the Gremlin / Limit-Break detection hooks. Dropping a worn
  // resplendent destiny's Endurance to 0 ends it: flag ended, shuck, remove the
  // identity AE, notify. Raising Endurance above 0 clears the guard.
  Hooks.on("updateItem", async (item, changes, _options, userId) => {
    if (game.user.id !== userId) return;
    if (item.type !== "destiny" || item.system.destinyType !== "resplendent") return;

    const newEndurance = foundry.utils.getProperty(changes, "system.endurance.value");
    if (newEndurance === undefined) return;

    const { _resplendentEndPending, removeIdentityAE, removeResplendencyEffects } =
      await import("../combat/resplendent-destiny.mjs");

    if (newEndurance > 0) { _resplendentEndPending.delete(item.id); return; }
    if (item.system.ended) return;
    if (_resplendentEndPending.has(item.id)) return;
    _resplendentEndPending.add(item.id);
    try {
      const actor = item.parent;
      await item.update({ "system.ended": true, "system.worn": false });
      if (actor) {
        await removeIdentityAE(actor, item.id);
        // Resplendency powers function only while the cover is worn — clear any
        // stat-bonus AEs stamped by this destiny's resplendencies.
        await removeResplendencyEffects(actor, { destinyId: item.id });
      }
      await ChatMessage.create({
        content: game.i18n.format("EX2E.ResplendentEndedChat", { identity: item.system.identity || item.name }),
        speaker: actor ? ChatMessage.getSpeaker({ actor }) : undefined,
      });
    } catch (err) {
      _resplendentEndPending.delete(item.id);
      throw err;
    }
  });

}
