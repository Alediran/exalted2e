import { normalizeCost } from "../rolls/activation-ledger.mjs";
import { buildCharmWeaponData } from "./charm-weapon-data.mjs";

/**
 * ExaltedItem – extends the base Foundry Item document.
 */
export class ExaltedItem extends Item {

  /** @override */
  prepareData() {
    super.prepareData();
  }

  /** @override */
  prepareDerivedData() {
    super.prepareDerivedData();
  }

  /**
   * Apply attunement-commitment deltas to the parent character's peripheral
   * pool when the `attuned` flag or `attunementCost` changes on an artifact.
   * Attuning moves motes out of `value` (they become committed); un-attuning
   * returns them (capped at max).
   */
  async _preUpdate(changed, options, user) {
    await super._preUpdate(changed, options, user);
    const actor = this.actor;
    if (!actor || actor.type !== "character") return;
    if (this.type !== "weapon" && this.type !== "armor") return;
    if (!this.system.artifact) return;

    const oldAttuned = this.system.attuned ?? false;
    const newAttuned = changed.system?.attuned ?? oldAttuned;
    const oldCost    = this.system.attunementCost ?? 0;
    const newCost    = changed.system?.attunementCost ?? oldCost;

    const oldCommit  = oldAttuned ? oldCost : 0;
    const newCommit  = newAttuned ? newCost : 0;
    const delta      = newCommit - oldCommit;
    if (delta === 0) return;

    const pool     = actor.system.motes.peripheral;
    const newValue = Math.min(pool.max ?? 0, Math.max(0, (pool.value ?? 0) - delta));
    await actor.update({ "system.motes.peripheral.value": newValue });
  }

  /**
   * Block deletion of the system-managed Unarmed Attacks weapon, and return
   * committed motes to the pool if an attuned artifact is deleted.
   */
  async _preDelete(options, user) {
    // The Unarmed Attacks weapon is part of every character by design —
    // refuse to delete it regardless of who triggered the delete.
    if (this.type === "weapon" && this.getFlag("exalted2e", "unarmed")) {
      ui.notifications.warn(game.i18n.localize("EX2E.CannotRemoveUnarmed"));
      return false;
    }
    await super._preDelete(options, user);
    // Deleting a charm that spawned weapon artifacts: tear them down too
    // so we don't leave orphaned weapons equipped on the actor.
    if (this.type === "charm" && this.system?.attack?.enabled && this.actor) {
      await this._removeCharmWeaponArtifacts();
    }
    // Form item deletion: if this form is the actor's active form or
    // designated spirit shape, null the dangling reference so the sheet
    // doesn't show a broken link.
    if (this.type === "form" && this.actor?.type === "character") {
      const sys = this.actor.system.splat?.lunar;
      const updates = {};
      if (sys?.activeFormId === this.id)      updates["system.splat.lunar.activeFormId"]      = "";
      if (sys?.spiritShapeFormId === this.id) updates["system.splat.lunar.spiritShapeFormId"] = "";
      if (Object.keys(updates).length) await this.actor.update(updates);
    }
    const actor = this.actor;
    if (!actor || actor.type !== "character") return;
    if (this.type !== "weapon" && this.type !== "armor") return;
    if (!(this.system.artifact && this.system.attuned)) return;

    const cost = this.system.attunementCost ?? 0;
    if (cost <= 0) return;

    const pool     = actor.system.motes.peripheral;
    const newValue = Math.min(pool.max ?? 0, (pool.value ?? 0) + cost);
    await actor.update({ "system.motes.peripheral.value": newValue });
  }

  // ── Charm Helpers ──────────────────────────────────────────────────────

  /**
   * Activate this charm on the owning actor, spending motes as required.
   *
   * @param {object}  [opts]
   * @param {boolean} [opts.skipXpConfirm=false] Suppress the XP confirmation
   *     dialog — Combo activation funnels the total XP into a single
   *     up-front confirm, so per-charm confirms would be double-prompting.
   * @param {string}  [opts.via=null] Diagnostic tag stamped into the
   *     activation ledger (`ledger.via`). Currently only "combo" is used;
   *     reserved for a possible future consolidated-Reverse path.
   * @returns {Promise<boolean>} true if activation succeeded.
   */
  async activateCharm({ skipXpConfirm = false, via = null } = {}) {
    if (this.type !== "charm") return false;
    const actor = this.actor;
    if (!actor) return false;

    const isToggleable = ["oneScene", "indefinite"].includes(this.system.duration);
    const turningOff   = isToggleable && this.system.active;

    if (this.system.isSubmodule && !this.system.effectivelyActive && !turningOff) {
      ui.notifications.warn(game.i18n.localize("EX2E.SubmoduleNotActive"));
      return false;
    }

    const sys      = this.system;
    const cost     = sys.cost ?? {};
    const motePool = "peripheral";  // default pool; chosen at activation time
    // isToggleable and turningOff are already declared above

    // Soft prerequisite check: warn (non-blocking) if any prereq group has
    // no satisfying owned charm. Homebrew / house-rule builds can always
    // activate regardless, so this is informational, not gating.
    if (!turningOff) {
      const { evaluateCharmPrereqs } = await import("../helpers/charm-prereqs.mjs");
      const report = evaluateCharmPrereqs(this, actor);
      const missing = report.filter(r => !r.satisfied);
      if (missing.length > 0) {
        const missingLabels = missing.map(m => m.label || "?").join("; ");
        ui.notifications.warn(game.i18n.format("EX2E.PrereqMissingToast", {
          charm:   this.name,
          missing: missingLabels
        }));
      }
    }

    // Spend all resource costs up front. Shared with castSpell() so both
    // paths use the same resolution order + XP confirmation + ledger shape.
    // When turning a sustained charm OFF, we skip spending entirely — the
    // original commit already paid its costs, and toggling back off is
    // a free action.
    let ledger;
    if (turningOff) {
      ledger = {
        moteBreakdown: null, willpower: 0, bashing: 0, lethal: 0,
        aggravated: 0, xp: 0,
        toggledOn: false, toggledOff: false,
        spawnedWeapon: false, rolledInstant: false,
        via
      };
    } else {
      ledger = await this._spendActivationCosts(cost, { motePool, skipXpConfirm });
      if (!ledger) return false;
      // Charm-specific ledger flags that _spendActivationCosts doesn't know
      // about live alongside the shared ones.
      ledger.toggledOn     = false;
      ledger.toggledOff    = false;
      ledger.spawnedWeapon = false;
      ledger.rolledInstant = false;
      ledger.via           = via;
    }

    // Weapon-like attack side effects — only when the Attack tab is enabled.
    if (sys.attack?.enabled) {
      if (turningOff) {
        await this._removeCharmWeaponArtifacts();
      } else if (sys.duration === "instant") {
        // Fire the attack roll right now using a transient weapon. The
        // attack card snapshots stats, so deleting the temp weapon
        // afterwards doesn't affect downstream resolution.
        await this._rollCharmInstantAttack();
        ledger.rolledInstant = true;
      } else {
        await this._spawnCharmWeaponArtifacts();
        ledger.spawnedWeapon = true;
      }
    }

    // Toggle active state for sustained Charms
    if (isToggleable) {
      await this.update({ "system.active": !sys.active });
      ledger.toggledOn  = !turningOff;
      ledger.toggledOff = turningOff;
    }

    // Send to chat with the activation ledger stamped on the message so
    // the Reverse button (added in item-card.hbs) can undo everything.
    await this.sendToChat({ activation: ledger });
    return true;
  }

  /**
   * Cast this spell on the owning actor: soft-check initiation against the
   * spell's circle, spend motes / willpower / health / XP via the shared
   * activation ledger, and post the chat card with a Reverse button.
   *
   * Initiation is informational only — a toast fires when the caster's
   * initiation is below the spell's circle, but casting continues
   * (homebrew / rules-of-cool, and matches the prereq soft-warn pattern).
   *
   * @deprecated The system's UI now routes spell casts through the
   * RAW-correct shaping pipeline (`castSpellFlow` in
   * `module/ui/cast-spell-flow.mjs`) — Speed-5 shape × N circles, mote
   * commitment with refund-on-interrupt, Cast Sorcery action,
   * tradition-correct chat card. This legacy immediate-cast method is
   * preserved for user-written macros that may still reference
   * `actor.items.get(id).castSpell()`. Prefer the new flow for
   * everything else.
   *
   * @returns {Promise<boolean>} true if the cast succeeded, false if the
   *                             user aborted an XP confirmation or motes
   *                             couldn't cover the cost.
   */
  async castSpell() {
    if (this.type !== "spell") return false;
    const actor = this.actor;
    if (!actor) return false;

    const sys = this.system;

    const tradKey    = sys.tradition === "necromancy" ? "necromancy" : "sorcery";
    const initiation = Number(actor.system?.[tradKey]?.initiation ?? 0);
    if (initiation < sys.circle) {
      ui.notifications.warn(game.i18n.format("EX2E.SpellInitiationWarning", {
        spell:    this.name,
        required: sys.circle,
        current:  initiation
      }));
    }

    const ledger = await this._spendActivationCosts(sys.cost ?? {});
    if (!ledger) return false;

    await this.sendToChat({ activation: ledger });
    return true;
  }

  /**
   * Shared activation-cost resolver for charms and spells. Spends in a
   * fixed order (XP confirmation → motes → willpower → health → XP) and
   * returns a ledger the chat card's Reverse button can undo field-by-
   * field. Returns null on any hard failure (user cancelled XP confirm,
   * motes couldn't be paid); partial spends are not possible — every
   * mutation here is contingent on the whole chain succeeding.
   *
   * Charm-only ledger flags (toggledOn/Off, spawnedWeapon, rolledInstant)
   * are added by the caller since they're attack-block / sustain
   * bookkeeping; this helper only handles the pure resource side.
   *
   * @param {object} cost  The item's `system.cost` object.
   * @param {object} [opts]
   * @param {string} [opts.motePool="peripheral"]  Which pool motes come from.
   * @param {boolean}[opts.skipXpConfirm=false]    Skip the XP confirmation.
   * @returns {Promise<object|null>} Ledger, or null on abort/failure.
   */
  async _spendActivationCosts(cost, { motePool = "peripheral", skipXpConfirm = false } = {}) {
    const actor = this.actor;
    if (!actor) return null;

    const {
      moteCost, willpowerCost, bashingCost, lethalCost, aggravatedCost, xpCost
    } = normalizeCost(cost);

    const ledger = {
      moteBreakdown: null,
      willpower:     0,
      bashing:       0,
      lethal:        0,
      aggravated:    0,
      xp:            0
    };

    // XP is irrecoverable in-world — confirm before touching anything.
    if (!skipXpConfirm && xpCost > 0) {
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: game.i18n.localize("EX2E.CharmXPConfirmTitle") },
        content: `<p>${game.i18n.format("EX2E.CharmXPConfirmBody", {
          name: this.name, xp: xpCost
        })}</p>`,
        yes: { label: game.i18n.localize("EX2E.Confirm"), icon: "fa-solid fa-check" },
        no:  { label: game.i18n.localize("EX2E.Cancel"),  icon: "fa-solid fa-xmark"  }
      });
      if (!confirmed) return null;
    }

    // Motes (spendMotes returns per-pool breakdown on success, null if pools can't cover).
    if (moteCost > 0) {
      const breakdown = await actor.spendMotes(moteCost, motePool);
      if (!breakdown) return null;
      ledger.moteBreakdown = breakdown;
    }

    // Willpower.
    if (willpowerCost > 0) {
      const currentWp = Number(actor.system.willpower?.value) || 0;
      await actor.update({
        "system.willpower.value": Math.max(0, currentWp - willpowerCost)
      });
      ledger.willpower = willpowerCost;
    }

    // Health costs — sequential so wound-cap / incapacitation runs per bucket.
    if (bashingCost    > 0) { await actor.applyDamage(bashingCost,    "bashing");    ledger.bashing    = bashingCost; }
    if (lethalCost     > 0) { await actor.applyDamage(lethalCost,     "lethal");     ledger.lethal     = lethalCost; }
    if (aggravatedCost > 0) { await actor.applyDamage(aggravatedCost, "aggravated"); ledger.aggravated = aggravatedCost; }

    // XP last.
    if (xpCost > 0) {
      const currentXp = Number(actor.system.experience?.value) || 0;
      await actor.update({
        "system.experience.value": Math.max(0, currentXp - xpCost)
      });
      ledger.xp = xpCost;
    }

    return ledger;
  }

  /**
   * Build a transient weapon item from the charm's attack block, run a full
   * attack through ExaltedRoll.rollAttack using it, then delete the item.
   * The attack card flags snapshot the mode's stats so removal is safe.
   */
  async _rollCharmInstantAttack() {
    const actor = this.actor;
    if (!actor) return;
    const weaponData = this._buildCharmWeaponData();
    const [weapon] = await actor.createEmbeddedDocuments("Item", [weaponData]);
    try {
      const { ExaltedRoll } = await import("../rolls/exalted-roll.mjs");
      await ExaltedRoll.rollAttack(actor, weapon.id, { modeIndex: 0 });
    } finally {
      await weapon.delete();
    }
  }

  /**
   * Spawn a persistent weapon item + a tracking ActiveEffect on the actor.
   * Both carry `flags.exalted2e.charmSource = <charmId>` so we can find and
   * remove them when the charm deactivates (or via the Effects tab).
   */
  async _spawnCharmWeaponArtifacts() {
    const actor = this.actor;
    if (!actor) return;
    // If we've already spawned for this charm (double-activation, sheet
    // re-renders, etc.), don't stack duplicates.
    const alreadySpawned = actor.items.some(
      i => i.type === "weapon" && i.getFlag("exalted2e", "charmSource") === this.id
    );
    if (alreadySpawned) return;

    const weaponData = this._buildCharmWeaponData();
    weaponData.system.equipped = true;
    await actor.createEmbeddedDocuments("Item", [weaponData]);
    await actor.createEmbeddedDocuments("ActiveEffect", [{
      name: `${this.name} — ${game.i18n.localize("EX2E.CharmWeapon")}`,
      img:  this.img || "icons/svg/sword.svg",
      flags: { exalted2e: {
        charmSource:   this.id,
        charmDuration: this.system.duration
      } },
      disabled: false,
      transfer: false
    }]);
  }

  /**
   * Find and delete every weapon / AE tagged with this charm as its source.
   * Called when the charm toggles off, is deleted, or when the tracking AE
   * is deleted manually (see exalted2e.mjs pre-delete hook).
   */
  async _removeCharmWeaponArtifacts() {
    const actor = this.actor;
    if (!actor) return;
    const weaponIds = actor.items
      .filter(i => i.type === "weapon" && i.getFlag("exalted2e", "charmSource") === this.id)
      .map(i => i.id);
    const effectIds = actor.effects
      .filter(e => e.flags?.exalted2e?.charmSource === this.id)
      .map(e => e.id);
    if (weaponIds.length) await actor.deleteEmbeddedDocuments("Item",         weaponIds);
    if (effectIds.length) await actor.deleteEmbeddedDocuments("ActiveEffect", effectIds);
  }

  /**
   * Activate this Combo: plan which owned charms will fire vs. skip,
   * show a single preflight dialog with aggregate cost + XP confirm,
   * post a header chat card, then iterate each planned charm through
   * the existing `activateCharm({ skipXpConfirm: true, via: "combo" })`
   * pipeline so each keeps its own chat card + Reverse button.
   *
   * Returns true if the user confirmed and at least one activation ran
   * (or the header-only case when everything was skippable), false if
   * the user cancelled.
   */
  async activateCombo() {
    if (this.type !== "combo") return false;
    const actor = this.actor;
    if (!actor) return false;

    // Escape user-controlled strings (charm names, actor/combo names,
    // raw UIDs) before they land in dialog / chat HTML.
    const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));

    // Resolve charmUids → owned charms by stable UID.
    const byUid = new Map();
    for (const i of actor.items) {
      if (i.type !== "charm") continue;
      const uid = i.system?.charmUid;
      if (uid) byUid.set(uid, i);
    }

    const planned  = [];  // { charm }
    const skipped  = [];  // { charm }
    const missing  = [];  // { uid }

    for (const uid of (this.system.charmUids ?? [])) {
      const charm = byUid.get(uid);
      if (!charm) { missing.push({ uid }); continue; }
      const isToggleable = ["oneScene", "indefinite"].includes(charm.system?.duration);
      if (isToggleable && charm.system?.active) {
        skipped.push({ charm });
      } else {
        planned.push({ charm });
      }
    }

    // Aggregate cost totals over the planned set.
    const total = { motes: 0, willpower: 0, bashing: 0, lethal: 0, aggravated: 0, xp: 0 };
    for (const { charm } of planned) {
      const c = charm.system?.cost ?? {};
      total.motes      += Number(c.motes)            || 0;
      total.willpower  += Number(c.willpower)        || 0;
      total.bashing    += Number(c.bashingHealth)    || 0;
      total.lethal     += Number(c.lethalHealth)     || 0;
      total.aggravated += Number(c.aggravatedHealth) || 0;
      total.xp         += Number(c.xp)               || 0;
    }

    // Build the preflight body.
    const sectionList = (items, mapFn) =>
      items.length ? `<ul style="margin:4px 0 10px 18px">${items.map(mapFn).join("")}</ul>` : "";
    const costBits = [];
    if (total.motes)      costBits.push(`${total.motes}m`);
    if (total.willpower)  costBits.push(`${total.willpower}wp`);
    if (total.bashing)    costBits.push(`${total.bashing}b`);
    if (total.lethal)     costBits.push(`${total.lethal}l`);
    if (total.aggravated) costBits.push(`${total.aggravated}a`);
    if (total.xp)         costBits.push(`${total.xp}xp`);
    const costLine = costBits.length ? costBits.join(", ") : "—";

    const charmCost = (charm) => {
      const c = charm.system?.cost ?? {};
      const bits = [];
      if (c.motes)            bits.push(`${c.motes}m`);
      if (c.willpower)        bits.push(`+${c.willpower}wp`);
      if (c.bashingHealth)    bits.push(`${c.bashingHealth}b`);
      if (c.lethalHealth)     bits.push(`${c.lethalHealth}l`);
      if (c.aggravatedHealth) bits.push(`${c.aggravatedHealth}a`);
      if (c.xp)               bits.push(`${c.xp}xp`);
      return bits.length ? ` (${bits.join(" ")})` : "";
    };

    const content = `
      ${planned.length ? `<h4>${game.i18n.localize("EX2E.ComboPreflightWillActivate")}</h4>${
        sectionList(planned, ({ charm }) =>
          `<li>${esc(charm.name)}${charmCost(charm)}</li>`)
      }` : ""}
      ${skipped.length ? `<h4>${game.i18n.localize("EX2E.ComboPreflightAlreadyActive")}</h4>${
        sectionList(skipped, ({ charm }) =>
          `<li>${esc(charm.name)}</li>`)
      }` : ""}
      ${missing.length ? `<h4>${game.i18n.localize("EX2E.ComboPreflightMissing")}</h4>${
        sectionList(missing, ({ uid }) =>
          `<li title="${esc(uid)}">${game.i18n.localize("EX2E.ComboBroken")}</li>`)
      }` : ""}
      ${planned.length === 0
        ? `<p><em>${game.i18n.localize("EX2E.ComboPreflightNothingToDo")}</em></p>`
        : `<p><strong>${game.i18n.localize("EX2E.ComboPreflightTotal")}:</strong> ${costLine}</p>`}
    `;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window:  { title: game.i18n.format("EX2E.ComboPreflightTitle", { name: this.name }) },
      content,
      yes: { label: game.i18n.localize("EX2E.ComboActivate"), icon: "fa-solid fa-bolt" },
      no:  { label: game.i18n.localize("EX2E.Cancel"),        icon: "fa-solid fa-xmark" }
    });
    if (!confirmed) return false;

    // Header chat card — compact summary of what's about to fire.
    const linesHtml = [
      ...planned.map(({ charm }) =>
        `<li>${esc(charm.name)}${charmCost(charm)}</li>`),
      ...skipped.map(({ charm }) =>
        `<li><em>${esc(charm.name)} — ${
          game.i18n.localize("EX2E.ComboPreflightAlreadyActive")}</em></li>`),
      ...missing.map(() =>
        `<li><em>${game.i18n.localize("EX2E.ComboBroken")}</em></li>`)
    ].join("");
    const headerMessage = game.i18n.format("EX2E.ComboHeaderMessage", {
      actor: esc(actor.name), name: esc(this.name)
    });
    await ChatMessage.create({
      content: `<div class="ex2e-combo-header"><h3>${headerMessage}</h3>
                <ul style="margin:4px 0 0 18px">${linesHtml}</ul></div>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });

    // Fire each planned charm through the existing pipeline.
    for (const { charm } of planned) {
      await charm.activateCharm({ skipXpConfirm: true, via: "combo" });
    }

    return true;
  }

  /** Shape the charm's attack config into a weapon item's creation data. */
  _buildCharmWeaponData() {
    return buildCharmWeaponData({
      attack:   this.system.attack,
      name:     this.name,
      img:      this.img,
      id:       this.id,
      duration: this.system.duration,
      rollData: this.actor?.getRollData?.() ?? {}
    });
  }

  /**
   * Send this item's description as a chat message.
   *
   * @param {object} [options]
   * @param {object} [options.activation] Ledger of what a charm activation
   *   spent / toggled, stamped onto the message's flags so the card's
   *   Reverse button can undo it later. Shape:
   *     { moteBreakdown, willpower, toggledOn, toggledOff,
   *       spawnedWeapon, rolledInstant }
   */
  async sendToChat({ activation = null } = {}) {
    const templateData = {
      item:  this,
      actor: this.actor,
      activation,
      canReverse: !!activation && !!this.actor
    };
    const content = await foundry.applications.handlebars.renderTemplate(
      "systems/exalted2e/templates/chat/item-card.hbs",
      templateData
    );
    const speaker = this.actor
      ? ChatMessage.getSpeaker({ actor: this.actor })
      : ChatMessage.getSpeaker();

    const flags = activation
      ? { exalted2e: {
          charmActivation: {
            charmId:  this.id,
            actorId:  this.actor?.id ?? null,
            ledger:   activation,
            reversed: false
          }
        } }
      : {};
    return ChatMessage.create({ content, speaker, flags });
  }
}

/**
 * Resolve a charm-attack formula (e.g. `"@str + @essence / 2"`) against
 * the given actor roll-data to an integer. Plain numbers short-circuit;
 * empty strings return `fallback`. Parse / eval failures log a warning
 * and fall back as well — a broken formula shouldn't block charm use.
 */
export function evaluateCharmFormula(formula, rollData, fallback = 0) {
  if (formula === null || formula === undefined || formula === "") return fallback;
  if (typeof formula === "number") return Math.floor(formula);
  const s = String(formula).trim();
  if (s === "") return fallback;
  // Plain integer / decimal — skip Roll machinery.
  if (/^-?\d+(?:\.\d+)?$/.test(s)) return Math.floor(Number(s));
  try {
    const substituted = Roll.replaceFormulaData(s, rollData ?? {}, { missing: "0", warn: false });
    const value       = Roll.safeEval(substituted);
    return Number.isFinite(value) ? Math.floor(value) : fallback;
  } catch (err) {
    console.warn("[EX2E] Charm formula failed:", formula, err);
    return fallback;
  }
}
