const GLOW_CONTAINER_KEY = "_ex2eGlowContainer";

const RING_SPACING_PX  = 8;
const BLUR_MULTIPLIER  = 6;

const TIER_ALPHA = {
  glowing: 0.35,
  burning: 0.55,
  bonfire: 0.75,
  totemic: 0.90
};

const TIER_LIGHT = {
  burning: { bright: 0, dim: 1, alpha: 0.4, animType: "none",  speed: 0 },
  bonfire: { bright: 0, dim: 2, alpha: 0.5, animType: "pulse", speed: 2 },
  totemic: { bright: 1, dim: 3, alpha: 0.6, animType: "pulse", speed: 4 }
};

export function refreshTokenAnimaGlow(token) {
  const actor = token.actor;
  if (!actor || actor.type !== "character") return;

  const tier   = actor.system.anima ?? "none";
  const colors = actor.getFlag("exalted2e", "animaColors") ?? [null, null, null];

  _updatePIXIGlow(token, tier, colors);
  _updateTokenLight(token, tier, colors);
}

function _updatePIXIGlow(token, tier, colors) {
  // Remove existing container
  if (token[GLOW_CONTAINER_KEY]) {
    token[GLOW_CONTAINER_KEY].destroy({ children: true });
    token[GLOW_CONTAINER_KEY] = null;
  }

  if (tier === "none" || tier === "dim") return;
  if (!token.mesh) return; // token not yet drawn — skip

  const alpha = TIER_ALPHA[tier] ?? 0;
  const filledColors = colors.filter(Boolean);
  if (!filledColors.length) return; // no colors configured — skip PIXI layer

  const container = new PIXI.Container();
  container.alpha = alpha;

  filledColors.forEach((hex, slotIndex) => {
    // PIXI v8: use PIXI.Color instead of removed PIXI.utils.string2hex
    const color  = new PIXI.Color(hex).toNumber();
    const radius = token.w / 2 + (slotIndex + 1) * RING_SPACING_PX;

    const gfx = new PIXI.Graphics();
    gfx.circle(token.w / 2, token.h / 2, radius);
    gfx.fill({ color, alpha: 0.8 });

    // blendMode must be set on the renderable child, not the Container
    gfx.blendMode = PIXI.BLEND_MODES.ADD;

    // PIXI v8: BlurFilter is at PIXI.BlurFilter (not PIXI.filters.BlurFilter)
    const BlurFilter = PIXI.BlurFilter ?? PIXI.filters?.BlurFilter;
    const blur = new BlurFilter();
    blur.blur = (slotIndex + 1) * BLUR_MULTIPLIER;
    gfx.filters = [blur];

    container.addChild(gfx);
  });

  // Insert at z=0 so the glow sits behind all token children
  token.addChildAt(container, 0);
  token[GLOW_CONTAINER_KEY] = container;
}

function _updateTokenLight(token, tier, colors) {
  const lightCfg = TIER_LIGHT[tier];
  if (!lightCfg) {
    // glowing, dim, or none — clear any light we previously set
    token.document.updateSource({
      light: { bright: 0, dim: 0, alpha: 0, animation: { type: null } }
    });
    return;
  }

  // Use the outermost (last) filled color as the light tint
  const outerColor = [...colors].reverse().find(Boolean) ?? "#FFD700";

  token.document.updateSource({
    light: {
      bright: lightCfg.bright,
      dim:    lightCfg.dim,
      alpha:  lightCfg.alpha,
      color:  outerColor,
      animation: {
        type:  lightCfg.animType,
        speed: lightCfg.speed
      }
    }
  });
}
