#!/usr/bin/env node
// scripts/populate-ma-styles.mjs
// Writes martialArtsStyleName into MA charm source JSON files
// based on name heuristics + known style groupings.
// Run: node scripts/populate-ma-styles.mjs [--write]

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const WRITE = process.argv.includes('--write');
const BASE  = 'src/packs/charms';

// ── Style detection rules (first match wins) ─────────────────────────────────
// Each rule: { test: regex | fn(name, system), style: string }
const RULES = [
  // Terrestrial Dragon styles — named charms first
  { test: /\bFive.Dragon\b/i,       style: 'Five-Dragon Style' },
  { test: /\bAir Dragon\b/i,        style: 'Air Dragon Style' },
  { test: /\bEarth Dragon\b/i,      style: 'Earth Dragon Style' },
  { test: /\bFire Dragon\b/i,       style: 'Fire Dragon Style' },
  { test: /\bWater Dragon\b/i,      style: 'Water Dragon Style' },
  { test: /\bWood Dragon\b/i,       style: 'Wood Dragon Style' },
  { test: /\bTerrestrial Hero\b/i,  style: 'Terrestrial Hero Style' },

  // Terrestrial Dragon styles — charms named after Immaculate Dragons
  // Mela = Air, Pasiap = Earth, Hesiesh = Fire, Daana'd = Water, Sextes Jylis = Wood
  { test: /\bMela\b/i,              style: 'Air Dragon Style' },
  { test: /\bPasiap\b/i,            style: 'Earth Dragon Style' },
  { test: /\bHesiesh\b/i,           style: 'Fire Dragon Style' },
  { test: /\bDaana.d\b/i,           style: 'Water Dragon Style' },
  { test: /\bSextes Jylis\b/i,      style: 'Wood Dragon Style' },

  // Terrestrial Dragon styles — unlabeled charms identifiable by element keywords in name
  // Air Dragon: wind, lightning, hurricane, cloud, breath-seizing
  { test: /\bAvenging Wind\b/i,     style: 'Air Dragon Style' },   // already-set example
  { test: /\bThunderclap\b(?! Rush)/i, style: 'Air Dragon Style' },   // already-set example
  { test: /\bCloud Treading\b/i,    style: 'Air Dragon Style' },
  { test: /\bBreath.Seizing\b/i,    style: 'Air Dragon Style' },
  { test: /\bHurricane Combat\b/i,  style: 'Air Dragon Style' },
  { test: /\bLightning Strike Style\b/i, style: 'Air Dragon Style' },
  { test: /\bTornado Offense\b/i,   style: 'Air Dragon Style' },
  { test: /\bTrireme Strikes\b/i,   style: 'Air Dragon Style' },
  { test: /\bWind Dragon Speed\b/i, style: 'Air Dragon Style' },
  { test: /\bShrouding The Body\b/i, style: 'Air Dragon Style' },
  // Earth Dragon: stone, mountain, shattering, unmoving, avalanche
  { test: /\bAvalanche Method\b/i,  style: 'Earth Dragon Style' },
  { test: /\bBecome The Hammer\b/i, style: 'Earth Dragon Style' },
  { test: /\bBlade.Deflecting Palm\b/i, style: 'Earth Dragon Style' },
  { test: /\bEarthshaker\b/i,       style: 'Earth Dragon Style' },
  { test: /\bForce Of The Mountain\b/i, style: 'Earth Dragon Style' },
  { test: /\bGhost.Grounding Blow\b/i, style: 'Earth Dragon Style' },
  { test: /\bHungry Earth\b/i,      style: 'Earth Dragon Style' },
  { test: /\bPerfection Of Earth Body\b/i, style: 'Earth Dragon Style' },
  { test: /\bShattering Fist\b/i,   style: 'Earth Dragon Style' },
  { test: /\bStillness Of Stone\b/i, style: 'Earth Dragon Style' },
  { test: /\bUnmoving Mountain\b/i, style: 'Earth Dragon Style' },
  { test: /\bWeapon.Breaking Defense\b/i, style: 'Earth Dragon Style' },
  { test: /\bWrathful Winds Maneuver\b/i, style: 'Earth Dragon Style' },
  // Fire Dragon: flame, searing, smoldering, flash-fire, overwhelming fire
  { test: /\bEnthralling Blow\b/i,  style: 'Fire Dragon Style' },
  { test: /\bFiery Hand\b/i,        style: 'Fire Dragon Style' },
  { test: /\bFlame.Flicker\b/i,     style: 'Fire Dragon Style' },
  { test: /\bFlash.Fire\b/i,        style: 'Fire Dragon Style' },
  { test: /\bOverwhelming Fire\b/i, style: 'Fire Dragon Style' },
  { test: /\bPerfect Blazing\b/i,   style: 'Fire Dragon Style' },
  { test: /\bSearing Fist\b/i,      style: 'Fire Dragon Style' },
  { test: /\bSmoldering Wound\b/i,  style: 'Fire Dragon Style' },
  // Water Dragon: wave, tide, drowning, flowing water, rippling
  { test: /\bBottomless Depths\b/i, style: 'Water Dragon Style' },
  { test: /\bCrashing Wave Style\b/i, style: 'Water Dragon Style' },
  { test: /\bCurrents Sweep\b/i,    style: 'Water Dragon Style' },
  { test: /\bDrowning Embrace\b/i,  style: 'Water Dragon Style' },
  { test: /\bDrowning.In.Blood\b/i, style: 'Water Dragon Style' },
  { test: /\bEssence.Dousing Wave\b/i, style: 'Water Dragon Style' },
  { test: /\bFlow From The Rocks\b/i, style: 'Water Dragon Style' },
  { test: /\bFlow Reversal Strike\b/i, style: 'Water Dragon Style' },
  { test: /\bFlowing Water Defense\b/i, style: 'Water Dragon Style' },
  { test: /\bGhost.Restraining Whirlpool\b/i, style: 'Water Dragon Style' },
  { test: /\bIris.Bulb Discourse\b/i, style: 'Water Dragon Style' },
  { test: /\bPounding Surf\b/i,     style: 'Water Dragon Style' },
  { test: /\bRippling Water\b/i,    style: 'Water Dragon Style' },
  { test: /\bRiptide Method\b/i,    style: 'Water Dragon Style' },
  { test: /\bShrugging Water Dragon\b/i, style: 'Water Dragon Style' },
  { test: /\bTheft.Of.Essence Method\b/i, style: 'Water Dragon Style' },
  { test: /\bTsunami Force\b/i,     style: 'Water Dragon Style' },
  // Wood Dragon: plants, vines, souls, spirit-rending, irises, eyes of the wood
  { test: /\bDeath.Pattern Sensing\b/i, style: 'Wood Dragon Style' },
  { test: /\bEyes Of The Wood Dragon\b/i, style: 'Wood Dragon Style' },
  { test: /\bMind.Over.Body Meditation\b/i, style: 'Wood Dragon Style' },
  { test: /\bSoul.Marking Strike\b/i, style: 'Wood Dragon Style' },
  { test: /\bSoul Mastery\b/i,      style: 'Wood Dragon Style' },
  { test: /\bSpirit.Rending Technique\b/i, style: 'Wood Dragon Style' },
  { test: /\bSpirit.Wracking Method\b/i, style: 'Wood Dragon Style' },
  { test: /\bUnbreakable Fascination Kata\b/i, style: 'Wood Dragon Style' },
  { test: /\bWalker.Among.Irises\b/i, style: 'Wood Dragon Style' },
  // Terrestrial Hero: Tiger-and-Bear is a specific sub-style
  { test: /\bTiger.And.Bear\b/i,    style: 'Terrestrial Hero Style' },

  // Celestial MA styles (Solar / multi-splat)
  { test: /\bSnake\b/i,             style: 'Snake Style' },
  { test: /\bSerpent\b/i,           style: 'Snake Style' },
  { test: /\bSerpentine\b/i,        style: 'Snake Style' },
  { test: /\bSolar Hero\b/i,        style: 'Solar Hero Style' },
  { test: /\bTiger\b/i,             style: 'Tiger Style' },
  { test: /\bCrane\b/i,             style: 'Crane Style' },
  { test: /\bMantis\b/i,            style: 'Mantis Style' },
  { test: /\bMonkey\b/i,            style: 'Monkey Style' },
  { test: /\bLotus\b/i,             style: 'White Lotus Style' },
  { test: /\bDreaming Pearl\b/i,    style: 'Dreaming Pearl Courtesan Style' },
  { test: /\bViolet Bier\b/i,       style: 'Violet Bier of Sorrows Style' },
  { test: /\bGolden Exhalation\b/i, style: 'Golden Exhalation Style' },
  { test: /\bBlade of the Battle\b/i, style: 'Violet Bier of Sorrows Style' },
  // Solar Hero unlabeled charms — identifiable by name keyword
  { test: /\bFists Of Iron\b/i,      style: 'Solar Hero Style' },
  { test: /\bHammer On Iron\b/i,     style: 'Solar Hero Style' },
  { test: /\bHeaven Thunder Hammer\b/i, style: 'Solar Hero Style' },
  { test: /\bOx.Stunning Blow\b/i,   style: 'Solar Hero Style' },
  { test: /\bCrashing Wave Throw\b/i, style: 'Solar Hero Style' },
  { test: /\bDragon Coil Technique\b/i, style: 'Solar Hero Style' },
  { test: /\bShockwave Technique\b/i, style: 'Solar Hero Style' },
  { test: /\bSledgehammer Fist\b/i,  style: 'Solar Hero Style' },
  { test: /\bThunderclap Rush\b/i,   style: 'Solar Hero Style' },
  // Snake Style unlabeled charms — clearly in style by context
  { test: /\bArmor.Penetrating Fang\b/i, style: 'Snake Style' },
  { test: /\bEssence Fangs And Scales\b/i, style: 'Snake Style' },
  { test: /\bEssence Venom Strike\b/i, style: 'Snake Style' },

  // Abyssal MA
  { test: /\bHungry Ghost\b/i,      style: 'Hungry Ghost Style' },
  { test: /\bDark Messiah\b/i,      style: 'Dark Messiah Style' },
  // Abyssal charms without "Dark Messiah" or "Hungry Ghost" in name — classified by known style membership
  { test: /\bVoid Avatar Prana\b/i,  style: 'Dark Messiah Style' },
  { test: /\bFive Knife Fist\b/i,    style: 'Dark Messiah Style' },
  { test: /\bRavaging Blow\b/i,      style: 'Dark Messiah Style' },
  { test: /\bBone.Shattering Blow\b/i, style: 'Dark Messiah Style' },
  { test: /\bIllustrative Overkill\b/i, style: 'Dark Messiah Style' },
  { test: /\bInescapable Iron Grip\b/i, style: 'Dark Messiah Style' },
  { test: /\bFoe.Blinding Jab\b/i,   style: 'Hungry Ghost Style' },
  { test: /\bGrievous Agony\b/i,     style: 'Hungry Ghost Style' },
  { test: /\bBlood.Freezing Technique\b/i, style: 'Hungry Ghost Style' },
  { test: /\bBlood.Scenting Hunger\b/i, style: 'Hungry Ghost Style' },
  { test: /\bConsuming Entropy Strike\b/i, style: 'Hungry Ghost Style' },
  { test: /\bLabyrinth.Walking Prana\b/i, style: 'Hungry Ghost Style' },
  { test: /\bLashing Tempest Palm\b/i, style: 'Hungry Ghost Style' },
  { test: /\bLunging Phantom Method\b/i, style: 'Hungry Ghost Style' },
  { test: /\bOwl Seizes Mouse\b/i,   style: 'Hungry Ghost Style' },
  { test: /\bPower.Reaping Prana\b/i, style: 'Hungry Ghost Style' },
  { test: /\bRapacious Lamprey\b/i,  style: 'Hungry Ghost Style' },
  { test: /\bScuttling Apparition\b/i, style: 'Hungry Ghost Style' },
  { test: /\bUnnatural Shambling\b/i, style: 'Hungry Ghost Style' },
  { test: /\bWrithing Blood Chain\b/i, style: 'Hungry Ghost Style' },

  // Infernal MA
  { test: /\bInfernal Monster\b/i,  style: 'Infernal Monster Style' },
  { test: /\bDemon.Monster\b/i,     style: 'Infernal Monster Style' },
  { test: /\bGod.Smashing\b/i,      style: 'Infernal Monster Style' },
  { test: /\bFists of the Old\b/i,  style: 'Infernal Monster Style' },
  { test: /\bCrack the Sky\b/i,     style: 'Infernal Monster Style' },
  { test: /\bOath.Shattering Strike\b/i, style: 'Infernal Monster Style' },
  { test: /\bOne Hand Fury\b/i,     style: 'Infernal Monster Style' },
  { test: /\bRaging Behemoth\b/i,   style: 'Infernal Monster Style' },
  { test: /\bRetribution Will Follow\b/i, style: 'Infernal Monster Style' },
  { test: /\bScreaming Meat Shield\b/i, style: 'Infernal Monster Style' },
  { test: /\bWorld.Breaker Grip\b/i, style: 'Infernal Monster Style' },
  { test: /\bGlory To The Demon.Monster\b/i, style: 'Infernal Monster Style' },

  // Alchemical MA (Thousand Wounds Gear Style and Live Wire Style)
  { test: /\bThousand Wounds Gear\b/i,    style: 'Thousand Wounds Gear Style' },
  { test: /\bHungry Gear.Tooth\b/i,       style: 'Thousand Wounds Gear Style' },
  { test: /\bArc Blinding Assault\b/i,    style: 'Thousand Wounds Gear Style' },
  { test: /\bFloating Target Lock\b/i,    style: 'Thousand Wounds Gear Style' },
  { test: /\bLinear Flight Principle\b/i, style: 'Thousand Wounds Gear Style' },
  { test: /\bThe Circle Screams\b/i,      style: 'Thousand Wounds Gear Style' },
  { test: /\bLive Wire\b/i,               style: 'Live Wire Style' },
  { test: /\bUnassailable Lightning Dance\b/i, style: 'Live Wire Style' },
  { test: /\bTangled Weaver.s Trap\b/i,   style: 'Live Wire Style' },
  { test: /\bRearing Crane\b/i,           style: 'Live Wire Style' },
  // Mechanical Weaving Style (whip-based coordination charms)
  { test: /\bConductive Principle\b/i,     style: 'Mechanical Weaving Style' },
  { test: /\bGear Catches Gear\b/i,        style: 'Mechanical Weaving Style' },
  { test: /\bFlesh.Rending Gear\b/i,       style: 'Mechanical Weaving Style' },
  { test: /\bLightning Supremacy Reversal\b/i, style: 'Mechanical Weaving Style' },
  { test: /\bWhistling Analog Signal\b/i,  style: 'Mechanical Weaving Style' },

  // Sidereal MA — all core sidereal MA charms are Violet Bier of Sorrows
  { test: /\bBattle Maiden\b/i,        style: 'Violet Bier of Sorrows Style' },
  { test: /\bConclusion.Pursuing\b/i,  style: 'Violet Bier of Sorrows Style' },
  { test: /\bCrimson Palm\b/i,         style: 'Violet Bier of Sorrows Style' },
  { test: /\bDeath.Parrying Stroke\b/i, style: 'Violet Bier of Sorrows Style' },
  { test: /\bFateful Martial Arts\b/i, style: 'Violet Bier of Sorrows Style' },
  { test: /\bFlight Of Mercury\b/i,    style: 'Violet Bier of Sorrows Style' },
  { test: /\bHorrific Wreath\b/i,      style: 'Violet Bier of Sorrows Style' },
  { test: /\bJoy In Adversity\b/i,     style: 'Violet Bier of Sorrows Style' },
  { test: /\bLife.Severing Blow\b/i,   style: 'Violet Bier of Sorrows Style' },
  { test: /\bMetal Storm\b/i,          style: 'Violet Bier of Sorrows Style' },
  { test: /\bPropitious Martial Arts\b/i, style: 'Violet Bier of Sorrows Style' },
  { test: /\bSecrets Of Future Strife\b/i, style: 'Violet Bier of Sorrows Style' },
  { test: /\bUnobstructed Blow\b/i,    style: 'Violet Bier of Sorrows Style' },

  // Inkmonkeys styles (identified by Form charm name)
  { test: /\bBlack Claw\b/i,        style: 'Black Claw Style' },
  { test: /\bIvory Pestle\b/i,      style: 'Ivory Pestle Style' },
  { test: /\bSwaying Grass\b/i,     style: 'Swaying Grass Dance Style' },
  { test: /\bOrbital Impact\b/i,    style: 'Orbital Impact Style' },
  { test: /\bDevil.Tyrant\b/i,      style: 'Devil-Tyrant Avatar Shintai Style' },
  { test: /\bUntamed Apocalypse\b/i,style: 'Untamed Apocalypse Shintai Style' },
  { test: /\bArmageddon Nightmare\b/i, style: 'Armageddon Nightmare Duel Style' },
  // Inkmonkeys: Cobra Style — charms with Cobra in name
  { test: /\bCobra\b/i,             style: 'Cobra Style' },
  // Inkmonkeys: Ivory Pestle — pestle/atemi charms clearly in style
  { test: /\bCrushing Pestle\b/i,   style: 'Ivory Pestle Style' },
  { test: /\bWhirling Pestle\b/i,   style: 'Ivory Pestle Style' },
  { test: /\bIvory Grace\b/i,       style: 'Ivory Pestle Style' },
  { test: /\bIvory Obstruction\b/i, style: 'Ivory Pestle Style' },
  // Inkmonkeys: Swaying Grass Dance — grass/meadow/wind-dance charms
  { test: /\bGrass Reaping\b/i,     style: 'Swaying Grass Dance Style' },
  { test: /\bHypnotic Swaying\b/i,  style: 'Swaying Grass Dance Style' },
  { test: /\bInescapable Tumbleweed\b/i, style: 'Swaying Grass Dance Style' },
  { test: /\bRolling With The Wind\b/i, style: 'Swaying Grass Dance Style' },
  { test: /\bSweeping Meadow\b/i,   style: 'Swaying Grass Dance Style' },
  { test: /\bTeeth In The Grass\b/i, style: 'Swaying Grass Dance Style' },
  // Inkmonkeys: Throne Shadow Style (Abyssal form)
  { test: /\bThrone Shadow\b/i,     style: 'Throne Shadow Style' },
  { test: /\bDaunting The False Savior\b/i, style: 'Throne Shadow Style' },
  // Inkmonkeys: Solar Hero Style additions
  { test: /\bBloodied King\b/i,     style: 'Solar Hero Style' },
  { test: /\bHero.s Fatal Resolve\b/i, style: 'Solar Hero Style' },
  { test: /\bHewer.Sharpened Fist\b/i, style: 'Solar Hero Style' },
  { test: /\bSky Breaker Throw\b/i, style: 'Solar Hero Style' },
  { test: /\bStance Breaker Instinct\b/i, style: 'Solar Hero Style' },
  // Inkmonkeys: Infernal Monster Style — identified by description references
  { test: /\bAll.Consuming Rampage\b/i, style: 'Infernal Monster Style' },
  { test: /\bBlood Heralds Death\b/i,   style: 'Infernal Monster Style' },
  { test: /\bBounding Beast Advance\b/i, style: 'Infernal Monster Style' },
  { test: /\bDeath.Devouring Sadism\b/i, style: 'Infernal Monster Style' },
  { test: /\bDragon.Spawned Demon.Monster\b/i, style: 'Infernal Monster Style' },
  { test: /\bEternal Monstrous Hunt\b/i, style: 'Infernal Monster Style' },
  { test: /\bFallen Star Fury\b/i,       style: 'Infernal Monster Style' },
  { test: /\bFear Of Foretold Fury\b/i,  style: 'Infernal Monster Style' },
  { test: /\bFearless Frenzy\b/i,        style: 'Infernal Monster Style' },
  { test: /\bFury Is Freedom\b/i,        style: 'Infernal Monster Style' },
  { test: /\bImpatient Slaughter Speed\b/i, style: 'Infernal Monster Style' },
  { test: /\bLeaping Smash Technique\b/i, style: 'Infernal Monster Style' },
  { test: /\bMoon.Beast Monster\b/i,     style: 'Infernal Monster Style' },
  { test: /\bNowhere To Hide\b/i,        style: 'Infernal Monster Style' },
  { test: /\bNowhere To Run\b/i,         style: 'Infernal Monster Style' },
  { test: /\bRabble.Terrorizing\b/i,     style: 'Infernal Monster Style' },
  { test: /\bSanity.Devouring Night Terror\b/i, style: 'Infernal Monster Style' },
  { test: /\bShock And Awe Slam\b/i,     style: 'Infernal Monster Style' },
  { test: /\bSmoldering Rage Beast\b/i,  style: 'Infernal Monster Style' },
  { test: /\bUnthinkable Shining Horror\b/i, style: 'Infernal Monster Style' },
  // Inkmonkeys: Black Claw Style additions
  { test: /\bDoe Eyes Defense\b/i,      style: 'Black Claw Style' },
  { test: /\bFlexing The Emerald Claw\b/i, style: 'Black Claw Style' },
  { test: /\bHeart.Ripping Claw\b/i,    style: 'Black Claw Style' },
  { test: /\bOpen Palm Caress\b/i,      style: 'Black Claw Style' },
  { test: /\bOutrage.Kindling Cry\b/i,  style: 'Black Claw Style' },
  { test: /\bTable.Turning Reversal\b/i, style: 'Black Claw Style' },
  { test: /\bTorn Lotus Defense\b/i,    style: 'Black Claw Style' },
  // Inkmonkeys: All-Devouring Depths Shintai Style (Abyssal shintai)
  { test: /\bAll.Devouring Depths\b/i,  style: 'All-Devouring Depths Shintai Style' },
  // Inkmonkeys: Flowing Kata Form (cross-style)
  { test: /\bFlowing Kata\b/i,          style: 'Flowing Kata Form Style' },
  { test: /\bSerenading The Reed\b/i,   style: 'Flowing Kata Form Style' },
  // Inkmonkeys: Ghost Scepter -> Swaying Grass or Ivory Pestle (desc references both; name has no Ivory/Grass)
  // Ghost Scepter Prana mentions Ivory Pestle in desc, assigning to Ivory Pestle Style
  { test: /\bGhost Scepter Prana\b/i,  style: 'Ivory Pestle Style' },
  // Inkmonkeys: Forked Tongue Transition and Death-Dreaming Flux -> Cobra Style (desc references Cobra Form)
  { test: /\bForked Tongue Transition\b/i, style: 'Cobra Style' },
  { test: /\bDeath.Dreaming Flux\b/i,   style: 'Cobra Style' },
  { test: /\bDread Scale Fascination\b/i, style: 'Cobra Style' },
  { test: /\bFalse Crane Posture\b/i,   style: 'Cobra Style' },
  { test: /\bTouch Of Finality\b/i,     style: 'Cobra Style' },
  // Inkmonkeys: Solar Hero Style — charms that chain to Solar Hero style via prereqs/postreqs
  { test: /\bBreak The Storm\b/i,       style: 'Solar Hero Style' },
  { test: /\bBreak Through The World\b/i, style: 'Solar Hero Style' },
  { test: /\bCancel The Apocalypse\b/i, style: 'Solar Hero Style' },
  { test: /\bCast Down Stars Condemnation\b/i, style: 'Solar Hero Style' },
  { test: /\bChained Thunder Strike\b/i, style: 'Solar Hero Style' },
  { test: /\bDome.Shattering Smite\b/i, style: 'Solar Hero Style' },
  { test: /\bFlicker.Fade Recursion\b/i, style: 'Solar Hero Style' },
  { test: /\bHellraiser.s Instinct\b/i, style: 'Solar Hero Style' },
  { test: /\bKnockout Blow\b/i,         style: 'Solar Hero Style' },
  { test: /\bLightning Strikes Twice\b/i, style: 'Solar Hero Style' },
  { test: /\bOne With The Wave\b/i,     style: 'Solar Hero Style' },
  { test: /\bPounding Hammer of Devastation\b/i, style: 'Solar Hero Style' },
  { test: /\bSecond Impact Flourish\b/i, style: 'Solar Hero Style' },
  { test: /\bShadow Foot Trap\b/i,      style: 'Solar Hero Style' },
  { test: /\bSolar Combination\b/i,     style: 'Solar Hero Style' },
  { test: /\bSplit The Chase\b/i,       style: 'Solar Hero Style' },
  { test: /\bStorm Burst Explosion\b/i, style: 'Solar Hero Style' },
  { test: /\bStunning Deathblow Evasion\b/i, style: 'Solar Hero Style' },
  { test: /\bSun.Suffusing Slag\b/i,    style: 'Solar Hero Style' },
  { test: /\bTeahouse.Shattering Symphony\b/i, style: 'Solar Hero Style' },
  { test: /\bTitan.Straightening Method\b/i, style: 'Solar Hero Style' },
  { test: /\bWorld.Rupturing Blow\b/i,  style: 'Solar Hero Style' },
  // Inkmonkeys: Swaying Grass Dance — chain-linked charms
  { test: /\bJubilant Battle Proposition\b/i, style: 'Swaying Grass Dance Style' },
  { test: /\bWhirling Rhythm Revolution\b/i, style: 'Swaying Grass Dance Style' },
  // Inkmonkeys: Black Claw — chain-linked charms
  { test: /\bStorm.Calming Embrace\b/i, style: 'Black Claw Style' },
  // Inkmonkeys: Infernal Monster — chain-linked charms
  { test: /\bPost.Traumatic Brutality Roar\b/i, style: 'Infernal Monster Style' },
  { test: /\bPanicked Soldier Stampede\b/i, style: 'Infernal Monster Style' },
  { test: /\bRank.Paralyzing Horror Infliction\b/i, style: 'Infernal Monster Style' },
  // Inkmonkeys: Iron Maiden's Embrace (Abyssal MA equivalent, used as Solar counterpart Armor-Shattering Strike)
  { test: /\bIron Maiden.s Embrace\b/i, style: 'Dark Messiah Style' },
  { test: /\bArmor.Shattering Strike\b/i, style: 'Solar Hero Style' },
  // Abyssal: remaining Hungry Ghost Style charms
  { test: /\bCharm.Smothering Technique\b/i, style: 'Hungry Ghost Style' },
  { test: /\bShrouded Claw Attack\b/i,  style: 'Hungry Ghost Style' },
  { test: /\bSoul.Consuming Transcendence\b/i, style: 'Hungry Ghost Style' },
  // Infernal: Joyful Cessation Of Restraint -> references Infernal Monster in desc
  { test: /\bJoyful Cessation Of Restraint\b/i, style: 'Infernal Monster Style' },
  // Alchemical: Thousand Wounds Persistence (uses gyroscopic chakram = Thousand Wounds Gear)
  { test: /\bThousand Wounds Persistence\b/i, style: 'Thousand Wounds Gear Style' },
  // Sidereal: Secret Lesson Revelation (Sidereal MA utility charm)
  { test: /\bSecret Lesson Revelation\b/i, style: 'Violet Bier of Sorrows Style' },
];

function detectStyle(name, system) {
  if (system.martialArtsStyleName) return system.martialArtsStyleName; // already set
  for (const { test, style } of RULES) {
    if (typeof test === 'function' ? test(name, system) : test.test(name)) return style;
  }
  return '';
}

const files = readdirSync(BASE).filter(f => f.endsWith('.json') && !f.startsWith('_'));
let changed = 0, total = 0;
const unknown = [];

for (const f of files) {
  const data = JSON.parse(readFileSync(join(BASE, f), 'utf8'));
  if (data.type !== 'charm' || data.system.ability !== 'martialarts') continue;
  total++;
  const detected = detectStyle(data.name, data.system);
  if (detected && detected !== data.system.martialArtsStyleName) {
    if (WRITE) {
      data.system.martialArtsStyleName = detected;
      writeFileSync(join(BASE, f), JSON.stringify(data, null, 2) + '\n');
    }
    changed++;
  } else if (!detected) {
    unknown.push({ splat: f.split('-')[0], name: data.name });
  }
}

console.log(`\nTotal MA charms: ${total}`);
console.log(`Style detected (${WRITE ? 'written' : 'dry-run'}): ${changed}`);
console.log(`Unknown style (will go to "[Splat] Martial Arts"): ${unknown.length}`);
if (unknown.length) {
  const byS = {};
  for (const u of unknown) { (byS[u.splat] = byS[u.splat] ?? []).push(u.name); }
  for (const [sp, names] of Object.entries(byS)) {
    console.log(`  ${sp} (${names.length}):`, names.slice(0, 5).join(', ') + (names.length > 5 ? '...' : ''));
  }
}
