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
import { registerCharmEconomics }         from "./combat/charm-economics.mjs";
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
import { registerLunarTell }               from "./combat/lunar-tell.mjs";
import { registerClarity }                 from "./combat/clarity.mjs";
import { registerSubmodules }              from "./combat/submodules.mjs";
import { registerTerrestrialBreeding }     from "./combat/terrestrial-breeding.mjs";
import { registerLimitBreak }              from "./combat/limit-break.mjs";
import { registerAnima }                   from "./combat/anima.mjs";
import { registerActOfVillainy }           from "./combat/act-of-villainy.mjs";
import { registerInfernalUrge }            from "./combat/infernal-urge.mjs";
import { registerEclipseOath }              from "./combat/eclipse-oath.mjs";
import { registerParadox }                  from "./combat/paradox.mjs";
import { registerDestiny }                  from "./combat/destiny.mjs";
import { registerHereticalGating }          from "./combat/heretical-gating.mjs";
import { registerResonanceVent }            from "./combat/resonance-vent.mjs";
import { registerGreaterSigns }             from "./combat/greater-signs.mjs";
import { registerCooperativeCharm }         from "./combat/cooperative-charm.mjs";
import { registerWeavingTests }             from "./combat/weaving.mjs";
import { registerCharmTargetEffect }        from "./combat/charm-target-effect.mjs";
import { registerCharmVariableCost }        from "./combat/charm-variable-cost.mjs";
import { registerHearthstone }              from "./combat/hearthstone.mjs";
import { registerMartialArtsStyle }         from "./combat/martial-arts-style.mjs";
import { registerVirtueChanneling }         from "./combat/virtue-channeling.mjs";
import { registerKeywordGating }            from "./combat/keyword-gating.mjs";
import { registerCoverStarmetal }           from "./combat/cover-starmetal.mjs";
import { registerComboImport }              from "./combat/combo-import.mjs";
import { registerFormCharms }              from "./combat/form-charms.mjs";
import { registerWillpowerVirtueLimit }    from "./combat/willpower-virtue-limit.mjs";
import { registerMentalInfluence }         from "./combat/mental-influence.mjs";
import { registerCoordinationTests }       from "./combat/coordination.mjs";
// NOTE: Anima Powers feature (_swapAnimaPower) relies on the animapowers compendium
// and cannot be exercised via Quench. No batch registered for ex2e.anima-powers.

Hooks.once("quenchReady", async quench => {
  // ui.notifications.element is null in the test world — its #postNotification
  // private method crashes whenever ChatMessage.create triggers a notify call.
  // Suppress notify for the whole test session; individual tests that need to
  // assert on warn/error stub those methods directly on ui.notifications.
  if (ui.notifications) ui.notifications.notify = () => {};

  // Delete any combats left active from a previous game session before any
  // test runs. A lingering combat causes game.combat.combatant to point at
  // the wrong actor, silently breaking Action-Only and other combat-gated checks.
  for (const c of (game.combats?.contents ?? [])) {
    try { await c.delete(); } catch (_) { /* ignore */ }
  }

  quench.registerBatch("ex2e.knockback.focused",        registerKnockbackFocused,       { displayName: "Knockback (focused)" });
  quench.registerBatch("ex2e.knockback.smoke",          registerKnockbackSmoke,         { displayName: "Knockback (smoke)" });
  quench.registerBatch("ex2e.dv-refresh",               registerDvRefresh,              { displayName: "DV refresh" });
  quench.registerBatch("ex2e.multi-tick",               registerMultiTick,              { displayName: "Multi-tick container" });
  quench.registerBatch("ex2e.sorcery.focused",          registerSorceryShapingFocused,  { displayName: "Sorcery shaping (focused)" });
  quench.registerBatch("ex2e.sorcery.smoke",            registerSorceryShapingSmoke,    { displayName: "Sorcery shaping (smoke)" });
  quench.registerBatch("ex2e.attack.focused",           registerAttackPipelineFocused,  { displayName: "Attack pipeline (focused)" });
  quench.registerBatch("ex2e.charm.activation",         registerCharmActivation,        { displayName: "Charm activation lifecycle" });
  quench.registerBatch("ex2e.charm-economics",          registerCharmEconomics,         { displayName: "Charm economics" });
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
  quench.registerBatch("ex2e.lunar-tell",              registerLunarTell,              { displayName: "Lunar Tell trait" });
  quench.registerBatch("ex2e.clarity",                 registerClarity,                { displayName: "Alchemical Clarity & Modules" });
  quench.registerBatch("ex2e.submodules",              registerSubmodules,             { displayName: "Alchemical submodules" });
  quench.registerBatch("ex2e.terrestrial-breeding",    registerTerrestrialBreeding,    { displayName: "Terrestrial Breeding" });
  quench.registerBatch("ex2e.limit-break",             registerLimitBreak,             { displayName: "Limit Break automation" });
  quench.registerBatch("ex2e.anima",                   registerAnima,                  { displayName: "Anima Banner system" });
  quench.registerBatch("ex2e.act-of-villainy",         registerActOfVillainy,          { displayName: "Act of Villainy roll" });
  quench.registerBatch("ex2e.infernal-urge",           registerInfernalUrge,           { displayName: "Infernal Urge trait" });
  quench.registerBatch("ex2e.eclipse-oath",             registerEclipseOath,             { displayName: "Solar Eclipse oath-binding" });
  quench.registerBatch("ex2e.paradox",                 registerParadox,                 { displayName: "Sidereal Paradox track" });
  quench.registerBatch("ex2e.destiny",                 registerDestiny,                 { displayName: "Sidereal Destiny creation" });
  quench.registerBatch("ex2e.heretical-gating",        registerHereticalGating,         { displayName: "Infernal Heretical charm gating" });
  quench.registerBatch("ex2e.resonance-vent",           registerResonanceVent,           { displayName: "Abyssal Resonance vent roll" });
  quench.registerBatch("ex2e.greater-signs",            registerGreaterSigns,            { displayName: "Sidereal Greater Signs" });
  quench.registerBatch("ex2e.cooperative-charm",        registerCooperativeCharm,        { displayName: "DB Charm cooperation" });
  quench.registerBatch("ex2e.weaving",                  registerWeavingTests,            { displayName: "Alchemical Weaving protocols" });
  quench.registerBatch("ex2e.charm.target-effect",      registerCharmTargetEffect,       { displayName: "Charm target effect (onHit)" });
  quench.registerBatch("ex2e.charm.variable-cost",      registerCharmVariableCost,       { displayName: "Charm variable mote cost" });
  quench.registerBatch("ex2e.hearthstone",              registerHearthstone,             { displayName: "Hearthstone socketing" });
  quench.registerBatch("ex2e.martial-arts-style",       registerMartialArtsStyle,        { displayName: "Martial Arts style auto-add" });
  quench.registerBatch("ex2e.virtue-channeling",         registerVirtueChanneling,         { displayName: "Virtue channeling (WP / virtue spend)" });
  quench.registerBatch("ex2e.keyword-gating",            registerKeywordGating,             { displayName: "Keyword gating (Native + Action-Only)" });
  quench.registerBatch("ex2e.cover-starmetal",           registerCoverStarmetal,            { displayName: "Cover DV bonuses + Starmetal attack penalty" });
  quench.registerBatch("ex2e.combo-import",              registerComboImport,               { displayName: "Combo import / name-remap" });
  quench.registerBatch("ex2e.form-charms",               registerFormCharms,                { displayName: "Form-type charm handling" });
  quench.registerBatch("ex2e.willpower-virtue-limit",    registerWillpowerVirtueLimit,       { displayName: "WP / Virtue / Limit automation" });
  quench.registerBatch("ex2e.mental-influence",          registerMentalInfluence,             { displayName: "Mental influence keywords" });
  quench.registerBatch("ex2e.coordination",              registerCoordinationTests,           { displayName: "Coordinated attack AE expiry" });

});
