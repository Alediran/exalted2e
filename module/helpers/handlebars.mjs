import { EX2E } from "../config.mjs";

/**
 * Register all Handlebars helpers used by the Exalted 2e system.
 */
export function registerHandlebarsHelpers() {

  // ── dotRating ──────────────────────────────────────────────────────────
  // Renders a row of clickable round dot pips (permanent ratings).
  // Usage: {{dotRating name=fieldName value=currentVal max=5 min=0}}
  Handlebars.registerHelper("dotRating", function(options) {
    const { name, value, max = 5, min = 0 } = options.hash;
    const safeVal = Math.max(min, Math.min(max, value ?? 0));
    let html = `<div class="dot-rating" data-name="${name}" data-max="${max}" data-min="${min}" data-current="${safeVal}">`;
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

  // ── healthTrack ────────────────────────────────────────────────────────
  // Renders the Exalted health track with damage types shown.
  // Usage: {{healthTrack health=system.health}}
  Handlebars.registerHelper("healthTrack", function(options) {
    const { health } = options.hash;
    const totalBoxes = health.totalBoxes ?? 7;
    const agg    = Math.min(health.aggravated ?? 0, totalBoxes);
    const lethal = Math.min(health.lethal     ?? 0, totalBoxes - agg);
    const bash   = Math.min(health.bashing    ?? 0, totalBoxes - agg - lethal);

    const levelLabels = ["-0", "-1", "-1", "-2", "-2", "-4", "Inc"];

    let html = '<div class="health-track">';
    for (let i = 0; i < totalBoxes; i++) {
      let dmgClass = "empty";
      let dmgLabel = "";
      if (i < agg) {
        dmgClass = "aggravated";
        dmgLabel = "X";
      } else if (i < agg + lethal) {
        dmgClass = "lethal";
        dmgLabel = "/";
      } else if (i < agg + lethal + bash) {
        dmgClass = "bashing";
        dmgLabel = "\\";
      }
      const levelLabel = i < levelLabels.length ? levelLabels[i] : "";
      html += `<div class="health-box ${dmgClass}" data-index="${i}" title="${levelLabel}">
        <span class="box-label">${levelLabel}</span>
        <span class="box-mark">${dmgLabel}</span>
      </div>`;
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
    let html = `<div class="limit-track" data-name="${name ?? 'system.limit.value'}" data-current="${safeVal}">`;
    for (let i = 1; i <= 10; i++) {
      const filled = i <= safeVal ? "filled" : "";
      html += `<span class="limit-pip ${filled}" data-value="${i}"></span>`;
    }
    html += "</div>";
    return new Handlebars.SafeString(html);
  });

  // ── localizeAbility ───────────────────────────────────────────────────
  Handlebars.registerHelper("localizeAbility", function(key) {
    const labelKey = EX2E.abilityLabels[key];
    return labelKey ? game.i18n.localize(labelKey) : key;
  });

  // ── localizeAttribute ─────────────────────────────────────────────────
  Handlebars.registerHelper("localizeAttribute", function(key) {
    for (const group of Object.values(EX2E.attributes)) {
      if (group[key]) return game.i18n.localize(group[key]);
    }
    return key;
  });

  // ── concatClasses ─────────────────────────────────────────────────────
  Handlebars.registerHelper("concatClasses", function(...args) {
    return args.filter(a => typeof a === "string").join(" ");
  });

  // ── gt / gte / lt / lte / eq ──────────────────────────────────────────
  Handlebars.registerHelper("gt",  (a, b) => a >  b);
  Handlebars.registerHelper("gte", (a, b) => a >= b);
  Handlebars.registerHelper("lt",  (a, b) => a <  b);
  Handlebars.registerHelper("lte", (a, b) => a <= b);
  Handlebars.registerHelper("eq",  (a, b) => a == b);
  Handlebars.registerHelper("neq", (a, b) => a != b);

  // ── add / subtract ────────────────────────────────────────────────────
  Handlebars.registerHelper("add", (a, b) => Number(a) + Number(b));
  Handlebars.registerHelper("sub", (a, b) => Number(a) - Number(b));

  // ── includes ──────────────────────────────────────────────────────────
  Handlebars.registerHelper("includes", (arr, item) =>
    Array.isArray(arr) && arr.includes(item)
  );

  // ── times ─────────────────────────────────────────────────────────────
  // {{#times 5}} ... {{/times}}
  Handlebars.registerHelper("times", function(n, block) {
    let result = "";
    for (let i = 0; i < n; i++) result += block.fn(i);
    return result;
  });

  // ── range ─────────────────────────────────────────────────────────────
  Handlebars.registerHelper("range", function(from, to, options) {
    let result = "";
    for (let i = from; i <= to; i++) result += options.fn(i);
    return result;
  });

  // ── objectEntries ─────────────────────────────────────────────────────
  Handlebars.registerHelper("objectEntries", function(obj, block) {
    if (typeof obj !== "object" || obj === null) return "";
    return Object.entries(obj).map(([key, value]) => block.fn({ key, value })).join("");
  });

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
}
