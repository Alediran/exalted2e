#!/usr/bin/env node
// Creates 20 missing Ink Monkeys counterpart charms and links mirrorId bidirectionally.
//
// Usage:
//   node scripts/create-inkmonkeys-counterparts.mjs          # dry-run
//   node scripts/create-inkmonkeys-counterparts.mjs --write  # apply

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DRY_RUN = !process.argv.includes('--write');
const PACK = 'src/packs/charms-inkmonkeys';

const STATS = {
  coreVersion: '13',
  systemId: 'exalted2e',
  systemVersion: '1.0.0',
  createdTime: 0,
  modifiedTime: 0,
  lastModifiedBy: null,
};

const FOLDERS = {
  athletics: '481b58529581316b',
  integrity:  'b0a1d89a8f7c4cdb',
  larceny:    'e2cfe49eaa1f7c53',
  martialarts:'c957890db8f42fd9',
  melee:      'fd05b302be1cc260',
  presence:   'e6b3f42bab7e5717',
  ride:       'edcc4814a971a872',
  sail:       'dca02b4134c59583',
  survival:   '82dbbb60bb2b2c18',
  thrown:     'a5a30fa2e730ff58',
  war:        'd517bd826bc73b9e',
};

const cost = (motes = 0, willpower = 0) => ({
  motes, willpower,
  bashingHealth: 0, lethalHealth: 0, aggravatedHealth: 0,
  xp: 0, motesLabel: '', resonance: 0, limitTrigger: 0,
});

const prereq = (charmUid, charmName) => ({
  alternatives: [{ type: 'charm', charmUid, charmName, abilityKey: '', virtueKey: 'valor', virtueMin: 1 }],
});

const charm = (id, exaltType, name, ability, essence, minAbility, charmType, duration, keywords, costObj, description, mirrorId, prereqGroups = []) => ({
  _id: id,
  _key: `!items!${id}`,
  _stats: STATS,
  name,
  type: 'charm',
  img: 'icons/magic/light/beam-rays-yellow.webp',
  system: {
    exaltType, ability, essence, minAbility, charmType, duration,
    speed: 6, dvPenalty: 0, steps: [], keywords,
    cost: costObj,
    description,
    source: 'Ink Monkeys',
    yoziPatron: '', martialArtsTier: '', martialArtsStyleName: '',
    maidenAffiliation: '', mirrorCharmRef: '', durationFormula: '',
    stackCount: 0, umiCost: 1, cooperationBonusDice: 0,
    excellency: '', perfectDefenseType: '', active: false,
    prereqGroups, mirrorId,
    charmUid: id,
  },
  folder: FOLDERS[ability],
  sort: 0,
  ownership: { default: 0 },
  flags: {},
  effects: [],
});

// ── IDs ────────────────────────────────────────────────────────────────────────
// Abyssal counterparts of Solar Ink Monkeys charms
const STALKING_THE_STRIKERS_HAND   = 'c1d2e3f4a5b60001';
const EVER_READY_KILLERS_TOOLS     = 'c1d2e3f4a5b60002';
const ASH_CHILDS_REQUIEM           = 'c1d2e3f4a5b60003';
const MANIFOLD_MURDER_ARTS         = 'c1d2e3f4a5b60004';
const BLADES_WELL_BLOODED          = 'c1d2e3f4a5b60005';
const ALL_BLADES_CRY_FOR_BLOOD     = 'c1d2e3f4a5b60006';
const DEATH_WELL_REMEMBERED        = 'c1d2e3f4a5b60007';
const COILED_SHADOW_ATTITUDE       = 'c1d2e3f4a5b60008';
const ENTROPIC_BLADE_NATURE        = 'c1d2e3f4a5b60009';
const DEATHS_KNIGHT_STANCE         = 'c1d2e3f4a5b60010';
const SUPERIOR_WEAPON_BODY         = 'c1d2e3f4a5b60011';
const TREACHEROUS_FLAG_DISPLAY     = 'c1d2e3f4a5b60012';
const FELL_CAPTAINS_ADVANTAGES     = 'c1d2e3f4a5b60013';
const FELL_RIDERS_ADVANTAGES       = 'c1d2e3f4a5b60014';
const DEATH_CLAIMS_ALL             = 'c1d2e3f4a5b60015';
const GUIDING_LIGHT_SHINES_ON      = 'c1d2e3f4a5b60016';
// Solar counterparts of Abyssal Ink Monkeys charms
const SHINING_ON_DARK_REALMS       = 'c1d2e3f4a5b60017';
const STARING_AT_THE_SUN           = 'c1d2e3f4a5b60018';
const GOLDEN_DESTRUCTION_CUT       = 'c1d2e3f4a5b60019';
const ARMOR_SHATTERING_STRIKE      = 'c1d2e3f4a5b60020';

// ── Cross-pack prerequisite UIDs ───────────────────────────────────────────────
// Abyssal charms
const CORPSE_MIGHT_SURGE           = '7badbd9dced068ad';
const CROUCHING_GARGOYLE_STANCE    = 'aa21ee2ce0908feb';
const DARK_PATHS_FOUND             = 'c4469895fbceb24d';
const DARK_MESSIAH_FORM            = '2895720300b257e8';
const DEATH_DEFLECTING_TECHNIQUE   = 'df15aa54dee692ea';
const EBON_LIGHTNING_PRANA         = '3016587f99bff116';
const RESPLENDENT_SHADOW_BLADE     = 'fccabddc690de95e';  // Abyssal mirror of Glorious Solar Saber
const SAVAGE_SHADE_STYLE           = '1e8fbd3b53715391';
const SOUL_REINS                   = 'bd12d89634c7f54b';  // Abyssal mirror of Master Horseman's Techniques
const UNHALLOWED_GHOST_SHIP        = 'dc09b955f88445ed';  // Abyssal mirror of Ship-Claiming Stance
// Solar charms
const AUTHORITY_RADIATING_STANCE   = '8f780f51e6ab8088';
const BULWARK_STANCE               = 'e8177e6c08d3eaf0';  // no Abyssal equivalent; reference Solar directly
const HUNGRY_TIGER_TECHNIQUE       = '7545ef0c42677e06';  // Solar mirror of Savage Shade Style
const PERFECT_RECKONING_TECHNIQUE  = '13dafff7cf599b5e'; // no Abyssal equivalent
const STEALING_FROM_PLAIN_SIGHT    = 'da28d6ba23ee80b3';  // no Abyssal equivalent

// ── New charm definitions ──────────────────────────────────────────────────────
const NEW_CHARMS = [
  // ── Abyssal counterparts of Solar Inkmonkeys charms ──

  charm(STALKING_THE_STRIKERS_HAND, 'abyssal', "Stalking the Striker's Hand", 'thrown',
    2, 3, 'permanent', 'permanent',
    ['Mirror'],
    cost(),
    `<p>Abyssals are able to keenly sense killing intent when directed at them. This Charm is identical to its Solar counterpart, Angle-Tracing Edge.</p>`,
    'bb357d881884071b'),

  charm(EVER_READY_KILLERS_TOOLS, 'abyssal', "Ever-Ready Killer's Tools", 'war',
    2, 3, 'permanent', 'permanent',
    ['Mirror'],
    cost(),
    `<p>Death teaches economy of destruction. The Abyssal always has what she needs to wage war. This Charm is identical to its Solar counterpart, Elegant Dance of Bow and Blade.</p>`,
    '193e2b599e7729cf'),

  charm(ASH_CHILDS_REQUIEM, 'abyssal', "Ash Child's Requiem", 'war',
    3, 4, 'permanent', 'permanent',
    ['Mirror', 'Native'],
    cost(),
    `<p>The Abyssal has internalized the rhythm of slaughter, moving troops through the chaos of battle with the ease of long practice. This Charm is identical to its Solar counterpart, King's Strife.</p>`,
    'facda2446a755853',
    [prereq(EVER_READY_KILLERS_TOOLS, "Ever-Ready Killer's Tools")]),

  charm(MANIFOLD_MURDER_ARTS, 'abyssal', 'Manifold Murder Arts', 'war',
    3, 4, 'permanent', 'permanent',
    ['Mirror', 'Native'],
    cost(1, 1),
    `<p>The Abyssal's soldiers are instruments of death, and she plays them perfectly. This Charm is identical to its Solar counterpart, Supreme Martial Instinct.</p>`,
    '434d3c517ab1d9ac',
    [prereq(EVER_READY_KILLERS_TOOLS, "Ever-Ready Killer's Tools")]),

  charm(BLADES_WELL_BLOODED, 'abyssal', 'Blades Well-Blooded', 'melee',
    3, 5, 'permanent', 'permanent',
    ['Mirror', 'Native'],
    cost(),
    `<p>Weapons drenched in death serve the Abyssal's will. This Charm is identical to its Solar counterpart, Perfected Battle Array.</p>`,
    'e20fd13124938d91'),

  charm(ALL_BLADES_CRY_FOR_BLOOD, 'abyssal', 'All Blades Cry for Blood', 'melee',
    3, 4, 'permanent', 'permanent',
    ['Mirror'],
    cost(),
    `<p>The Abyssal channels necrotic Essence into weapons, making them hunger for vital fluid. This Charm is identical to its Solar counterpart, Sun-Sword Concentration.</p>`,
    '77d521ac684fa083',
    [prereq(RESPLENDENT_SHADOW_BLADE, 'Resplendent Shadow Blade')]),

  charm(DEATH_WELL_REMEMBERED, 'abyssal', 'Death Well-Remembered', 'melee',
    3, 5, 'permanent', 'permanent',
    ['Martial-ready', 'Mirror', 'Native'],
    cost(),
    `<p>The Abyssal's guard is the memory of every blow she has ever deflected — every death she has witnessed. This Charm is identical to its Solar counterpart, Perfect Blade Aegis.</p>`,
    '47bd4132f45872a1',
    [prereq(BULWARK_STANCE, 'Bulwark Stance')]),

  charm(COILED_SHADOW_ATTITUDE, 'abyssal', 'Coiled Shadow Attitude', 'melee',
    4, 5, 'reflexive', 'scene',
    ['Combo-OK', 'Mirror', 'Native'],
    cost(3),
    `<p>The Abyssal enters a killing stance, her weapon an extension of her hunger. This Charm is identical to its Solar counterpart, Blade Lair Discipline.</p>`,
    'b778e6d75ac6179e',
    [prereq(DEATH_WELL_REMEMBERED, 'Death Well-Remembered')]),

  charm(ENTROPIC_BLADE_NATURE, 'abyssal', 'Entropic Blade Nature', 'melee',
    5, 5, 'permanent', 'permanent',
    ['Martial-ready', 'Mirror', 'Native'],
    cost(),
    `<p>The Abyssal becomes the sword of Oblivion, her nature inseparable from the act of killing. This Charm is identical to its Solar counterpart, Inexorable Swordsman Spirit.</p>`,
    '71b1aa315048bc0c',
    [prereq(COILED_SHADOW_ATTITUDE, 'Coiled Shadow Attitude')]),

  charm(DEATHS_KNIGHT_STANCE, 'abyssal', "Death's Knight Stance", 'melee',
    4, 5, 'permanent', 'permanent',
    ['Mirror'],
    cost(3, 1),
    `<p>The Abyssal stands eternal vigil, her defense powered by necrotic conviction. This Charm is identical to its Solar counterpart, Guardian Sunfire Catechism.</p>`,
    '3c47bbb5e42fb88a',
    [prereq(DEATH_DEFLECTING_TECHNIQUE, 'Death-Deflecting Technique')]),

  charm(SUPERIOR_WEAPON_BODY, 'abyssal', 'Superior Weapon Body', 'athletics',
    3, 5, 'permanent', 'permanent',
    ['Mirror'],
    cost(),
    `<p>The Abyssal's corpse-given body is itself a weapon, surpassing mortal physical limits through necrotic Essence. This Charm is identical to its Solar counterpart, Glorious Temple Body.</p>`,
    '2403dabb314adb79',
    [
      prereq(CORPSE_MIGHT_SURGE, 'Corpse-Might Surge'),
      prereq(CROUCHING_GARGOYLE_STANCE, 'Crouching Gargoyle Stance'),
      prereq(EBON_LIGHTNING_PRANA, 'Ebon Lightning Prana'),
    ]),

  charm(TREACHEROUS_FLAG_DISPLAY, 'abyssal', 'Treacherous Flag Display', 'sail',
    3, 4, 'simple', 'indefinite',
    ['Combo-OK', 'Illusion', 'Mirror', 'Obvious'],
    cost(7),
    `<p>The ghost ship flies whatever colors it pleases, and those who see it believe utterly. This Charm is identical to its Solar counterpart, Flag of All Nations Method.</p>`,
    '787158da9de1b17e',
    [prereq(UNHALLOWED_GHOST_SHIP, 'Unhallowed Ghost Ship')]),

  charm(FELL_CAPTAINS_ADVANTAGES, 'abyssal', "Fell Captain's Advantages", 'sail',
    3, 3, 'permanent', 'permanent',
    ['Mirror', 'Native'],
    cost(),
    `<p>Death's admiral knows every current, reef, and wind. This Charm is identical to its Solar counterpart, Immortal Captain's Advantages.</p>`,
    '854c8dc3ddd64342',
    [prereq(PERFECT_RECKONING_TECHNIQUE, 'Perfect Reckoning Technique')]),

  charm(FELL_RIDERS_ADVANTAGES, 'abyssal', "Fell Rider's Advantages", 'ride',
    3, 3, 'permanent', 'permanent',
    ['Mirror', 'Mount (Mundane)', 'Native'],
    cost(),
    `<p>The Abyssal commands any mundane mount with the authority of death. This Charm is identical to its Solar counterpart, Immortal Rider's Advantages.</p>`,
    '27765cad1de6a0ab',
    [prereq(SOUL_REINS, "Soul Reins")]),

  charm(DEATH_CLAIMS_ALL, 'abyssal', 'Death Claims All', 'larceny',
    3, 5, 'reflexive', 'instant',
    ['Combo-OK', 'Counterattack', 'Mirror'],
    cost(5),
    `<p>When an enemy thinks to catch the Abyssal off-guard, death answers instead. This Charm is identical to its Solar counterpart, Reversal of Fortune.</p>`,
    'e8e48f13e7dc5ff3',
    [prereq(STEALING_FROM_PLAIN_SIGHT, 'Stealing from Plain Sight Spirit')]),

  charm(GUIDING_LIGHT_SHINES_ON, 'abyssal', 'Guiding Light Shines On', 'survival',
    4, 5, 'reflexive', 'indefinite',
    ['Combo-OK', 'Compulsion', 'Mirror', 'Obvious'],
    cost(5),
    `<p>The Abyssal summons a pale necrotic light that draws the living toward it with irresistible compulsion. This Charm is identical to its Solar counterpart, Wisp Light Summons.</p>`,
    '0cd65082aa55d798',
    [prereq(DARK_PATHS_FOUND, 'Dark Paths Found')]),

  // ── Solar counterparts of Abyssal Inkmonkeys charms ──

  charm(SHINING_ON_DARK_REALMS, 'solar', 'Shining on Dark Realms', 'presence',
    3, 5, 'permanent', 'permanent',
    ['Mirror'],
    cost(),
    `<p>The Solar's presence banishes the dread authority of the undead, asserting righteous dominion where the Abyssal would claim rulership of death. This Charm is identical to its Abyssal counterpart, Barrow King's Authority.</p>`,
    'e458314a98211ec6',
    [prereq(AUTHORITY_RADIATING_STANCE, 'Authority-Radiating Stance')]),

  charm(STARING_AT_THE_SUN, 'solar', 'Staring at the Sun', 'integrity',
    2, 3, 'reflexive', 'instant',
    ['Combo-OK', 'Mirror', 'Social'],
    cost(1),
    `<p>Gazing into the unconquered light of Creation, the Solar turns deathly visions aside. This Charm is identical to its Abyssal counterpart, Dark Visionary Defense.</p>`,
    'bc050d8719dbae5f'),

  charm(GOLDEN_DESTRUCTION_CUT, 'solar', 'Golden Destruction Cut', 'melee',
    4, 5, 'permanent', 'permanent',
    ['Mirror'],
    cost(),
    `<p>The Solar refines the perfection of her blade technique into an art that shears through supernatural endurance. This Charm is identical to its Abyssal counterpart, Elegant Bloodletting Art.</p>`,
    'f3d748ff6d77abba',
    [prereq(HUNGRY_TIGER_TECHNIQUE, 'Hungry Tiger Technique')]),

  charm(ARMOR_SHATTERING_STRIKE, 'solar', 'Armor-Shattering Strike', 'martialarts',
    3, 5, 'supplemental', 'instant',
    ['Combo-OK', 'Crippling', 'Mirror', 'Obvious', 'Stackable'],
    cost(5),
    `<p>The Solar drives sunfire Essence through a foe's defenses, breaking bone and shattering armor alike. This Charm is identical to its Abyssal counterpart, Iron Maiden's Embrace.</p>`,
    'f1bb29c1ce4124b6',
    [prereq(DARK_MESSIAH_FORM, 'Dark Messiah Form')]),
];

// ── Bidirectional mirror links to set on source charms ────────────────────────
// sourceFile → mirrorId to set
const SOURCE_UPDATES = [
  ['angle-tracing-edge.json',          STALKING_THE_STRIKERS_HAND],
  ['elegant-dance-of-bow-and-blade.json', EVER_READY_KILLERS_TOOLS],
  ['dawn-kings-strife.json',           ASH_CHILDS_REQUIEM],
  ['supreme-martial-instinct.json',    MANIFOLD_MURDER_ARTS],
  ['perfected-battle-array.json',      BLADES_WELL_BLOODED],
  ['sun-sword-concentration.json',     ALL_BLADES_CRY_FOR_BLOOD],
  ['perfect-blade-aegis.json',         DEATH_WELL_REMEMBERED],
  ['blade-lair-discipline.json',       COILED_SHADOW_ATTITUDE],
  ['inexorable-swordsman-spirit.json', ENTROPIC_BLADE_NATURE],
  ['guardian-sunfire-catechism.json',  DEATHS_KNIGHT_STANCE],
  ['glorious-temple-body.json',        SUPERIOR_WEAPON_BODY],
  ['flag-of-all-nations-method.json',  TREACHEROUS_FLAG_DISPLAY],
  ['immortal-captains-advantages.json', FELL_CAPTAINS_ADVANTAGES],
  ['immortal-riders-advantages.json',  FELL_RIDERS_ADVANTAGES],
  ['reversal-of-fortune.json',         DEATH_CLAIMS_ALL],
  ['wisp-light-summons.json',          GUIDING_LIGHT_SHINES_ON],
  ['barrow-kings-authority.json',      SHINING_ON_DARK_REALMS],
  ['dark-visionary-defense.json',      STARING_AT_THE_SUN],
  ['elegant-bloodletting-art.json',    GOLDEN_DESTRUCTION_CUT],
  ['iron-maidens-embrace.json',        ARMOR_SHATTERING_STRIKE],
];

// ── Execute ────────────────────────────────────────────────────────────────────
let created = 0, updated = 0;

for (const c of NEW_CHARMS) {
  const slug = c.name.toLowerCase()
    .replace(/[''']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const filePath = join(PACK, slug + '.json');
  console.log(`Create: ${filePath}`);
  if (!DRY_RUN) {
    writeFileSync(filePath, JSON.stringify(c, null, 2) + '\n');
  }
  created++;
}

for (const [file, mirrorId] of SOURCE_UPDATES) {
  const filePath = join(PACK, file);
  const doc = JSON.parse(readFileSync(filePath, 'utf-8'));
  if (doc.system.mirrorId === mirrorId) { console.log(`Skip (already set): ${file}`); continue; }
  doc.system.mirrorId = mirrorId;
  console.log(`Update mirrorId: ${file} → ${mirrorId}`);
  if (!DRY_RUN) {
    writeFileSync(filePath, JSON.stringify(doc, null, 2) + '\n');
  }
  updated++;
}

console.log(`\nNew charms:    ${created}`);
console.log(`Source updates: ${updated}`);
console.log(`\n${'─'.repeat(60)}`);
if (DRY_RUN) console.log('⚠  DRY RUN — pass --write to apply changes');
else console.log('Done.');
