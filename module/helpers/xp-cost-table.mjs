// module/helpers/xp-cost-table.mjs

/**
 * buildXpCostRows(exaltType, costs) — returns the rows that drive the
 * XP cost reference table on the Experience tab. Each row is
 * `{ traitKey, cost, trainingKey }`:
 *
 *   traitKey     — i18n key for the trait label
 *   cost         — pre-formatted cost string (uses localized "current" /
 *                  "per dot" tokens where needed)
 *   trainingKey  — i18n key for the training-time column; starts empty,
 *                  GMs fill it in by editing lang/*.json
 *
 * Every trait suffix (e.g., "Attribute", "AbilityFav") yields both
 * `EX2E.XPTableTrait<suffix>` and `EX2E.XPTraining<suffix>`. The helper
 * only composes the keys — the localize happens in the template.
 *
 * The full list of row suffixes lives below in each exalt branch so a
 * quick scan tells you which rows a given exalt gets. If a new cost key
 * is added to xp-cost-defaults.mjs, either add a row here or leave an
 * explicit skip comment near the relevant branch.
 */

const TRAIT_PREFIX    = "EX2E.XPTableTrait";
const TRAINING_PREFIX = "EX2E.XPTraining";

function _row(suffix, cost) {
  return {
    traitKey:    `${TRAIT_PREFIX}${suffix}`,
    cost,
    trainingKey: `${TRAINING_PREFIX}${suffix}`
  };
}

function _n(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function _currentToken() { return game.i18n.localize("EX2E.XPFormulaCurrent"); }
function _perDotToken()  { return game.i18n.localize("EX2E.XPFormulaPerDot");  }

function _fCurrent(mult) {
  return `${_currentToken()} × ${mult}`;
}

function _fCurrentSub(mult, sub) {
  if (sub > 0) return `${_currentToken()} × ${mult} − ${sub}`;
  return `${_currentToken()} × ${mult}`;
}

function _fCurrentPerDot(mult) {
  return `${_currentToken()} × ${mult} ${_perDotToken()}`;
}

function _fFlat(xp) {
  return `${xp} XP`;
}

function _fFlatPerDot(xp) {
  return `${xp} XP ${_perDotToken()}`;
}

export function buildXpCostRows(exaltType, costs) {
  const rows    = [];
  const general = costs?.general ?? {};
  const et      = costs?.[exaltType] ?? {};

  // ── Fair Folk: entirely different XP structure ──────────────────────────
  if (exaltType === "fairfolk") {
    rows.push(_row("Attribute",         _fCurrent(_n(general.attributeMult, 4))));
    rows.push(_row("FolkAbilityFav",    _fCurrent(_n(et.abilityFavoredMult, 2))));
    rows.push(_row("FolkAbilityOther",  _fCurrent(_n(et.abilityOtherMult, 3))));
    rows.push(_row("Willpower",         _fCurrent(_n(general.willpowerMult, 2))));
    rows.push(_row("Virtue",            _fCurrent(_n(general.virtueMult, 3))));
    rows.push(_row("GraceMajor",        _fCurrent(_n(et.majorGraceMult, 3))));
    rows.push(_row("GraceMinor",        _fCurrent(_n(et.minorGraceMult, 6))));
    rows.push(_row("GraceHeartTo4",     _fFlat(_n(et.heartGraceTo4, 20))));
    rows.push(_row("FolkCharm",         _fFlat(_n(et.charm, 6))));
    rows.push(_row("SpecialtyCommoner", _fFlat(_n(et.specialtyCommoner, 2))));
    rows.push(_row("SpecialtyNoble",    _fFlat(_n(et.specialtyNoble, 5))));
    return rows;
  }

  // Universal rows (every exalt + mortal)
  rows.push(_row("Attribute", _fCurrent(_n(general.attributeMult, 4))));

  if (exaltType === "lunar" || exaltType === "alchemical") {
    rows.push(_row("AttributeFav",
      _fCurrent(_n(et.attributeCasteFavoredMult, _n(general.attributeMult, 4)))));
  }

  const abFavMult = _n(et.abilityFavoredMult, 1);
  const abFavSub  = _n(et.abilityFavoredSub, 0);
  rows.push(_row("AbilityFav",   _fCurrentSub(abFavMult, abFavSub)));
  rows.push(_row("AbilityOther", _fCurrent(_n(et.abilityOtherMult, 2))));
  rows.push(_row("AbilityNew",   _fFlat(_n(general.abilityNewFlat, 3))));
  rows.push(_row("Specialty",    _fFlat(_n(general.specialtyFlat, 3))));
  rows.push(_row("Willpower",    _fCurrent(_n(general.willpowerMult, 2))));
  rows.push(_row("Virtue",       _fCurrent(_n(general.virtueMult, 3))));

  if (exaltType === "mortal") {
    rows.push(_row("Background", _fFlatPerDot(_n(general.backgroundFlat, 3))));
    return rows;
  }

  rows.push(_row("Essence",    _fCurrent(_n(et.essenceMult, 8))));
  rows.push(_row("Background", _fFlatPerDot(_n(general.backgroundFlat, 3))));

  switch (exaltType) {
    case "solar":
    case "abyssal":
      rows.push(_row("CharmFav",        _fFlat(_n(et.charmFavored,      8))));
      rows.push(_row("CharmOther",      _fFlat(_n(et.charmOther,       10))));
      rows.push(_row("SpellFav",        _fFlat(_n(et.spellFavored,      8))));
      rows.push(_row("SpellOther",      _fFlat(_n(et.spellOther,       10))));
      rows.push(_row("ForeignCharm",    _fFlat(_n(et.foreignCharm,     16))));
      rows.push(_row("SiderealMAFav",   _fFlat(_n(et.siderealMaFavored, 12))));
      rows.push(_row("SiderealMAOther", _fFlat(_n(et.siderealMaOther,   15))));
      break;

    case "lunar":
      rows.push(_row("CharmFav",   _fFlat(_n(et.charmFavored, 10))));
      rows.push(_row("CharmOther", _fFlat(_n(et.charmOther,   12))));
      rows.push(_row("SpellFav",   _fFlat(_n(et.spellFavored, 10))));
      rows.push(_row("SpellOther", _fFlat(_n(et.spellOther,   12))));
      rows.push(_row("Knack",      _fFlat(_n(et.knack,        11))));
      break;

    case "sidereal":
      rows.push(_row("CharmFav",      _fFlat(_n(et.charmFavored,      10))));
      rows.push(_row("CharmOther",    _fFlat(_n(et.charmOther,        12))));
      rows.push(_row("SpellFav",      _fFlat(_n(et.spellFavored,      10))));
      rows.push(_row("SpellOther",    _fFlat(_n(et.spellOther,        12))));
      rows.push(_row("CollegeNew",    _fFlat(_n(et.collegeNew,         5))));
      rows.push(_row("CollegePerDot", _fCurrentPerDot(_n(et.collegePerDotMult, 3))));
      break;

    case "terrestrial":
      rows.push(_row("CharmFav",             _fFlat(_n(et.charmFavored,        10))));
      rows.push(_row("CharmOther",           _fFlat(_n(et.charmOther,          12))));
      rows.push(_row("SpellFav",             _fFlat(_n(et.spellFavored,        10))));
      rows.push(_row("SpellOther",           _fFlat(_n(et.spellOther,          12))));
      rows.push(_row("CelestialMAAspect",    _fFlat(_n(et.celestialMaFavored,  12))));
      rows.push(_row("CelestialMANonAspect", _fFlat(_n(et.celestialMaOther,    15))));
      rows.push(_row("MAUnfavored",          _fFlat(_n(et.maUnfavored,         15))));
      break;

    case "alchemical":
      rows.push(_row("CharmFlat",          _fFlat(_n(et.charm,               6))));
      rows.push(_row("MartialArtsCharm",   _fFlat(_n(et.martialArtsCharm,   11))));
      rows.push(_row("CharmSlotGeneral",   _fFlat(_n(et.slotGeneral,         6))));
      rows.push(_row("CharmSlotDedicated", _fFlat(_n(et.slotDedicated,       4))));
      rows.push(_row("CharmSlotUpgrade",   _fFlat(_n(et.slotUpgrade,         2))));
      rows.push(_row("ProtocolManMachine", _fFlat(_n(et.protocolManMachine,  3))));
      rows.push(_row("ProtocolGodMachine", _fFlat(_n(et.protocolGodMachine,  6))));
      break;

    case "infernal":
      rows.push(_row("CharmPatron",    _fFlat(_n(et.charmFavored,  8))));
      rows.push(_row("CharmNonPatron", _fFlat(_n(et.charmOther,   10))));
      rows.push(_row("MAFavored",      _fFlat(_n(et.maFavored,     8))));
      rows.push(_row("MAOther",        _fFlat(_n(et.maOther,      10))));
      rows.push(_row("SorcerySpell",   _fFlat(_n(et.spellFlat,     9))));
      break;

    default:
      // Unknown exalt type — universal rows only.
      break;
  }

  return rows;
}
