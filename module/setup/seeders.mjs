/**
 * seeders.mjs — Compendium and world-folder seeders for Exalted 2nd Edition.
 *
 * Extracted verbatim from module/exalted2e.mjs. Called from the `ready`
 * hook (GM-only) in the main entry point.
 */

/**
 * Seed the `effects` compendium with built-in Exalted 2e condition
 * wrappers the first time a GM boots the system. Each entry is a
 * lightweight Item with its real payload carried as an embedded
 * ActiveEffect flagged `transfer: true`, so dragging the item onto an
 * actor applies the effect (see the preCreateItem hook below, which
 * discards the wrapper item and keeps only the effect).
 *
 * Additional wrappers can be appended to `_EFFECT_WRAPPER_SEEDS`.
 */
const _EFFECT_WRAPPER_SEEDS = [
  {
    name: "EX2E.CreatureOfDarkness",
    img:  "icons/svg/cowled.svg",
    // Canonically a Flaw — it has no in-game cost but cannot be shaken off.
    meritFlawType: "flaw",
    effect: {
      // Detection is flag-based rather than status-based so the token HUD
      // doesn't advertise the trait — CoD is supposed to be invisible to
      // observers. `gmOnlyRemoval` is enforced by the preDeleteActiveEffect
      // hook below.
      flags: {
        exalted2e: {
          creatureOfDarkness: true,
          gmOnlyRemoval:      true
        }
      },
      description: "Holy-keyword attacks deal aggravated damage to this character instead of bashing or lethal."
    }
  },
  {
    name: "EX2E.StatusBlind",
    img:  "icons/svg/blind.svg",
    effect: {
      flags: {
        exalted2e: {
          externalPenalty: { value: 2, type: "physical" },
          blind: true
        }
      },
      statuses: ["blind"],
      description: "−2 external penalty to all physical actions. Ranged attacks against unseen targets are impossible."
    }
  },
  {
    name: "EX2E.StatusDeaf",
    img:  "icons/svg/deaf.svg",
    effect: {
      flags: { exalted2e: { deaf: true } },
      statuses: ["deaf"],
      description: "Cannot hear. Surprise attacks from behind are automatic. Awareness rolls requiring hearing automatically fail."
    }
  },
  {
    name: "EX2E.StatusStunned",
    img:  "icons/svg/daze.svg",
    effect: {
      flags: {
        exalted2e: {
          externalPenalty: { value: 4, type: "all" }
        }
      },
      statuses: ["stunned"],
      description: "−4 external penalty to all actions. Cannot take non-reflexive actions for the remainder of the tick."
    }
  },
  {
    name: "EX2E.StatusGrappled",
    img:  "icons/svg/net.svg",
    effect: {
      flags: {
        exalted2e: {
          externalPenalty: { value: 2, type: "physical" },
          grappled: true
        }
      },
      statuses: ["restrained"],
      description: "−2 external penalty to physical actions. Reaching weapons cannot be used. Cannot move freely."
    }
  },
  {
    name: "EX2E.StatusLightCover",
    img:  "icons/svg/ruins.svg",
    effect: {
      flags: { exalted2e: { dvBonus: { dodge: 1, parry: 0 } } },
      statuses: ["lightCover"],
      description: "+1 Dodge DV from light cover (low wall, brush, doorframe)."
    }
  },
  {
    name: "EX2E.StatusHeavyCover",
    img:  "icons/svg/castle.svg",
    effect: {
      flags: { exalted2e: { dvBonus: { dodge: 2, parry: 1 } } },
      statuses: ["heavyCover"],
      description: "+2 Dodge DV, +1 Parry DV from heavy cover (solid wall, fortification)."
    }
  },
  {
    name: "EX2E.StatusCrippled",
    img:  "icons/svg/blood.svg",
    effect: {
      flags: { exalted2e: { internalPenalty: { value: 1, type: "physical" }, crippled: true } },
      statuses: ["crippled"],
      description: "−1 internal penalty to physical actions from a crippling injury. Requires surgery (Int+Medicine) to heal fully."
    }
  },
  {
    name: "EX2E.StatusHeightAdvantage",
    img:  "icons/svg/up.svg",
    effect: {
      flags: { exalted2e: { dvBonus: { dodge: 1, parry: 1 } } },
      statuses: ["heightAdvantage"],
      description: "+1 Dodge DV and +1 Parry DV while on higher ground. Attacks from below are harder to land."
    }
  },
  {
    name: "EX2E.CreatureOfVoid",
    img:  "icons/svg/ice-aura.svg",
    meritFlawType: "flaw",
    effect: {
      // Detection is flag-based (same as Creature of Darkness) so the token
      // HUD does not expose the trait to observers.
      flags: {
        exalted2e: {
          creatureOfVoid: true,
          gmOnlyRemoval:  true
        }
      },
      description: "Axiomatic-keyword attacks deal aggravated damage to this character instead of bashing or lethal."
    }
  }
];

export async function _seedEffectsCompendium() {
  const pack = game.packs.get("exalted2e.effects");
  if (!pack) return;
  const existing = await pack.getIndex();
  // Skip the seed pass if every expected entry already exists (indexed by name).
  const existingNames = new Set(existing.map(e => e.name));
  const todo = _EFFECT_WRAPPER_SEEDS.filter(s =>
    !existingNames.has(game.i18n.localize(s.name))
  );
  if (todo.length === 0) return;

  // The pack may be locked by default; unlock for seeding.
  const wasLocked = pack.locked;
  if (wasLocked) await pack.configure({ locked: false });
  try {
    for (const seed of todo) {
      const localizedName = game.i18n.localize(seed.name);
      await Item.create({
        name:  localizedName,
        type:  "meritflaw",
        img:   seed.img,
        flags: { exalted2e: { effectWrapper: true } },
        system: {
          meritFlawType: seed.meritFlawType ?? "merit",
          description:   seed.effect.description ?? ""
        },
        effects: [{
          name:     localizedName,
          img:      seed.img,
          // Permanent duration — no rounds / turns / seconds set.
          duration: {},
          flags:    seed.effect.flags ?? {},
          // `statuses` links the AE to a token HUD condition id so toggling
          // the status icon also activates this AE. Omitted for flag-only
          // entries (e.g. Creature of Darkness) where HUD exposure is
          // undesirable.
          ...(seed.effect.statuses ? { statuses: seed.effect.statuses } : {}),
          transfer: true,
          disabled: false
        }]
      }, { pack: "exalted2e.effects" });
    }
    console.log(`Exalted 2e | Seeded ${todo.length} effect wrapper(s) into the effects compendium.`);
  } finally {
    if (wasLocked) await pack.configure({ locked: true });
  }
}

/**
 * Flag-based lookup for The Circle folder. Returns the Folder document
 * or null if the folder was never seeded (or the GM deleted it).
 * Survives renames because we key on the `exalted2e.theCircle` flag,
 * not on the folder's display name.
 */
export function _getTheCircleFolder() {
  return game.folders?.find(f =>
    f.type === "Actor" && f.getFlag("exalted2e", "theCircle")) ?? null;
}

/**
 * True if `folderId` points to The Circle, or to any descendant
 * (sub-folder) of The Circle. Walks the parent pointer chain.
 * Returns false if `folderId` is null / unresolved, or if The Circle
 * doesn't currently exist in the world.
 */
export function _isInTheCircle(folderId) {
  if (!folderId) return false;
  const circle = _getTheCircleFolder();
  if (!circle) return false;
  let cur = game.folders?.get(folderId);
  while (cur) {
    if (cur.id === circle.id) return true;
    cur = cur.folder ?? null;
  }
  return false;
}

/**
 * Create the "The Circle" Actor folder on first GM load of a world.
 * Tracked via the world setting `theCircleSeeded`; once true, we never
 * re-create the folder, even if the GM deleted it (respects GM intent).
 * For dev/testing, flip the setting back to false in the console and
 * reload.
 */
export async function _seedTheCircleFolder() {
  if (game.settings.get("exalted2e", "theCircleSeeded")) return;
  try {
    await Folder.create({
      name:  game.i18n.localize("EX2E.TheCircleFolderName"),
      type:  "Actor",
      color: "#d4af37",
      flags: { exalted2e: { theCircle: true } }
    });
    await game.settings.set("exalted2e", "theCircleSeeded", true);
  } catch (err) {
    console.warn("[EX2E] Failed to seed The Circle folder:", err);
  }
}
