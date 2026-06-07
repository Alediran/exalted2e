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
import { registerAttunement,
         registerAttunementMotes }        from "./combat/attunement.mjs";
import { registerOverdrive }              from "./combat/overdrive.mjs";
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
import { registerCountermagic }            from "./combat/countermagic.mjs";
import { registerEssenceFlow,
         registerPurchaseBypass }          from "./combat/essence-flow-bypass.mjs";
import { registerCrafting }               from "./crafting/crafting-roll.mjs";
import { registerManse }                from "./manse/manse-item.mjs";
import { registerMassCombat, registerMassCombatCCR, registerMassCombatHealth, registerMassCombatJoinWar, registerMassCombatHesitation, registerMassCombatHeroPhase3, registerMassCombatUnitVsHero, registerMassCombatPhase4Actions, registerMassCombatPhase4SplitMerge, registerMassCombatPhase5, registerMassCombatPhase6, registerMassCombatPhase7, registerMassCombatPhase8, registerMassCombatPhase9 } from "./combat/mass-combat.mjs";
import { registerCharmUpgradeTiersSchema, registerCharmUpgradeTiersPipeline } from "./combat/charm-upgrade-tiers.mjs";
import { registerCharmTreeBuilder, registerCharmTreeDialogIntegration } from "./charm-tree-dialog.mjs";
import { registerClinch }      from "./combat/clinch.mjs";
import { registerMounted }     from "./combat/mounted.mjs";
import { registerAffliction }  from "./combat/affliction.mjs";
import { registerMassGuard }  from "./combat/mass-guard.mjs";
import { registerRegionBehaviors } from "./data/region-behaviors.mjs";
import { registerItemSheets }      from "./sheets/item-sheets.mjs";
import { registerActorSheets }     from "./sheets/actor-sheets.mjs";
import { registerDialogShells }    from "./dialogs/dialog-shells.mjs";
import { registerAppShells }        from "./apps/app-shells.mjs";
import { registerMigrationRunner }  from "./migration/runner.mjs";
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
  // Guard: only purge in the dedicated test world so Quench installed in a
  // play world doesn't wipe the GM's active encounter on every reload.
  if (game.world.id === "exalted2e-test") {
    for (const c of (game.combats?.contents ?? [])) {
      try { await c.delete(); } catch (_) { /* ignore */ }
    }
  }

  quench.registerBatch("exalted2e.knockback.focused",        registerKnockbackFocused,       { displayName: "Knockback (focused)" });
  quench.registerBatch("exalted2e.knockback.smoke",          registerKnockbackSmoke,         { displayName: "Knockback (smoke)" });
  quench.registerBatch("exalted2e.dv-refresh",               registerDvRefresh,              { displayName: "DV refresh" });
  quench.registerBatch("exalted2e.multi-tick",               registerMultiTick,              { displayName: "Multi-tick container" });
  quench.registerBatch("exalted2e.sorcery.focused",          registerSorceryShapingFocused,  { displayName: "Sorcery shaping (focused)" });
  quench.registerBatch("exalted2e.sorcery.smoke",            registerSorceryShapingSmoke,    { displayName: "Sorcery shaping (smoke)" });
  quench.registerBatch("exalted2e.attack.focused",           registerAttackPipelineFocused,  { displayName: "Attack pipeline (focused)" });
  quench.registerBatch("exalted2e.charm.activation",         registerCharmActivation,        { displayName: "Charm activation lifecycle" });
  quench.registerBatch("exalted2e.charm-economics",          registerCharmEconomics,         { displayName: "Charm economics" });
  quench.registerBatch("exalted2e.charm.weapon-artifacts",   registerCharmWeaponArtifacts,   { displayName: "Charm weapon artifacts" });
  quench.registerBatch("exalted2e.attack-charm.smoke",       registerAttackCharmSmoke,       { displayName: "Attack + charm (smoke)" });
  quench.registerBatch("exalted2e.social.focused",           registerSocialAttackFocused,    { displayName: "Social attack (focused)" });
  quench.registerBatch("exalted2e.social.defense",           registerSocialDefense,          { displayName: "Social defense + UMI + scene cleanup" });
  quench.registerBatch("exalted2e.social.smoke",             registerSocialSmoke,            { displayName: "Social attack (smoke)" });
  quench.registerBatch("exalted2e.stunt.rewards",            registerStuntRewards,           { displayName: "Stunt rewards" });
  quench.registerBatch("exalted2e.purchase.mode",            registerPurchaseMode,           { displayName: "Purchase mode enforcement" });
  quench.registerBatch("exalted2e.attunement",               registerAttunement,             { displayName: "Attunement / artifact commitment" });
  quench.registerBatch("exalted2e.attunement-motes",         registerAttunementMotes,        { displayName: "Attunement motes (Surging Essence Reactor)" });
  quench.registerBatch("exalted2e.overdrive",                registerOverdrive,              { displayName: "Overdrive pool" });
  quench.registerBatch("exalted2e.resource-economy.smoke",   registerResourceEconomySmoke,   { displayName: "Resource economy (smoke)" });
  quench.registerBatch("exalted2e.effect-wrapper",           registerEffectWrapper,          { displayName: "Effect-wrapper compendium" });
  quench.registerBatch("exalted2e.combat-hud.smoke",         registerCombatHudSmoke,         { displayName: "Combat HUD (smoke)" });
  quench.registerBatch("exalted2e.caste-attributes",        registerCasteAttributes,        { displayName: "Caste attributes" });
  quench.registerBatch("exalted2e.shapeshift",              registerShapeshift,             { displayName: "Lunar shapeshift" });
  quench.registerBatch("exalted2e.dbt",                     registerDBT,                    { displayName: "Deadly Beastman Transformation" });
  quench.registerBatch("exalted2e.lunar-tell",              registerLunarTell,              { displayName: "Lunar Tell trait" });
  quench.registerBatch("exalted2e.clarity",                 registerClarity,                { displayName: "Alchemical Clarity & Modules" });
  quench.registerBatch("exalted2e.submodules",              registerSubmodules,             { displayName: "Alchemical submodules" });
  quench.registerBatch("exalted2e.terrestrial-breeding",    registerTerrestrialBreeding,    { displayName: "Terrestrial Breeding" });
  quench.registerBatch("exalted2e.limit-break",             registerLimitBreak,             { displayName: "Limit Break automation" });
  quench.registerBatch("exalted2e.anima",                   registerAnima,                  { displayName: "Anima Banner system" });
  quench.registerBatch("exalted2e.act-of-villainy",         registerActOfVillainy,          { displayName: "Act of Villainy roll" });
  quench.registerBatch("exalted2e.infernal-urge",           registerInfernalUrge,           { displayName: "Infernal Urge trait" });
  quench.registerBatch("exalted2e.eclipse-oath",             registerEclipseOath,             { displayName: "Solar Eclipse oath-binding" });
  quench.registerBatch("exalted2e.paradox",                 registerParadox,                 { displayName: "Sidereal Paradox track" });
  quench.registerBatch("exalted2e.destiny",                 registerDestiny,                 { displayName: "Sidereal Destiny creation" });
  quench.registerBatch("exalted2e.heretical-gating",        registerHereticalGating,         { displayName: "Infernal Heretical charm gating" });
  quench.registerBatch("exalted2e.resonance-vent",           registerResonanceVent,           { displayName: "Abyssal Resonance vent roll" });
  quench.registerBatch("exalted2e.greater-signs",            registerGreaterSigns,            { displayName: "Sidereal Greater Signs" });
  quench.registerBatch("exalted2e.cooperative-charm",        registerCooperativeCharm,        { displayName: "DB Charm cooperation" });
  quench.registerBatch("exalted2e.weaving",                  registerWeavingTests,            { displayName: "Alchemical Weaving protocols" });
  quench.registerBatch("exalted2e.charm.target-effect",      registerCharmTargetEffect,       { displayName: "Charm target effect (onHit)" });
  quench.registerBatch("exalted2e.charm.variable-cost",      registerCharmVariableCost,       { displayName: "Charm variable mote cost" });
  quench.registerBatch("exalted2e.hearthstone",              registerHearthstone,             { displayName: "Hearthstone socketing" });
  quench.registerBatch("exalted2e.martial-arts-style",       registerMartialArtsStyle,        { displayName: "Martial Arts style — auto-add + MA gates" });
  quench.registerBatch("exalted2e.virtue-channeling",         registerVirtueChanneling,         { displayName: "Virtue channeling (WP / virtue spend)" });
  quench.registerBatch("exalted2e.keyword-gating",            registerKeywordGating,             { displayName: "Keyword gating (Native + Action-Only)" });
  quench.registerBatch("exalted2e.cover-starmetal",           registerCoverStarmetal,            { displayName: "Cover DV bonuses + Starmetal attack penalty" });
  quench.registerBatch("exalted2e.combo-import",              registerComboImport,               { displayName: "Combo import / name-remap" });
  quench.registerBatch("exalted2e.form-charms",               registerFormCharms,                { displayName: "Form-type charm handling" });
  quench.registerBatch("exalted2e.willpower-virtue-limit",    registerWillpowerVirtueLimit,       { displayName: "WP / Virtue / Limit automation" });
  quench.registerBatch("exalted2e.mental-influence",          registerMentalInfluence,             { displayName: "Mental influence keywords" });
  quench.registerBatch("exalted2e.coordination",              registerCoordinationTests,           { displayName: "Coordinated attack AE expiry" });
  quench.registerBatch("exalted2e.countermagic",              registerCountermagic,                { displayName: "Countermagic resolution" });
  quench.registerBatch("exalted2e.essence-flow",             registerEssenceFlow,                 { displayName: "Essence Flow — RollDialog cap detection" });
  quench.registerBatch("exalted2e.purchase-bypass",          registerPurchaseBypass,              { displayName: "Purchase mode — ST bypass button" });
  quench.registerBatch("exalted2e.crafting",                  registerCrafting,                    { displayName: "Crafting roll resolver" });
  quench.registerBatch("exalted2e.manse",                     registerManse,                       { displayName: "Manse item — data layer" });
  quench.registerBatch("exalted2e.mass-combat",               registerMassCombat,                  { displayName: "Mass combat roll engine" });
  quench.registerBatch("exalted2e.masscombat.phase2.ccr",         registerMassCombatCCR,         { displayName: "EX2E: Mass Combat Phase 2 — CCR bonus integration" });
  quench.registerBatch("exalted2e.masscombat.phase2.health",      registerMassCombatHealth,      { displayName: "EX2E: Mass Combat Phase 2 — health track cycling" });
  quench.registerBatch("exalted2e.masscombat.phase2.joinwar",     registerMassCombatJoinWar,     { displayName: "EX2E: Mass Combat Phase 2 — Join War Dialog smoke" });
  quench.registerBatch("exalted2e.masscombat.phase2.hesitation",  registerMassCombatHesitation,  { displayName: "EX2E: Mass Combat Phase 2 — Hesitation flag on rout failure" });
  quench.registerBatch("exalted2e.masscombat.phase3.hero-attacks", registerMassCombatHeroPhase3,   { displayName: "EX2E: Mass Combat Phase 3 — Hero attacks unit" });
  quench.registerBatch("exalted2e.masscombat.phase3.unit-attacks", registerMassCombatUnitVsHero,   { displayName: "EX2E: Mass Combat Phase 3 — Unit attacks hero" });
  quench.registerBatch("exalted2e.masscombat.phase4.actions",      registerMassCombatPhase4Actions,    { displayName: "EX2E: Mass Combat Phase 4 — Unit Actions" });
  quench.registerBatch("exalted2e.masscombat.phase4.splitmerg",    registerMassCombatPhase4SplitMerge, { displayName: "EX2E: Mass Combat Phase 4 — Split & Merge" });
  quench.registerBatch("exalted2e.masscombat.phase5", registerMassCombatPhase5, { displayName: "EX2E: Mass Combat Phase 5 — Rally, Routing & Token Status" });
  quench.registerBatch("exalted2e.masscombat.phase6", registerMassCombatPhase6, { displayName: "EX2E: Mass Combat Phase 6 — Exhaustion & Signal Units" });
  quench.registerBatch("exalted2e.masscombat.phase7", registerMassCombatPhase7, { displayName: "EX2E: Mass Combat Phase 7 — Turn Action & Relay Command Pool" });
  quench.registerBatch("exalted2e.masscombat.phase8", registerMassCombatPhase8, { displayName: "EX2E: Mass Combat Phase 8 — Guard DV Bonus & Unit DV Pipeline" });
  quench.registerBatch("exalted2e.masscombat.phase9", registerMassCombatPhase9, { displayName: "EX2E: Mass Combat Phase 9 — Chokepoints" });
  quench.registerBatch("exalted2e.charms.upgradetiers.schema", registerCharmUpgradeTiersSchema, { displayName: "EX2E: Charm Upgrade Tiers — Schema & Gate Logic" });
  quench.registerBatch("exalted2e.charms.upgradetiers.pipeline", registerCharmUpgradeTiersPipeline, { displayName: "EX2E: Charm Upgrade Tiers — Activation Pipeline" });
  quench.registerBatch("exalted2e.charmTree.builder",               registerCharmTreeBuilder,             { displayName: "EX2E: Charm Tree Builder — unit tests" });
  quench.registerBatch("exalted2e.charmTree.dialog",                registerCharmTreeDialogIntegration,   { displayName: "EX2E: Charm Tree Dialog — integration" });
  quench.registerBatch("exalted2e.clinch",       registerClinch,       { displayName: "Clinch / Grapple mechanics" });
  quench.registerBatch("exalted2e.mounted",      registerMounted,      { displayName: "Mounted combat — Ride cap" });
  quench.registerBatch("exalted2e.affliction",   registerAffliction,   { displayName: "Poison/Disease afflictions" });
  quench.registerBatch("exalted2e.mass-guard",   registerMassGuard,   { displayName: "Mass Guard (multi-actor)" });
  quench.registerBatch("exalted2e.region-behaviors", registerRegionBehaviors, { displayName: "Region behaviors (hazard/terrain)" });
  quench.registerBatch("exalted2e.item-sheets",      registerItemSheets,      { displayName: "Item sheets (render + round-trip)" });
  quench.registerBatch("exalted2e.actor-sheets",     registerActorSheets,     { displayName: "Actor sheets (render + round-trip)" });
  quench.registerBatch("exalted2e.dialog-shells",    registerDialogShells,    { displayName: "Dialog shells (render)" });
  quench.registerBatch("exalted2e.app-shells",       registerAppShells,       { displayName: "App shells (render)" });
  quench.registerBatch("exalted2e.migration.runner", registerMigrationRunner, { displayName: "Migration runner (smoke)" });

});
