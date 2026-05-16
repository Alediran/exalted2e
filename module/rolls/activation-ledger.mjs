// ── Cost Formula DSL Parser ──────────────────────────────────────────────────

const ZERO_COST = () => ({
  motes: 0, committed: false, moteVar: null,
  willpower: 0, lethalHealth: 0, bashingHealth: 0, aggravatedHealth: 0,
  xp: 0, permanentEssence: 0, permanentWillpower: 0, promise: 0, surcharge: null
});

function _resolveQuantity(q, rollData) {
  if (/^\d+$/.test(q)) return parseInt(q, 10);
  if (rollData && /^@(\w+)$/.test(q)) {
    const key = q.slice(1);
    const val = rollData[key];
    if (typeof val === "number") return Math.floor(val);
  }
  return 0;
}

function _evalCondition(condStr, rollData) {
  const m = /^(@\w+)\s*(>=|<=|>|<|=)\s*(\d+)$/.exec((condStr ?? "").trim());
  if (!m || !rollData) return false;
  const val = _resolveQuantity(m[1], rollData);
  const rhs = parseInt(m[3], 10);
  switch (m[2]) {
    case ">=": return val >= rhs;
    case "<=": return val <= rhs;
    case ">":  return val >  rhs;
    case "<":  return val <  rhs;
    case "=":  return val === rhs;
  }
  return false;
}

// Split on "," but not inside brackets or parens.
function _splitItems(str) {
  const parts = []; let depth = 0, start = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (c === "," && depth === 0) { parts.push(str.slice(start, i)); start = i + 1; }
  }
  parts.push(str.slice(start));
  return parts;
}

// Split on " or " but not inside brackets or parens.
function _splitOnOr(str) {
  const parts = []; let depth = 0, start = 0;
  for (let i = 0; i < str.length - 3; i++) {
    const c = str[i];
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (depth === 0 && str.slice(i, i + 4) === " or ") {
      parts.push(str.slice(start, i)); start = i + 4; i += 3;
    }
  }
  parts.push(str.slice(start));
  return parts;
}

function _hasTierSeparator(str) {
  let depth = 0;
  for (let i = 0; i < str.length - 3; i++) {
    const c = str[i];
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (depth === 0 && str.slice(i, i + 4) === " or ") return true;
  }
  return false;
}

function _parseMoteItem(item, result, rollData) {
  // Tiered: "3m or 5m" / "3m (Label) or 5m (Label)"
  if (_hasTierSeparator(item)) {
    const opts = _splitOnOr(item);
    const tiers = opts.map(opt => {
      const m = /^(\d+)m(?:\s*\(([^)]+)\))?$/.exec(opt.trim());
      if (!m) return null;
      return { moteCost: parseInt(m[1], 10), label: m[2]?.trim() ?? "" };
    });
    if (tiers.some(t => t === null)) return false;
    result.moteVar = { type: "tiered", tiers };
    return true;
  }

  // Per-unit: "[BASE m +] RATE m/[N ]UNIT[(CAP)][committed]"
  // e.g. "1m/die", "1m/die (@str)", "1m/2 dice", "2m + 1m/die (@str)", "1m/cubic foot"
  const puM = /^(?:(@?\w+)\s*m\s*\+\s*)?(\d+)m\/(\d+\s+)?(\w+(?:[\s\-]\w+)*)(?:\s*\((@?\w[\w.]*)\))?(?:\s*\[committed\])?$/i.exec(item);
  if (puM) {
    const committed   = /\[committed\]/i.test(item);
    const base        = puM[1] ? _resolveQuantity(puM[1], rollData) : 0;
    const rate        = parseInt(puM[2], 10);
    const rateN       = puM[3] ? parseInt(puM[3].trim(), 10) : 1;
    const unit        = puM[4];
    let   maxResolved = null;
    if (puM[5]) {
      if (/^\d+$/.test(puM[5])) maxResolved = parseInt(puM[5], 10);
      else if (rollData) {
        const key = puM[5].replace(/^@/, "");
        const v   = rollData[key];
        if (typeof v === "number") maxResolved = Math.floor(v);
      }
    }
    result.motes += base;
    result.moteVar = { type: "perUnit", rate, rateN, unit, min: 0, maxResolved, committed };
    return true;
  }

  // Open-ended: "2m+"
  const oeM = /^(\d+)\s*m\+$/i.exec(item);
  if (oeM) {
    const committed = /\[committed\]/i.test(item);
    result.motes += parseInt(oeM[1], 10);
    result.moteVar = { type: "openEnded", committed };
    return true;
  }

  // Fixed motes: "3m" or "@ess m" or "1m [committed]"
  const fxM = /^(@?\w+|\d+)\s*m(?:\s*\[committed\])?$/i.exec(item);
  if (fxM) {
    const committed  = /\[committed\]/i.test(item);
    result.motes    += _resolveQuantity(fxM[1], rollData);
    result.committed = result.committed || committed;
    return true;
  }

  return false;
}

function _parseItem(item, result, rollData) {
  const s = item.trim();

  const wpM = /^(\d+)wp$/i.exec(s);
  if (wpM)  { result.willpower += parseInt(wpM[1], 10); return true; }

  const hlM = /^(\d+)(lhl|bhl|ahl|hl)$/i.exec(s);
  if (hlM) {
    const n = parseInt(hlM[1], 10);
    const t = hlM[2].toLowerCase();
    if (t === "lhl" || t === "hl") result.lethalHealth    += n;
    else if (t === "bhl")          result.bashingHealth   += n;
    else                           result.aggravatedHealth += n;
    return true;
  }

  const xpM = /^(\d+)xp$/i.exec(s);
  if (xpM) { result.xp += parseInt(xpM[1], 10); return true; }

  const promM = /^(\d+)p$/i.exec(s);
  if (promM) { result.promise += parseInt(promM[1], 10); return true; }

  const permM = /^perm\s+(ess|essence|wp|willpower)$/i.exec(s);
  if (permM) {
    const k = permM[1].toLowerCase();
    if (k === "ess" || k === "essence") result.permanentEssence++;
    else                                 result.permanentWillpower++;
    return true;
  }

  return _parseMoteItem(s, result, rollData);
}

function _parseSurchargeOpts(surchargeStr, rollData) {
  return _splitOnOr(surchargeStr).map(opt => {
    opt = opt.trim();

    // Extract trailing condition "[@ token op value]"
    let condition = null, conditionMet = false;
    const condM = /\[(@\w+\s*(?:>=|<=|>|<|=)\s*\d+)\]$/.exec(opt);
    if (condM) {
      condition    = condM[1].trim();
      conditionMet = _evalCondition(condition, rollData);
      opt          = opt.slice(0, condM.index).trim();
    }

    // Extract leading "+"
    let relative = false;
    if (opt.startsWith("+")) { relative = true; opt = opt.slice(1).trim(); }

    // Parse inner cost
    const innerResult = ZERO_COST();
    for (const it of _splitItems(opt)) _parseItem(it, innerResult, rollData);

    return { label: opt || null, condition, conditionMet, relative, cost: innerResult };
  });
}

/**
 * Parse an activation cost formula string into a structured ParsedCost object.
 *
 * Supported syntax (see spec docs/superpowers/specs/2026-05-15-cost-formula-dsl-design.md):
 *   "3m"  "4m, 1wp"  "1m/die (@str)"  "2m+"  "3m or 5m"  "—(5m, 1wp)"  ...
 *
 * @param {string|null} formula
 * @param {object|null} [rollData]  Actor rollData for resolving "@token" cap formulas.
 * @returns {ParsedCost|null}  Zero-cost object for empty/null input; null if the formula contains an unrecognised token.
 */
export function parseCostFormula(formula, rollData = null) {
  if (!formula || typeof formula !== "string") return ZERO_COST();
  const f = formula.trim();
  if (!f || f === "—") return ZERO_COST();

  // Surcharge wrapper: "—(content)" only
  const surchargeM = /^—\((.+)\)$/.exec(f);
  if (surchargeM) {
    return { ...ZERO_COST(), surcharge: _parseSurchargeOpts(surchargeM[1], rollData) };
  }

  // Standard item list
  const result = ZERO_COST();
  for (const item of _splitItems(f)) {
    const ok = _parseItem(item, result, rollData);
    if (!ok) {
      console.warn(`[exalted2e] parseCostFormula: unrecognised token "${item.trim()}" in "${formula}"`);
      return null;
    }
  }
  return result;
}

/**
 * Returns the activation cost display string for a charm cost object.
 * With the formula DSL, cost.formula IS the display string.
 *
 * @param {object} [cost]
 * @returns {string}
 */
export function moteCostString(cost) {
  return cost?.formula ?? "";
}

/**
 * Returns variable-cost display fields for a charm item, for use in dialog
 * picker contexts. The return shape matches what templates already expect:
 * { hasTiers, tiers, hasPerUnit, motesPerUnit, motesMin, motesMax, motesUnitLabel, baseMotes }
 *
 * @param {ExaltedItem} charm
 * @returns {object}
 */
export function charmVariableCostCtx(charm) {
  const parsed = parseCostFormula(charm.system?.cost?.formula ?? "");
  const base   = { hasTiers: false, tiers: [], hasPerUnit: false, motesPerUnit: 0, motesMin: 0, motesMax: 0, motesUnitLabel: "unit", baseMotes: parsed?.motes ?? 0 };
  if (!parsed?.moteVar) return base;
  const { moteVar, motes } = parsed;
  switch (moteVar.type) {
    case "perUnit": return {
      hasTiers: false, tiers: [],
      hasPerUnit: true, motesPerUnit: moteVar.rate,
      motesMin: moteVar.min, motesMax: moteVar.maxResolved ?? 0,
      motesUnitLabel: moteVar.unit, baseMotes: motes,
    };
    case "tiered": return {
      hasTiers: true, tiers: moteVar.tiers,
      hasPerUnit: false, motesPerUnit: 0, motesMin: 0, motesMax: 0,
      motesUnitLabel: "unit", baseMotes: motes,
    };
    case "openEnded": return {
      hasTiers: false, tiers: [],
      hasPerUnit: true, motesPerUnit: 1,
      motesMin: 0, motesMax: 0,
      motesUnitLabel: "mote", baseMotes: motes,
    };
    default: return base;
  }
}

/**
 * Given FormDataExtended output and the enriched charm context array (produced
 * by spreading charmVariableCostCtx into each entry), returns charmActivations:
 *   [{ id: string, motesOverride: number | undefined }]
 *
 * Only checked charms (data["charm-<id>"] truthy) are included.
 * `motesOverride` is undefined for fixed-cost charms (activateCharm uses
 * cost.motes directly); for variable-cost charms it is the computed total.
 *
 * @param {object} data - FormDataExtended result object
 * @param {Array}  charms - enriched charm context objects
 * @returns {Array<{id: string, motesOverride: number|undefined}>}
 */
export function extractCharmActivations(data, charms) {
  return charms
    .filter(c => data[`charm-${c.id}`])
    .map(c => {
      if (!c.hasTiers && !c.hasPerUnit) return { id: c.id, motesOverride: undefined };
      // Tier picks: radio value is the tier's moteCost directly.
      let motes = c.hasTiers
        ? Math.max(0, parseInt(data[`charm-tier-${c.id}`], 10) || 0)
        : c.baseMotes;
      // Per-unit adds on top of the tier (or base) cost.
      if (c.hasPerUnit) {
        const raw   = parseInt(data[`charm-units-${c.id}`], 10);
        const units = Math.max(c.motesMin, isNaN(raw) ? c.motesMin : raw);
        motes += c.motesPerUnit * units;
      }
      return { id: c.id, motesOverride: motes };
    });
}

/**
 * Normalize a raw charm `system.cost` object to non-negative integer values.
 *
 * Two modes:
 *  - Formula-based (CharmData after DSL): cost has a `formula` string field.
 *    Parses it and reads all cost components from ParsedCost.
 *  - Legacy field-based (SpellData, old data): cost has `motes`, `willpower`, etc.
 *    Reads fields directly (SpellData schema is unchanged).
 *
 * @param {object} [cost]
 * @param {object} [overrides]
 * @param {number} [overrides.motesOverride]  If provided, replaces the mote amount.
 * @returns {{moteCost, willpowerCost, bashingCost, lethalCost, aggravatedCost, xpCost}}
 */
export function normalizeCost(cost, { motesOverride } = {}) {
  const n   = v => Math.max(0, Math.floor(Number(v) || 0));
  const ov  = (motesOverride !== undefined && motesOverride !== null) ? n(motesOverride) : null;

  // Formula-based path (charm cost after DSL change)
  if (cost !== null && cost !== undefined && "formula" in cost) {
    const parsed = parseCostFormula(cost.formula ?? "") ?? {};
    return {
      moteCost:       ov ?? (parsed.motes ?? 0),
      willpowerCost:  parsed.willpower ?? 0,
      bashingCost:    parsed.bashingHealth ?? 0,
      lethalCost:     parsed.lethalHealth ?? 0,
      aggravatedCost: parsed.aggravatedHealth ?? 0,
      xpCost:         parsed.xp ?? 0,
    };
  }

  // Legacy field-based path (SpellData, other non-charm cost objects)
  return {
    moteCost:       ov ?? n(cost?.motes),
    willpowerCost:  n(cost?.willpower),
    bashingCost:    n(cost?.bashingHealth),
    lethalCost:     n(cost?.lethalHealth),
    aggravatedCost: n(cost?.aggravatedHealth),
    xpCost:         n(cost?.xp),
  };
}

/**
 * Compute the Foundry `actor.update()` payload that reverses a charm activation
 * ledger.
 *
 * Inputs:
 *   - `ledger`: the record stored on the chat message at activation time:
 *     `{moteBreakdown, willpower, bashing, lethal, aggravated, xp}`.
 *     `moteBreakdown` has shape `{primaryPool, secondaryPool, fromPrimary, fromSecondary}`
 *     as returned by `ExaltedActor.spendMotes`.
 *   - `actorSystem`: the actor's `system` object as it stands right now.
 *     Reads `motes[poolKey]`, `willpower`, `experience`, and `health`.
 *
 * Returns `{updates}` where `updates` is a flat dict of dotted paths suitable
 * for `actor.update(updates)`. Refunds are capped at each resource's max (pool
 * max, willpower max, experience total); health values are floored at 0.
 * Toggle-state and spawned-weapon teardown are NOT this helper's concern — the
 * listener still handles those through the `ExaltedItem` API.
 *
 * @param {object} ledger
 * @param {object} actorSystem
 * @returns {{updates: Record<string, unknown>}}
 */
export function planLedgerRefund(ledger, actorSystem) {
  const updates = {};
  const sys = actorSystem ?? {};
  const l   = ledger      ?? {};

  // ── Motes: refund to the exact pools they came from ────────────────
  const mb = l.moteBreakdown;
  if (mb && (Number(mb.fromPrimary) > 0 || Number(mb.fromSecondary) > 0)) {
    const primary   = sys.motes?.[mb.primaryPool]   ?? { value: 0, max: 0 };
    const secondary = sys.motes?.[mb.secondaryPool] ?? { value: 0, max: 0 };
    updates[`system.motes.${mb.primaryPool}.value`]   = Math.min(primary.max   ?? 0, (primary.value   ?? 0) + (Number(mb.fromPrimary)   || 0));
    updates[`system.motes.${mb.secondaryPool}.value`] = Math.min(secondary.max ?? 0, (secondary.value ?? 0) + (Number(mb.fromSecondary) || 0));
  }

  // ── Willpower (capped at max) ──────────────────────────────────────
  const wpRefund = Number(l.willpower) || 0;
  if (wpRefund > 0) {
    const wp = sys.willpower ?? { value: 0, max: 0 };
    updates["system.willpower.value"] = Math.min(wp.max ?? 0, (wp.value ?? 0) + wpRefund);
  }

  // ── XP (capped at `experience.total`, the earned-XP ceiling) ───────
  const xpRefund = Number(l.xp) || 0;
  if (xpRefund > 0) {
    const xp = sys.experience ?? { value: 0, total: 0 };
    updates["system.experience.value"] = Math.min(xp.total ?? 0, (xp.value ?? 0) + xpRefund);
  }

  // ── Health: decrement each column, fresh object so the original
  //    system.health is not mutated ────────────────────────────────────
  const bRefund = Number(l.bashing)    || 0;
  const lRefund = Number(l.lethal)     || 0;
  const aRefund = Number(l.aggravated) || 0;
  if (bRefund > 0 || lRefund > 0 || aRefund > 0) {
    const h = { ...(sys.health ?? {}) };
    if (bRefund > 0) h.bashing    = Math.max(0, (h.bashing    ?? 0) - bRefund);
    if (lRefund > 0) h.lethal     = Math.max(0, (h.lethal     ?? 0) - lRefund);
    if (aRefund > 0) h.aggravated = Math.max(0, (h.aggravated ?? 0) - aRefund);
    updates["system.health"] = h;
  }

  return { updates };
}
