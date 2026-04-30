/**
 * Quench test-harness entry point.
 *
 * Loaded conditionally from module/exalted2e.mjs only when the Quench
 * module is active. Registers each test batch via Quench's `quenchReady`
 * hook. Do NOT import this file outside of that gated path — it pulls in
 * the helper layer and test fixtures that the production runtime doesn't
 * need.
 */

import { registerKnockbackFocused }       from "./combat/knockback-focused.mjs";
import { registerKnockbackSmoke }         from "./combat/knockback-smoke.mjs";
import { registerDvRefresh }              from "./combat/dv-refresh.mjs";
import { registerMultiTick }              from "./combat/multi-tick.mjs";
import { registerSorceryShapingFocused }  from "./combat/sorcery-shaping-focused.mjs";
import { registerSorceryShapingSmoke }    from "./combat/sorcery-shaping-smoke.mjs";
import { registerAttackPipelineFocused }  from "./combat/attack-pipeline-focused.mjs";
import { registerCharmActivation }        from "./combat/charm-activation.mjs";
import { registerCharmWeaponArtifacts }   from "./combat/charm-weapon-artifacts.mjs";
import { registerAttackCharmSmoke }       from "./combat/attack-charm-smoke.mjs";
import { registerSocialAttackFocused }    from "./combat/social-attack-focused.mjs";
import { registerSocialDefense }          from "./combat/social-defense.mjs";
import { registerSocialSmoke }            from "./combat/social-smoke.mjs";
import { registerStuntRewards }           from "./combat/stunt-rewards.mjs";
import { registerPurchaseMode }           from "./combat/purchase-mode.mjs";
import { registerAttunement }             from "./combat/attunement.mjs";
import { registerResourceEconomySmoke }   from "./combat/resource-economy-smoke.mjs";
import { registerEffectWrapper }          from "./combat/effect-wrapper.mjs";
import { registerCombatHudSmoke }         from "./combat/combat-hud-smoke.mjs";
import { registerCasteAttributes }        from "./combat/caste-attributes.mjs";
import { registerShapeshift }              from "./combat/shapeshift.mjs";
import { registerDBT }                     from "./combat/dbt.mjs";

Hooks.once("quenchReady", quench => {
  quench.registerBatch("ex2e.knockback.focused",        registerKnockbackFocused,       { displayName: "Knockback (focused)" });
  quench.registerBatch("ex2e.knockback.smoke",          registerKnockbackSmoke,         { displayName: "Knockback (smoke)" });
  quench.registerBatch("ex2e.dv-refresh",               registerDvRefresh,              { displayName: "DV refresh" });
  quench.registerBatch("ex2e.multi-tick",               registerMultiTick,              { displayName: "Multi-tick container" });
  quench.registerBatch("ex2e.sorcery.focused",          registerSorceryShapingFocused,  { displayName: "Sorcery shaping (focused)" });
  quench.registerBatch("ex2e.sorcery.smoke",            registerSorceryShapingSmoke,    { displayName: "Sorcery shaping (smoke)" });
  quench.registerBatch("ex2e.attack.focused",           registerAttackPipelineFocused,  { displayName: "Attack pipeline (focused)" });
  quench.registerBatch("ex2e.charm.activation",         registerCharmActivation,        { displayName: "Charm activation lifecycle" });
  quench.registerBatch("ex2e.charm.weapon-artifacts",   registerCharmWeaponArtifacts,   { displayName: "Charm weapon artifacts" });
  quench.registerBatch("ex2e.attack-charm.smoke",       registerAttackCharmSmoke,       { displayName: "Attack + charm (smoke)" });
  quench.registerBatch("ex2e.social.focused",           registerSocialAttackFocused,    { displayName: "Social attack (focused)" });
  quench.registerBatch("ex2e.social.defense",           registerSocialDefense,          { displayName: "Social defense + UMI + scene cleanup" });
  quench.registerBatch("ex2e.social.smoke",             registerSocialSmoke,            { displayName: "Social attack (smoke)" });
  quench.registerBatch("ex2e.stunt.rewards",            registerStuntRewards,           { displayName: "Stunt rewards" });
  quench.registerBatch("ex2e.purchase.mode",            registerPurchaseMode,           { displayName: "Purchase mode enforcement" });
  quench.registerBatch("ex2e.attunement",               registerAttunement,             { displayName: "Attunement / artifact commitment" });
  quench.registerBatch("ex2e.resource-economy.smoke",   registerResourceEconomySmoke,   { displayName: "Resource economy (smoke)" });
  quench.registerBatch("ex2e.effect-wrapper",           registerEffectWrapper,          { displayName: "Effect-wrapper compendium" });
  quench.registerBatch("ex2e.combat-hud.smoke",         registerCombatHudSmoke,         { displayName: "Combat HUD (smoke)" });
  quench.registerBatch("ex2e.caste-attributes",        registerCasteAttributes,        { displayName: "Caste attributes" });
  quench.registerBatch("ex2e.shapeshift",              registerShapeshift,             { displayName: "Lunar shapeshift" });
  quench.registerBatch("ex2e.dbt",                     registerDBT,                    { displayName: "Deadly Beastman Transformation" });
});
