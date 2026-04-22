import { EX2E } from "../config.mjs";

/**
 * Lazily create (or return) the shared bottom-HUD flex container that
 * hosts the tick wheel (left) and the action quickbar (right). A shared
 * parent is simpler than manually matching two fixed-position elements.
 */
export function ensureCombatHUD() {
  let hud = document.getElementById("ex2e-combat-hud");
  if (!hud) {
    hud = document.createElement("div");
    hud.id = "ex2e-combat-hud";
    hud.classList.add("ex2e-combat-hud");
    document.body.appendChild(hud);
  }
  return hud;
}

/**
 * ActionQuickbar — floating HUD bar (anchored above Foundry's hotbar) that
 * exposes every combat action to the active combatant's owner (or GM).
 *
 * Lifecycle: a single instance is created on `ready` and `refresh()`ed from
 * combat / token / item hooks. The bar hides itself when combat isn't
 * running, when there's no active combatant, or when the current user isn't
 * that combatant's owner.
 *
 * Actions resolve through three paths:
 *   • Attack        → popover of equipped weapon modes → rollAttack() +
 *                     stamp `pendingAction` with the mode's Speed / DV.
 *   • Flurry        → opens the existing FlurryDeclarationDialog; the flurry
 *                     flag takes precedence over pendingAction at turn end.
 *   • Other actions → posts an action-declared chat card, applies the DV
 *                     penalty as a refreshable AE, and stamps pendingAction.
 *
 * Finish Turn consumes in this order: declared flurry → pendingAction →
 * FinishTurnDialog fallback.
 */
export class ActionQuickbar {
  static _instance = null;

  static get instance() {
    if (!this._instance) this._instance = new ActionQuickbar();
    return this._instance;
  }

  constructor() {
    this._root = null;
    this._submenu = null;
    this._moveOverlay = null;
    this._moveOverlayPending = null;
    this._build();
    // Close the attack-mode submenu on any outside click.
    document.addEventListener("click", (ev) => {
      if (!this._submenu || this._submenu.hidden) return;
      if (this._submenu.contains(ev.target)) return;
      if (ev.target.closest(".qb-attack")) return;
      this._hideSubmenu();
    });
  }

  _build() {
    const hud = ensureCombatHUD();

    const root = document.createElement("div");
    root.id = "ex2e-action-quickbar";
    root.classList.add("ex2e-action-quickbar", "hidden");
    hud.appendChild(root);
    this._root = root;

    const submenu = document.createElement("div");
    submenu.classList.add("ex2e-action-submenu");
    submenu.hidden = true;
    // The popover needs to overflow the HUD bounds, so it lives on body.
    document.body.appendChild(submenu);
    this._submenu = submenu;
  }

  refresh() {
    const combat = game.combat;
    if (!combat?.started) return this._hide();
    const current = combat.combatant;
    if (!current?.actor) return this._hide();
    const canAct = game.user.isGM
      || current.actor.testUserPermission(game.user, "OWNER");
    if (!canAct) return this._hide();

    const currentTick = combat.currentTick;
    const initiative  = current.initiative ?? 0;
    const acted       = !!current.flags?.exalted2e?.actedThisTick;
    const committed   = current.flags?.exalted2e?.committedAction ?? null;

    // Mid-action (initiative is past the wheel): only show a bar if the
    // committed action is abortable and hasn't been aborted yet.
    if (initiative > currentTick) {
      if (committed?.abortable && !committed?.aborted) {
        this._renderAbortOnly(current, committed);
        this._show();
      } else {
        this._hide();
      }
      return;
    }

    // Already committed this tick — waiting for GM's Next Tick.
    if (acted) return this._hide();

    // Free and eligible: full quickbar.
    this._render(combat, current);
    this._show();
  }

  _show() { this._root.classList.remove("hidden"); }
  _hide() {
    this._root.classList.add("hidden");
    this._hideSubmenu();
    this._hideMoveRange();
  }

  _render(combat, current) {
    // A re-render destroys old buttons before their mouseleave can fire —
    // clear any lingering reach preview so it can't orphan on the canvas.
    this._hideMoveRange();
    const actor   = current.actor;
    const pending = current.flags?.exalted2e?.pendingAction ?? null;
    const flurry  = current.flags?.exalted2e?.flurry ?? null;

    const pieces = [];
    if (pending || flurry) pieces.push(this._pendingIndicator(pending, flurry));

    pieces.push(this._attackButton(actor));

    for (const [key, cfg] of Object.entries(EX2E.actions)) {
      pieces.push(this._actionButton(key, cfg));
    }

    pieces.push(this._flurryButton(flurry));
    pieces.push(this._finishButton());

    this._root.replaceChildren(...pieces);
    this._wire(combat, current);
  }

  _pendingIndicator(pending, flurry) {
    const el = document.createElement("div");
    el.classList.add("qb-pending");
    if (flurry) {
      el.textContent = game.i18n.format("EX2E.QuickbarFlurryLocked", {
        speed: flurry.speed, dv: flurry.dvPenalty
      });
    } else if (pending) {
      el.textContent = game.i18n.format("EX2E.QuickbarPendingLabel", {
        name: pending.label, speed: pending.speed, dv: pending.dvPenalty
      });
    }
    return el;
  }

  _attackButton(actor) {
    const modes = this._equippedModes(actor);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("qb-btn", "qb-attack");
    btn.title = game.i18n.localize("EX2E.QuickbarAttackTooltip");
    btn.innerHTML = `<i class="fa-solid fa-crosshairs"></i> ${game.i18n.localize("EX2E.ActionAttack")} <i class="fa-solid fa-caret-up"></i>`;
    if (modes.length === 0) {
      btn.disabled = true;
      btn.title = game.i18n.localize("EX2E.QuickbarNoEquipped");
    }
    return btn;
  }

  _actionButton(key, cfg) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("qb-btn", "qb-action");
    btn.dataset.actionKey = key;
    const label = game.i18n.localize(cfg.labelKey);
    btn.title = game.i18n.format("EX2E.QuickbarActionTooltip", {
      name: label, speed: cfg.speed, dv: cfg.dvMod
    });
    const iconMarkup = cfg.icon ? `<i class="${cfg.icon}"></i> ` : "";
    btn.innerHTML = `${iconMarkup}${label} <small>(${cfg.speed}s)</small>`;
    return btn;
  }

  _flurryButton(flurry) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("qb-btn", "qb-flurry");
    btn.title = game.i18n.localize("EX2E.FlurryDeclare");
    btn.innerHTML = `<i class="fa-solid fa-burst"></i> ${game.i18n.localize("EX2E.FlurryDeclare")}`;
    if (flurry) btn.disabled = true;
    return btn;
  }

  _finishButton() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("qb-btn", "qb-finish");
    btn.title = game.i18n.localize("EX2E.FinishTurn");
    btn.innerHTML = `<i class="fa-solid fa-forward-step"></i> ${game.i18n.localize("EX2E.FinishTurn")}`;
    return btn;
  }

  _wire(combat, current) {
    const actor = current.actor;

    this._root.querySelector(".qb-attack")?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._toggleAttackSubmenu(ev.currentTarget, actor, current);
    });

    this._root.querySelectorAll(".qb-action").forEach(btn => {
      const key = btn.dataset.actionKey;
      btn.addEventListener("click", () => {
        this._handleAction(key, actor, current);
      });
      // Move / Dash hover — paint a reach circle on the canvas so the
      // player can gauge whether they'll close the distance in one action.
      if (key === "move" || key === "dash") {
        btn.addEventListener("mouseenter", () => this._showMoveRange(actor, key));
        btn.addEventListener("mouseleave", () => this._hideMoveRange());
      }
    });

    this._root.querySelector(".qb-flurry")?.addEventListener("click", async () => {
      const { FlurryDeclarationDialog } = await import("../dialogs/flurry-declaration-dialog.mjs");
      const result = await FlurryDeclarationDialog.prompt({ actor });
      if (!result) return;
      // A flurry supersedes any single-action declaration — tear down its
      // DV penalty AE before the flurry stamps its own.
      await this._clearPendingAction(actor, current);
      if (result.dvPenalty > 0) {
        await actor.applyDVPenalty("flurry", result.dvPenalty, {
          label: game.i18n.format("EX2E.FlurryDvPenaltyLabel", { n: result.count })
        });
      }
      await current.setFlag("exalted2e", "flurry", {
        actions:     result.actions,
        count:       result.count,
        dicePenalty: result.dicePenalty,
        speed:       result.speed,
        dvPenalty:   result.dvPenalty
      });
      const content = await foundry.applications.handlebars.renderTemplate(
        "systems/exalted2e/templates/chat/flurry-declared.hbs",
        {
          actorId: actor.id, actorName: actor.name,
          actions: result.actions, count: result.count,
          dicePenalty: result.dicePenalty, speed: result.speed,
          dvPenalty: result.dvPenalty
        }
      );
      await ChatMessage.create({
        content,
        speaker: ChatMessage.getSpeaker({ actor })
      });
    });

    this._root.querySelector(".qb-finish")?.addEventListener("click", async () => {
      await finishTurnFor(combat, current);
    });
  }

  // ── Attack submenu ────────────────────────────────────────────────────
  _toggleAttackSubmenu(btn, actor, current) {
    if (!this._submenu.hidden) { this._hideSubmenu(); return; }
    const modes = this._equippedModes(actor);
    if (modes.length === 0) return;

    this._submenu.replaceChildren(
      ...modes.map(m => {
        const row = document.createElement("button");
        row.type = "button";
        row.classList.add("qb-attack-mode");
        row.innerHTML = `<span class="mode-label">${m.label}</span><span class="mode-stats">Spd ${m.speed}</span>`;
        row.addEventListener("click", (ev) => {
          ev.stopPropagation();
          this._hideSubmenu();
          this._handleAttack(m, actor, current);
        });
        return row;
      })
    );

    const br = btn.getBoundingClientRect();
    this._submenu.hidden = false;
    const sw = this._submenu.offsetWidth;
    this._submenu.style.left = `${Math.max(8, br.left + br.width / 2 - sw / 2)}px`;
    this._submenu.style.bottom = `${window.innerHeight - br.top + 6}px`;
  }

  _hideSubmenu() {
    if (!this._submenu) return;
    this._submenu.hidden = true;
    this._submenu.replaceChildren();
  }

  // ── Abort-only render (mid-action, abortable) ─────────────────────────
  _renderAbortOnly(current, committed) {
    const indicator = document.createElement("div");
    indicator.classList.add("qb-pending");
    indicator.textContent = game.i18n.format("EX2E.QuickbarInProgressLabel", {
      name: committed.label || "",
      tick: current.initiative ?? 0
    });

    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("qb-btn", "qb-abort");
    btn.title = game.i18n.localize("EX2E.AbortActionTooltip");
    btn.innerHTML = `<i class="fa-solid fa-ban"></i> ${game.i18n.localize("EX2E.AbortAction")}`;
    btn.addEventListener("click", async () => {
      await this._handleAbort(current, committed);
    });

    this._root.replaceChildren(indicator, btn);
  }

  async _handleAbort(current, committed) {
    const actor = current.actor;
    if (!actor) return;
    // Mark the committed action aborted — downstream action-specific
    // effects (e.g. Aim's dice bonus, once it lands) read this and skip
    // applying. The unspent ticks and DV penalty stay per Exalted RAW.
    await current.setFlag("exalted2e", "committedAction", {
      ...committed,
      aborted: true
    });
    const content = await foundry.applications.handlebars.renderTemplate(
      "systems/exalted2e/templates/chat/action-declared.hbs",
      {
        actorName: actor.name,
        label:     game.i18n.format("EX2E.ActionAbortedLabel", {
          name: committed.label || ""
        }),
        speed:     committed.speed  ?? 0,
        dvPenalty: committed.dvPenalty ?? 0
      }
    );
    await ChatMessage.create({
      content,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }

  // ── Move / Dash reach preview ─────────────────────────────────────────
  /**
   * Render a client-only MeasuredTemplate centered on the active
   * combatant's token, radius equal to their Move (Dex) or Dash (Dex + 3)
   * distance. Using Foundry's native template gives us the scene's proper
   * distance unit, grid-aware fill highlighting, and the built-in distance
   * ruler for free.
   *
   * The template is never saved to the scene — we hand-instantiate the
   * document + object pair and parent the object under
   * `canvas.templates.preview` so it lives only on this client's canvas
   * until `_hideMoveRange` tears it down.
   */
  async _showMoveRange(actor, key) {
    this._hideMoveRange();
    if (!canvas?.ready || !canvas.scene) return;
    const token = actor?.getActiveTokens?.()[0];
    if (!token) return;

    const sys = actor.system ?? {};
    const dex = sys.attributes?.dexterity?.value ?? 0;
    const distance = key === "dash"
      ? (sys.dash ?? (dex + 3))
      : (sys.movement ?? dex);
    if (distance <= 0) return;

    const color = key === "dash" ? "#f0a500" : "#ffe066";
    const DocClass = CONFIG.MeasuredTemplate.documentClass;
    const ObjClass = CONFIG.MeasuredTemplate.objectClass;
    const doc = new DocClass({
      t:           "circle",
      user:        game.user.id,
      x:           token.center.x,
      y:           token.center.y,
      distance,
      direction:   0,
      fillColor:   color,
      borderColor: color,
      hidden:      false,
      flags:       { exalted2e: { movePreview: true } }
    }, { parent: canvas.scene });

    // Track the pending show so a fast hover→leave doesn't orphan a
    // half-drawn template on the canvas.
    const token_id = Symbol("ex2e-move-preview");
    this._moveOverlayPending = token_id;

    const template = new ObjClass(doc);
    await template.draw();

    // If the user already moved off the button while draw() was awaiting,
    // discard this template instead of attaching it.
    if (this._moveOverlayPending !== token_id) {
      template.destroy({ children: true });
      return;
    }

    canvas.templates.preview.addChild(template);
    this._moveOverlay = template;
    this._moveOverlayPending = null;
  }

  _hideMoveRange() {
    this._moveOverlayPending = null;
    if (!this._moveOverlay) return;
    this._moveOverlay.parent?.removeChild(this._moveOverlay);
    this._moveOverlay.destroy({ children: true });
    this._moveOverlay = null;
  }

  _equippedModes(actor) {
    const out = [];
    for (const w of (actor?.items ?? [])) {
      if (w.type !== "weapon") continue;
      if (!w.system.equipped) continue;
      const modes = w.system.modes ?? [];
      modes.forEach((mode, idx) => {
        out.push({
          weaponId: w.id,
          modeIndex: idx,
          label: modes.length > 1 ? `${w.name} — ${mode.name}` : w.name,
          speed: mode.effectiveSpeed ?? mode.speed ?? 5,
          dvMod: 1
        });
      });
    }
    return out;
  }

  // ── Action handlers ───────────────────────────────────────────────────
  /**
   * Clear any previously-declared single action on this combatant — delete
   * its DV-penalty AE (if still present) and drop the flag. Returns nothing.
   * The flurry flag is untouched; flurries supersede pendingAction and are
   * cleaned up on turn advance.
   */
  async _clearPendingAction(actor, current) {
    const pending = current.flags?.exalted2e?.pendingAction;
    if (!pending) return;
    if (pending.dvEffectId) {
      const eff = actor.effects.get(pending.dvEffectId);
      if (eff) await eff.delete();
    }
    await current.unsetFlag("exalted2e", "pendingAction");
  }

  async _handleAction(key, actor, current) {
    const cfg = EX2E.actions[key];
    if (!cfg) return;
    const label = game.i18n.localize(cfg.labelKey);

    await this._clearPendingAction(actor, current);

    let dvEffectId = null;
    if (cfg.dvMod > 0) {
      const eff = await actor.applyDVPenalty(key, cfg.dvMod, {
        label: game.i18n.format("EX2E.QuickbarActionDvLabel", { name: label })
      });
      dvEffectId = eff?.id ?? null;
    }
    await current.setFlag("exalted2e", "pendingAction", {
      actionKey: key,
      label,
      speed:     cfg.speed,
      dvPenalty: cfg.dvMod,
      abortable: !!cfg.abortable,
      dvEffectId
    });
    await this._postActionCard(actor, { label, speed: cfg.speed, dvPenalty: cfg.dvMod });
  }

  async _handleAttack(mode, actor, current) {
    await this._clearPendingAction(actor, current);

    let dvEffectId = null;
    if (mode.dvMod > 0) {
      const eff = await actor.applyDVPenalty("attack", mode.dvMod, {
        label: game.i18n.format("EX2E.QuickbarActionDvLabel", { name: mode.label })
      });
      dvEffectId = eff?.id ?? null;
    }
    await current.setFlag("exalted2e", "pendingAction", {
      actionKey: "attack",
      label:     mode.label,
      speed:     mode.speed,
      dvPenalty: mode.dvMod,
      abortable: false,
      weaponId:  mode.weaponId,
      modeIndex: mode.modeIndex,
      dvEffectId
    });
    const { ExaltedRoll } = await import("../rolls/exalted-roll.mjs");
    await ExaltedRoll.rollAttack(actor, mode.weaponId, { modeIndex: mode.modeIndex });
  }

  async _postActionCard(actor, data) {
    const content = await foundry.applications.handlebars.renderTemplate(
      "systems/exalted2e/templates/chat/action-declared.hbs",
      {
        actorName: actor.name,
        label:     data.label,
        speed:     data.speed,
        dvPenalty: data.dvPenalty
      }
    );
    await ChatMessage.create({
      content,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }
}

/**
 * Shared Finish-Turn resolver used by both the quickbar and the combat
 * tracker's Finish Turn button. Priority: flurry flag → pendingAction flag
 * → FinishTurnDialog. Any pending flag is cleared by
 * ExaltedCombat.advanceCurrentByTicks.
 */
export async function finishTurnFor(combat, current) {
  const flurry  = current.flags?.exalted2e?.flurry ?? null;
  if (flurry) {
    await combat.advanceCurrentByTicks(flurry.speed);
    return;
  }
  const pending = current.flags?.exalted2e?.pendingAction ?? null;
  if (pending) {
    await combat.advanceCurrentByTicks(pending.speed);
    return;
  }
  const { FinishTurnDialog } = await import("../dialogs/finish-turn-dialog.mjs");
  const speed = await FinishTurnDialog.prompt({
    combatantName: current.name,
    currentTick:   current.initiative ?? 0,
    defaultSpeed:  5
  });
  if (speed === null) return;
  await combat.advanceCurrentByTicks(speed);
}
