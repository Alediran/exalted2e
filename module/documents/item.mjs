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
   * @returns {Promise<boolean>} true if activation succeeded.
   */
  async activateCharm() {
    if (this.type !== "charm") return false;
    const actor = this.actor;
    if (!actor) return false;

    const sys      = this.system;
    const cost     = sys.cost ?? {};
    const motePool = "peripheral";  // default pool; chosen at activation time
    const isToggleable = ["oneScene", "indefinite"].includes(sys.duration);
    // For toggleable charms, activation is a flip — we only charge motes /
    // create attack effects when turning ON, and skip those when turning OFF.
    const turningOff = isToggleable && sys.active;

    // Coerce costs to numbers defensively — form inputs occasionally round-trip
    // as strings, and `"1" > 0` is fine but `wp.value - "1"` is NaN.
    const n = (v) => Math.max(0, Math.floor(Number(v) || 0));
    const moteCost        = n(cost.motes);
    const willpowerCost   = n(cost.willpower);
    const bashingCost     = n(cost.bashingHealth);
    const lethalCost      = n(cost.lethalHealth);
    const aggravatedCost  = n(cost.aggravatedHealth);
    const xpCost          = n(cost.xp);

    // Track what we actually spent so the chat card's Reverse button can
    // refund precisely what came out. Each field is recorded only when
    // the activation actually incurred that cost.
    const ledger = {
      moteBreakdown: null,
      willpower:     0,
      bashing:       0,
      lethal:        0,
      aggravated:    0,
      xp:            0,
      toggledOn:     false,
      toggledOff:    false,
      spawnedWeapon: false,
      rolledInstant: false
    };

    // Experience costs are irrecoverable in-world, so we prompt the user
    // before going through with them. A "No" aborts the activation
    // entirely — no motes / willpower / health consumed either.
    if (!turningOff && xpCost > 0) {
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: game.i18n.localize("EX2E.CharmXPConfirmTitle") },
        content: `<p>${game.i18n.format("EX2E.CharmXPConfirmBody", {
          name: this.name, xp: xpCost
        })}</p>`,
        yes: { label: game.i18n.localize("EX2E.Confirm"), icon: "fa-solid fa-check" },
        no:  { label: game.i18n.localize("EX2E.Cancel"),  icon: "fa-solid fa-xmark"  }
      });
      if (!confirmed) return false;
    }

    // Spend motes (spendMotes returns per-pool breakdown on success, null
    // if the pools combined couldn't cover the cost)
    if (!turningOff && moteCost > 0) {
      const breakdown = await actor.spendMotes(moteCost, motePool);
      if (!breakdown) return false;
      ledger.moteBreakdown = breakdown;
    }

    // Spend willpower in a single update against the live value.
    if (!turningOff && willpowerCost > 0) {
      const currentWp = Number(actor.system.willpower?.value) || 0;
      await actor.update({
        "system.willpower.value": Math.max(0, currentWp - willpowerCost)
      });
      ledger.willpower = willpowerCost;
    }

    // Apply health-level costs per type. We use applyDamage sequentially
    // so the actor's wound-cap / incapacitation logic runs once per
    // damage injection — aligning charm self-harm with ordinary damage.
    if (!turningOff && bashingCost    > 0) { await actor.applyDamage(bashingCost,    "bashing");    ledger.bashing    = bashingCost; }
    if (!turningOff && lethalCost     > 0) { await actor.applyDamage(lethalCost,     "lethal");     ledger.lethal     = lethalCost; }
    if (!turningOff && aggravatedCost > 0) { await actor.applyDamage(aggravatedCost, "aggravated"); ledger.aggravated = aggravatedCost; }

    // Spend experience — `experience.value` is the current pool.
    if (!turningOff && xpCost > 0) {
      const currentXp = Number(actor.system.experience?.value) || 0;
      await actor.update({
        "system.experience.value": Math.max(0, currentXp - xpCost)
      });
      ledger.xp = xpCost;
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

  /** Shape the charm's attack config into a weapon item's creation data. */
  _buildCharmWeaponData() {
    const a = this.system.attack ?? {};
    const displayName = a.name?.trim() ? a.name : this.name;
    const rollData = this.actor?.getRollData?.() ?? {};
    const num = (formula, fallback = 0) => evaluateCharmFormula(formula, rollData, fallback);

    return {
      name: displayName,
      type: "weapon",
      img:  this.img || "icons/svg/sword.svg",
      flags: { exalted2e: {
        charmSource:   this.id,
        charmDuration: this.system.duration
      } },
      system: {
        equipped:  false,
        artifact:  false,
        modes: [{
          name:           displayName,
          speed:          num(a.speed,          5),
          accuracy:       num(a.accuracy,       0),
          damage:         num(a.damage,         1),
          damageType:     a.damageType     ?? "lethal",
          overwhelming:   num(a.overwhelming,   1),
          defense:        num(a.defense,        0),
          rate:           num(a.rate,           1),
          range:          num(a.range,          0),
          minStrength:    num(a.minStrength,    0),
          minDexterity:   num(a.minDexterity,   0),
          minMartialArts: num(a.minMartialArts, 0),
          tags:           [...(a.tags ?? [])]
        }]
      }
    };
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
