import { vi, describe, it, expect, beforeEach } from "vitest";
import { registerSheets } from "../../module/setup/register-sheets.mjs";
import { CharacterSheet }       from "../../module/sheets/actor/character-sheet.mjs";
import { NpcSheet }             from "../../module/sheets/actor/npc-sheet.mjs";
import { UnitSheet }            from "../../module/sheets/actor/unit-sheet.mjs";
import { VehicleSheet }         from "../../module/sheets/actor/vehicle-sheet.mjs";
import { CharmSheet }           from "../../module/sheets/item/charm-sheet.mjs";
import { SpellSheet }           from "../../module/sheets/item/spell-sheet.mjs";
import { WeaponSheet }          from "../../module/sheets/item/weapon-sheet.mjs";
import { ArmorSheet }           from "../../module/sheets/item/armor-sheet.mjs";
import { GenericItemSheet }     from "../../module/sheets/item/generic-item-sheet.mjs";
import { KnackSheet }           from "../../module/sheets/item/knack-sheet.mjs";
import { VirtueFlawSheet }      from "../../module/sheets/item/virtueflaw-sheet.mjs";
import { UrgeSheet }            from "../../module/sheets/item/urge-sheet.mjs";
import { ComboSheet }           from "../../module/sheets/item/combo-sheet.mjs";
import { FormSheet }            from "../../module/sheets/item/form-sheet.mjs";
import { AnimaPowerSheet }      from "../../module/sheets/item/anima-power-sheet.mjs";
import { DestinySheet }         from "../../module/sheets/item/destiny-sheet.mjs";
import { ResplendencySheet }    from "../../module/sheets/item/resplendency-sheet.mjs";
import { MartialArtsStyleSheet } from "../../module/sheets/item/martial-arts-style-sheet.mjs";
import { ThaummArtSheet }       from "../../module/sheets/item/thaum-art-sheet.mjs";
import { ProcedureSheet }       from "../../module/sheets/item/procedure-sheet.mjs";

const Actors = foundry.documents.collections.Actors;
const Items  = foundry.documents.collections.Items;

describe("registerSheets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Actor sheet unregistration ────────────────────────────────────────────

  it("unregisters the core ActorSheet", () => {
    registerSheets();
    expect(Actors.unregisterSheet).toHaveBeenCalledWith("core", foundry.appv1.sheets.ActorSheet);
  });

  // ── Actor sheet registration ──────────────────────────────────────────────

  it("registers CharacterSheet as default for character type", () => {
    registerSheets();
    expect(Actors.registerSheet).toHaveBeenCalledWith("exalted2e", CharacterSheet, expect.objectContaining({
      types:       ["character"],
      makeDefault: true,
    }));
  });

  it("registers NpcSheet as default for npc type", () => {
    registerSheets();
    expect(Actors.registerSheet).toHaveBeenCalledWith("exalted2e", NpcSheet, expect.objectContaining({
      types:       ["npc"],
      makeDefault: true,
    }));
  });

  it("registers UnitSheet as default for unit type", () => {
    registerSheets();
    expect(Actors.registerSheet).toHaveBeenCalledWith("exalted2e", UnitSheet, expect.objectContaining({
      types:       ["unit"],
      makeDefault: true,
    }));
  });

  it("registers VehicleSheet as default for vehicle type", () => {
    registerSheets();
    expect(Actors.registerSheet).toHaveBeenCalledWith("exalted2e", VehicleSheet, expect.objectContaining({
      types:       ["vehicle"],
      makeDefault: true,
    }));
  });

  it("registers all four actor sheet types exactly once each", () => {
    registerSheets();
    const actorCalls = Actors.registerSheet.mock.calls.map(([_ns, cls]) => cls);
    expect(actorCalls).toContain(CharacterSheet);
    expect(actorCalls).toContain(NpcSheet);
    expect(actorCalls).toContain(UnitSheet);
    expect(actorCalls).toContain(VehicleSheet);
    expect(actorCalls).toHaveLength(4);
  });

  // ── Item sheet unregistration ─────────────────────────────────────────────

  it("unregisters the core ItemSheet", () => {
    registerSheets();
    expect(Items.unregisterSheet).toHaveBeenCalledWith("core", foundry.appv1.sheets.ItemSheet);
  });

  // ── Item sheet registration ───────────────────────────────────────────────

  it("registers CharmSheet for charm type", () => {
    registerSheets();
    expect(Items.registerSheet).toHaveBeenCalledWith("exalted2e", CharmSheet, expect.objectContaining({
      types: ["charm"], makeDefault: true,
    }));
  });

  it("registers SpellSheet for spell type", () => {
    registerSheets();
    expect(Items.registerSheet).toHaveBeenCalledWith("exalted2e", SpellSheet, expect.objectContaining({
      types: ["spell"], makeDefault: true,
    }));
  });

  it("registers WeaponSheet for weapon type", () => {
    registerSheets();
    expect(Items.registerSheet).toHaveBeenCalledWith("exalted2e", WeaponSheet, expect.objectContaining({
      types: ["weapon"], makeDefault: true,
    }));
  });

  it("registers ArmorSheet for armor type", () => {
    registerSheets();
    expect(Items.registerSheet).toHaveBeenCalledWith("exalted2e", ArmorSheet, expect.objectContaining({
      types: ["armor"], makeDefault: true,
    }));
  });

  it("registers GenericItemSheet for background, intimacy, meritflaw and other generic types", () => {
    registerSheets();
    expect(Items.registerSheet).toHaveBeenCalledWith("exalted2e", GenericItemSheet, expect.objectContaining({
      types: expect.arrayContaining(["background", "intimacy", "meritflaw"]),
      makeDefault: true,
    }));
  });

  it("registers KnackSheet for knack type", () => {
    registerSheets();
    expect(Items.registerSheet).toHaveBeenCalledWith("exalted2e", KnackSheet, expect.objectContaining({
      types: ["knack"], makeDefault: true,
    }));
  });

  it("registers VirtueFlawSheet for virtueflaw type", () => {
    registerSheets();
    expect(Items.registerSheet).toHaveBeenCalledWith("exalted2e", VirtueFlawSheet, expect.objectContaining({
      types: ["virtueflaw"], makeDefault: true,
    }));
  });

  it("registers specialty item sheets (urge, combo, form, animapower)", () => {
    registerSheets();
    const classes = Items.registerSheet.mock.calls.map(([_ns, cls]) => cls);
    expect(classes).toContain(UrgeSheet);
    expect(classes).toContain(ComboSheet);
    expect(classes).toContain(FormSheet);
    expect(classes).toContain(AnimaPowerSheet);
  });

  it("registers DestinySheet, ResplendencySheet, MartialArtsStyleSheet", () => {
    registerSheets();
    const classes = Items.registerSheet.mock.calls.map(([_ns, cls]) => cls);
    expect(classes).toContain(DestinySheet);
    expect(classes).toContain(ResplendencySheet);
    expect(classes).toContain(MartialArtsStyleSheet);
  });

  it("registers ThaummArtSheet and ProcedureSheet", () => {
    registerSheets();
    const classes = Items.registerSheet.mock.calls.map(([_ns, cls]) => cls);
    expect(classes).toContain(ThaummArtSheet);
    expect(classes).toContain(ProcedureSheet);
  });

  it("registers exactly 16 item sheets total", () => {
    registerSheets();
    expect(Items.registerSheet).toHaveBeenCalledTimes(16);
  });
});
