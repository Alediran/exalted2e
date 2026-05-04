/**
 * XP Cost Engine — computes XP cost for a Purchase-Mode confirmation.
 *
 * Source of truth:
 *   docs/Experience.md (house-rules / errata blend the author runs) is
 *   the conceptual reference; the actual numbers are read from the
 *   `exalted2e.xpCosts` world setting via `resolveXpCosts` so a GM can
 *   tune any value without editing code. Defaults live in
 *   `xp-cost-defaults.mjs`.
 *
 * Return shape (stable):
 *   { xp: number, confident: boolean, description: string }
 *
 * `confident` is the knob the PurchaseConfirmDialog reads to decide
 * whether to show the "verify this cost" hint. Flip to false whenever
 * the rule depends on data the schema doesn't yet track (MA sub-tier,
 * Infernal patron Yozi, etc.). The number is still the best guess —
 * the GM can override in the dialog.
 *
 * Forward compatibility: the bottom of the file exports a few helpers
 * (`priceAlchemicalCharmSlot`, `priceAlchemicalProtocol`,
 * `priceAstrologicalCollege`) covering features not yet in the schema.
 * They all read from the same settings object.
 */

import { resolveXpCosts } from "./xp-cost-defaults.mjs";

// ─── Public API ────────────────────────────────────────────────────────

export function computeXpCost(actor, change) {
  const description = _describeChange(change);
  if (!actor || !change) return { xp: 0, confident: false, description };

  const exaltType = actor.system?.exaltType ?? "solar";
  const costs = _getCosts();

  try {
    const result = change.kind === "item"
      ? _priceItem(actor, change.item, exaltType, costs)
      : _priceField(actor, change, exaltType, costs);

    if (!result) return { xp: 0, confident: false, description };
    const xp = Math.max(0, Math.round(Number(result.xp) || 0));
    return { xp, confident: !!result.confident, description };
  } catch (err) {
    console.error("EX2E | computeXpCost failed", err, { actor, change });
    return { xp: 0, confident: false, description };
  }
}

function _describeChange(change) {
  if (!change) return "";
  if (change.kind === "item" && change.item) {
    return `${change.item.type}: ${change.item.name}`;
  }
  const delta = change.oldValue != null ? ` ${change.oldValue}→${change.newValue}` : "";
  return `${change.path ?? ""}${delta}`;
}

// Lazy read; the setting may not be registered during init, and the
// engine is never called until runtime, so this stays safe.
function _getCosts() {
  try {
    const stored = game.settings?.get?.("exalted2e", "xpCosts");
    return resolveXpCosts(stored);
  } catch {
    return resolveXpCosts(null);
  }
}

// ─── Field-level pricing ───────────────────────────────────────────────

function _priceField(actor, change, exaltType, costs) {
  const path   = change.path ?? "";
  const oldVal = Number(change.oldValue ?? 0);
  const newVal = Number(change.newValue ?? 0);

  let m;
  if ((m = path.match(/^system\.attributes\.(\w+)\.value$/)))
    return _priceAttribute(actor, m[1], oldVal, newVal, exaltType, costs);

  if ((m = path.match(/^system\.abilities\.(\w+)\.value$/)))
    return _priceAbility(actor, m[1], oldVal, newVal, exaltType, costs);

  if ((m = path.match(/^system\.abilities\.(\w+)\.specialties$/)))
    return _priceSpecialtyDelta(oldVal, newVal, costs);

  if (path === "system.essence.value")    return _priceEssence(oldVal, newVal, exaltType, costs);
  if (path === "system.willpower.max")    return _priceWillpower(oldVal, newVal, costs);
  if ((m = path.match(/^system\.virtues\.(\w+)\.value$/)))
    return _priceVirtue(oldVal, newVal, costs);

  if ((m = path.match(/^system\.splat\.alchemical\.(dedicatedSlots|generalSlots)$/))) {
    const delta = newVal - oldVal;
    if (delta <= 0) return { xp: 0, confident: true };
    const xpPerSlot = m[1] === "dedicatedSlots"
      ? Number(costs.alchemical?.slotDedicated ?? 4)
      : Number(costs.alchemical?.slotGeneral   ?? 6);
    return { xp: xpPerSlot * delta, confident: true };
  }

  return null;
}

function _priceAttribute(actor, key, oldVal, newVal, exaltType, costs) {
  if (newVal <= oldVal) return { xp: 0, confident: true };
  const usesCaste  = exaltType === "lunar" || exaltType === "alchemical";
  const isCasteFav = usesCaste && _isAttributeCasteFavored(actor, key);
  const mult = (usesCaste && isCasteFav)
    ? _n(costs[exaltType]?.attributeCasteFavoredMult, costs.general.attributeMult)
    : _n(costs.general.attributeMult, 4);
  let xp = 0;
  for (let n = oldVal; n < newVal; n++) xp += n * mult;
  return { xp, confident: true };
}

function _priceAbility(actor, key, oldVal, newVal, exaltType, costs) {
  if (newVal <= oldVal) return { xp: 0, confident: true };
  const ab          = actor.system?.abilities?.[key];
  const casteFav    = !!(ab?.caste || ab?.favored);
  const newFlat     = _n(costs.general.abilityNewFlat, 3);
  const s           = costs[exaltType] ?? {};
  const favMult     = _n(s.abilityFavoredMult, 1);
  const favSub      = _n(s.abilityFavoredSub, 0);
  const otherMult   = _n(s.abilityOtherMult, 2);
  let xp = 0;
  for (let n = oldVal; n < newVal; n++) {
    if (n === 0) xp += newFlat;
    else if (casteFav) xp += (n * favMult) - favSub;
    else               xp += (n * otherMult);
  }
  return { xp, confident: true };
}

function _priceSpecialtyDelta(oldLen, newLen, costs) {
  const delta = newLen - oldLen;
  if (delta <= 0) return { xp: 0, confident: true };
  return { xp: delta * _n(costs.general.specialtyFlat, 3), confident: true };
}

function _priceEssence(oldVal, newVal, exaltType, costs) {
  if (newVal <= oldVal) return { xp: 0, confident: true };
  const mult = _n(costs[exaltType]?.essenceMult, 8);
  let xp = 0;
  for (let n = oldVal; n < newVal; n++) xp += n * mult;
  return { xp, confident: true };
}

function _priceWillpower(oldVal, newVal, costs) {
  if (newVal <= oldVal) return { xp: 0, confident: true };
  const mult = _n(costs.general.willpowerMult, 2);
  let xp = 0;
  for (let n = oldVal; n < newVal; n++) xp += n * mult;
  return { xp, confident: true };
}

function _priceVirtue(oldVal, newVal, costs) {
  if (newVal <= oldVal) return { xp: 0, confident: true };
  const mult = _n(costs.general.virtueMult, 3);
  let xp = 0;
  for (let n = oldVal; n < newVal; n++) xp += n * mult;
  return { xp, confident: true };
}

// ─── Item-level pricing ────────────────────────────────────────────────

function _priceItem(actor, item, exaltType, costs) {
  if (!item) return null;
  switch (item.type) {
    case "charm":      return _priceCharm(actor, item, exaltType, costs);
    case "spell":      return _priceSpell(actor, item, exaltType, costs);
    case "knack":      return _priceKnack(exaltType, costs);
    case "background": return _priceBackground(item, costs);
    default:           return { xp: 0, confident: false };
  }
}

function _priceCharm(actor, charm, exaltType, costs) {
  const attrKey    = charm.system?.ability ?? "";
  const charmExalt = charm.system?.exaltType ?? "";
  const isMA       = attrKey === "martialArts";
  const keywords   = _normKeywords(charm.system?.keywords);
  let casteFav;
  if (exaltType === "alchemical") {
    const attr = actor.system?.attributes?.[attrKey];
    casteFav   = !!(attr?.caste || attr?.favored);
  } else {
    const actorAbil = actor.system?.abilities?.[attrKey];
    casteFav        = !!(actorAbil?.caste || actorAbil?.favored);
  }
  const caste      = actor.system?.caste ?? "";
  const s          = costs[exaltType] ?? {};

  if (keywords.includes("heretical")) return { xp: _n(s.heretical, 9), confident: true };

  // Eclipse (Solar) / Moonshadow (Abyssal, caste-keyed "eclipse" in this
  // schema) / Fiend (Infernal) pay a flat foreign-charm cost for any non-native charm.
  // Solar ⇄ Abyssal charms are NOT "foreign" for this rule.
  const eclipseLike  = caste === "eclipse" ||
    (exaltType === "infernal" && caste === "fiend");
  const foreignCharm = !!charmExalt && charmExalt !== exaltType
                    && !(exaltType === "solar"   && charmExalt === "abyssal")
                    && !(exaltType === "abyssal" && charmExalt === "solar");

  const casteBlankSolarAbyssal = (exaltType === "solar" || exaltType === "abyssal") && !caste;

  if (foreignCharm && (eclipseLike || casteBlankSolarAbyssal)) {
    return { xp: _n(s.foreignCharm, 16), confident: eclipseLike };
  }

  if (charm.system?.isSubmodule) {
    const price = charm.system.purchaseXp || _n(s.submodule, 6);
    return { xp: price, confident: true };
  }

  switch (exaltType) {
    case "solar":
    case "abyssal": {
      if (isMA && _isSiderealMa(charm, keywords)) {
        return {
          xp: casteFav ? _n(s.siderealMaFavored, 12) : _n(s.siderealMaOther, 15),
          confident: false
        };
      }
      return {
        xp: casteFav ? _n(s.charmFavored, 8) : _n(s.charmOther, 10),
        confident: true
      };
    }

    case "lunar": {
      return {
        xp: casteFav ? _n(s.charmFavored, 10) : _n(s.charmOther, 12),
        confident: true
      };
    }

    case "sidereal": {
      return {
        xp: casteFav ? _n(s.charmFavored, 10) : _n(s.charmOther, 12),
        confident: true
      };
    }

    case "terrestrial": {
      const maAb       = actor.system?.abilities?.martialArts;
      const maFavored  = !!(maAb?.caste || maAb?.favored);
      if (isMA) {
        if (_isCelestialMa(charm, keywords)) {
          return {
            xp: maFavored ? _n(s.celestialMaFavored, 12) : _n(s.celestialMaOther, 15),
            confident: false
          };
        }
        if (!maFavored) return { xp: _n(s.maUnfavored, 15), confident: true };
        return {
          xp: casteFav ? _n(s.charmFavored, 10) : _n(s.charmOther, 12),
          confident: true
        };
      }
      return {
        xp: casteFav ? _n(s.charmFavored, 10) : _n(s.charmOther, 12),
        confident: true
      };
    }

    case "alchemical": {
      // Flat per-charm XP; the slot subsystem (not yet wired) handles
      // caste/favored separately via priceAlchemicalCharmSlot().
      return {
        xp: isMA ? _n(s.martialArtsCharm, 11) : _n(s.charm, 6),
        confident: true
      };
    }

    case "infernal": {
      if (isMA) {
        return {
          xp: casteFav ? _n(s.maFavored, 8) : _n(s.maOther, 10),
          confident: true
        };
      }
      const inf = actor.system?.splat?.infernal ?? {};
      const yp  = charm.system?.yoziPatron ?? "";
      const discounted = yp !== "" && (yp === inf.patron || yp === inf.favoredYozi);
      return { xp: discounted ? _n(s.charmFavored, 8) : _n(s.charmOther, 10), confident: true };
    }

    case "mortal":
    default: return { xp: 0, confident: false };
  }
}

function _priceSpell(actor, spell, exaltType, costs) {
  const occult    = actor.system?.abilities?.occult;
  const occultFav = !!(occult?.caste || occult?.favored);
  const s         = costs[exaltType] ?? {};

  switch (exaltType) {
    case "solar":
    case "abyssal":    return {
      xp: occultFav ? _n(s.spellFavored, 8)  : _n(s.spellOther, 10),
      confident: true
    };
    case "lunar":
    case "sidereal":   return {
      xp: occultFav ? _n(s.spellFavored, 10) : _n(s.spellOther, 12),
      confident: true
    };
    case "terrestrial": return {
      xp: occultFav ? _n(s.spellFavored, 10) : _n(s.spellOther, 12),
      confident: false
    };
    case "alchemical": return { xp: _n(s.spell, 6),     confident: false };
    case "infernal":   return { xp: _n(s.spellFlat, 9), confident: true };
    default:           return { xp: 0, confident: false };
  }
}

function _priceKnack(exaltType, costs) {
  if (exaltType === "lunar") return { xp: _n(costs.lunar?.knack, 11), confident: true };
  return { xp: 0, confident: false };
}

function _priceBackground(bg, costs) {
  const rating = Math.max(0, Number(bg.system?.value ?? 0));
  const flat   = _n(costs.general.backgroundFlat, 3);
  return { xp: rating * flat, confident: true };
}

// ─── Classification helpers ────────────────────────────────────────────

function _isAttributeCasteFavored(actor, key) {
  const attr = actor.system?.attributes?.[key];
  return !!(attr?.caste || attr?.favored);
}

function _normKeywords(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(k => String(k ?? "").trim().toLowerCase()).filter(Boolean);
}

function _isSiderealMa(charm, keywords = null) {
  const tier = charm.system?.martialArtsTier;
  if (tier === "sidereal") return true;
  const kws = keywords ?? _normKeywords(charm.system?.keywords);
  return kws.some(k => k.includes("sidereal"));
}

function _isCelestialMa(charm, keywords = null) {
  const tier = charm.system?.martialArtsTier;
  if (tier === "celestial") return true;
  const kws = keywords ?? _normKeywords(charm.system?.keywords);
  return kws.some(k => k.includes("celestial"));
}

// Coerce a value to a finite number, or return the fallback.
function _n(value, fallback) {
  const v = Number(value);
  return Number.isFinite(v) ? v : fallback;
}

// ─── Future hooks ──────────────────────────────────────────────────────
//
// Pricers for rules that need schema / item-type support we don't have
// yet. All three read from the resolved settings, so the Config dialog
// can tune them even before the backing features land.

/**
 * Alchemical Charm Slot purchase.
 *
 *   General   — any charm fits             (slotGeneral, default 6)
 *   Dedicated — locked to a specific charm (slotDedicated, default 4)
 *   Upgrade   — growing an existing slot   (slotUpgrade, default 2)
 */
export function priceAlchemicalCharmSlot(grade) {
  const s = _getCosts().alchemical ?? {};
  switch ((grade ?? "").toLowerCase()) {
    case "general":   return { xp: _n(s.slotGeneral, 6),   confident: true };
    case "dedicated": return { xp: _n(s.slotDedicated, 4), confident: true };
    case "upgrade":   return { xp: _n(s.slotUpgrade, 2),   confident: true };
    default:          return { xp: 0, confident: false };
  }
}

/**
 * Alchemical Protocol purchase (Essence 2 / Essence 4 one-time buys).
 */
export function priceAlchemicalProtocol(kind) {
  const s = _getCosts().alchemical ?? {};
  switch ((kind ?? "").toLowerCase()) {
    case "manmachine": return { xp: _n(s.protocolManMachine, 3), confident: true };
    case "godmachine": return { xp: _n(s.protocolGodMachine, 6), confident: true };
    default:           return { xp: 0, confident: false };
  }
}

/**
 * Sidereal Astrological College — brand-new or per-dot increase.
 *
 *   oldRating = 0  → charges the "new College" fee (collegeNew, default 5)
 *                    for the first dot, then collegePerDotMult × n per
 *                    additional dot.
 *   oldRating ≥ 1  → collegePerDotMult × n per dot added.
 */
export function priceAstrologicalCollege({ oldRating = 0, newRating = 1 } = {}) {
  const s = _getCosts().sidereal ?? {};
  const newFee  = _n(s.collegeNew, 5);
  const perMult = _n(s.collegePerDotMult, 3);
  const o = Math.max(0, Number(oldRating) || 0);
  const n = Math.max(o, Number(newRating) || 0);
  if (n <= o) return { xp: 0, confident: true };
  let xp = 0;
  for (let r = o; r < n; r++) {
    xp += (r === 0) ? newFee : (r * perMult);
  }
  return { xp, confident: true };
}
