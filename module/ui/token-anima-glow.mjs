import { getAnimaPalette } from "../config.mjs";

const GLOW_CONTAINER_KEY = "_ex2eGlowContainer";

const RING_SPACING_PX  = 8;
const BLUR_MULTIPLIER  = 6;

const TIER_ALPHA = {
  glowing: 0.35,
  burning: 0.55,
  bonfire: 0.75,
  totemic: 0.90
};

const DEFAULT_GLOW  = { burning: "none", bonfire: "pulse", totemic: "pulse" };
const DEFAULT_LIGHT = { burning: "none", bonfire: "pulse", totemic: "pulse" };

const TIER_LIGHT = {
  burning: { bright: 0, dim: 0, alpha: 0.4, speed: 0 },
  bonfire: { bright: 0.3, dim: 0.3, alpha: 0.5, speed: 2 },
  totemic: { bright: 0.3, dim: 0.3, alpha: 0.6, speed: 4 }
};

const TIER_STRENGTH = { burning: 0.8, bonfire: 1.0, totemic: 1.3 };

export function refreshTokenAnimaGlow(token) {
  const actor = token.actor;
  if (!actor || actor.type !== "character") return;

  const tier   = actor.system.anima ?? "none";
  const colors = actor.getFlag("exalted2e", "animaColors") ?? [null, null, null];

  if (game.modules.get("tokenmagic")?.active) {
    const tmfxPresets      = actor.getFlag("exalted2e", "animaTmfxPresets")      ?? {};
    const tmfxCustomParams = actor.getFlag("exalted2e", "animaTmfxCustomParams") ?? {};
    _updateTMFXGlow(token, tier, tmfxPresets, tmfxCustomParams).catch(err =>
      console.error("exalted2e | TMFX glow update failed:", err)
    );
  } else {
    const glowEffects  = actor.getFlag("exalted2e", "animaEffects")      ?? {};
    const lightEffects = actor.getFlag("exalted2e", "animaLightEffects") ?? {};
    _updatePIXIGlow(token, tier, colors, glowEffects);
    _updateTokenLight(token, tier, colors, lightEffects);
  }
}

async function _deleteAnimaFilters(token) {
  const stored = token.document.getFlag("tokenmagic", "filters") ?? [];
  const ids = [...new Set(
    stored.map(f => f.tmFilters?.tmFilterId).filter(id => id?.startsWith("exalted2e-anima"))
  )];
  for (const id of ids) {
    await TokenMagic.deleteFilters(token, id);
  }
}

async function _addAnimaFilters(token, params) {
  for (let i = 0; i < params.length; i++) {
    await TokenMagic.addFilters(token, [{ ...params[i], filterId: `exalted2e-anima-${i}` }]);
  }
}

async function _updateTMFXGlow(token, tier, tmfxPresets, tmfxCustomParams) {
  await _deleteAnimaFilters(token);

  if (tier === "none" || tier === "dim") return;

  const customParams = tmfxCustomParams?.[tier];
  if (customParams?.length) {
    await _addAnimaFilters(token, customParams);
    return;
  }

  const presetName = tmfxPresets[tier] ?? "none";
  if (presetName === "none") return;

  const params = TokenMagic.getPreset(presetName);
  if (!params) return;

  const scalar = TIER_STRENGTH[tier] ?? 1.0;
  const scaledParams = params.map(p => {
    const out = { ...p };
    if (p.outerStrength    !== undefined) out.outerStrength    = p.outerStrength    * scalar;
    if (p.innerStrength    !== undefined) out.innerStrength    = p.innerStrength    * scalar;
    if (p.auraIntensity    !== undefined) out.auraIntensity    = p.auraIntensity    * scalar;
    if (p.subAuraIntensity !== undefined) out.subAuraIntensity = p.subAuraIntensity * scalar;
    if (p.padding          !== undefined) out.padding          = Math.round(p.padding * scalar);
    return out;
  });
  await _addAnimaFilters(token, scaledParams);
}

function _updatePIXIGlow(token, tier, colors, glowEffects) {
  if (token[GLOW_CONTAINER_KEY]) {
    if (token[GLOW_CONTAINER_KEY]._glowTick) {
      PIXI.Ticker.shared.remove(token[GLOW_CONTAINER_KEY]._glowTick);
    }
    token[GLOW_CONTAINER_KEY].destroy({ children: true });
    token[GLOW_CONTAINER_KEY] = null;
  }

  if (tier === "none" || tier === "dim") return;
  if (!token.mesh) return;

  const alpha = TIER_ALPHA[tier] ?? 0;
  let filledColors = colors.filter(Boolean);

  if (!filledColors.length) {
    const palette = getAnimaPalette(token.actor);
    if (palette.length) filledColors = [palette[0].hex];
  }
  if (!filledColors.length) return;

  const container = new PIXI.Container();
  container.alpha = alpha;

  const BlurFilter = PIXI.BlurFilter ?? PIXI.filters?.BlurFilter;

  filledColors.forEach((hex, slotIndex) => {
    const color  = new PIXI.Color(hex).toNumber();
    const radius = token.w / 2 + (slotIndex + 1) * RING_SPACING_PX;

    const gfx = new PIXI.Graphics();
    gfx.beginFill(color, 1.0);
    gfx.drawCircle(token.w / 2, token.h / 2, radius);
    gfx.endFill();

    gfx.blendMode = PIXI.BLEND_MODES.ADD;

    const blur = new BlurFilter();
    blur.blur = (slotIndex + 1) * BLUR_MULTIPLIER;
    gfx.filters = [blur];

    container.addChild(gfx);
  });

  const effectKey = glowEffects[tier] ?? DEFAULT_GLOW[tier] ?? "none";
  const tick = _buildTick(effectKey, container, alpha);
  if (tick) {
    PIXI.Ticker.shared.add(tick);
    container._glowTick = tick;
  }

  token.addChildAt(container, 0);
  token[GLOW_CONTAINER_KEY] = container;
}

// ── PIXI animation factories ───────────────────────────────────────────────

function _buildTick(effectKey, container, alpha) {
  if (effectKey === "pulse")   return _pulseTick(container, alpha);
  if (effectKey === "flicker") return _flickerTick(container, alpha);
  return null;
}

function _pulseTick(container, alpha) {
  return () => {
    container.alpha = alpha + Math.sin(Date.now() / 1000 * 0.8 * Math.PI) * 0.18;
  };
}

function _flickerTick(container, alpha) {
  let current = alpha;
  return () => {
    const target = alpha * (0.65 + Math.random() * 0.7);
    current += (target - current) * 0.25;
    container.alpha = Math.max(0.05, Math.min(1.0, current));
  };
}

// ── Token light ────────────────────────────────────────────────────────────

function _updateTokenLight(token, tier, colors, lightEffects) {
  const lightCfg = TIER_LIGHT[tier];
  if (!lightCfg) {
    token.document.updateSource({
      light: { bright: 0, dim: 0, alpha: 0, animation: { type: null } }
    });
    return;
  }

  const animType   = lightEffects[tier] ?? DEFAULT_LIGHT[tier] ?? "none";
  const outerColor = [...colors].reverse().find(Boolean) ?? "#FFD700";

  token.document.updateSource({
    light: {
      bright: lightCfg.bright,
      dim:    lightCfg.dim,
      alpha:  lightCfg.alpha,
      color:  outerColor,
      animation: {
        type:  animType === "none" ? null : animType,
        speed: lightCfg.speed
      }
    }
  });
}
