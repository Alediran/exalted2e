import { EX2E } from "../config.mjs";
import { computeSpellCastButtonState } from "./spell-cast-button.mjs";
import { resolveUserActor } from "../helpers/targeting.mjs";
import { moteCostString } from "../rolls/activation-ledger.mjs";
import { QB_GROUP_OF } from "./quickbar/quickbar-layout.mjs";
import { applyDockLayout } from "./quickbar/dock-layout.mjs";
import { applyRadialLayout } from "./quickbar/radial-layout.mjs";

/**
 * Lazily create (or return) the shared bottom-HUD flex container that
 * hosts the wheel column (left) and the action quickbar (right). A shared
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
 * Lazily create (or return) the left column inside the combat HUD. The
 * column stacks the Join Battle panel (top) above the tick wheel (bottom).
 */
export function ensureCombatHUDLeftColumn() {
  const hud = ensureCombatHUD();
  let col = hud.querySelector(":scope > .ex2e-hud-left-col");
  if (!col) {
    col = document.createElement("div");
    col.classList.add("ex2e-hud-left-col");
    hud.insertBefore(col, hud.firstChild);
  }
  return col;
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
 * 1-tick pass (if nothing was declared).
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
    // Close the popover submenu on any outside click. Both the Attack and
    // Cast Spell buttons open it, so either one keeps it open.
    document.addEventListener("click", (ev) => {
      // Close the Attack/Cast mode popover.
      if (this._submenu && !this._submenu.hidden
          && !this._submenu.contains(ev.target)
          && !ev.target.closest(".qb-attack") && !ev.target.closest(".qb-cast")) {
        this._hideSubmenu();
      }
      // Close the radial overflow popover.
      const openRadial = this._root?.querySelector(".ex2e-action-radial.open");
      if (openRadial && !openRadial.contains(ev.target) && !ev.target.closest(".qb-more")) {
        openRadial.classList.remove("open");
      }
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

  /** Tag a button element with its layout group + key (read by the layouts). */
  _tag(el, key) {
    el.dataset.qbKey = key;
    el.dataset.qbGroup = QB_GROUP_OF[key] ?? "utility";
    return el;
  }

  refresh() {
    this._renderForState();
    this._appendMassGuardButton();
  }

  /**
   * GM-only Mass Guard control. Independent of whose tick it is — shown
   * whenever a GM has a running combat. Guards the actors of all currently
   * controlled tokens via applyMassGuard.
   */
  _appendMassGuardButton() {
    if (!(game.user.isGM && game.combat?.started)) return;
    // Every _renderForState path replaceChildren()s the root before this runs,
    // so the button is normally absent here. Remove defensively anyway so the
    // single-button invariant holds even if a future render path skips that.
    this._root.querySelector(".qb-mass-guard")?.remove();
    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("qb-btn", "qb-mass-guard");
    btn.innerHTML = `<i class="fa-solid fa-shield"></i> <span class="qb-label">${game.i18n.localize("EX2E.MassGuardButton")}</span>`;
    this._tag(btn, "massGuard");
    btn.addEventListener("click", async () => {
      const controlled = canvas.tokens?.controlled ?? [];
      if (!controlled.length) {
        ui.notifications.warn(game.i18n.localize("EX2E.MassGuardNoSelection"));
        return;
      }
      const { applyMassGuard } = await import("../combat/mass-guard.mjs");
      await applyMassGuard(game.combat, controlled);
      // Repaint so the active combatant's pending-action indicator reflects a
      // Guard we may have just stamped on them.
      this.refresh();
    });
    this._root.appendChild(btn);
  }

  _renderForState() {
    // The bar is permanent — it stays visible even when there's no active
    // combatant so players can reference their action list out of combat
    // and so future social/mass-combat modes have a home. Only the bar's
    // CONTENT varies with state.
    const combat = game.combat;
    const current = combat?.started ? combat.combatant : null;
    const ownsActive = !!current?.actor
      && (game.user.isGM || current.actor.testUserPermission(game.user, "OWNER"));

    this._show();

    if (ownsActive) {
      const currentTick = combat.currentTick;
      const initiative  = current.initiative ?? 0;
      const acted       = !!current.flags?.exalted2e?.actedThisTick;
      const committed   = current.flags?.exalted2e?.committedAction ?? null;

      // Mid-action: abortable → abort-only bar; otherwise passive.
      if (initiative > currentTick) {
        if (committed?.abortable && !committed?.aborted) {
          this._renderAbortOnly(current, committed);
        } else {
          this._renderPassive(current.actor);
        }
        return;
      }

      // Already committed this tick — passive until GM advances.
      if (acted) { this._renderPassive(current.actor); return; }

      // Free and eligible: full combat bar.
      this._render(combat, current);
      return;
    }

    // Out of combat, or combat exists but this user doesn't own the
    // active combatant. Resolve the actor by preference:
    //   1. Currently controlled token (lets a GM with no assigned
    //      character act on whichever token they've selected — including
    //      Lunars they want to shapeshift between Heart's Blood forms).
    //   2. game.user.character (the user's assigned character, if any).
    //   3. null — buttons render but their click handlers no-op.
    this._renderPassive(resolveUserActor());
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
    const flurry  = current.flags?.exalted2e?.flurry        ?? null;
    const clinch  = current.flags?.exalted2e?.clinch        ?? null;

    // Held combatant: show frozen indicator instead of normal bar.
    if (clinch?.role === "held") {
      this._renderHeld(combat, current, clinch);
      return;
    }

    const pieces = [];
    if (pending || flurry) pieces.push(this._pendingIndicator(pending, flurry));

    // Controller: prepend clinch action section.
    if (clinch?.role === "controller") {
      pieces.push(this._clinchControlSection(combat, current, clinch));
    }

    pieces.push(this._attackButton(actor));

    for (const [key, cfg] of Object.entries(EX2E.actions)) {
      if (cfg.clinchOnly) continue;  // handled via _clinchControlSection
      // Shapeshift is Lunar-only — hide it for every other splat (and when
      // there's no actor to read a splat from).
      if (key === "shapeshift" && actor?.system?.exaltType !== "lunar") continue;
      pieces.push(this._actionButton(key, cfg));
      // Cast Spell slots in right after the Simple Charm action — it
      // occupies an equivalent conceptual spot (another Simple-shape
      // activation) and the menu pattern matches the Attack button.
      if (key === "simpleCharm") pieces.push(this._castSpellButton(actor));
    }

    pieces.push(this._flurryButton(flurry));
    pieces.push(this._finishButton());

    this._applyLayout(pieces);
    this._wire(combat, current);
  }

  /**
   * Arrange built pieces into the root using the player's chosen bar style.
   * Replaces the bare `this._root.replaceChildren(...pieces)` call so both
   * styles share one entry point. Buttons keep their wiring hooks — `_wire`
   * runs after this and queries `this._root`, which still contains every
   * button (the radial popover is a child of the root).
   */
  _applyLayout(pieces) {
    const style = game.settings.get("exalted2e", "actionBarStyle") ?? "dock";
    const radial = style === "radial";
    this._root.classList.toggle("qb-style-dock", !radial);
    this._root.classList.toggle("qb-style-radial", radial);
    if (radial) {
      const pinned = game.settings.get("exalted2e", "actionBarPinned") ?? [];
      applyRadialLayout(this._root, pieces, pinned);
    } else {
      applyDockLayout(this._root, pieces);
    }
  }

  _clinchControlSection(combat, current, clinch) {
    const frag = document.createDocumentFragment();

    const header = document.createElement("span");
    header.classList.add("qb-clinch-label");
    header.textContent = game.i18n.localize("EX2E.QuickbarClinchSection");
    frag.appendChild(header);

    for (const key of ["hold", "crush", "throw", "release"]) {
      const cfg = {
        hold:    { label: "EX2E.ClinchHold",    icon: "fa-solid fa-hand",           speed: 3 },
        crush:   { label: "EX2E.ClinchCrush",   icon: "fa-solid fa-hand-fist",      speed: 3 },
        throw:   { label: "EX2E.ClinchThrow",   icon: "fa-solid fa-person-falling", speed: 3 },
        release: { label: "EX2E.ClinchRelease", icon: "fa-solid fa-door-open",      speed: 0 },
      }[key];

      const btn = document.createElement("button");
      btn.type = "button";
      btn.classList.add("qb-btn", "qb-clinch");
      btn.dataset.clinchAction = key;
      btn.innerHTML = `<i class="${cfg.icon}"></i> <span class="qb-label">${game.i18n.localize(cfg.label)}</span>`;
      if (cfg.speed > 0) btn.title = `(${cfg.speed}s)`;
      frag.appendChild(btn);
    }

    return frag;
  }

  _renderHeld(combat, current, clinch) {
    const controllerCombatant = combat.combatants.get(clinch.controllerCombatantId);
    const controllerName      = controllerCombatant?.actor?.name ?? "?";

    const indicator = document.createElement("div");
    indicator.classList.add("qb-held-indicator");
    indicator.innerHTML = `<i class="fa-solid fa-lock"></i> ${game.i18n.format("EX2E.QuickbarHeldIndicator", { name: controllerName })}`;

    this._applyLayout([indicator, this._finishButton()]);
    this._root.querySelector(".qb-finish")?.addEventListener("click", async () => {
      await finishTurnFor(combat, current);
    });
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
    btn.innerHTML = `<i class="fa-solid fa-crosshairs"></i> <span class="qb-label">${game.i18n.localize("EX2E.ActionAttack")}</span> <i class="fa-solid fa-caret-up qb-caret"></i>`;
    this._tag(btn, "attack");
    if (modes.length === 0) {
      btn.disabled = true;
      btn.title = game.i18n.localize("EX2E.QuickbarNoEquipped");
    }
    return btn;
  }

  _castSpellButton(actor) {
    const spells = this._ownedSpells(actor);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("qb-btn", "qb-cast");
    btn.title = game.i18n.localize("EX2E.QuickbarCastTooltip");
    btn.innerHTML = `<i class="fa-solid fa-hat-wizard"></i> <span class="qb-label">${game.i18n.localize("EX2E.ActionCast")}</span> <i class="fa-solid fa-caret-up qb-caret"></i>`;
    this._tag(btn, "cast");
    if (spells.length === 0) {
      btn.disabled = true;
      btn.title = game.i18n.localize("EX2E.QuickbarNoSpells");
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
    btn.innerHTML = `${iconMarkup}<span class="qb-label">${label}</span> <small class="qb-speed">${cfg.speed}s</small>`;
    this._tag(btn, key);
    return btn;
  }

  _flurryButton(flurry) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("qb-btn", "qb-flurry");
    btn.title = game.i18n.localize("EX2E.FlurryDeclare");
    btn.innerHTML = `<i class="fa-solid fa-burst"></i> <span class="qb-label">${game.i18n.localize("EX2E.FlurryDeclare")}</span>`;
    this._tag(btn, "flurry");
    if (flurry) btn.disabled = true;
    return btn;
  }

  _finishButton() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("qb-btn", "qb-finish");
    btn.title = game.i18n.localize("EX2E.FinishTurn");
    btn.innerHTML = `<i class="fa-solid fa-forward-step"></i> <span class="qb-label">${game.i18n.localize("EX2E.FinishTurn")}</span>`;
    this._tag(btn, "finish");
    return btn;
  }

  _wire(combat, current) {
    const actor = current.actor;

    this._root.querySelector(".qb-attack")?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._toggleAttackSubmenu(ev.currentTarget, actor, current);
    });

    this._root.querySelector(".qb-cast")?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._toggleSpellsSubmenu(ev.currentTarget, actor);
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

    this._root.querySelectorAll(".qb-clinch").forEach(btn => {
      const key = btn.dataset.clinchAction;
      btn.addEventListener("click", () => this._handleClinchAction(key, combat, current));
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
    const modes = [
      ...this._equippedModes(actor),
      ...this._vehicleModes(current),
    ];
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

  // ── Cast Spell submenu ─────────────────────────────────────────────────
  /**
   * Popover list of every spell the actor knows. Each row is gated by
   * `computeSpellCastButtonState` (initiation, motes, WP, multi-tick
   * conflicts), shows the same tooltip as the Charms tab spell row,
   * and clicks route through the RAW-correct shaping pipeline via
   * `castSpellFlow`. Both sorcery and necromancy traditions are
   * handled — the flow reads `spell.system.tradition` to pick the
   * right initiation field and circle labels.
   */
  _toggleSpellsSubmenu(btn, actor) {
    if (!this._submenu.hidden) { this._hideSubmenu(); return; }
    const spells = this._ownedSpells(actor);
    if (spells.length === 0) return;

    this._submenu.replaceChildren(
      ...spells.map(s => {
        const row = document.createElement("button");
        row.type = "button";
        row.classList.add("qb-attack-mode");
        const cost = s.system?.cost ?? {};
        const costParts = [];
        const mStr = moteCostString(cost); if (mStr) costParts.push(mStr);
        const costLabel = costParts.join(" ") || "—";
        row.innerHTML = `<span class="mode-label">${s.name}</span><span class="mode-stats">${costLabel}</span>`;

        // Per-row gating — same logic as the Charms tab spell row + the
        // spell item sheet's Cast button. Disabled rows show the tooltip
        // explaining why (insufficient initiation / motes / WP / busy
        // with another action / etc.).
        const btnState = computeSpellCastButtonState(s);
        if (btnState.visible === false || btnState.enabled === false) {
          row.disabled = true;
          if (btnState.tooltip) row.dataset.tooltip = btnState.tooltip;
        } else {
          row.addEventListener("click", async (ev) => {
            ev.stopPropagation();
            this._hideSubmenu();
            const { castSpellFlow } = await import("./cast-spell-flow.mjs");
            await castSpellFlow(s);
          });
        }
        return row;
      })
    );

    const br = btn.getBoundingClientRect();
    this._submenu.hidden = false;
    const sw = this._submenu.offsetWidth;
    this._submenu.style.left = `${Math.max(8, br.left + br.width / 2 - sw / 2)}px`;
    this._submenu.style.bottom = `${window.innerHeight - br.top + 6}px`;
  }

  /** Actor's spells, sorted by tradition → circle → name for the submenu. */
  _ownedSpells(actor) {
    const list = [];
    for (const i of (actor?.items ?? [])) {
      if (i.type === "spell") list.push(i);
    }
    return list.sort((a, b) => {
      const ta = a.system?.tradition ?? "";
      const tb = b.system?.tradition ?? "";
      if (ta !== tb) return ta.localeCompare(tb);
      const ca = Number(a.system?.circle) || 0;
      const cb = Number(b.system?.circle) || 0;
      if (ca !== cb) return ca - cb;
      return a.name.localeCompare(b.name);
    });
  }

  // ── Passive render (no-combat, mid-action non-abortable, acted, etc.) ─
  /**
   * Render the bar in a stateless "browsing" mode: all action buttons are
   * shown for reference and the Attack submenu still fires `rollAttack`
   * against the given actor, but the Flurry / Finish Turn / pending
   * indicator are hidden and the generic action buttons have no click
   * handler. Move / Dash hover previews stay live because they only need
   * an actor's token to draw.
   *
   * @param {ExaltedActor|null} actor  Acting actor — may be null (GM with
   *                                   no assigned character and no active
   *                                   combatant); in that case Attack and
   *                                   previews simply no-op.
   */
  _renderPassive(actor) {
    this._hideMoveRange();
    const pieces = [];
    pieces.push(this._attackButton(actor));
    for (const [key, cfg] of Object.entries(EX2E.actions)) {
      if (cfg.clinchOnly) continue;
      // Shapeshift is Lunar-only (see _render).
      if (key === "shapeshift" && actor?.system?.exaltType !== "lunar") continue;
      pieces.push(this._actionButton(key, cfg));
      if (key === "simpleCharm") pieces.push(this._castSpellButton(actor));
    }
    this._applyLayout(pieces);
    this._wirePassive(actor);
  }

  _wirePassive(actor) {
    // Attack + Cast Spell remain functional out of combat — they each
    // resolve costs / rolls on the target item itself, no combatant
    // bookkeeping required.
    this._root.querySelector(".qb-attack")?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (!actor) return;
      this._toggleAttackSubmenu(ev.currentTarget, actor, null);
    });
    this._root.querySelector(".qb-cast")?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (!actor) return;
      this._toggleSpellsSubmenu(ev.currentTarget, actor);
    });
    if (!actor) return;
    this._root.querySelectorAll(".qb-action").forEach(btn => {
      const key = btn.dataset.actionKey;
      if (key === "move" || key === "dash") {
        btn.addEventListener("mouseenter", () => this._showMoveRange(actor, key));
        btn.addEventListener("mouseleave", () => this._hideMoveRange());
      }
      // Shapeshift works out of combat too — the dialog opens, motes are
      // spent, and activeFormId updates. The action commit (DV penalty +
      // pendingAction flag) only fires when there's a combatant.
      if (key === "shapeshift") {
        btn.addEventListener("click", () => {
          this._handleShapeshift(actor, null, EX2E.actions.shapeshift);
        });
      }
      // Click handlers for other generic actions land when Social / Mass
      // Combat modes ship; for now the buttons are reference-only in
      // passive mode.
    });
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
    btn.innerHTML = `<i class="fa-solid fa-ban"></i> <span class="qb-label">${game.i18n.localize("EX2E.AbortAction")}</span>`;
    btn.addEventListener("click", async () => {
      await this._handleAbort(current, committed);
    });
    this._tag(btn, "abort");

    this._applyLayout([indicator, btn]);
  }

  async _handleAbort(current, committed) {
    const actor = current.actor;
    if (!actor) return;
    // Mark the committed action aborted — downstream action-specific
    // effects (e.g. Aim's dice bonus) read this and skip applying. The
    // sticky DV penalty stays per the abortable-action rule; it clears
    // at the end of whatever the character commits next.
    // The combatant snaps back to the current wheel tick so they can
    // pick a new action right away (mid-action is over). Their acted
    // flag isn't touched — if they already acted this tick, the wheel
    // still advances normally before they're eligible again.
    const combat = game.combat;
    const updates = {
      "flags.exalted2e.committedAction": { ...committed, aborted: true }
    };
    if (combat) updates.initiative = combat.currentTick;

    // Multi-tick handler abort dispatch — gives the active consumer a
    // chance to clean up (refund costs, tear down sticky AEs). Aim's
    // onAbort returns clearAction:false so the flag stays put (its
    // -2-internal-on-divert is applied by next-commit's planCommitOther,
    // which needs the flag still present). Sorcery's onAbort refunds
    // motes/WP + tears down DV AE + returns clearAction:true.
    const { dispatchAbort } = await import("../combat/multi-tick.mjs");
    const { clearAction } = await dispatchAbort(current, combat);
    if (clearAction) {
      updates["flags.exalted2e.-=multiTickAction"] = null;
    }

    await current.update(updates);
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
   * Render a client-only circle on the interface layer showing Move (Dex) or
   * Dash (Dex + 3) reach for the active combatant's token.
   * Drawn using PIXI v8 Graphics; torn down by _hideMoveRange on mouse-leave.
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

    const hexColor = key === "dash" ? 0xf0a500 : 0xffe066;
    const radiusPx = distance * canvas.scene.grid.size;

    const token_id = Symbol("ex2e-move-preview");
    this._moveOverlayPending = token_id;

    await new Promise(r => requestAnimationFrame(r));

    if (this._moveOverlayPending !== token_id) return;

    const gfx = new PIXI.Graphics();
    gfx.lineStyle(2, hexColor, 0.8);
    gfx.beginFill(hexColor, 0.25);
    gfx.drawCircle(0, 0, radiusPx);
    gfx.endFill();
    gfx.position.set(token.center.x, token.center.y);

    if (!canvas?.interface) { gfx.destroy(); return; }
    canvas.interface.addChild(gfx);
    this._moveOverlay = gfx;
    this._moveOverlayPending = null;
  }

  _hideMoveRange() {
    this._moveOverlayPending = null;
    if (!this._moveOverlay) return;
    this._moveOverlay.parent?.removeChild(this._moveOverlay);
    this._moveOverlay.destroy();
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

  /** Weapon modes from the vehicle the current combatant is mounted on. */
  _vehicleModes(current) {
    const mountedOn = current?.actor?.flags?.exalted2e?.mountedOn;
    if (!mountedOn?.vehicleActorId) return [];
    const vehicle = game.actors?.get(mountedOn.vehicleActorId);
    if (!vehicle || vehicle.type !== "vehicle") return [];

    const out = [];
    for (const w of vehicle.items) {
      if (w.type !== "weapon" || !w.system.equipped) continue;
      const modes = w.system.modes ?? [];
      modes.forEach((mode, idx) => {
        out.push({
          weaponId:       w.id,
          vehicleActorId: vehicle.id,
          modeIndex:      idx,
          label:          modes.length > 1
            ? `[${vehicle.name}] ${w.name} — ${mode.name}`
            : `[${vehicle.name}] ${w.name}`,
          speed: mode.effectiveSpeed ?? mode.speed ?? 5,
          dvMod: 1,
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

  async _handleClinchAction(key, combat, current) {
    const { applyClinchSubAction } = await import("../rolls/clinch.mjs");
    await applyClinchSubAction(combat, current, key);
  }

  async _handleAction(key, actor, current) {
    const cfg = EX2E.actions[key];
    if (!cfg) return;
    // Shapeshift opens a sub-dialog to pick the target form, then runs the
    // normal action commit pipeline on confirm.
    if (key === "shapeshift") return this._handleShapeshift(actor, current, cfg);
    // Rise has its own pre-commit flow (adjacent-enemy check, optional
    // Dex + Dodge roll) that decides whether Prone clears on commit.
    if (key === "rise") return this._handleRise(actor, current, cfg);
    // Aim needs a target-picker and per-combatant aim-state
    // bookkeeping — offloaded to its own handler.
    if (key === "aim")        return this._handleAim(actor, current, cfg);
    if (key === "coordinate") return this._handleCoordinate(actor, current, cfg);
    const label = game.i18n.localize(cfg.labelKey);

    await this._clearPendingAction(actor, current);

    let dvEffectId = null;
    if (cfg.dvMod > 0) {
      const eff = await actor.applyDVPenalty(key, cfg.dvMod, {
        label: game.i18n.format("EX2E.QuickbarActionDvLabel", { name: label }),
        // Abortable actions (Aim, Guard) carry their DV penalty past
        // their own resolution — it only clears at the end of the
        // action-after-next. `advanceCurrentByTicks` flips the sticky
        // bit off at the next commit.
        sticky: !!cfg.abortable
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

  /**
   * Rise from Prone flow. Canon 2e: if no enemy is within one yard, the
   * character stands up unopposed; otherwise they must roll Dexterity +
   * Dodge at Difficulty 2. Either way the Rise action itself costs its
   * Speed / DV penalty, so the usual pendingAction stamp still fires.
   *
   * Failure path: Prone stays on the actor (and continues to impose its
   * external penalty on their future physical actions).
   */
  async _handleRise(actor, current, cfg) {
    if (!current) return; // Passive / no-combat — quickbar doesn't wire this
    const label = game.i18n.localize(cfg.labelKey);

    const { hasAdjacentEnemy } = await import("../helpers/targeting.mjs");
    const contested = hasAdjacentEnemy(actor, 1);

    let succeeded = true;
    let resultSuffix = "";
    if (contested) {
      const { ExaltedRoll } = await import("../rolls/exalted-roll.mjs");
      const roll = await ExaltedRoll.rollAttributeAbility(actor, "dexterity", "dodge", {
        flavor: game.i18n.localize("EX2E.RiseRollFlavor")
      });

      if (!roll) return; // User cancelled the roll dialog — abort the whole action.
      const successes = roll.successes ?? 0;
      succeeded = successes >= 2;
      resultSuffix = succeeded
        ? game.i18n.format("EX2E.RiseSucceededContested", { successes })
        : game.i18n.format("EX2E.RiseFailedContested",    { successes });
    } else {
      resultSuffix = game.i18n.localize("EX2E.RiseSucceededClear");
    }

    if (succeeded) {
      // Clear Prone via whichever effect carries the status.
      const proneEff = actor.effects.find(e => e.statuses?.has?.("prone"));
      if (proneEff) await proneEff.delete();
    }

    // Stamp the normal action bookkeeping regardless of success — the Rise
    // attempt costs Speed 5 / DV 2 either way.
    await this._clearPendingAction(actor, current);
    let dvEffectId = null;
    if (cfg.dvMod > 0) {
      const eff = await actor.applyDVPenalty("rise", cfg.dvMod, {
        label: game.i18n.format("EX2E.QuickbarActionDvLabel", { name: label })
      });
      dvEffectId = eff?.id ?? null;
    }
    await current.setFlag("exalted2e", "pendingAction", {
      actionKey: "rise",
      label,
      speed:     cfg.speed,
      dvPenalty: cfg.dvMod,
      abortable: !!cfg.abortable,
      dvEffectId
    });
    await this._postActionCard(actor, {
      label:     `${label} — ${resultSuffix}`,
      speed:     cfg.speed,
      dvPenalty: cfg.dvMod
    });
  }

  /**
   * Lunar shapeshift flow. Opens ShapeshiftDialog to pick a target form;
   * on confirm spends the appropriate motes (1m for true forms, 3m for
   * Heart's Blood), updates the actor's `activeFormId`, posts a chat card,
   * then runs the normal action commit (Speed 5 / -1 DV penalty / pending
   * action flag). On cancel: aborts entirely (no flag change, no motes,
   * no DV penalty).
   *
   * Non-Lunars who pick this action see only the Human option at 1m. They
   * can still commit, but the substitution layer no-ops on non-Lunars.
   */
  async _handleShapeshift(actor, current, cfg) {
    if (!actor) return;
    const { ShapeshiftDialog } = await import("../dialogs/shapeshift-dialog.mjs");
    const result = await ShapeshiftDialog.prompt({ actor });
    if (result === null) return;  // cancelled — abort

    const { targetFormId } = result;
    const targetFormType = result.targetFormType ??
      (actor.items.get(targetFormId)?.system?.formType ?? "");
    const isDBT = targetFormType === "warform";

    // DBT: let the player pick which Gift charms to activate (+2m each).
    let pickedGiftIds = [];
    if (isDBT) {
      const giftCharms = actor.items.filter(
        i => i.type === "charm" && (i.system?.keywords ?? []).includes("Gift")
      );
      if (giftCharms.length) {
        const essenceMax = actor.system.essence?.value ?? 1;
        const { GiftPickerDialog } = await import("../dialogs/gift-picker-dialog.mjs");
        pickedGiftIds = await GiftPickerDialog.prompt({
          gifts:      giftCharms.map(c => ({ id: c.id, name: c.name, img: c.img })),
          baseCost:   result.cost,
          essenceMax
        });
      }
    }
    const totalCost = result.cost + pickedGiftIds.length * 2;

    // Spend motes via the standard overflow-aware path.
    const breakdown = await actor.spendMotes(totalCost, "peripheral");
    if (!breakdown) return;  // insufficient motes — spendMotes already showed warn

    // Apply the form change.
    await actor.update({ "system.splat.lunar.activeFormId": targetFormId });

    // Activate the player-selected Gift charms.
    for (const id of pickedGiftIds) {
      const charm = actor.items.get(id);
      if (charm) await charm.update({ "system.active": true });
    }

    // Look up target form name for the chat card.
    let targetName;
    if (!targetFormId) {
      targetName = game.i18n.localize("EX2E.HumanShape");
    } else {
      const form = actor.items.get(targetFormId);
      targetName = form?.name ?? game.i18n.localize("EX2E.HeartsBloodForm");
    }

    // Post the shapeshift chat card.
    const cardContent = await foundry.applications.handlebars.renderTemplate(
      "systems/exalted2e/templates/chat/shapeshift-card.hbs",
      {
        actorName:  actor.name,
        targetName,
        cost:       totalCost,
        isDBT,
        toLabel:    targetFormId
          ? game.i18n.localize("EX2E.ShapeshiftToForm")
          : game.i18n.localize("EX2E.ShapeshiftToHuman")
      }
    );
    await ChatMessage.create({
      content: cardContent,
      speaker: ChatMessage.getSpeaker({ actor })
    });

    // Out-of-combat: stop here. No action commit (no combatant to flag,
    // no DV penalty, no Speed bookkeeping). The form change + mote spend
    // already happened above.
    if (!current) return;

    // Run the standard action commit (DV penalty + pendingAction flag + action card).
    const label = game.i18n.localize(cfg.labelKey);
    await this._clearPendingAction(actor, current);
    let dvEffectId = null;
    if (cfg.dvMod > 0) {
      const eff = await actor.applyDVPenalty("shapeshift", cfg.dvMod, {
        label: game.i18n.format("EX2E.QuickbarActionDvLabel", { name: label }),
        sticky: !!cfg.abortable
      });
      dvEffectId = eff?.id ?? null;
    }
    await current.setFlag("exalted2e", "pendingAction", {
      actionKey: "shapeshift",
      label,
      speed:     cfg.speed,
      dvPenalty: cfg.dvMod,
      abortable: !!cfg.abortable,
      dvEffectId
    });
    await this._postActionCard(actor, { label, speed: cfg.speed, dvPenalty: cfg.dvMod });
  }

  /**
   * Aim flow. Opens the canvas picker to choose a target, then stamps
   * an aim-state flag on the combatant and the normal abortable
   * pendingAction / sticky-DV pair. If Aim was already active against
   * the same target (re-aim), the existing aim's startTick + sticky DV
   * AE are preserved — no stacking, no fresh start. Aiming at a
   * different target resets both.
   *
   * Cancelling the target picker aborts the whole click (nothing
   * stamped). No-range check: the user said Aim has no reach limit.
   */
  async _handleAim(actor, current, cfg) {
    if (!current) return; // Aim needs a combat context to track state
    const { pickTargetActor } = await import("../helpers/targeting.mjs");
    const target = await pickTargetActor();
    if (!target) return;

    const label = game.i18n.format("EX2E.AimAtLabel", { target: target.name });
    await this._clearPendingAction(actor, current);

    // Preserve continuity when re-aiming at the same target. We keep
    // startTick (so computeAimBonus's lazy compute still caps at +3),
    // cycleCount (so onComplete's "first completion" guard still
    // suppresses chat after cycle 1), and the existing sticky DV AE
    // (so the -1 penalty doesn't re-stamp). We RESET ticksElapsed to 0
    // so the badge shows meaningful per-cycle progress.
    const existing    = current.flags?.exalted2e?.multiTickAction ?? null;
    const continuing  = existing?.actionKey === "aim"
                     && existing?.state?.targetActorId === target.id;
    const currentTick = game.combat?.currentTick ?? 0;
    const startTick   = continuing ? (existing.startTick ?? currentTick) : currentTick;

    let dvEffectId = null;
    const existingAimDv = continuing
      ? actor.effects.find(e =>
          e.flags?.exalted2e?.dvSticky === true
          && e.flags?.exalted2e?.dvPenalty?.type === "aim")
      : null;
    if (existingAimDv) {
      dvEffectId = existingAimDv.id;
    } else if (cfg.dvMod > 0) {
      const eff = await actor.applyDVPenalty("aim", cfg.dvMod, {
        label:  game.i18n.format("EX2E.QuickbarActionDvLabel", { name: label }),
        sticky: true
      });
      dvEffectId = eff?.id ?? null;
    }

    await current.setFlag("exalted2e", "multiTickAction", {
      actionKey:    "aim",
      startTick,
      totalTicks:   3,
      ticksElapsed: 0,
      cycleCount:   continuing ? (existing.cycleCount ?? 0) : 0,
      state: { targetActorId: target.id, dvEffectId }
    });
    await current.setFlag("exalted2e", "pendingAction", {
      actionKey:     "aim",
      label,
      speed:         cfg.speed,
      dvPenalty:     cfg.dvMod,
      abortable:     true,
      targetActorId: target.id,
      dvEffectId
    });

    await this._postActionCard(actor, { label, speed: cfg.speed, dvPenalty: cfg.dvMod });
  }

  async _handleCoordinate(actor, current, cfg) {
    const { CoordinationDialog } = await import("../dialogs/coordination-dialog.mjs");
    const combat = this._combat ?? game.combat;

    const result = await CoordinationDialog.prompt({ coordinator: actor, combat });
    if (!result) return;

    const { target, participants, pool, difficulty } = result;
    if (!target) return;

    await this._clearPendingAction(actor, current);

    const { ExaltedRoll } = await import("../rolls/exalted-roll.mjs");
    const roll = new ExaltedRoll({ pool });
    const rollResult = await roll.evaluate();
    const successes   = rollResult.successes ?? 0;
    const dvReduction = Math.max(0, Math.min(successes - difficulty, participants));

    const currentTick = combat?.combatants?.get(combat?.current?.combatantId)?.initiative ?? 0;
    const label = game.i18n.localize("EX2E.CoordinatedAttack");

    if (dvReduction > 0) {
      const ae = await target.applyDVPenalty("both", dvReduction, {
        label,
        dvRefreshable: false,
      });
      if (ae) {
        await ae.update({
          "flags.exalted2e.coordinationExpiry": { tick: currentTick }
        });
      }
    }

    const success = successes >= difficulty;
    const content = await foundry.applications.handlebars.renderTemplate(
      "systems/exalted2e/templates/chat/coordination-card.hbs",
      {
        coordinatorName: actor.name,
        targetName:      target.name,
        pool,
        successes,
        difficulty,
        dvReduction,
        tick:            currentTick,
        success,
        failLabel:       game.i18n.localize("EX2E.CoordinationFailed"),
      }
    );
    await ChatMessage.create({
      content,
      rolls:   [rollResult.foundryRoll],
      sound:   CONFIG.sounds.dice,
      speaker: ChatMessage.getSpeaker({ actor }),
    });

    const cfgLabel = game.i18n.localize(cfg.labelKey);
    await current.setFlag("exalted2e", "pendingAction", {
      actionKey: "coordinate",
      label:     cfgLabel,
      speed:     cfg.speed,
      dvPenalty: 0,
      abortable: false,
      dvEffectId: null,
    });
    await this._postActionCard(actor, { label: cfgLabel, speed: cfg.speed, dvPenalty: 0 });
  }

  async _handleAttack(mode, actor, current) {
    // In passive mode (no active owned combatant) we skip the combatant
    // bookkeeping — no DV penalty, no pendingAction, no committedAction —
    // and just fire the attack roll for out-of-combat convenience.
    if (current) {
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
        speed:     Math.max(1, mode.speed - (actor.system.bonuses?.speedReduction ?? 0)),
        dvPenalty: mode.dvMod,
        abortable: false,
        weaponId:  mode.weaponId,
        modeIndex: mode.modeIndex,
        dvEffectId
      });
    }
    const { ExaltedRoll } = await import("../rolls/exalted-roll.mjs");
    await ExaltedRoll.rollAttack(actor, mode.weaponId, {
      modeIndex:     mode.modeIndex,
      weaponActorId: mode.vehicleActorId,
    });

    // After rollAttack resolves its target (via pickTargetActor or the
    // pre-existing user target), capture the target's id on pendingAction
    // so the commit path can detect "attacking the aimed target" and
    // consume the aim flag instead of treating it as a divert.
    if (current) {
      const targetId = game.user.targets.first()?.actor?.id;
      const pending  = current.flags?.exalted2e?.pendingAction ?? null;
      if (targetId && pending?.actionKey === "attack") {
        await current.setFlag("exalted2e", "pendingAction", { ...pending, targetActorId: targetId });
      }
    }
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
 * tracker's Finish Turn button. Priority:
 *   • flurry flag       → commit by the flurry's Speed
 *   • pendingAction     → commit by the declared action's Speed
 *   • nothing declared  → commit a 1-tick pass (same rule applied when
 *                         the GM advances the wheel past an unacted
 *                         combatant)
 *
 * Declaration flags are cleared by `ExaltedCombat.advanceCurrentByTicks`.
 */
export async function finishTurnFor(combat, current) {
  const flurry  = current.flags?.exalted2e?.flurry ?? null;
  if (flurry) {
    await combat.advanceCurrentByTicks(flurry.speed);
    return;
  }
  const pending = current.flags?.exalted2e?.pendingAction ?? null;
  const speed = pending ? (pending.speed ?? 0) : 1;
  await combat.advanceCurrentByTicks(speed);
}
