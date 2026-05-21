import { computeAttackExcellencyCaps } from "../rolls/excellency-math.mjs";
import { findCampaign, validateNewCampaign } from "../rolls/motivation-break-math.mjs";
import { moteCostString, charmVariableCostCtx, extractCharmActivations } from "../rolls/activation-ledger.mjs";
import { refreshPips } from "../helpers/pip-track.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * SocialAttackDialog — Collects social attack configuration.
 * Used by ExaltedRoll.rollSocialAttack().
 */
export class SocialAttackDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:      "ex2e-social-attack-dialog",
    // Intentionally NOT `tag: "dialog"`. ApplicationV2's position code
    // miscomputes `left` when it writes through a native modal <dialog>
    // element that also has `height: "auto"`, leaving the window stuck
    // off-axis. Using the standard Foundry window frame gives us
    // predictable, draggable positioning.
    classes: ["exalted2e", "roll-dialog", "social-attack-dialog"],
    position: { width: 420, height: "auto" },
    window: {
      title:        "EX2E.SocialAttackTitle",
      resizable:    false,
      minimizable:  false
    },
    actions: {
      confirmSocialAttack: SocialAttackDialog.#onConfirm,
      pickTarget:          SocialAttackDialog.#onPickTarget
    }
  };

  static PARTS = {
    form: {
      template: "systems/exalted2e/templates/dialog/social-attack-dialog.hbs"
    }
  };

  constructor(options = {}, resolve) {
    super(options);
    this._resolve  = resolve;
    this._resolved = false;
    this._attacker = options.attacker;
    this._data = {
      target:       options.target       ?? game.user.targets.first()?.actor ?? null,
      attribute:    options.attribute    ?? "charisma",
      ability:      options.ability      ?? "presence",
      intent:       options.intent       ?? "build",
      subject:      options.subject      ?? "",
      claims:       options.claims       ?? {
        supportingIntimacyId: null,
        supportingVirtue:     false,
        supportingMotivation: false,
        opposingIntimacyId:   null,
        opposingVirtue:       false,
        opposingMotivation:   false,
        immediateThreat:      false,
        unnaturalInfluence:   false
      },
      stuntDice:           String(options.stuntDice ?? 0),
      advancesMotivation:  options.advancesMotivation ?? false,
      rewardKind:          options.rewardKind         ?? "motes",
      // 3c-1: Excellency block defaults
      moteType:     options.moteType     ?? "peripheral",
      firstExcDice: options.firstExcDice ?? 0,
      secondExcSucc: options.secondExcSucc ?? 0,
      // 3c-2: Motivation-break campaign target
      targetMotivation: options.targetMotivation ?? "",
      // combo selector
      selectedComboId: options.selectedComboId ?? null
    };
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const a = this._attacker;
    const t = this._data.target;
    const attAppVal = a?.system?.attributes?.appearance?.value ?? 0;
    const defAppVal = t?.system?.attributes?.appearance?.value ?? 0;
    const appearanceDelta = Math.max(-3, Math.min(3, attAppVal - defAppVal));

    // 3c-1: charm picker. Filter to social-ability supplemental/reflexive-step-1
    // charms keyed to the currently-selected ability, excluding Excellencies.
    const SOCIAL_ABILITIES = ["presence", "performance", "investigation", "bureaucracy"];
    const allCharms = a?.items?.filter(i => i.type === "charm") ?? [];
    const eligible = allCharms.filter(c => {
      if (c.system.excellency) return false;
      if (c.system.ability !== this._data.ability) return false;
      if (!SOCIAL_ABILITIES.includes(c.system.ability)) return false;
      const ct = c.system.charmType;
      if (ct === "supplemental") return true;
      if (ct === "reflexive" && (c.system.steps ?? []).includes(1)) return true;
      return false;
    });
    const pickerCharms = eligible.map(c => {
      const cost = c.system?.cost ?? {};
      const parts = [];
      const mStr = moteCostString(cost); if (mStr) parts.push(mStr);
      const kws = c.system?.keywords ?? [];
      const TAG_KEYWORDS = ["Unnatural Mental Influence", "Compel", "Emotion", "Illusion"];
      const tags = kws.filter(k => TAG_KEYWORDS.includes(k));
      return {
        id:        c.id,
        name:      c.name,
        costLabel: parts.join(" · "),
        tagLabel:  tags.join(", "),
        isUmi:     kws.includes("Unnatural Mental Influence"),
        ...charmVariableCostCtx(c),
      };
    });
    this._pickerCharms = pickerCharms;

    // Eligible combos: actor combos with ≥1 social-ability supplemental/reflexive charm
    const combos = a?.items?.filter(i => i.type === "combo") ?? [];
    const eligibleCombos = combos.map(combo => {
      const charmUids = combo.system?.charmUids ?? [];
      const socialCount = charmUids.filter(uid => {
        const charm = a.items.find(c => c.type === "charm" && c.system?.charmUid === uid);
        if (!charm) return false;
        if (charm.system.ability !== this._data.ability) return false;
        if (!SOCIAL_ABILITIES.includes(charm.system.ability)) return false;
        const ct = charm.system.charmType;
        return ct === "supplemental" || (ct === "reflexive" && (charm.system.steps ?? []).includes(1));
      }).length;
      return socialCount > 0 ? { id: combo.id, name: combo.name, charmCount: socialCount } : null;
    }).filter(Boolean);

    // 3c-1: Excellency caps
    const { firstExcMax, secondExcMax } = a
      ? computeAttackExcellencyCaps(a, this._data.attribute, this._data.ability)
      : { firstExcMax: 0, secondExcMax: 0 };

    // 3c-2: detect existing Motivation-break campaign for the (attacker, defender) pair
    const existingCampaign = (a && t)
      ? findCampaign(t, a.id)
      : null;
    const isBreakIntent = this._data.intent === "break-motivation";
    const campaignInProgress = isBreakIntent && existingCampaign?.status === "active";
    const campaignTargetReadOnly = campaignInProgress;
    const effectiveTargetMotivation = campaignInProgress
      ? existingCampaign.targetMotivation
      : this._data.targetMotivation;
    const campaignProgressLabel = campaignInProgress
      ? game.i18n.format("EX2E.MotivationBreakCampaignInProgress", { count: existingCampaign.attemptCount ?? 0 })
      : "";

    return {
      ...context,
      ...this._data,
      appearanceDelta,
      pickerCharms,
      hasPickerCharms: pickerCharms.length > 0,
      eligibleCombos,
      hasEligibleCombos: eligibleCombos.length > 0,
      firstExcMax,
      secondExcMax,
      isBreakIntent,
      campaignInProgress,
      campaignTargetReadOnly,
      effectiveTargetMotivation,
      campaignProgressLabel,
      stuntChoices: {
        0: game.i18n.localize("EX2E.NoStunt"),
        1: game.i18n.localize("EX2E.Stunt1"),
        2: game.i18n.localize("EX2E.Stunt2"),
        3: game.i18n.localize("EX2E.Stunt3")
      },
      moteTypeChoices: {
        personal:   game.i18n.localize("EX2E.MotesPersonal"),
        peripheral: game.i18n.localize("EX2E.MotesPeripheral")
      },
      defenderIntimacies: (this._data.target?.items ?? [])
        .filter(i => i.type === "intimacy")
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(i => ({
          id:        i.id,
          name:      i.name,
          positive:  i.system?.positive ?? true,
          intensity: i.system?.intensity ?? "minor",
          strength:  i.system?.strength  ?? 0
        })),
      useIntimacyIntensity: game.settings.get("exalted2e", "useIntimacyIntensity"),
    };
  }

  _onRender(context, options) {
    const el = this.element;
    const firstPipTrack  = el.querySelector(".exc-pip-track[data-exc='first']");
    const secondPipTrack = el.querySelector(".exc-pip-track[data-exc='second']");
    const firstHidden    = el.querySelector("[name='firstExcDice']");
    const secondHidden   = el.querySelector("[name='secondExcSucc']");
    const totalCostEl    = el.querySelector(".exc-total-cost");
    const umiCheckbox    = el.querySelector("[name='unnaturalInfluence']");
    const umiHint        = el.querySelector(".umi-charm-driven-hint");
    const pickerInputs   = el.querySelectorAll(".attack-charm-picker input[type='checkbox']");

    const currentFirstExcMax  = context.firstExcMax;
    const currentSecondExcMax = context.secondExcMax;

    const enforceExcCap = () => {
      const firstVal      = parseInt(firstHidden?.value)  || 0;
      const secondVal     = (parseInt(secondHidden?.value) || 0) * 2;
      const secondAllowed = Math.min(currentSecondExcMax, Math.floor((currentFirstExcMax - firstVal) / 2));
      const firstAllowed  = Math.min(currentFirstExcMax,  currentFirstExcMax - secondVal);
      refreshPips(firstPipTrack,  firstHidden,  Math.max(0, firstAllowed));
      refreshPips(secondPipTrack, secondHidden, Math.max(0, secondAllowed));
      if (firstVal > firstAllowed && firstHidden)
        firstHidden.value = Math.max(0, firstAllowed);
      if ((parseInt(secondHidden?.value) || 0) > secondAllowed && secondHidden)
        secondHidden.value = Math.max(0, secondAllowed);
    };

    const updateTotal = () => {
      enforceExcCap();
      if (!totalCostEl) return;
      const firstCost  = parseInt(firstHidden?.value)  || 0;
      const secondCost = (parseInt(secondHidden?.value) || 0) * 2;
      totalCostEl.textContent = firstCost + secondCost;
    };

    const updateUmiLock = () => {
      const anyUmiPicked = Array.from(pickerInputs).some(input => {
        if (!input.checked) return false;
        return input.dataset.umi === "true";
      });
      if (!umiCheckbox) return;
      if (anyUmiPicked) {
        umiCheckbox.checked  = true;
        umiCheckbox.disabled = true;
        if (umiHint) umiHint.style.display = "";
      } else {
        umiCheckbox.disabled = false;
        if (umiHint) umiHint.style.display = "none";
      }
    };

    firstPipTrack?.addEventListener("click", (e) => {
      const pip = e.target.closest(".exc-pip");
      if (!pip) return;
      const v = parseInt(pip.dataset.value);
      firstHidden.value = (parseInt(firstHidden?.value) || 0) === v ? 0 : v;
      updateTotal();
    });
    secondPipTrack?.addEventListener("click", (e) => {
      const pip = e.target.closest(".exc-pip");
      if (!pip) return;
      const v = parseInt(pip.dataset.value);
      secondHidden.value = (parseInt(secondHidden?.value) || 0) === v ? 0 : v;
      updateTotal();
    });
    updateTotal();
    pickerInputs.forEach(input => input.addEventListener("change", updateUmiLock));

    // Re-render on attribute/ability change so the picker filter and
    // Excellency caps refresh against the new selection.
    const attrSelect    = el.querySelector("[name='attribute']");
    const abilitySelect = el.querySelector("[name='ability']");
    attrSelect?.addEventListener("change", (e) => {
      this._data.attribute = e.target.value;
      this.render();
    });
    abilitySelect?.addEventListener("change", (e) => {
      this._data.ability = e.target.value;
      this.render();
    });
    const intentSelect = el.querySelector("[name='intent']");
    intentSelect?.addEventListener("change", (e) => {
      this._data.intent = e.target.value;
      this.render();
    });
    const supportingIntimacySelect = el.querySelector("[name='supportingIntimacyId']");
    const opposingIntimacySelect   = el.querySelector("[name='opposingIntimacyId']");
    supportingIntimacySelect?.addEventListener("change", (e) => {
      this._data.claims.supportingIntimacyId = e.target.value || null;
    });
    opposingIntimacySelect?.addEventListener("change", (e) => {
      this._data.claims.opposingIntimacyId = e.target.value || null;
    });
    // 3c-2: mirror typed Target Motivation into _data so re-renders preserve it.
    const targetMotivationInput = el.querySelector("[name='targetMotivation']");
    targetMotivationInput?.addEventListener("input", (e) => {
      this._data.targetMotivation = e.target.value;
    });

    // Mirror stunt fields into _data so re-renders preserve user choices.
    el.querySelector("[name='stuntAdvancesMotivation']")?.addEventListener("change", (e) => {
      this._data.advancesMotivation = e.target.checked;
    });
    el.querySelectorAll("[name='stuntRewardKind']").forEach(r => {
      r.addEventListener("change", (e) => {
        this._data.rewardKind = e.target.value;
      });
    });

    // Combo selector: toggling a combo radio hides/shows the individual picker.
    el.querySelectorAll("[name='selectedComboId']").forEach(radio => {
      radio.addEventListener("change", () => {
        const checked = el.querySelector("[name='selectedComboId']:checked");
        this._data.selectedComboId = checked?.value || null;
        const pickerSection = el.querySelector(".attack-charm-picker");
        if (pickerSection) {
          pickerSection.style.display = this._data.selectedComboId ? "none" : "";
        }
      });
    });

    // Apply initial visibility if a combo was pre-selected.
    if (this._data.selectedComboId) {
      const pickerSection = el.querySelector(".attack-charm-picker");
      if (pickerSection) pickerSection.style.display = "none";
    }

    updateTotal();
    updateUmiLock();

    // Stunt sub-fields driven by the stuntDice selector (not "stunt").
    const stuntSelect   = el.querySelector("[name='stuntDice']");
    const motivationRow = el.querySelector(".stunt-motivation-row");
    const rewardPrefRow = el.querySelector(".stunt-reward-pref-row");
    const updateStuntFields = () => {
      const v = parseInt(stuntSelect?.value) || 0;
      if (motivationRow) motivationRow.style.display = v >= 1 ? "" : "none";
      if (rewardPrefRow) rewardPrefRow.style.display = v >= 2 ? "" : "none";
    };
    stuntSelect?.addEventListener("change", updateStuntFields);
    updateStuntFields();
  }

  static async #onPickTarget(event, target) {
    const { pickTargetActor } = await import("../helpers/targeting.mjs");
    const picked = await pickTargetActor();
    if (picked) {
      this._data.target = picked;
      this.render();
    }
  }

  static #onConfirm(event, target) {
    const form = this.element.querySelector("form");
    const fd   = new foundry.applications.ux.FormDataExtended(form);
    const data = fd.object;

    if (!this._data.target) {
      ui.notifications.warn(game.i18n.localize("EX2E.NoTargetSelected"));
      return;
    }

    // 3c-2: Motivation-break validation
    if ((data.intent || this._data.intent) === "break-motivation") {
      const validation = validateNewCampaign({
        attacker:         this._attacker,
        defender:         this._data.target,
        targetMotivation: data.targetMotivation ?? this._data.targetMotivation ?? ""
      });
      if (!validation.ok) {
        const reasonKey = {
          "npc-defender-unsupported": "EX2E.MotivationBreakNpcDefenderUnsupported",
          "self-attack":              "EX2E.MotivationBreakSelfAttack",
          "blank-target":             "EX2E.MotivationBreakBlankTarget",
          "target-equals-current":    "EX2E.MotivationBreakTargetEqualsCurrent",
          "already-broken":           "EX2E.MotivationBreakAlreadyBroken"
        }[validation.reason];
        if (reasonKey) {
          ui.notifications.warn(game.i18n.localize(reasonKey));
        } else {
          // Defensive fallback if validateNewCampaign gains a new reason
          // string before this map is updated.
          console.warn(`exalted2e | Unknown Motivation-break validation reason: ${validation.reason}`);
          ui.notifications.warn(`Cannot start Motivation-break campaign (${validation.reason ?? "unknown reason"}).`);
        }
        return;
      }
    }

    // 3c-1: Collect picker charm ids + variable-cost selections.
    const charmActivations = extractCharmActivations(data, this._pickerCharms ?? []);
    const charmIds = charmActivations.map(a => a.id);

    this._resolved = true;
    this._resolve({
      defender:  this._data.target,
      attribute: data.attribute  || "charisma",
      ability:   data.ability    || "presence",
      intent:    data.intent     || "build",
      subject:   data.subject    || "",
      claims: {
        supportingIntimacyId: data.supportingIntimacyId || null,
        supportingVirtue:     !!data.supportingVirtue,
        supportingMotivation: !!data.supportingMotivation,
        opposingIntimacyId:   data.opposingIntimacyId || null,
        opposingVirtue:       !!data.opposingVirtue,
        opposingMotivation:   !!data.opposingMotivation,
        immediateThreat:      !!data.immediateThreat,
        unnaturalInfluence:   !!data.unnaturalInfluence
      },
      stuntDice:          Number(data.stuntDice) || 0,
      advancesMotivation: !!data.stuntAdvancesMotivation,
      rewardKind:         data.stuntRewardKind === "willpower" ? "willpower" : "motes",
      // 3c-1
      charmIds,
      charmActivations,
      firstExcDice:  parseInt(data.firstExcDice)  || 0,
      secondExcSucc: parseInt(data.secondExcSucc) || 0,
      moteType:      data.moteType || "peripheral",
      // 3c-2
      targetMotivation: data.targetMotivation ?? this._data.targetMotivation ?? "",
      // combo selector
      selectedComboId: this._data.selectedComboId ?? null
    });
    this.close();
  }

  _onClose(options) {
    if (!this._resolved) this._resolve(null);
  }

  static async prompt(options = {}) {
    return new Promise(resolve => {
      const dialog = new SocialAttackDialog(options, resolve);
      dialog.render({ force: true });
    });
  }
}
