/**
 * register-documents.mjs
 * Registers document classes, data models, and CONFIG entries for the
 * Exalted 2nd Edition system. Called from the main "init" hook.
 */

// ── Imports ─────────────────────────────────────────────────────────────────
import { EX2E }             from "../config.mjs";
import { ExaltedActor }     from "../documents/actor.mjs";
import { ExaltedItem }      from "../documents/item.mjs";
import { ExaltedCombat }    from "../documents/combat.mjs";
import { CharacterData }    from "../data/actor/character-data.mjs";
import { NpcData }          from "../data/actor/npc-data.mjs";
import { UnitData }         from "../data/actor/unit-data.mjs";
import { VehicleData }      from "../data/actor/vehicle-data.mjs";
import { FairFolkData }    from "../data/actor/fairfolk-data.mjs";
import { CharmData }        from "../data/item/charm-data.mjs";
import { SpellData }        from "../data/item/spell-data.mjs";
import { WeaponData }       from "../data/item/weapon-data.mjs";
import { ArmorData }        from "../data/item/armor-data.mjs";
import { BackgroundData }   from "../data/item/background-data.mjs";
import { IntimacyData }     from "../data/item/intimacy-data.mjs";
import { MeritFlawData }    from "../data/item/meritflaw-data.mjs";
import { KnackData }        from "../data/item/knack-data.mjs";
import { VirtueFlawData }   from "../data/item/virtueflaw-data.mjs";
import { ComboData }        from "../data/item/combo-data.mjs";
import { FormData }         from "../data/item/form-data.mjs";
import { AnimaPowerData }   from "../data/item/anima-power-data.mjs";
import { UrgeData }         from "../data/item/urge-data.mjs";
import { DestinyData }      from "../data/item/destiny-data.mjs";
import { ResplendencyData } from "../data/item/resplendency-data.mjs";
import { EquipmentData }    from "../data/item/equipment-data.mjs";
import { HearthstoneData }          from "../data/item/hearthstone-data.mjs";
import { MartialArtsStyleData }     from "../data/item/martial-arts-style-data.mjs";
import { PoisonData }    from "../data/item/poison-data.mjs";
import { DiseaseData }   from "../data/item/disease-data.mjs";
import { DrugData }      from "../data/item/drug-data.mjs";
import { MutationData }  from "../data/item/mutation-data.mjs";
import { ManseData }     from "../data/item/manse-data.mjs";
import { MansePowerData } from "../data/item/manse-power-data.mjs";
import { FamiliarData }  from "../data/item/familiar-data.mjs";
import { CultData }      from "../data/item/cult-data.mjs";
import { CommandData }   from "../data/item/command-data.mjs";
import { FollowersData } from "../data/item/followers-data.mjs";
import { ThaummArtData }  from "../data/item/thaum-art-data.mjs";
import { ProcedureData }  from "../data/item/procedure-data.mjs";
import { AmmoData }       from "../data/item/ammo-data.mjs";
import { MaladosData }    from "../data/item/malados-data.mjs";
import { HazardDamageBehaviorType }    from "../data/region-behaviors/hazard-damage.mjs";
import { TerrainModifierBehaviorType } from "../data/region-behaviors/terrain-modifier.mjs";
import { GmRollPoolDialog }   from "../dialogs/gm-roll-pool-dialog.mjs";
import { CharmTreeDialog }    from "../apps/charm-tree-dialog.mjs";

// ── Registration function ────────────────────────────────────────────────────

export function registerDocuments() {
  // from init #1

  // Expose config on the game object
  game.exalted2e = {
    EX2E,
    CharmTreeDialog,
    gmRollPool: (options = {}) => GmRollPoolDialog.prompt(options)
  };

  // ── Document Classes ────────────────────────────────────────────────────
  CONFIG.Actor.documentClass  = ExaltedActor;
  CONFIG.Item.documentClass   = ExaltedItem;
  CONFIG.Combat.documentClass = ExaltedCombat;
  // Initiative is driven by Join Battle (Wits + Awareness) and the tick
  // advance after each action — Foundry's built-in per-combatant roll isn't
  // used, so give it a null formula.
  CONFIG.Combat.initiative = { formula: "0", decimals: 0 };
  // Swap the default d20 on the per-combatant Roll Initiative button for a d10
  // — Exalted rolls d10 pools. Foundry ships d10-grey.svg; no highlight
  // variant exists, so we reuse it for hover (the :hover drop-shadow still
  // makes the button feel interactive).
  CONFIG.Combat.initiativeIcon = {
    icon:  "/systems/exalted2e/assets/icons/d10.svg",
    hover: "/systems/exalted2e/assets/icons/d10-highlight.svg"
  };

  // ── Data Models ─────────────────────────────────────────────────────────
  CONFIG.Actor.dataModels = {
    character: CharacterData,
    npc:       NpcData,
    unit:      UnitData,
    vehicle:   VehicleData,
    fairfolk:  FairFolkData,
  };
  CONFIG.Item.dataModels = {
    charm:      CharmData,
    spell:      SpellData,
    weapon:     WeaponData,
    armor:      ArmorData,
    background: BackgroundData,
    intimacy:   IntimacyData,
    meritflaw:  MeritFlawData,
    knack:      KnackData,
    virtueflaw: VirtueFlawData,
    combo:      ComboData,
    form:       FormData,
    animapower: AnimaPowerData,
    urge:       UrgeData,
    destiny:    DestinyData,
    resplendency: ResplendencyData,
    equipment:   EquipmentData,
    hearthstone:      HearthstoneData,
    martialartsstyle: MartialArtsStyleData,
    poison:    PoisonData,
    disease:   DiseaseData,
    drug:      DrugData,
    mutation:  MutationData,
    manse:     ManseData,
    "manse-power": MansePowerData,
    familiar:  FamiliarData,
    cult:      CultData,
    command:   CommandData,
    followers:   FollowersData,
    "thaum-art": ThaummArtData,
    procedure:   ProcedureData,
    ammo:        AmmoData,
    malados:     MaladosData,
  };

  // ── Region Behavior Types ────────────────────────────────────────────────
  CONFIG.RegionBehavior.dataModels["hazardDamage"]     = HazardDamageBehaviorType;
  CONFIG.RegionBehavior.dataModels["terrainModifier"] = TerrainModifierBehaviorType;

  // ── CONFIG Additions ────────────────────────────────────────────────────
  CONFIG.EX2E = EX2E;

  // Strip status effects that have no meaning in Exalted 2e. This covers both
  // Foundry built-ins that don't apply to the system and any extras injected
  // by modules (shields, blessings, RPG-generic markers, etc.).
  for (const id of [
    "invisible", "frozen",  "burning",
    "silence",   "marked",  "targeted", "target",
    "holyShield","magicShield","coldShield","fireShield",
    "bless",     "eye",     "downgrade", "upgrade",
    "degen",     "regen",   "curse",     "shock"
  ]) {
    delete CONFIG.statusEffects[id];
  }

  // Enrich Foundry built-in status effects with Exalted 2e mechanical flags.
  // Storing flags on the entry means the AE Foundry creates from the token HUD
  // already carries the right payload — the roll pipelines aggregate every
  // active effect with a `flags.exalted2e.externalPenalty` and subtract.
  const _enrichStatus = (id, flags, tooltip) => {
    const entry = CONFIG.statusEffects[id];
    if (entry) {
      entry.name = tooltip ?? entry.name;
      entry.flags = foundry.utils.mergeObject(entry.flags ?? {}, { exalted2e: flags });
    }
  };

  _enrichStatus("prone",      { externalPenalty: { value: 1, type: "physical" } });
  _enrichStatus("stun",    { externalPenalty: { value: 4, type: "all" } });
  _enrichStatus("blind",      { externalPenalty: { value: 2, type: "physical" }, blind: true });
  _enrichStatus("deaf",       { deaf: true });
  // Foundry's "restrained" maps to the 2e Clinch/Grapple condition.
  _enrichStatus("restrain", { externalPenalty: { value: 2, type: "physical" }, grappled: true }, "EX2E.StatusClinch");
  _enrichStatus("fly",        { flying: true });
  // Poison/disease mark the condition for detection; specific penalties come
  // from the Poison/Disease item that applied the condition.
  _enrichStatus("poison",     { poisoned: true });
  _enrichStatus("disease",    { diseased: true });

  // Custom statuses — not in Foundry's built-in list.
  Object.assign(CONFIG.statusEffects, {
    // Cover: defender on higher/behind cover is harder to hit.
    lightCover:      { id: "lightCover",      name: "EX2E.StatusLightCover",      img: "icons/svg/ruins.svg",   flags: { exalted2e: { dvBonus: { dodge: 1, parry: 0 } } } },
    heavyCover:      { id: "heavyCover",      name: "EX2E.StatusHeavyCover",      img: "icons/svg/castle.svg",  flags: { exalted2e: { dvBonus: { dodge: 2, parry: 1 } } } },
    // Height advantage: attacker on higher ground is harder to hit in return.
    heightAdvantage: { id: "heightAdvantage", name: "EX2E.StatusHeightAdvantage", img: "icons/svg/up.svg",      flags: { exalted2e: { dvBonus: { dodge: 1, parry: 1 } } } },
    // Crippling injury: −1 internal penalty to all physical actions until surgically healed.
    crippled:        { id: "crippled",        name: "EX2E.StatusCrippled",        img: "icons/svg/blood.svg",   flags: { exalted2e: { internalPenalty: { value: 1, type: "physical" }, crippled: true } } },
    // Dematerialized: spirit is in the spirit world; only harmImmaterial attacks can hit.
    dematerialized:  { id: "dematerialized",  name: "EX2E.StatusDematerialized",  img: "icons/svg/eye.svg",     flags: { exalted2e: { dematerialized: true } } },
    // Shaped: raksha is wearing their natural form; required to activate ShapedOnly charms.
    shaped:          { id: "shaped",          name: "EX2E.StatusShaped",          img: "icons/magic/symbols/runes-star-magenta.webp", flags: { exalted2e: { shaped: true } } },
  });
  // Unit mass-combat states — pushed as plain array entries so toggleStatusEffect / .find() can locate them by id.
  CONFIG.statusEffects.push(
    { id: "unit-hesitating", name: "EX2E.StatusHesitating", img: "icons/svg/stun.svg"  },
    { id: "unit-engaged",    name: "EX2E.StatusEngaged",    img: "icons/svg/net.svg"   },
    { id: "unit-disbanded",  name: "EX2E.StatusDisbanded",  img: "icons/svg/skull.svg" },
  );
}
