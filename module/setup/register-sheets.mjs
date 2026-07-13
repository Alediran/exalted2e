import { CharacterSheet }           from "../sheets/actor/character-sheet.mjs";
import { NpcSheet }         from "../sheets/actor/npc-sheet.mjs";
import { UnitSheet }   from "../sheets/actor/unit-sheet.mjs";
import { VehicleSheet }   from "../sheets/actor/vehicle-sheet.mjs";
import { FairFolkSheet }  from "../sheets/actor/fairfolk-sheet.mjs";
import { CharmSheet }       from "../sheets/item/charm-sheet.mjs";
import { SpellSheet }       from "../sheets/item/spell-sheet.mjs";
import { WeaponSheet }      from "../sheets/item/weapon-sheet.mjs";
import { ArmorSheet }       from "../sheets/item/armor-sheet.mjs";
import { GenericItemSheet } from "../sheets/item/generic-item-sheet.mjs";
import { KnackSheet }      from "../sheets/item/knack-sheet.mjs";
import { VirtueFlawSheet } from "../sheets/item/virtueflaw-sheet.mjs";
import { UrgeSheet }       from "../sheets/item/urge-sheet.mjs";
import { ComboSheet }       from "../sheets/item/combo-sheet.mjs";
import { FormSheet }        from "../sheets/item/form-sheet.mjs";
import { AnimaPowerSheet }  from "../sheets/item/anima-power-sheet.mjs";
import { DestinySheet }          from "../sheets/item/destiny-sheet.mjs";
import { ResplendencySheet }     from "../sheets/item/resplendency-sheet.mjs";
import { MartialArtsStyleSheet } from "../sheets/item/martial-arts-style-sheet.mjs";
import { ThaummArtSheet }  from "../sheets/item/thaum-art-sheet.mjs";
import { ProcedureSheet }  from "../sheets/item/procedure-sheet.mjs";

// from init #1
export function registerSheets() {
  foundry.documents.collections.Actors.unregisterSheet("core", foundry.appv1.sheets.ActorSheet);
  foundry.documents.collections.Actors.registerSheet("exalted2e", CharacterSheet, {
    types:     ["character"],
    makeDefault: true,
    label:     "EX2E.SheetCharacter"
  });
  foundry.documents.collections.Actors.registerSheet("exalted2e", NpcSheet, {
    types:     ["npc"],
    makeDefault: true,
    label:     "EX2E.SheetNpc"
  });
  foundry.documents.collections.Actors.registerSheet("exalted2e", UnitSheet, {
    types:     ["unit"],
    makeDefault: true,
    label:     "EX2E.SheetUnit"
  });
  foundry.documents.collections.Actors.registerSheet("exalted2e", VehicleSheet, {
    types:       ["vehicle"],
    makeDefault: true,
    label:       "EX2E.SheetVehicle",
  });
  foundry.documents.collections.Actors.registerSheet("exalted2e", FairFolkSheet, {
    types:       ["fairfolk"],
    makeDefault: true,
    label:       "EX2E.SheetFairFolk",
  });

  foundry.documents.collections.Items.unregisterSheet("core", foundry.appv1.sheets.ItemSheet);
  foundry.documents.collections.Items.registerSheet("exalted2e", CharmSheet, {
    types:     ["charm"],
    makeDefault: true,
    label:     "EX2E.SheetCharm"
  });
  foundry.documents.collections.Items.registerSheet("exalted2e", SpellSheet, {
    types:     ["spell"],
    makeDefault: true,
    label:     "EX2E.SheetSpell"
  });
  foundry.documents.collections.Items.registerSheet("exalted2e", WeaponSheet, {
    types:     ["weapon"],
    makeDefault: true,
    label:     "EX2E.SheetWeapon"
  });
  foundry.documents.collections.Items.registerSheet("exalted2e", ArmorSheet, {
    types:     ["armor"],
    makeDefault: true,
    label:     "EX2E.SheetArmor"
  });
  foundry.documents.collections.Items.registerSheet("exalted2e", GenericItemSheet, {
    types:     ["background", "intimacy", "meritflaw", "equipment", "hearthstone",
                "poison", "disease", "drug", "mutation", "manse", "manse-power", "familiar", "cult",
                "command", "followers", "ammo"],
    makeDefault: true,
    label:     "EX2E.SheetGenericItem"
  });
  foundry.documents.collections.Items.registerSheet("exalted2e", KnackSheet, {
    types:     ["knack"],
    makeDefault: true,
    label:     "EX2E.SheetKnack"
  });
  foundry.documents.collections.Items.registerSheet("exalted2e", VirtueFlawSheet, {
    types:     ["virtueflaw"],
    makeDefault: true,
    label:     "EX2E.SheetVirtueFlaw"
  });
  foundry.documents.collections.Items.registerSheet("exalted2e", UrgeSheet, {
    types:       ["urge"],
    makeDefault: true,
    label:       "EX2E.UrgeItemType"
  });
  foundry.documents.collections.Items.registerSheet("exalted2e", ComboSheet, {
    types:     ["combo"],
    makeDefault: true,
    label:     "EX2E.SheetCombo"
  });
  foundry.documents.collections.Items.registerSheet("exalted2e", FormSheet, {
    types:     ["form"],
    makeDefault: true,
    label:     "EX2E.SheetForm"
  });
  foundry.documents.collections.Items.registerSheet("exalted2e", AnimaPowerSheet, {
    types:     ["animapower"],
    makeDefault: true,
    label:     "EX2E.SheetAnimaPower"
  });
  foundry.documents.collections.Items.registerSheet("exalted2e", DestinySheet, {
    types:       ["destiny"],
    makeDefault: true,
    label:       game.i18n.localize("EX2E.DestinySheet"),
  });
  foundry.documents.collections.Items.registerSheet("exalted2e", ResplendencySheet, {
    types:       ["resplendency"],
    makeDefault: true,
    label:       "EX2E.SheetResplendency",
  });
  foundry.documents.collections.Items.registerSheet("exalted2e", MartialArtsStyleSheet, {
    types:       ["martialartsstyle"],
    makeDefault: true,
    label:       "EX2E.MartialArtsStyle"
  });
  foundry.documents.collections.Items.registerSheet("exalted2e", ThaummArtSheet, {
    types:       ["thaum-art"],
    makeDefault: true,
    label:       "EX2E.ItemTypeThaummArt",
  });
  foundry.documents.collections.Items.registerSheet("exalted2e", ProcedureSheet, {
    types:       ["procedure"],
    makeDefault: true,
    label:       "EX2E.ItemTypeProcedure",
  });
}
