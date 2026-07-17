/**
 * text-importer.mjs
 *
 * Parses raw PDF-copied text from Exalted 2e sourcebooks into structured
 * objects, then converts them into Foundry document data ready for
 * Item.create() / Actor.create().
 *
 * Three layers:
 *  1. Normalizers  – map raw strings to enum values (same logic as pack scripts)
 *  2. Parsers      – extract fields from raw text blocks
 *  3. Factories    – build Foundry item/actor data objects from parsed results
 */

// ── Normalizers ────────────────────────────────────────────────────────────

function normalizeType(t) {
  if (!t) return "supplemental";
  const l = t.toLowerCase().replace(/\s*\([^)]*\)/g, "").trim();
  if (l.includes("reflexive"))    return "reflexive";
  if (l.includes("extra action")) return "extraAction";
  if (l.includes("simple"))       return "simple";
  if (l.includes("supplemental")) return "supplemental";
  if (l.includes("permanent"))    return "permanent";
  if (l.includes("shintai"))      return "shintai";
  return "supplemental";
}

function normalizeDuration(d) {
  if (!d) return "instant";
  const l = d.toLowerCase().trim();
  if (l === "instant")                              return "instant";
  if (/until next action/.test(l))                  return "untilNextAction";
  if (/one scene/.test(l) || l === "scene")         return "oneScene";
  if (/one day/.test(l))                            return "oneDay";
  if (/one week/.test(l))                           return "oneWeek";
  if (/one month/.test(l))                          return "oneMonth";
  if (/one season|season/.test(l))                  return "oneSeason";
  if (/indefinite/.test(l))                         return "indefinite";
  if (/calibration/.test(l))                        return "untilCalibration";
  if (l === "permanent")                            return "permanent";
  return "instant";
}

const ABILITY_MAP = {
  martialarts: "martialArts", "martial arts": "martialArts", "martial-arts": "martialArts",
  lore: "lore", melee: "melee", archery: "archery", athletics: "athletics",
  awareness: "awareness", bureaucracy: "bureaucracy", craft: "craft", dodge: "dodge",
  integrity: "integrity", investigation: "investigation", larceny: "larceny",
  linguistics: "linguistics", medicine: "medicine", occult: "occult",
  performance: "performance", presence: "presence", resistance: "resistance",
  ride: "ride", sail: "sail", socialize: "socialize", stealth: "stealth",
  survival: "survival", thrown: "thrown", war: "war",
  strength: "strength", dexterity: "dexterity", stamina: "stamina",
  charisma: "charisma", manipulation: "manipulation", appearance: "appearance",
  perception: "perception", intelligence: "intelligence", wits: "wits",
};

function abilitySlug(ability) {
  if (!ability) return "";
  const l = ability.toLowerCase().replace(/\s+/g, "");
  return ABILITY_MAP[l] ?? ABILITY_MAP[ability.toLowerCase()] ?? ability.toLowerCase();
}

function normalizeExaltType(t) {
  if (!t) return "solar";
  const l = t.toLowerCase().replace(/\s+/g, "");
  if (l === "solar")                                    return "solar";
  if (l === "abyssal")                                  return "abyssal";
  if (l === "dragonblooded" || l === "terrestrial")     return "dragonblooded";
  if (l === "infernal")                                 return "infernal";
  if (l === "lunar")                                    return "lunar";
  if (l === "sidereal")                                 return "sidereal";
  if (l === "alchemical")                               return "alchemical";
  if (l === "fairfolk" || l === "fair-folk")            return "fairfolk";
  if (l === "martialarts" || l === "martial-arts")      return "martialarts";
  return "solar";
}

function normKeywords(raw) {
  if (!raw) return [];
  const list = raw.split(/[,;]/).map(k => k.trim()).filter(Boolean);
  return list.filter(k => k.toLowerCase() !== "none");
}

function textToHtml(t) {
  if (!t) return "";
  const paras = t.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  if (!paras.length) return "";
  return paras.map(p => `<p>${p.replace(/\n/g, " ")}</p>`).join("");
}

function parseMins(minsText) {
  if (!minsText) return { ability: 1, essence: 1 };
  const clean = minsText.replace(/;\s*T?\s*ype:.*/i, "").trim();
  const essM   = /Essence\s+(\d+)/i.exec(clean);
  const essence = essM ? parseInt(essM[1]) : 1;
  let ability = 1;
  for (const part of clean.split(",")) {
    if (/essence/i.test(part)) continue;
    const m = /(\d+)/.exec(part);
    if (m) { ability = parseInt(m[1]); break; }
  }
  return { ability, essence };
}

// Shared regex for field label lines; used by all parsers
const FIELD_RE = /^(Cost|Mins?|Minimums?|Type|Keywords?|Duration|Prerequisite\s*Charms?|Source|Exalt(?:\s*Type)?|Ability|Attack(?:\s*Pool)?|Essence|Willpower|Motes?|Join\s*Battle|Dodge|Parry|Soak|Hardness|Mobility|Fatigue|Health|Speed|Accuracy|Damage|Defense|Rate|Range|Tags?|Artifact|Attunement|Hearthstone)\s*[:/]/i;

// ── Text Preprocessing ─────────────────────────────────────────────────────

function preprocessText(text) {
  return text
    .replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    // Dehyphenate line-break hyphens from two-column PDF layouts
    .replace(/-\n(\w)/g, "$1")
    // Insert newlines before field labels that got merged onto the previous line
    // e.g. "Combo-OKDuration:" → "Combo-OK\nDuration:"
    .replace(/([^\n])(Duration|Keywords?|Type|Prerequisite[s]?(?:\s*Charms?)?|Source)\s*:/gi, "$1\n$2:")
    .trim();
}

// ── Content Detection ──────────────────────────────────────────────────────

export function detectContentType(text) {
  const t = preprocessText(text);
  if (/Dodge\s+DV|Join\s*Battle|Parry\s+DV/i.test(t))                                   return "npc";
  if (/Mobility\s*Penalty|Fatigue\s*(?:Value|Penalty)/i.test(t))                         return "armor";
  if (/\bSoak\b.+\d+[BL]/i.test(t) && !/Dodge\s+DV/i.test(t) && !/Cost\s*:/i.test(t))  return "armor";
  if (/Speed\s*[:\s]\s*\d+.+Accuracy/is.test(t) && !/Cost\s*:/i.test(t))                 return "weapon";
  if (/Cost\s*:/i.test(t) && /Mins?\s*:/i.test(t))                                       return "charm";
  return "unknown";
}

// ── Charm Parser ───────────────────────────────────────────────────────────

/**
 * Split pasted text containing one or more charm blocks into individual blocks.
 * A new charm block begins whenever a non-field line (a name) appears after a
 * blank line AND the current accumulated block already contains a "Cost:" line.
 */
export function splitCharmBlocks(text) {
  const processed = preprocessText(text);
  const lines = processed.split("\n");
  const blocks = [];
  let current = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      if (current.length > 0) current.push("");
      continue;
    }

    const isField = FIELD_RE.test(trimmed);

    // A non-field line after a blank line signals a potential new charm name —
    // but only split if the current block already has a Cost: line (i.e. it's
    // a complete charm, not just an accumulating first charm).
    const prevIsBlank = current.length > 0 && current[current.length - 1] === "";
    if (prevIsBlank && !isField && current.some(l => /Cost\s*:/i.test(l))) {
      blocks.push(current.join("\n").trim());
      current = [];
    }

    current.push(line);
  }

  if (current.length > 0) {
    const joined = current.join("\n").trim();
    if (joined) blocks.push(joined);
  }

  // Only return blocks that have at least a Cost: line (real charm blocks)
  return blocks.filter(b => /Cost\s*:/i.test(b));
}

/**
 * Parse a single charm block into a structured object.
 * @param {string} text          Raw text of one charm block
 * @param {string} defaultExaltType  Fallback exalt type if not detected in text
 */
export function parseCharmBlock(text, defaultExaltType = "solar") {
  const processed = preprocessText(text);
  const lines = processed.split("\n").map(l => l.trim()).filter(Boolean);
  if (!lines.length) return null;

  // Name: first non-field line
  let nameIdx = 0;
  while (nameIdx < lines.length && FIELD_RE.test(lines[nameIdx])) nameIdx++;
  let name = lines[nameIdx] ?? lines[0];

  // Normalize ALL-CAPS names to Title Case
  if (name === name.toUpperCase() && name.length > 2) {
    name = name.replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }

  // Join everything for full-text field extraction
  const full = lines.join("\n");

  const costM     = /Cost\s*:\s*([^;\n]+)/i.exec(full);
  const minsM     = /Mins?\s*:\s*([^\n;]+(?:;\s*[^\n;]+)?)/i.exec(full);
  const typeM     = /(?:^|\n)\s*Type\s*:\s*([^\n;]+)/i.exec(full);
  const keywordsM = /Keywords?\s*:\s*([^\n]+)/i.exec(full);
  const durationM = /Duration\s*:\s*([^\n]+)/i.exec(full);
  const sourceM   = /Source\s*:\s*([^\n]+)/i.exec(full);
  const exaltM    = /Exalt(?:\s*Type)?\s*:\s*([^\n]+)/i.exec(full);

  const minsRaw = minsM ? minsM[1].trim() : "";
  const mins    = parseMins(minsRaw);

  // Extract ability from Mins field: "Melee 3, Essence 2" → "Melee"
  let abilityRaw = "";
  if (minsRaw) {
    const abilM = /^([A-Za-z][\w\s]*?)\s+\d/.exec(minsRaw.replace(/;\s*T?\s*ype:.*/i, "").trim());
    if (abilM) abilityRaw = abilM[1].trim();
  }

  // Description: all lines after the last field-label line
  let lastField = nameIdx;
  for (let i = nameIdx; i < lines.length; i++) {
    if (FIELD_RE.test(lines[i])) lastField = i;
  }
  const descLines = lines.slice(lastField + 1);
  const description = textToHtml(descLines.join("\n\n"));

  return {
    _importType:  "charm",
    name,
    exaltType:    normalizeExaltType(exaltM ? exaltM[1].trim() : defaultExaltType),
    ability:      abilitySlug(abilityRaw) || "melee",
    essence:      mins.essence,
    minAbility:   mins.ability,
    cost:         { formula: (costM ? costM[1].trim() : "").replace(/;$/, "").trim() },
    charmType:    normalizeType(typeM ? typeM[1].trim() : ""),
    duration:     normalizeDuration(durationM ? durationM[1].trim() : ""),
    keywords:     normKeywords(keywordsM ? keywordsM[1].trim() : ""),
    description,
    source:       sourceM ? sourceM[1].trim() : "",
  };
}

// ── Weapon Parser ──────────────────────────────────────────────────────────

export function parseWeaponBlock(text) {
  const processed = preprocessText(text);
  const lines = processed.split("\n").map(l => l.trim()).filter(Boolean);
  if (!lines.length) return null;

  // First non-stat line is the name
  let nameIdx = 0;
  while (nameIdx < lines.length && FIELD_RE.test(lines[nameIdx])) nameIdx++;
  let name = lines[nameIdx] ?? lines[0];
  if (name === name.toUpperCase() && name.length > 2) {
    name = name.replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }

  const full = processed;

  const speedM   = /Speed\s*[:\s]\s*(\d+)/i.exec(full);
  const accM     = /Accuracy\s*[:\s]\s*([+-]?\d+)/i.exec(full);
  const damM     = /Damage\s*[:\s]\s*([+-]?\d+)\s*([LlBbAa])/i.exec(full);
  const defM     = /Defense\s*[:\s]\s*([+-]?\d+)/i.exec(full);
  const rateM    = /Rate\s*[:\s]\s*(\d+)/i.exec(full);
  const rangeM   = /Range\s*[:\s]\s*(\d+)/i.exec(full);
  const tagsM    = /Tags?\s*[:\s]\s*([^\n]+)/i.exec(full);
  const strM     = /Min(?:imum)?\s+Str(?:ength)?\s*[:\s]\s*(\d+)/i.exec(full);
  const dexM     = /Min(?:imum)?\s+Dex(?:terity)?\s*[:\s]\s*(\d+)/i.exec(full);
  const maM      = /Min(?:imum)?\s+(?:MA|Martial\s*Arts?)\s*[:\s]\s*(\d+)/i.exec(full);
  const artM     = /Artifact\s+(?:Rating)?\s*[:\s]\s*(\d+)/i.exec(full);
  const attuneM  = /Attunem?ent\s*(?:Cost)?\s*[:\s]\s*(\d+)/i.exec(full);
  const hslotsM  = /Hearthstone\s+Slots?\s*[:\s]\s*(\d+)/i.exec(full);

  const dmgTypeRaw = damM ? damM[2].toUpperCase() : "L";
  const dmgTypeMap = { L: "lethal", B: "bashing", A: "aggravated" };

  let lastField = nameIdx;
  for (let i = nameIdx; i < lines.length; i++) {
    if (FIELD_RE.test(lines[i])) lastField = i;
  }
  const descLines = lines.slice(lastField + 1);

  return {
    _importType: "weapon",
    name,
    modes: [{
      name:           "",
      speed:          speedM ? parseInt(speedM[1]) : 5,
      accuracy:       accM   ? parseInt(accM[1])   : 0,
      damage:         damM   ? parseInt(damM[1])   : 0,
      damageType:     dmgTypeMap[dmgTypeRaw] ?? "lethal",
      overwhelming:   1,
      defense:        defM   ? parseInt(defM[1])   : 0,
      rate:           rateM  ? parseInt(rateM[1])  : 2,
      range:          rangeM ? parseInt(rangeM[1]) : 0,
      minStrength:    strM   ? parseInt(strM[1])   : 0,
      minDexterity:   dexM   ? parseInt(dexM[1])   : 0,
      minMartialArts: maM    ? parseInt(maM[1])    : 0,
      tags:           tagsM  ? normKeywords(tagsM[1]) : [],
    }],
    artifact:         !!(artM || attuneM),
    artifactRating:   artM     ? parseInt(artM[1])    : 0,
    attunementCost:   attuneM  ? parseInt(attuneM[1]) : 0,
    hearthstoneSlots: hslotsM  ? parseInt(hslotsM[1]) : 0,
    description:      textToHtml(descLines.join("\n\n")),
  };
}

// ── Armor Parser ───────────────────────────────────────────────────────────

export function parseArmorBlock(text) {
  const processed = preprocessText(text);
  const lines = processed.split("\n").map(l => l.trim()).filter(Boolean);
  if (!lines.length) return null;

  let nameIdx = 0;
  while (nameIdx < lines.length && FIELD_RE.test(lines[nameIdx])) nameIdx++;
  let name = lines[nameIdx] ?? lines[0];
  if (name === name.toUpperCase() && name.length > 2) {
    name = name.replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }

  const full = processed;

  // Soak: "+XB/+YL/+ZA" or "XB/YL" or "Soak +X bashing / +Y lethal"
  const soakM = /Soak\s*[:\s]+\+?(\d+)\s*B[^\d\/]*\/?[^\d]*\+?(\d+)\s*L[^\d\/]*(?:\/?[^\d]*\+?(\d+)\s*A)?/i.exec(full);
  const hardM  = /Hardness\s*[:\s]+(\d+)/i.exec(full);
  const mobM   = /Mobility\s*(?:Penalty)?\s*[:\s]+(-?\d+)/i.exec(full);
  const fatM   = /Fatigue\s*(?:Value|Penalty)?\s*[:\s]+(-?\d+)/i.exec(full);
  const tagsM  = /Tags?\s*[:\s]+([^\n]+)/i.exec(full);
  const artM   = /Artifact\s+(?:Rating)?\s*[:\s]+(\d+)/i.exec(full);
  const attuneM = /Attunem?ent\s*(?:Cost)?\s*[:\s]+(\d+)/i.exec(full);
  const hslotsM = /Hearthstone\s+Slots?\s*[:\s]+(\d+)/i.exec(full);

  let lastField = nameIdx;
  for (let i = nameIdx; i < lines.length; i++) {
    if (FIELD_RE.test(lines[i])) lastField = i;
  }
  const descLines = lines.slice(lastField + 1);

  return {
    _importType:      "armor",
    name,
    soak: {
      bashing:    soakM ? parseInt(soakM[1])       : 0,
      lethal:     soakM ? parseInt(soakM[2])       : 0,
      aggravated: soakM ? parseInt(soakM[3] ?? "0") : 0,
    },
    hardness:         hardM  ? parseInt(hardM[1])  : 0,
    mobilityPenalty:  mobM   ? parseInt(mobM[1])   : 0,
    fatiguePenalty:   fatM   ? parseInt(fatM[1])   : 0,
    tags:             tagsM  ? normKeywords(tagsM[1]) : [],
    artifact:         !!(artM || attuneM),
    artifactRating:   artM     ? parseInt(artM[1])    : 0,
    attunementCost:   attuneM  ? parseInt(attuneM[1]) : 0,
    hearthstoneSlots: hslotsM  ? parseInt(hslotsM[1]) : 0,
    description:      textToHtml(descLines.join("\n\n")),
  };
}

// ── NPC Parser ─────────────────────────────────────────────────────────────

export function parseNpcBlock(text) {
  const processed = preprocessText(text);
  const lines = processed.split("\n").map(l => l.trim()).filter(Boolean);
  if (!lines.length) return null;

  // First line is the NPC name
  let name = lines[0];
  if (name === name.toUpperCase() && name.length > 2) {
    name = name.replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }

  const full = processed;

  const essM     = /\bEssence\s+(\d+)/i.exec(full);
  const wpM      = /\bWillpower\s+(\d+)/i.exec(full);
  // Motes: "30/30" or "30 Personal" or just "30"
  const motesM   = /\bMotes?\s+(\d+)\s*(?:\/\s*(\d+))?/i.exec(full);
  const jbM      = /Join\s*Battle\s+(\d+)/i.exec(full);
  const dodgeDVM = /Dodge\s+DV\s+(\d+)/i.exec(full);
  const parryDVM = /Parry\s+DV\s+(\d+)/i.exec(full);
  const dodgeMDVM= /Dodge\s+MDV\s+(\d+)/i.exec(full);
  const parryMDVM= /Parry\s+MDV\s+(\d+)/i.exec(full);
  // Soak: "8B/4L/1A" or "8 bashing/4 lethal"
  const soakM    = /Soak\s+(\d+)\s*[Bb][^\d\/]*\/?[^\d]*(\d+)\s*[Ll][^\d\/]*(?:\/?[^\d]*(\d+)\s*[Aa])?/i.exec(full);
  const hardM    = /Hardness\s+(\d+)/i.exec(full);
  const atkM     = /Attack(?:\s*Pool)?\s*[:\s]+(?:[A-Za-z ']+[:\s]+)?(\d+)\s*[dD]/i.exec(full);

  // Health levels: parse token counts from "−0, −1, −1, −2, −2, −4, Inc" patterns
  const hlM = /Health\s*(?:Levels?)?\s*[:\-]\s*([^\n]+)/i.exec(full);
  const healthLevels = { zero: 1, one: 2, two: 2, four: 1 };
  if (hlM) {
    const tokens = hlM[1].split(/[,;\s]+/).map(t => t.trim()).filter(Boolean);
    let z = 0, o = 0, tw = 0, f = 0;
    for (const tok of tokens) {
      if (/^[−\-]0$/.test(tok))       z++;
      else if (/^[−\-]1$/.test(tok))  o++;
      else if (/^[−\-]2$/.test(tok))  tw++;
      else if (/^[−\-]4$/.test(tok))  f++;
    }
    if (z + o + tw + f > 0) {
      healthLevels.zero = z  || 0;
      healthLevels.one  = o  || 0;
      healthLevels.two  = tw || 0;
      healthLevels.four = f  || 0;
    }
  }

  // Powers: everything from the first long non-stat line onward
  const STAT_FIELD = /^(Essence|Willpower|Motes?|Join|Dodge|Parry|Soak|Hardness|Attack|Health|Virtue|Speed|Strength|Dexterity|Stamina|Charisma|Manipulation|Appearance|Perception|Intelligence|Wits)\b/i;
  const statLines  = new Set();
  for (let i = 1; i < lines.length; i++) {
    if (STAT_FIELD.test(lines[i]) || (lines[i].length < 60 && /\d/.test(lines[i]))) {
      statLines.add(i);
    }
  }
  const powerLines = lines.slice(1).filter((_, i) => !statLines.has(i + 1) && lines[i + 1]?.length > 30);

  return {
    _importType: "npc",
    name,
    npcType:    "npc",
    essence:    { value: essM   ? parseInt(essM[1])   : 1 },
    willpower:  { value: wpM    ? parseInt(wpM[1])    : 3, max: wpM ? parseInt(wpM[1]) : 3 },
    motes:      { value: motesM ? parseInt(motesM[1]) : 0, max: motesM ? parseInt(motesM[2] ?? motesM[1]) : 0 },
    pools:      { combat: atkM  ? parseInt(atkM[1])   : 5, social: 3, physical: 4 },
    combat: {
      joinBattle:  jbM      ? parseInt(jbM[1])      : 4,
      dodgeDV:     dodgeDVM ? parseInt(dodgeDVM[1]) : 2,
      parryDV:     parryDVM ? parseInt(parryDVM[1]) : 2,
      dodgeMDV:    dodgeMDVM? parseInt(dodgeMDVM[1]): 2,
      parryMDV:    parryMDVM? parseInt(parryMDVM[1]): 2,
      soak: {
        bashing:    soakM ? parseInt(soakM[1])       : 3,
        lethal:     soakM ? parseInt(soakM[2])       : 1,
        aggravated: soakM ? parseInt(soakM[3] ?? "0"): 0,
      },
      hardness: hardM ? parseInt(hardM[1]) : 0,
    },
    health: { levels: healthLevels, bashing: 0, lethal: 0, aggravated: 0 },
    powers: textToHtml(powerLines.join("\n\n")),
    notes:  "",
  };
}

// ── Document Factories ─────────────────────────────────────────────────────

export function charmToItemData(parsed, overrides = {}) {
  return {
    name: parsed.name,
    type: "charm",
    img:  "icons/magic/light/beam-rays-yellow.webp",
    system: {
      exaltType:    overrides.exaltType ?? parsed.exaltType ?? "solar",
      ability:      overrides.ability   ?? parsed.ability   ?? "melee",
      essence:      parsed.essence      ?? 1,
      minAbility:   parsed.minAbility   ?? 1,
      cost:         { formula: parsed.cost?.formula ?? "" },
      charmType:    parsed.charmType    ?? "supplemental",
      duration:     parsed.duration     ?? "instant",
      keywords:     parsed.keywords     ?? [],
      description:  parsed.description  ?? "",
      source:       overrides.source    ?? parsed.source ?? "",
      yoziPatron:   "",
      martialArtsTier:      overrides.martialArtsTier      ?? "",
      martialArtsStyleName: overrides.martialArtsStyleName ?? "",
      prereqGroups: [],
      active:       false,
    },
  };
}

export function weaponToItemData(parsed) {
  return {
    name: parsed.name,
    type: "weapon",
    img:  "icons/weapons/swords/sword-guard-brass.webp",
    system: {
      modes:            parsed.modes            ?? [],
      artifact:         parsed.artifact         ?? false,
      magicalMaterial:  "",
      attunementCost:   parsed.attunementCost   ?? 0,
      attuned:          false,
      artifactRating:   parsed.artifactRating   ?? 0,
      hearthstoneSlots: parsed.hearthstoneSlots ?? 0,
      description:      parsed.description      ?? "",
      equipped:         false,
    },
  };
}

export function armorToItemData(parsed) {
  return {
    name: parsed.name,
    type: "armor",
    img:  "icons/equipment/chest/breastplate-quilted-red.webp",
    system: {
      soak:             parsed.soak             ?? { bashing: 0, lethal: 0, aggravated: 0 },
      hardness:         parsed.hardness         ?? 0,
      mobilityPenalty:  parsed.mobilityPenalty  ?? 0,
      fatiguePenalty:   parsed.fatiguePenalty   ?? 0,
      tags:             parsed.tags             ?? [],
      artifact:         parsed.artifact         ?? false,
      magicalMaterial:  "",
      attunementCost:   parsed.attunementCost   ?? 0,
      attuned:          false,
      artifactRating:   parsed.artifactRating   ?? 0,
      hearthstoneSlots: parsed.hearthstoneSlots ?? 0,
      description:      parsed.description      ?? "",
      equipped:         false,
    },
  };
}

export function npcToActorData(parsed) {
  return {
    name:   parsed.name,
    type:   "npc",
    img:    "icons/svg/mystery-man.svg",
    system: {
      npcType:   parsed.npcType   ?? "npc",
      concept:   "",
      essence:   parsed.essence,
      willpower: parsed.willpower,
      motes:     parsed.motes,
      pools:     parsed.pools,
      combat:    parsed.combat,
      health:    parsed.health,
      powers:    parsed.powers    ?? "",
      notes:     parsed.notes     ?? "",
      biography: "",
    },
  };
}
