import { EX2E } from "../config.mjs";

export function canLearnCelestialMA(actor) {
  if (actor.system?.exaltType !== "terrestrial") return true;
  return actor.items.some(
    i => i.type === "charm" && i.system?.grantsCelestialMA === true
  );
}

export function canLearnSiderealMA(actor) {
  const access = EX2E.maAccessByExaltType?.[actor.system?.exaltType] ?? "";
  if (access !== "sidereal") return false;
  return actor.items.some(
    i => i.type === "charm"
      && i.system?.martialArtsTier === "celestial"
      && i.system?.grantsMastery === true
  );
}

export function isWeaponValidForStyle(weapon, styleName, actor) {
  if (!styleName) return true;

  if (actor?.effects?.some(e =>
    !e.disabled && e.flags?.exalted2e?.anyMAWeapon
  )) return true;

  const weaponStyles = weapon?.system?.martialArtsStyles ?? [];
  const styleNorm = styleName.toLowerCase();
  if (weaponStyles.some(s => s.toLowerCase() === styleNorm)) return true;

  const styleItem = _findStyleItem(styleName, actor);
  if (!styleItem) return true;

  const allowed = styleItem.system?.weapons ?? [];
  const weaponName = (weapon?.name ?? "").toLowerCase();
  return allowed.some(w => w.toLowerCase() === weaponName);
}

export function canBypassMinAbility(actor, charm) {
  if (!charm.system?.keywords?.includes("Martial-ready")) return false;
  const ability = charm.system?.ability;
  if (!ability) return false;
  const abilData = actor.system?.abilities?.[ability];
  return !!(abilData?.caste || abilData?.favored);
}

function _findStyleItem(styleName, actor) {
  const norm = styleName.toLowerCase();
  return (
    actor?.items?.find(i => i.type === "martialartsstyle" && i.name.toLowerCase() === norm)
    ?? game?.items?.find(i => i.type === "martialartsstyle" && i.name.toLowerCase() === norm)
    ?? null
  );
}
