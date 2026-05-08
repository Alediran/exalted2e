#!/usr/bin/env node
// Creates the 18 Solar charms missing from the pack that Abyssal Mirror charms reference.
// Usage:
//   node scripts/create-missing-solar-charms.mjs          # dry-run (shows what would be created)
//   node scripts/create-missing-solar-charms.mjs --write  # create files

import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const DRY_RUN = !process.argv.includes('--write');
const SOLAR_DIR = 'src/packs/charms-solar';

const STATS = { coreVersion: '13', systemId: 'exalted2e', systemVersion: '1.0.0', createdTime: 0, modifiedTime: 0, lastModifiedBy: null };
const FOLDERS = {
  athletics: '481b58529581316b', craft: '461821c707bbdbb0', larceny: 'e2cfe49eaa1f7c53',
  linguistics: '13c99c0e197877e7', lore: '5b0108cbcf2feaf4', occult: '9f789a9f97cf7e28',
  performance: 'e38c83836f199624', presence: 'e6b3f42bab7e5717', resistance: 'f05b544008eaceb0',
  ride: 'edcc4814a971a872', sail: 'dca02b4134c59583', socialize: '5da24482e38ff9ae',
  thrown: 'a5a30fa2e730ff58', war: 'd517bd826bc73b9e',
};

const prereq = (charmUid, charmName) => ({ alternatives: [{ type: 'charm', charmUid, charmName, abilityKey: '', virtueKey: 'valor', virtueMin: 1 }] });
const cost = (motes, willpower = 0) => ({ motes, willpower, bashingHealth: 0, lethalHealth: 0, aggravatedHealth: 0, xp: 0, motesLabel: '', resonance: 0, limitTrigger: 0 });

const charm = (id, name, ability, essence, minAbility, charmType, duration, keywords, costObj, description, prereqGroups, source = 'MoEP: Abyssals') => ({
  _id: id, _key: `!items!${id}`, _stats: STATS,
  name, type: 'charm', img: 'icons/magic/light/beam-rays-yellow.webp',
  system: {
    exaltType: 'solar', ability, essence, minAbility, charmType, duration,
    speed: 5, dvPenalty: 0, steps: [], keywords, cost: costObj, description,
    source, yoziPatron: '', martialArtsTier: '', martialArtsStyleName: '',
    maidenAffiliation: '', mirrorCharmRef: '', mirrorId: '', durationFormula: '',
    stackCount: 0, umiCost: 1, cooperationBonusDice: 0, excellency: '',
    perfectDefenseType: '', active: false, prereqGroups, charmUid: id, mergedIds: [],
  },
  folder: FOLDERS[ability], sort: 0, ownership: { default: 0 }, flags: {}, effects: [],
});

const charms = [
  // 1. Wind Full of Knives — Thrown E2/A5 extraaction (mirror of Five Birds, One Stone)
  charm('a1b2c3d4e5f60001', 'Wind Full of Knives', 'thrown', 2, 5, 'extraaction', 'instant',
    ['Combo-OK', 'Mirror', 'Obvious'],
    cost(2),
    '<p>The radiance of the sun glows around the Lawgiver\'s weapon as he prepares to throw it. The shining weapon whirls from target to target, cutting them down with Solar fury. This Charm is a magical flurry of up to (Thrown) attacks with no multiple-action penalties, all of which must be aimed at targets within the weapon\'s range. Because the attacks all use a single Thrown weapon, the flurry ignores the weapon\'s Rate and has a DV penalty of the highest penalty for any attack.</p>',
    [prereq('39902b4620932b68', 'Triple-Distance Attack Technique')],
    'MoEP: Abyssals'),

  // 2. Hill-Hurling Might — Athletics E4/A5 supplemental (mirror of Headstones Flung Like Pebbles)
  charm('a1b2c3d4e5f60002', 'Hill-Hurling Might', 'athletics', 4, 5, 'supplemental', 'instant',
    ['Combo-OK', 'Mirror'],
    cost(3),
    '<p>The Solar channels the might of the Unconquered Sun through her muscles, enhancing her ability to hurl large objects to destructive effect (Exalted, p. 127):</p><ul><li>Add +5 to the character\'s (Strength + Athletics) total for determining what she can throw as a weapon</li><li>Multiply the attack\'s base Range by 10</li><li>Increase the attack\'s Accuracy to +3 instead of -3</li></ul><p>If such an attack hits a character no larger than the projectile, the target automatically falls prone. She must lift the object off as a miscellaneous action or use some other means to free herself before she can rise or move. Identical apart from its prerequisite to its Abyssal Mirror.</p>',
    [prereq('c00e9d7c7ddd694d', 'Increasing Strength Exercise')],
    'MoEP: Abyssals'),

  // 3. Mastery of Small Manners — Socialize E1/A2 reflexive Social (mirror of Exquisite Etiquette Style)
  charm('a1b2c3d4e5f60004', 'Mastery of Small Manners', 'socialize', 1, 2, 'reflexive', 'until next action',
    ['Combo-OK', 'Mirror', 'Social'],
    cost(1),
    '<p>Abyssals are horrid monsters full of lies and cruelty, but that is no excuse for bad manners. As Moonshadows must remind their circlemates, sometimes courtly elegance and sophistication can ruin more lives than all the swords in the world. The Solar\'s innate grace and courtly sophistication make her perfectly at ease in any social situation, and she extends that courtesy to those around her. Activating this Charm allows the Lawgiver to navigate any social gathering with perfect poise, lending her a bonus die on the first Socialize action she takes before the Charm expires.</p>',
    [],
    'MoEP: Abyssals'),

  // 4. Heartfelt Honorific Opportunity — Socialize E3/A5 supplemental Social (mirror of Honey-Tongued Serpent Attack)
  charm('a1b2c3d4e5f60003', 'Heartfelt Honorific Opportunity', 'socialize', 3, 5, 'supplemental', 'instant',
    ['Combo-OK', 'Mirror', 'Social'],
    cost(3, 1),
    '<p>The Solar\'s gracious courtesies disarm opponents, creating unexpected openings for social attacks. This Charm may enhance any Charisma-based social attack, making the attack unexpected. It is explicitly permitted to supplement actions using other Abilities. Apart from its prerequisite, this Charm functions identically to its Abyssal Mirror.</p>',
    [prereq('a1b2c3d4e5f60004', 'Mastery of Small Manners')],
    'MoEP: Abyssals'),

  // 5. Face the Light — Performance E2/A3 reflexive Compulsion/Obvious (mirror of Inescapable Massacre Technique)
  charm('a1b2c3d4e5f60005', 'Face the Light', 'performance', 2, 3, 'reflexive', 'scene',
    ['Combo-OK', 'Compulsion', 'Mirror', 'Obvious'],
    cost(5, 1),
    '<p>Upon activating this Charm, the Solar\'s player rolls (Charisma + Performance), adding the character\'s Essence in bonus successes. For the rest of the scene, everyone with a Dodge MDV lower than the successes rolled suffers an unnatural compulsion to remain and face the Solar whenever they attempt to flee any combat, mass combat or social combat in which the Lawgiver visibly participates. Falling back to make ranged attacks is not retreating. Resisting this compulsion for the rest of the scene costs three Willpower. Like moths to the flame, afflicted Fair Folk cannot resist. This Charm works through awe rather than a sense of futility, but otherwise functions identically to its Abyssal Mirror.</p>',
    [prereq('2b5b16ac2ab3d4e6', 'Respect Commanding Attitude')],
    'MoEP: Abyssals'),

  // 6. Deft Hands Deflection — Thrown E2/A4 reflexive Counterattack (mirror of Lightning Clutch Of The Raptor)
  charm('a1b2c3d4e5f60006', 'Deft Hands Deflection', 'thrown', 2, 4, 'reflexive', 'instant',
    ['Combo-OK', 'Counterattack', 'Mirror'],
    cost(4),
    '<p>With this Charm, a Solar can swat incoming projectiles out of the air with preternatural speed. Deft Hands Deflection perfectly parries any ranged attack regardless of whether it is blockable, provided the Lawgiver has a hand free to catch the projectile. Parrying an area attack stops the attack from hitting the Solar, but not any other targets caught in the path of destruction. If the projectile has physical substance, the Solar catches it and may reflexively toss it aside or wield it for her own attacks. Energy-based attacks dissolve as the Solar closes her fist to smother them. Whenever a Solar with Essence 4+ uses this Charm to catch and hold a Thrown weapon, she also gains a normal Thrown counterattack with the stolen weapon in Step Nine of attack resolution. The Solar Mirror to Lightning Clutch of the Raptor has different prerequisites but is otherwise identical.</p>',
    [prereq('7eefeb7437ae6390', 'Call The Blade')],
    'MoEP: Abyssals'),

  // 7. Minds Yield to Glory — Presence E3/A5 permanent (mirror of Lurking Malice Insinuation)
  charm('a1b2c3d4e5f60007', 'Minds Yield to Glory', 'presence', 3, 5, 'permanent', 'n/a',
    ['Mirror'],
    cost(0),
    '<p>This Charm expands Hypnotic Tongue Technique, increasing its duration to one month. If the Solar has Essence 4+, she can make the cost five Willpower to resist when the first opportunity to fulfill the order arises (in lieu of one Willpower per day), after which the Charm ends. Finally, if the Lawgiver has Essence 5+, the mote cost to activate Hypnotic Tongue Technique is only the target\'s Essence rating instead of 10m. This Charm improves Hypnotic Tongue Technique but otherwise works the same as its Abyssal Mirror.</p>',
    [prereq('a9d00c5a98487353', 'Hypnotic Tongue Technique')],
    'MoEP: Abyssals'),

  // 8. Tireless Sentinel Technique — Resistance E2/A3 simple indefinite (mirror of Restless As The Dead)
  charm('a1b2c3d4e5f60008', 'Tireless Sentinel Technique', 'resistance', 2, 3, 'simple', 'indefinite',
    ['Mirror'],
    cost(3),
    '<p>The Solar transcends the need for sleep, remaining ever-vigilant in service of the Unconquered Sun. While this Charm is active, the Lawgiver suffers no adverse effects from sleep deprivation besides the lost opportunity for Willpower recovery. A character can use this Charm to go without sleep for (Stamina + Resistance) days. After that, she suffers one level of unsoakable bashing damage per day without sleep, which she must heal through rest before she can activate the Charm again. This Charm works like its Abyssal analogue, except that Solars cannot permanently abandon the need for sleep.</p>',
    [],
    'MoEP: Abyssals'),

  // 9. Crew-Inspiring Charisma — Sail E2/A3 permanent Emotion (mirror of Ruthless Captain Efficiency)
  charm('a1b2c3d4e5f60009', 'Crew-Inspiring Charisma', 'sail', 2, 3, 'permanent', 'permanent',
    ['Emotion', 'Mirror'],
    cost(0),
    '<p>Once a Solar masters this Charm, ships she commands function at full efficiency and with no penalties, even with crew complements as low as a skeleton crew. In addition, each scene the Lawgiver spends commanding her crew counts as a scene of building an Intimacy of adoration in them unless they have an Essence rating equal to or greater than her own. Those who develop such Intimacies cannot take any actions that would knowingly result in harm to their captain or remove her from her position while aboard a ship she owns, unless they spend two Willpower points per day to overcome the unnatural mental influence of this Charm. The Solar Mirror builds Intimacies of adoration to deter mutiny rather than terror, but otherwise operates the same way as its Abyssal counterpart.</p>',
    [prereq('b07718511848c0e1', 'Salty Dog Method')],
    'MoEP: Abyssals'),

  // 10. Vile Anathema Shroud — Larceny E3/A4 simple Illusion (mirror of Solar Impersonation Style)
  charm('a1b2c3d4e5f6000a', 'Vile Anathema Shroud', 'larceny', 3, 4, 'simple', 'one day',
    ['Illusion', 'Mirror'],
    cost(5),
    '<p>The Solar Mirror to Solar Impersonation Style has only become possible in the Time of Tumult. It helps Lawgivers infiltrate the courts of the Deathlords—and offers ruthless Exalted a scapegoat visage for morally questionable actions. This Charm makes the character appear to belong to the corollary Abyssal Caste (Night to Day, etc.), altering her anima banner and caste mark accordingly. It also reverses any blatantly inhuman changes to appearance wrought by the Black Exaltation, so the Lawgiver can appear as a deathknight. Most importantly, deceived onlookers rationalize all Solar Charms the character uses as if they were actually Abyssal Charms. Vile Anathema Shroud\'s Illusion automatically fools all mundane senses, but Essence-based perceptions see through the fraud.</p>',
    [prereq('a33cb84cc6a7f695', 'Flawlessly Impenetrable Disguise')],
    'MoEP: Abyssals'),

  // 11. Demon-Binding Redemption — Occult E5/A5 permanent Servitude/Obvious (mirror of Spirit-Chaining Doom)
  charm('a1b2c3d4e5f6000b', 'Demon-Binding Redemption', 'occult', 5, 5, 'permanent', 'instant',
    ['Mirror', 'Obvious', 'Servitude'],
    cost(0),
    '<p>This Charm expands the capabilities of Ghost-Eating Technique, giving the Solar the option to bind a slain demon with an unnatural Servitude effect rather than unmake it. At the moment when the demon would fade away completely, it instead heals back to its lowest -4 health level with no Willpower points remaining and must obey its killer\'s orders without the possibility of resistance for a year and a day. Beings enslaved thus must obey normally unacceptable orders, but they need follow only the wording of commands and not their spirit. Actual sorcerous or necromantic binding trumps this Charm and prematurely ends its effects. The Solar Mirror to Spirit-Chaining Doom functions identically, except it affects only the demon-spawn of the surrendered Primordials.</p>',
    [prereq('b6977eae1a392e18', 'Ghost-Eating Technique')],
    'MoEP: Abyssals'),

  // 12. Virtue-Donating Grace — Lore E3/A3 permanent (mirror of Virtue-Devouring Hunger)
  charm('a1b2c3d4e5f6000c', 'Virtue-Donating Grace', 'lore', 3, 3, 'permanent', 'n/a',
    ['Mirror'],
    cost(0),
    '<p>The excellence of the Lawgivers helps others find greatness of spirit and strength of will. This Charm expands the utility of Will-Bolstering Method, enabling the Solar to tap her own Virtue channels to restore another\'s corresponding channels, or do so as a source of Willpower points. The Lawgiver can consume her own drained channels for one Willpower point each to donate to others or restore their Virtue channels. The character can mix-and-match, donating Willpower and channels with the same action, though the Solar always has the option of tapping another Virtue if one pool runs dry before the transfer is complete.</p>',
    [prereq('b6556519b203161e', 'Will-Bolstering Method')],
    'MoEP: Abyssals'),

  // 13. Demon-Wracking Glory — Performance E3/A5 simple Holy/Illusion/Obvious (mirror of Withering Phantasmagoria)
  charm('a1b2c3d4e5f6000d', 'Demon-Wracking Glory', 'performance', 3, 5, 'simple', 'instant (see below)',
    ['Combo-Basic', 'Holy', 'Illusion', 'Mirror', 'Obvious'],
    cost(0, 1),
    '<p>This Charm expands the capabilities of Phantom-Conjuring Performance to increase its range. The maximum radius for evoking effects extends to (Essence x 100) yards, or (Essence x 5) miles if the Solar has Essence 6+. More importantly, the Lawgiver may use these effects to cause physical injury to creatures of darkness within (Essence x 10) yards while leaving all other creatures unharmed. The Charm has the Holy keyword for its Performance-based attacks, inflicting aggravated damage to targeted creatures of darkness. Attacks take the form of bright fires, scorching beams of sunlight, phantom executioners and the like.</p><p>Demon-Wracking Glory inflicts harm in three ways, chosen each use. Activating the Charm costs Willpower; continuing it costs Essence per action. A character gains one attack form when she learns the Charm; additional forms cost one experience point each, or all three for one bonus point.</p><p><strong>Area, Continuing:</strong> Inflicts one level of lethal damage per two motes spent (max Essence) to all creatures of darkness whose Dodge MDV is less than successes from (Charisma + Performance).</p><p><strong>Single Target, Continuing:</strong> Chosen creature of darkness suffers one level of unsoakable aggravated damage per action (costs three motes per action).</p><p><strong>Single Target, Instant:</strong> Spend up to (Stamina + Essence) motes to inflict that many dice of aggravated damage plus extra successes.</p>',
    [prereq('c7efdb2e7c781f0a', 'Phantom-Conjuring Performance')],
    'MoEP: Abyssals'),

  // 14. Legendary Warrior Curriculum — War E4/A5 permanent (mirror of Soul-Numbing Prowess)
  charm('a1b2c3d4e5f6000e', 'Legendary Warrior Curriculum', 'war', 4, 5, 'permanent', 'one week',
    ['Mirror', 'Obvious'],
    cost(0),
    '<p>The most devoted servants of the Unconquered Sun pass their heroic virtues on to those they train. This Charm expands Tiger Warrior Training Technique, enabling the Solar to impart her heroic values to her soldiers. Unlike its Abyssal Mirror, this Charm can confer bonus dice to those she trains. Mortals and spirits may be taught to embody heroic virtues as an unnatural Compulsion effect (costing trainees no bonus or experience points). These champions become immune to wound penalties until Incapacitated and automatically succeed on all Valor rolls, giving units of these troops perfect morale. The effects of this heroic conditioning last until the warrior\'s will is broken (Exalted, p. 174).</p>',
    [prereq('ab1fcc826118f36e', 'Tiger Warrior Training Technique')],
    'MoEP: Abyssals'),

  // 15. Wind-Racing Essence Infusion — Ride E4/A5 permanent (mirror of Primal Terror Spurs)
  charm('a1b2c3d4e5f6000f', 'Wind-Racing Essence Infusion', 'ride', 4, 5, 'permanent', 'permanent',
    ['Mirror', 'Obvious'],
    cost(0),
    '<p>This Charm expands Flashing Thunderbolt Steed, infusing the Solar\'s steed with supernatural speed granted by the Unconquered Sun. Once purchased, whenever the Lawgiver activates Flashing Thunderbolt Steed, her mount\'s travel rate becomes (the creature\'s Stamina + the Exalt\'s Essence) × 20 miles per hour. Unlike its Abyssal Mirror (Primal Terror Spurs), this Charm\'s benefits apply anywhere in Creation and beyond, not just within the realms of the dead.</p>',
    [prereq('41ce33cbb7bfef0a', 'Flashing Thunderbolt Steed')],
    'MoEP: Abyssals'),

  // 16. Excellent Emissary's Tongue — Linguistics E3/A3 supplemental Stackable/Training (mirror of Language-Absorbing Method)
  charm('a1b2c3d4e5f60010', "Excellent Emissary's Tongue", 'linguistics', 3, 3, 'supplemental', 'indefinite',
    ['Mirror', 'Stackable', 'Training'],
    cost(10),
    '<p>By immersing herself in extended conversation with a native speaker, the Solar absorbs a new language through the power of Solar Essence. This Charm supplements an extended interaction lasting at least one scene. If the Lawgiver gains any successes on a (Intelligence + Linguistics) roll, she may choose one language spoken by the target and gains total fluency in it for as long as she commits motes, including a specialty in the target\'s dialect. This effect does not increase her actual Linguistics rating. A Solar with experience to spend can also permanently absorb a language as a diceless miscellaneous action, terminating the Charm to instantly raise the Lawgiver\'s Linguistics rating and/or purchase the appropriate dialect specialty as a Training effect.</p><p>This Charm may be separately activated any number of times to learn multiple languages, provided the Solar commits Essence for each tongue.</p>',
    [prereq('e0f8f471898825b1', 'Poetic Expression Style')],
    'MoEP: Abyssals'),

  // 17. Discerning Savant's Eye — Linguistics E2/A5 reflexive scene (mirror of Mystique-Spoiling Guess)
  charm('a1b2c3d4e5f60011', "Discerning Savant's Eye", 'linguistics', 2, 5, 'reflexive', 'scene',
    ['Combo-OK', 'Mirror'],
    cost(6, 1),
    '<p>The Solar effortlessly comprehends the deepest layers of text and speech, cutting through codes, ciphers, obfuscation and deliberate ambiguity. For the rest of the scene, the Lawgiver automatically understands the deeper meaning and intent behind any written or spoken communication she encounters. Ciphers, secret languages, metaphorical codes and deliberate misdirection all become transparent to her. She can read any written language and understand any spoken tongue as if she had a perfect command of it, regardless of her actual Linguistics rating. The Solar\'s insight extends to body language and subtext, making it nearly impossible to deceive her through linguistic or rhetorical tricks.</p>',
    [prereq('23f31acd8f158a53', 'Sagacious Reading Of Intent')],
    'MoEP: Abyssals'),

  // 18. Wonder-Forging Genius — Craft E5/A5 permanent (mirror of World-Slaying Arsenal Epiphany)
  charm('a1b2c3d4e5f60012', 'Wonder-Forging Genius', 'craft', 5, 5, 'permanent', 'permanent',
    ['Mirror'],
    cost(0),
    '<p>Inspired by the creative genius of the Primordials before them, the greatest Solar artisans conceive and craft wonders that would take lesser craftsmen centuries to realize. Once a Lawgiver purchases this Charm, the Craft, Lore, Medicine and Occult minimums required to design, build and repair wondrous artifacts decrease by one (to a minimum of 1). The Exalt receives the same benefits toward creating Solar manses. For the purposes of this Charm, a wondrous artifact must be a constructive or beneficial artifact of notable power. A Solar may buy this Charm no more than twice.</p>',
    [prereq('504a103c29f2c25a', 'Craft Essence Flow')],
    'Oadenol\'s Codex'),
];

// File name mapping (kebab-case from charm name)
const toFileName = name => name.toLowerCase()
  .replace(/[''']/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

let created = 0, skipped = 0;
for (const c of charms) {
  const fileName = toFileName(c.name) + '.json';
  const filePath = `${SOLAR_DIR}/${fileName}`;
  if (existsSync(filePath)) {
    console.log(`SKIP (exists): ${fileName}`);
    skipped++;
    continue;
  }
  console.log(`CREATE: ${fileName} [${c.system.ability} E${c.system.essence}/A${c.system.minAbility} ${c.system.charmType}]`);
  if (!DRY_RUN) {
    writeFileSync(filePath, JSON.stringify(c, null, 2) + '\n');
  }
  created++;
}

console.log(`\nCharms to create: ${created}, skipped (already exist): ${skipped}`);
if (DRY_RUN) console.log('⚠  DRY RUN — pass --write to apply');
else console.log('Done.');
