import { descriptionsField } from "./_shared/descriptions-field.mjs";

const fields = foundry.data.fields;

export class DestinyData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      destinyType:   new fields.StringField({ initial: "ascending", blank: false }),
      college:       new fields.StringField({ initial: "", blank: true }),
      collegeMaiden: new fields.StringField({ initial: "", blank: true }),
      effectPoints:  new fields.SchemaField({
        total: new fields.NumberField({ initial: 0, min: 0, integer: true }),
      }),
      finalized:     new fields.BooleanField({ initial: false }),
      paradoxGained: new fields.NumberField({ initial: 0, min: 0, integer: true }),
      providence:    new fields.SchemaField({
        key:    new fields.StringField({ initial: "", blank: true }),
        virtue: new fields.StringField({ initial: "", blank: true }),
      }),
      trigger:     new fields.StringField({ initial: "", blank: true }),
      scope:       new fields.NumberField({ initial: 0, min: 0, max: 10, integer: true }),
      duration:    new fields.NumberField({ initial: 0, min: 0, max: 10, integer: true }),
      frequency:    new fields.NumberField({ initial: 1, min: 1, max: 4,  integer: true }),
      description:  new fields.HTMLField({ initial: "" }),
      descriptions: descriptionsField(),
      // ── Resplendent Destiny (Phase 1) ──────────────────────────────────
      identity:  new fields.StringField({ initial: "", blank: true }),
      worn:      new fields.BooleanField({ initial: false }),
      ended:     new fields.BooleanField({ initial: false }),
      endurance: new fields.SchemaField({
        value: new fields.NumberField({ initial: 0, min: 0, integer: true }),
        max:   new fields.NumberField({ initial: 0, min: 0, integer: true }),
      }),
    };
  }

  prepareDerivedData() {
    this.isResplendent = this.destinyType === "resplendent";
    if (this.isResplendent) {
      // Resplendent destinies use College / Identity / Endurance, not the
      // trigger/scope/duration/frequency paradox budget. Scope is fixed at
      // 2 EP by the rules (sheet guidance, not enforced here).
      this.paradoxDice = 0;
      return;
    }
    const EX = game.exalted2e.EX2E;
    const trigger  = EX.destinyTrigger[this.trigger]?.paradoxDice    ?? 0;
    const scope    = EX.destinyScope[this.scope]?.paradoxDice         ?? 0;
    const duration = EX.destinyDuration[this.duration]?.paradoxDice   ?? 0;
    const freq     = EX.destinyFrequency[this.frequency]?.paradoxDice ?? 0;
    this.paradoxDice = trigger + scope + duration + freq;

    this.effectPoints.spent =
      (EX.destinyScope[this.scope]?.effectPoints        ?? 0) +
      (EX.destinyDuration[this.duration]?.effectPoints  ?? 0) +
      (EX.destinyFrequency[this.frequency]?.effectPoints ?? 0);

    this.invitesCensure = !!(
      EX.destinyScope[this.scope]?.invitesCensure      ||
      EX.destinyDuration[this.duration]?.invitesCensure ||
      EX.destinyFrequency[this.frequency]?.invitesCensure
    );
  }
}
