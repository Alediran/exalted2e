import { EX2E } from "../config.mjs";
import { moteCostString } from "../rolls/activation-ledger.mjs";
import { itemDescription } from "./localize-description.mjs";

/**
 * Register all Handlebars helpers used by the Exalted 2e system.
 */
export function registerHandlebarsHelpers() {

  // ── moteCostString ─────────────────────────────────────────────────────
  // Returns the variable-aware mote cost label for a cost object.
  // Usage: {{moteCostString system.cost}}
  Handlebars.registerHelper("moteCostString", cost => moteCostString(cost));

  // ── dotRating ──────────────────────────────────────────────────────────
  // Renders a row of clickable round dot pips (permanent ratings).
  // Usage: {{dotRating name=fieldName value=currentVal max=5 min=0}}
  Handlebars.registerHelper("dotRating", function(options) {
    const { name, value, max = 5, min = 0, readonly = false } = options.hash;
    const safeVal = Math.max(min, Math.min(max, value ?? 0));
    const nameAttr = readonly ? "" : ` data-name="${name}"`;
    const roClass  = readonly ? " readonly" : "";
    let html = `<div class="dot-rating${roClass}"${nameAttr} data-max="${max}" data-min="${min}" data-current="${safeVal}">`;
    for (let i = 1; i <= max; i++) {
      const filled = i <= safeVal ? "filled" : "";
      html += `<span class="dot ${filled}" data-value="${i}" title="${i}"></span>`;
    }
    html += "</div>";
    return new Handlebars.SafeString(html);
  });

  // ── boxRating ──────────────────────────────────────────────────────────
  // Renders a row of clickable square boxes (temporal / resource tracks).
  // `total` controls how many boxes are rendered (matches the pip track above).
  // Boxes beyond `max` are shown disabled (greyed out, not clickable).
  // Usage: {{boxRating name=fieldName value=currentVal max=5 total=10 min=0}}
  Handlebars.registerHelper("boxRating", function(options) {
    const { name, value, max = 5, total, min = 0 } = options.hash;
    const display = total ?? max;
    const safeVal = Math.max(min, Math.min(max, value ?? 0));
    let html = `<div class="box-rating" data-name="${name}" data-max="${max}" data-min="${min}" data-current="${safeVal}">`;
    for (let i = 1; i <= display; i++) {
      if (i > max) {
        html += `<span class="box disabled" title="—"></span>`;
      } else {
        const filled = i <= safeVal ? "filled" : "";
        html += `<span class="box ${filled}" data-value="${i}" title="${i}"></span>`;
      }
    }
    html += "</div>";
    return new Handlebars.SafeString(html);
  });

  // ── pipTrack ───────────────────────────────────────────────────────────
  // Renders a row of clickable pip buttons plus a hidden value input.
  // Used by the Excellency sections in roll/attack/social-attack dialogs.
  // Usage: {{pipTrack name="firstExcDice" max=firstExcMax exc="first"}}
  Handlebars.registerHelper("pipTrack", function(options) {
    const { name, max = 0, exc = "" } = options.hash;
    let html = `<div class="exc-pip-track" data-exc="${exc}">`;
    for (let i = 1; i <= max; i++) {
      html += `<button type="button" class="exc-pip" data-value="${i}"></button>`;
    }
    html += `<input type="hidden" name="${name}" value="0"></div>`;
    return new Handlebars.SafeString(html);
  });

  // ── healthTrack ────────────────────────────────────────────────────────
  // Renders the Exalted health track as one row per penalty level. Each
  // row carries a label column (-0 / -1 / -2 / -4 / Inc) and a box
  // column; box lines wrap every 10 boxes and right-align within the
  // column so partial lines settle flush with the track's right edge.
  //
  // -0 / -1 / -2 accept bonus boxes via `health.bonus.{zero,one,two}`;
  // -4 and Incapacitated are always one box each.
  //
  // Usage: {{healthTrack health=system.health}}
  Handlebars.registerHelper("healthTrack", function(options) {
    const { health, exaltType } = options.hash;
    // `levelCounts` is written by _prepareHealthData and includes charm bonuses
    // (Ox-Body etc.). Fall back to manual calculation for contexts that don't
    // run prepareDerivedData (NPC sheet, isolated template tests).
    let zeroCount, oneCount, twoCount;
    if (health.levelCounts) {
      ({ zero: zeroCount, one: oneCount, two: twoCount } = health.levelCounts);
    } else {
      const bonus = health.bonus ?? { zero: 0, one: 0, two: 0 };
      zeroCount = 1 + (bonus.zero ?? 0);
      oneCount  = 2 + (bonus.one  ?? 0);
      twoCount  = 2 + (bonus.two  ?? 0);
    }
    const totalBoxes = zeroCount + oneCount + twoCount + 1 /* -4 */ + 1 /* Inc */;

    const agg    = Math.min(health.aggravated ?? 0, totalBoxes);
    const lethal = Math.min(health.lethal     ?? 0, totalBoxes - agg);
    const bash   = Math.min(health.bashing    ?? 0, totalBoxes - agg - lethal);

    const levels = [
      { label: "-0",  count: zeroCount },
      { label: "-1",  count: oneCount  },
      { label: "-2",  count: twoCount  },
      { label: "-4",  count: 1         },
      { label: "Inc", count: 1         }
    ];

    // Lunars can take Ox-Body twice as many times at each tier, so their
    // rows can stretch well past 5 boxes; give them a 10-box line before
    // wrapping. Everyone else (including NPCs where `exaltType` is unset)
    // wraps at 5 boxes — keeps the track readable on a narrow sheet.
    const MAX_PER_LINE = exaltType === "lunar" ? 10 : 5;
    let globalIndex = 0;
    let html = '<div class="health-track-rows">';

    for (const level of levels) {
      html += `<div class="health-row">`;
      html += `<div class="health-row-label">${level.label}</div>`;
      html += `<div class="health-row-boxes">`;

      // Collect boxes, chunking at MAX_PER_LINE so each resulting line
      // can be right-aligned independently.
      const lines = [];
      let currentLine = [];
      for (let j = 0; j < level.count; j++) {
        let dmgClass = "empty";
        let dmgLabel = "";
        if (globalIndex < agg) {
          dmgClass = "aggravated";
          dmgLabel = "X";
        } else if (globalIndex < agg + lethal) {
          dmgClass = "lethal";
          dmgLabel = "/";
        } else if (globalIndex < agg + lethal + bash) {
          dmgClass = "bashing";
          dmgLabel = "\\";
        }
        currentLine.push(
          `<div class="health-box ${dmgClass}" data-index="${globalIndex}" title="${level.label}">`
          + `<span class="box-mark">${dmgLabel}</span></div>`
        );
        globalIndex++;
        if (currentLine.length >= MAX_PER_LINE) {
          lines.push(currentLine);
          currentLine = [];
        }
      }
      if (currentLine.length > 0) lines.push(currentLine);

      for (const line of lines) {
        html += `<div class="health-row-line">${line.join("")}</div>`;
      }
      html += `</div></div>`;
    }
    html += "</div>";
    return new Handlebars.SafeString(html);
  });

  // ── motePool ───────────────────────────────────────────────────────────
  // Renders a labeled mote pool display.
  // Usage: {{motePool label="Personal" value=13 max=16 committed=3}}
  Handlebars.registerHelper("motePool", function(options) {
    const { label, value, max, committed } = options.hash;
    const available = max - (committed ?? 0);
    return new Handlebars.SafeString(
      `<div class="mote-pool">
        <span class="pool-label">${label}</span>
        <span class="pool-value">${value}/${available}</span>
        ${committed ? `<span class="pool-committed">(${committed} committed)</span>` : ""}
      </div>`
    );
  });

  // ── willpowerTrack ─────────────────────────────────────────────────────
  // Renders the willpower track as filled/empty pips.
  Handlebars.registerHelper("willpowerTrack", function(options) {
    const { value, max, name } = options.hash;
    let html = `<div class="willpower-track" data-name="${name ?? ''}">`;
    for (let i = 1; i <= (max ?? 10); i++) {
      const filled = i <= (value ?? 0) ? "filled" : "";
      html += `<span class="wp-pip ${filled}" data-value="${i}"></span>`;
    }
    html += "</div>";
    return new Handlebars.SafeString(html);
  });

  // ── limitTrack ─────────────────────────────────────────────────────────
  Handlebars.registerHelper("limitTrack", function(options) {
    const { value, name } = options.hash;
    const safeVal = value ?? 0;
    let html = `<div class="limit-track" data-name="${name ?? 'system.limit'}" data-current="${safeVal}">`;
    for (let i = 1; i <= 10; i++) {
      const filled = i <= safeVal ? "filled" : "";
      html += `<span class="limit-pip ${filled}" data-value="${i}"></span>`;
    }
    html += "</div>";
    return new Handlebars.SafeString(html);
  });

  // ── localizeAttribute ─────────────────────────────────────────────────
  Handlebars.registerHelper("localizeAttribute", function(key) {
    for (const group of Object.values(EX2E.attributes)) {
      if (group[key]) return game.i18n.localize(group[key]);
    }
    return key;
  });

  // ── gt / gte / lt / lte / eq ──────────────────────────────────────────
  Handlebars.registerHelper("gt",  (a, b) => a >  b);
  Handlebars.registerHelper("gte", (a, b) => a >= b);
  Handlebars.registerHelper("lt",  (a, b) => a <  b);
  Handlebars.registerHelper("lte", (a, b) => a <= b);
  Handlebars.registerHelper("eq",  (a, b) => a == b);
  Handlebars.registerHelper("neq", (a, b) => a != b);
  Handlebars.registerHelper("or",  (a, b) => a || b);
  Handlebars.registerHelper("and", (a, b) => !!(a && b));

  // ── add / subtract ────────────────────────────────────────────────────
  Handlebars.registerHelper("add", (a, b) => Number(a) + Number(b));
  Handlebars.registerHelper("sub", (a, b) => Number(a) - Number(b));
  Handlebars.registerHelper("mul", (a, b) => Number(a) * Number(b));

  // ── includes ──────────────────────────────────────────────────────────
  Handlebars.registerHelper("includes", (arr, item) =>
    Array.isArray(arr) && arr.includes(item)
  );

  // ── array ─────────────────────────────────────────────────────────────
  // Creates an array from arguments: {{#each (array "a" "b" "c")}}
  Handlebars.registerHelper("array", function(...args) {
    // Last arg is the Handlebars options hash; strip it
    return args.slice(0, -1);
  });

  // ── capitalize ────────────────────────────────────────────────────────
  // Capitalizes first letter: {{capitalize "foo"}} → "Foo"
  // Note: Foundry also registers this, so only register if not already present
  if (!Handlebars.helpers["capitalize"]) {
    Handlebars.registerHelper("capitalize", function(str) {
      if (!str) return "";
      return str.charAt(0).toUpperCase() + str.slice(1);
    });
  }

  // ── localizeKey ───────────────────────────────────────────────────────
  // Finds an option by key in an options array and returns its label.
  // {{localizeKey system.scope scopes}}
  Handlebars.registerHelper("localizeKey", function(key, options) {
    const entry = options.find(o => String(o.key) === String(key));
    return entry ? entry.label : (key ?? "");
  });

  // ── localizeDesc ──────────────────────────────────────────────────────
  // Resolve an item's description to the current UI language (raw HTML).
  // Usage: {{localizeDesc item}}
  Handlebars.registerHelper("localizeDesc", (item) => itemDescription(item));

  // ── descLanguageList ──────────────────────────────────────────────────
  // Declared languages MINUS the primary (first) — the override slots
  // offered in the description editor. Each entry: { lang, label }.
  // Usage: {{#each (descLanguageList)}}
  Handlebars.registerHelper("descLanguageList", () => {
    // game.system.languages is a Set/Collection in Foundry (not an array);
    // Array.from handles Set/array/iterable and degrades to [] for anything
    // non-iterable, so only the Default editor shows if it's unavailable.
    const langs = Array.from(game.system?.languages ?? []);
    return langs.slice(1).map(l => ({ lang: l.lang, label: l.name ?? l.lang }));
  });
}
