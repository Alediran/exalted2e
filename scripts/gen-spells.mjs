#!/usr/bin/env node
// scripts/gen-spells.mjs
// Generates src/packs/spells/ with all Sorcery, Necromancy, and Weaving spells.
// Run: node scripts/gen-spells.mjs

import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const OUT = 'src/packs/spells';
mkdirSync(OUT, { recursive: true });

// ── Deterministic ID (FNV-1a 64-bit, 16 hex chars, uppercase-safe) ────────────
function deterministicId(str) {
  let h = 2166136261n;
  for (const c of str) {
    h ^= BigInt(c.charCodeAt(0));
    h = BigInt.asUintN(32, h * 16777619n);
  }
  // extend to 16 chars by doubling
  const lo = h.toString(16).padStart(8, '0');
  let h2 = h ^ 0xdeadbeefn;
  h2 = BigInt.asUintN(32, h2 * 16777619n);
  const hi = h2.toString(16).padStart(8, '0');
  return (hi + lo).slice(0, 16);
}

function stats() {
  return {
    coreVersion: '13',
    systemId: 'exalted2e',
    systemVersion: '1.0.0',
    createdTime: 0,
    modifiedTime: 0,
    lastModifiedBy: null,
  };
}

function cost({ motes = 0, willpower = 0, bashing = 0, lethal = 0, aggravated = 0, xp = 0 } = {}) {
  return {
    motes,
    willpower,
    bashingHealth: bashing,
    lethalHealth: lethal,
    aggravatedHealth: aggravated,
    xp,
  };
}

// ── Folder helpers ────────────────────────────────────────────────────────────

const TRADITIONS = [
  { key: 'sorcery',   label: 'Sorcery',   color: '#806020' },
  { key: 'necromancy', label: 'Necromancy', color: '#503050' },
  { key: 'weaving',   label: 'Weaving',   color: '#304060' },
];

const CIRCLES = {
  sorcery: [
    { circle: 1, label: 'Terrestrial Circle' },
    { circle: 2, label: 'Celestial Circle' },
    { circle: 3, label: 'Solar Circle' },
  ],
  necromancy: [
    { circle: 1, label: 'Shadowlands Circle' },
    { circle: 2, label: 'Labyrinth Circle' },
    { circle: 3, label: 'Void Circle' },
  ],
  weaving: [
    { circle: 1, label: 'Man-Machine Protocol' },
    { circle: 2, label: 'God-Machine Protocol' },
  ],
};

// Pre-compute folder IDs
const tradIds = {};
for (const t of TRADITIONS) {
  tradIds[t.key] = deterministicId(`folder-tradition-${t.key}`);
}
const circleIds = {};
for (const [trad, circles] of Object.entries(CIRCLES)) {
  circleIds[trad] = {};
  for (const { circle, label } of circles) {
    circleIds[trad][circle] = deterministicId(`folder-${trad}-${label}`);
  }
}

// ── Write folder docs ─────────────────────────────────────────────────────────

for (const t of TRADITIONS) {
  const id = tradIds[t.key];
  const doc = {
    _id: id,
    _key: `!folders!${id}`,
    _stats: stats(),
    name: t.label,
    type: 'Item',
    folder: null,
    sorting: 'a',
    color: t.color,
    flags: {},
  };
  writeFileSync(join(OUT, `_folder-${t.key}.json`), JSON.stringify(doc, null, 2), 'utf-8');
}

for (const [trad, circles] of Object.entries(CIRCLES)) {
  const tradColor = TRADITIONS.find(t => t.key === trad).color;
  for (const { circle, label } of circles) {
    const id = circleIds[trad][circle];
    const doc = {
      _id: id,
      _key: `!folders!${id}`,
      _stats: stats(),
      name: label,
      type: 'Item',
      folder: tradIds[trad],
      sorting: 'a',
      color: tradColor,
      flags: {},
    };
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    writeFileSync(join(OUT, `_folder-${trad}-${slug}.json`), JSON.stringify(doc, null, 2), 'utf-8');
  }
}

// ── Spell builder ─────────────────────────────────────────────────────────────

function spell({ uid, name, tradition, circle, minimumClarity = 0, costOpts, duration, target = '', description }) {
  const id = deterministicId(`spell-${uid}`);
  const folderId = circleIds[tradition][circle];
  return {
    _id: id,
    _key: `!items!${id}`,
    _stats: stats(),
    name,
    type: 'spell',
    img: '',
    system: {
      spellUid: uid,
      tradition,
      circle,
      minimumClarity,
      cost: cost(costOpts),
      duration,
      target,
      description: `<p>${description}</p>`,
    },
    folder: folderId,
    ownership: { default: 0 },
    flags: {},
  };
}

// ── Spell data ────────────────────────────────────────────────────────────────

const SPELLS = [

  // ═══════════════════════════════════════════════════════════════════════════
  // SORCERY — Terrestrial Circle (circle 1)
  // ═══════════════════════════════════════════════════════════════════════════

  spell({
    uid: 'terrestrial-burning-eye-of-the-tyrant',
    name: 'Burning Eye of the Tyrant',
    tradition: 'sorcery', circle: 1,
    costOpts: { motes: 10, willpower: 1 },
    duration: 'one scene',
    target: 'self',
    description: 'The sorcerer\'s eyes blaze with golden fire. For the rest of the scene, the sorcerer may use Perception + Occult to see through mundane disguises, illusions, and the auras of the Exalted. Demons, creatures of darkness, and beings steeped in Essence glow visibly.',
  }),

  spell({
    uid: 'terrestrial-calling-the-blade',
    name: 'Calling the Blade',
    tradition: 'sorcery', circle: 1,
    costOpts: { motes: 5 },
    duration: 'one scene',
    target: 'self',
    description: 'The sorcerer names a specific weapon she owns or has held. That weapon flies instantly to her hand from anywhere within a mile. The weapon arrives ready for use at the start of her next action. If the weapon is held or restrained, this spell fails.',
  }),

  spell({
    uid: 'terrestrial-death-of-obsidian-butterflies',
    name: 'Death of Obsidian Butterflies',
    tradition: 'sorcery', circle: 1,
    costOpts: { motes: 15, willpower: 1 },
    duration: 'instant',
    target: 'all in 90-degree arc',
    description: 'The sorcerer hurls a storm of razor-edged obsidian butterfly shapes in a 90-degree arc covering the battlefield. Every target in the area suffers a 12L Piercing, Overwhelming attack. Targets may dodge but not parry this attack. The butterflies strike simultaneously and shred terrain as well as flesh.',
  }),

  spell({
    uid: 'terrestrial-disguise-of-the-new-face',
    name: 'Disguise of the New Face',
    tradition: 'sorcery', circle: 1,
    costOpts: { motes: 10 },
    duration: 'one scene',
    target: 'self or touched',
    description: 'The sorcerer reshapes one person\'s features — including her own — into any human face she can clearly envision. Height, build, weight, and skin tone change to match within a realistic human range. The disguise is complete enough to fool casual observers and even close acquaintances of the person being imitated.',
  }),

  spell({
    uid: 'terrestrial-elemental-bolt',
    name: 'Elemental Bolt',
    tradition: 'sorcery', circle: 1,
    costOpts: { motes: 10 },
    duration: 'instant',
    target: 'single',
    description: 'The sorcerer conjures a bolt of elemental force — fire, lightning, ice, stone, or wind — and hurls it at a single target. The bolt has Accuracy +2, Damage 10L, and Rate 2. It is a ranged attack using Perception + Occult. The elemental type is chosen at casting and determines minor thematic effects but not game statistics.',
  }),

  spell({
    uid: 'terrestrial-emerald-countermagic',
    name: 'Emerald Countermagic',
    tradition: 'sorcery', circle: 1,
    costOpts: { motes: 10 },
    duration: 'instant',
    target: 'spell or enchantment',
    description: 'Spending 10 motes, the sorcerer may dispel any Terrestrial Circle sorcery or unraveling enchantment as a reflexive action. By spending 20 motes she may attempt to counter a Celestial Circle spell; the rival sorcerer rolls (Wits + Occult) against the countermagician\'s roll, and the higher result prevails. Solar Circle spells and effects above Celestial are immune.',
  }),

  spell({
    uid: 'terrestrial-facade-of-flesh',
    name: 'Façade of Flesh',
    tradition: 'sorcery', circle: 1,
    costOpts: { motes: 10 },
    duration: 'one scene',
    target: 'touched object or creature',
    description: 'The sorcerer wraps an object, creature, or undead in a perfect sheath of living human flesh and sensation. Automata appear organic, skeletons appear as healthy humans, and objects gain realistic surface texture. The disguise is convincing to touch and sight; supernatural senses may pierce it.',
  }),

  spell({
    uid: 'terrestrial-flight-of-the-brilliant-raptor',
    name: 'Flight of the Brilliant Raptor',
    tradition: 'sorcery', circle: 1,
    costOpts: { motes: 15 },
    duration: 'instant',
    target: 'single',
    description: 'A blazing eagle of golden fire hurtles at a single target, dealing 14L damage on impact. The target and everything in contact with it catches fire, suffering 3L per tick until extinguished. The raptor cannot be deflected or intercepted, though it may be dodged or soaked.',
  }),

  spell({
    uid: 'terrestrial-impervious-vessel-of-bronze',
    name: 'Impervious Vessel of Bronze',
    tradition: 'sorcery', circle: 1,
    costOpts: { motes: 15 },
    duration: 'one scene (committed)',
    target: 'one vehicle or structure',
    description: 'The sorcerer sheathes a ship, wagon, or structure in a bronze lattice of hardened Essence. The vessel gains +30 health levels, Hardness 8, and soak 10B/10L against all attacks for the duration. The sorcerer must commit 15 motes throughout the scene or the effect ends early.',
  }),

  spell({
    uid: 'terrestrial-keel-cleaves-the-clouds',
    name: 'Keel Cleaves the Clouds',
    tradition: 'sorcery', circle: 1,
    costOpts: { motes: 15 },
    duration: 'one scene',
    target: 'one vehicle',
    description: 'The sorcerer enchants a seagoing vessel or airship, allowing it to sail through clouds or sky as easily as open water. The ship travels at twice its normal speed and ignores weather penalties for the duration. A vessel under this spell leaves no wake and emits a faint golden glow from its hull.',
  }),

  spell({
    uid: 'terrestrial-mists-of-eventide',
    name: 'Mists of Eventide',
    tradition: 'sorcery', circle: 1,
    costOpts: { motes: 10 },
    duration: 'one scene',
    target: 'area',
    description: 'Cloying silver fog rolls in at the sorcerer\'s command, blanketing up to a square mile in concealing mist. All ranged attacks suffer a −4 external penalty. Those within the mists risk losing their bearings; characters must succeed on (Perception + Survival) at difficulty 2 to navigate directly to a destination.',
  }),

  spell({
    uid: 'terrestrial-peacock-shadow-eyes',
    name: 'Peacock Shadow Eyes',
    tradition: 'sorcery', circle: 1,
    costOpts: { motes: 10 },
    duration: 'one scene',
    target: 'self',
    description: 'The sorcerer\'s eyes shift to iridescent violet orbs seeing across frequencies of light invisible to mortal sight. She can see in complete darkness, detect invisible spirits and dematerialized entities, and read Essence flows and auras. She may also look through mundane barriers up to a foot thick by concentrating for one tick.',
  }),

  spell({
    uid: 'terrestrial-raising-the-earths-bones',
    name: "Raising the Earth's Bones",
    tradition: 'sorcery', circle: 1,
    costOpts: { motes: 15 },
    duration: 'indefinite / permanent',
    target: 'terrain',
    description: 'The sorcerer commands the stone and soil to reshape itself over the course of a scene. She may raise walls up to 20 feet high and 100 feet long, create trenches, collapse tunnels, or form crude staircases. If she commits the motes indefinitely the changes persist; otherwise the stone slowly returns to its original shape over a day.',
  }),

  spell({
    uid: 'terrestrial-ritual-of-elemental-empowerment',
    name: 'Ritual of Elemental Empowerment',
    tradition: 'sorcery', circle: 1,
    costOpts: { motes: 15, willpower: 1 },
    duration: 'one month',
    target: 'area (demesne or manse)',
    description: 'Performed over a full day within a demesne or manse attuned to an element, this ritual harmonizes the local Essence flows. Aspect-appropriate charms cost one fewer mote (minimum 1) for all Exalted within the area. The ritual must be renewed monthly or its benefits fade.',
  }),

  spell({
    uid: 'terrestrial-silent-words-of-dreams-and-nightmares',
    name: 'Silent Words of Dreams and Nightmares',
    tradition: 'sorcery', circle: 1,
    costOpts: { motes: 10 },
    duration: 'indefinite',
    target: 'touched sleeper',
    description: 'The sorcerer plants a vision, message, or recurring nightmare in a sleeping target\'s mind. The dream recurs nightly until the sorcerer releases the motes, playing out with vivid clarity. Extremely disturbing nightmares may impose a penalty on the target\'s actions the following day from lost sleep.',
  }),

  spell({
    uid: 'terrestrial-stormwind-rider',
    name: 'Stormwind Rider',
    tradition: 'sorcery', circle: 1,
    costOpts: { motes: 15 },
    duration: 'one scene',
    target: 'self and willing passengers',
    description: 'A howling cyclone lifts the sorcerer and up to her Essence in passengers, carrying them at speeds up to 500 miles per hour. She can direct the wind precisely enough to land on a specific rooftop or to thread between obstacles. Combat maneuvers while riding the Stormwind are possible but require (Dexterity + Dodge) at difficulty 3.',
  }),

  spell({
    uid: 'terrestrial-summon-elemental',
    name: 'Summon Elemental',
    tradition: 'sorcery', circle: 1,
    costOpts: { motes: 10 },
    duration: 'indefinite',
    target: 'summoned elemental',
    description: 'The sorcerer summons a minor elemental of one of the five elements, spending 1 additional mote per dot of the elemental\'s Essence (minimum Essence 1). The elemental serves willingly if the sorcerer succeeds on a (Charisma or Manipulation + Occult) roll against its Resolve; otherwise it is bound by the spell until released or the motes are uncapped.',
  }),

  spell({
    uid: 'terrestrial-terrestrial-ward',
    name: 'Terrestrial Ward',
    tradition: 'sorcery', circle: 1,
    costOpts: { motes: 10 },
    duration: 'indefinite (committed)',
    target: 'location',
    description: 'The sorcerer inscribes a ward around a doorway, window, or area up to a room in size. Any being of a type specified at casting (demons, spirits, undead, the Wyld-touched, etc.) who attempts to cross the ward must succeed on (Willpower) at difficulty (sorcerer\'s Essence + 3) or be repelled. A given ward affects one category of being.',
  }),

  spell({
    uid: 'terrestrial-thoughtful-gift',
    name: 'Thoughtful Gift',
    tradition: 'sorcery', circle: 1,
    costOpts: { motes: 10, willpower: 1 },
    duration: 'permanent',
    target: 'single recipient',
    description: 'The sorcerer channels Essence into a permanent blessing, granting one person a minor supernatural boon: a slightly stronger constitution, keener senses, a natural talent for a craft, or similar mundane enhancement. The effect is permanent but subtle — no more powerful than a single favored ability or minor merit.',
  }),

  spell({
    uid: 'terrestrial-voracious-onslaught-of-flame',
    name: 'Voracious Onslaught of Flame',
    tradition: 'sorcery', circle: 1,
    costOpts: { motes: 20 },
    duration: 'instant',
    target: 'line',
    description: 'A torrent of hungry fire erupts from the sorcerer\'s hands in a column 100 yards long and 10 yards wide. Every target within the column suffers a 16L Piercing attack. The fire continues to burn for three ticks, dealing 3L per tick to anyone remaining in the area. Flammable structures ignite immediately.',
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // SORCERY — Celestial Circle (circle 2)
  // ═══════════════════════════════════════════════════════════════════════════

  spell({
    uid: 'celestial-calling-and-binding-the-monstrous',
    name: 'Calling and Binding the Monstrous',
    tradition: 'sorcery', circle: 2,
    costOpts: { motes: 25, willpower: 1 },
    duration: 'indefinite',
    target: 'summoned first-circle demon',
    description: 'The sorcerer tears open the fabric of the world and drags a specific named First Circle Demon into Creation. If no name is spoken, a random demon of the desired type arrives. The demon is bound to obey the sorcerer\'s commands as long as she commits the motes. A demon so bound will not violate its nature or destroy itself, but otherwise must comply.',
  }),

  spell({
    uid: 'celestial-demon-of-the-second-circle',
    name: 'Demon of the Second Circle',
    tradition: 'sorcery', circle: 2,
    costOpts: { motes: 25, willpower: 1 },
    duration: 'indefinite',
    target: 'summoned second-circle demon',
    description: 'The sorcerer summons and binds a Second Circle Demon, the soul-fragments of the Yozis. These are potent entities with formidable Essence and capabilities. The binding holds as long as the sorcerer commits the motes; breaking it prematurely risks the demon turning on her. Summoning a Second Circle Demon takes an entire day\'s ritual.',
  }),

  spell({
    uid: 'celestial-eye-of-the-unconquered-sun',
    name: 'Eye of the Unconquered Sun',
    tradition: 'sorcery', circle: 2,
    costOpts: { motes: 25 },
    duration: 'one scene',
    target: 'self',
    description: 'A blazing circle of golden light manifests above the sorcerer\'s brow, shedding light equivalent to full daylight in a 100-yard radius. Creatures of darkness within the radius suffer 2L per tick. The light cannot be dimmed or extinguished by mundane or magical means short of Celestial sorcery. The sorcerer sees truth within this light — all illusions, disguises, and dematerialized spirits stand revealed.',
  }),

  spell({
    uid: 'celestial-incomparable-body-arsenal',
    name: 'Incomparable Body Arsenal',
    tradition: 'sorcery', circle: 2,
    costOpts: { motes: 20 },
    duration: 'one scene',
    target: 'self',
    description: 'The sorcerer\'s body becomes a living armory. She may sprout bladed limbs, launch bone darts, extend bony spurs, or reshape her hands into claws. Each weapon manifests with statistics equal to a mundane version of the chosen type plus the sorcerer\'s Essence as a bonus to damage. She may manifest and dismiss individual weapons as a reflexive action.',
  }),

  spell({
    uid: 'celestial-invulnerable-skin-of-bronze',
    name: 'Invulnerable Skin of Bronze',
    tradition: 'sorcery', circle: 2,
    costOpts: { motes: 25 },
    duration: 'one scene (committed)',
    target: 'self',
    description: 'The sorcerer\'s skin hardens into bronzed plates of solidified Essence, granting soak 12L/12B and Hardness 8. Her movement is not impeded. The bronze deflects mundane missiles automatically. This spell may be combined with armor though the soak values do not fully stack — use the higher value for each type and add half the lower, rounded down.',
  }),

  spell({
    uid: 'celestial-sapphire-countermagic',
    name: 'Sapphire Countermagic',
    tradition: 'sorcery', circle: 2,
    costOpts: { motes: 20 },
    duration: 'instant',
    target: 'spell',
    description: 'Spending 20 motes reflexively, the sorcerer may dispel any Celestial or Terrestrial Circle spell. By spending 30 motes she may attempt to counter a Solar Circle spell; both sorcerers roll (Wits + Occult) and the higher total wins. Third Circle and Yozi magic cannot be countered by Sapphire Countermagic.',
  }),

  spell({
    uid: 'celestial-sorcerers-irresistible-puppetry',
    name: "Sorcerer's Irresistible Puppetry",
    tradition: 'sorcery', circle: 2,
    costOpts: { motes: 20, willpower: 1 },
    duration: 'indefinite',
    target: 'one victim',
    description: 'The sorcerer enslaves a single target\'s body, controlling their physical actions entirely while leaving the mind a horrified prisoner. The victim performs any physical action the sorcerer commands, though she cannot compel them to speak convincingly. The target may attempt (Willpower) at difficulty (sorcerer\'s Essence + 2) each scene to resist momentarily.',
  }),

  spell({
    uid: 'celestial-unbreakable-bones-of-stone',
    name: 'Unbreakable Bones of Stone',
    tradition: 'sorcery', circle: 2,
    costOpts: { motes: 20 },
    duration: 'one scene',
    target: 'self',
    description: 'The sorcerer\'s skeleton transforms into enchanted stone, granting immunity to knockback, knockdown, and crippling. She reduces all wound penalties by two (minimum zero). She cannot be grappled by mortals or creatures with Strength less than her (Stamina + Essence). Her unarmed strikes deal lethal damage and ignore the Hardness of mundane materials.',
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // SORCERY — Solar Circle (circle 3)
  // ═══════════════════════════════════════════════════════════════════════════

  spell({
    uid: 'solar-adamant-countermagic',
    name: 'Adamant Countermagic',
    tradition: 'sorcery', circle: 3,
    costOpts: { motes: 30 },
    duration: 'instant',
    target: 'spell or enchantment',
    description: 'The ultimate countermagic of sorcery. Spending 30 motes reflexively, the sorcerer dispels any Terrestrial, Celestial, or Solar Circle sorcery. Spending 50 motes she may attempt to counter Yozi or similarly transcendent workings; both casters roll (Wits + Occult), and the higher result prevails. Adamant Countermagic cannot be countered by lesser countermagics.',
  }),

  spell({
    uid: 'solar-benediction-of-archgenesis',
    name: 'Benediction of Archgenesis',
    tradition: 'sorcery', circle: 3,
    costOpts: { motes: 40, willpower: 1 },
    duration: 'permanent',
    target: 'one region',
    description: 'The sorcerer performs a month-long ritual to permanently alter a region up to a hundred miles across. She may change the climate, redirect rivers, raise or lower terrain by hundreds of feet, or alter the local Essence environment. The changes persist indefinitely and reshape the region\'s ecology. This spell requires an entire month of casting and cannot be rushed.',
  }),

  spell({
    uid: 'solar-demon-of-the-third-circle',
    name: 'Demon of the Third Circle',
    tradition: 'sorcery', circle: 3,
    costOpts: { motes: 50, willpower: 1 },
    duration: 'indefinite',
    target: 'summoned third-circle demon',
    description: 'The pinnacle of demon-binding sorcery. The sorcerer tears open the Demon Realm and drags a Third Circle Demon — a fetich soul fragment of a Yozi — into Creation. Such beings are enormously powerful and deeply hostile. Binding requires committing 50 motes; the demon obeys while bound but seeks any loophole. Casting takes three days of ritual.',
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // NECROMANCY — Shadowlands Circle (circle 1)
  // ═══════════════════════════════════════════════════════════════════════════

  spell({
    uid: 'shadowlands-countermagic',
    name: 'Shadowlands Circle Countermagic',
    tradition: 'necromancy', circle: 1,
    costOpts: { motes: 10 },
    duration: 'instant',
    target: 'spell or necrotic working',
    description: 'Spending 10 motes reflexively, the necromancer unravels any Shadowlands Circle necromancy or lesser necrotic effect. Spending 20 motes she may attempt to dispel Labyrinth Circle workings; both necromancers roll (Wits + Occult), and the higher total prevails. Void Circle necromancy and Beyond-the-Void workings cannot be countered by Shadowlands Countermagic.',
  }),

  spell({
    uid: 'shadowlands-bone-puppet-dance',
    name: 'Bone Puppet Dance',
    tradition: 'necromancy', circle: 1,
    costOpts: { motes: 15 },
    duration: 'one scene',
    target: 'one corpse or skeleton',
    description: 'The necromancer animates a single corpse or skeleton, commanding it as a puppet. The undead creature uses the base statistics of its species at death but obeys the necromancer\'s every command. It fights, carries, and performs labor until destroyed or the scene ends. More capable necromancers may animate creatures of greater size.',
  }),

  spell({
    uid: 'shadowlands-corpse-flesh-warding',
    name: 'Corpse Flesh Warding',
    tradition: 'necromancy', circle: 1,
    costOpts: { motes: 10 },
    duration: 'indefinite (committed)',
    target: 'self',
    description: 'The necromancer sheathes herself in an aura of death-aspected Essence that wards away the undead. Mindless undead will not willingly approach within (necromancer\'s Essence × 5) yards. Thinking undead must succeed on (Willpower) at difficulty (Essence + 2) to approach or act against her. The ward does not protect allies.',
  }),

  spell({
    uid: 'shadowlands-death-knell',
    name: 'Death Knell',
    tradition: 'necromancy', circle: 1,
    costOpts: { motes: 10 },
    duration: 'instant',
    target: 'single',
    description: 'A bolt of pure Oblivion-aspected Essence lances from the necromancer\'s outstretched hand. It strikes a single target for 10A damage. The attack ignores all mundane soak and Hardness; only supernatural protection derived from life-aspected Essence provides any resistance. This attack cannot be parried, only dodged.',
  }),

  spell({
    uid: 'shadowlands-haunting-the-beloved-dead',
    name: 'Haunting the Beloved Dead',
    tradition: 'necromancy', circle: 1,
    costOpts: { motes: 10, willpower: 1 },
    duration: 'indefinite',
    target: 'one ghost',
    description: 'The necromancer binds a ghost to a specific person, place, or object as its haunt. The ghost must obey the necromancer\'s commands regarding the haunting: it may harry, terrify, aid, or guard the haunt target as directed. The ghost cannot leave its designated territory while bound. Many necromancers use this to create loyal guardians.',
  }),

  spell({
    uid: 'shadowlands-iron-shackles-of-the-grave',
    name: 'Iron Shackles of the Grave',
    tradition: 'necromancy', circle: 1,
    costOpts: { motes: 15, willpower: 1 },
    duration: 'indefinite',
    target: 'one ghost or spirit',
    description: 'Chains of black iron ghost-stuff erupt from the ground and bind a single ghost or dematerialized spirit. The target is anchored to its current location and cannot move, dematerialize, or use Charms that require movement. It remains bound as long as the necromancer commits the motes. Particularly powerful spirits may resist with an opposed (Essence) roll.',
  }),

  spell({
    uid: 'shadowlands-raise-the-skeletal-horde',
    name: 'Raise the Skeletal Horde',
    tradition: 'necromancy', circle: 1,
    costOpts: { motes: 20, willpower: 1 },
    duration: 'one scene',
    target: 'up to Essence × 3 corpses within range',
    description: 'The necromancer commands the dead to rise, animating up to (Essence × 3) skeletons or zombies from available remains within 50 yards. The undead horde fights for her as long as she concentrates, requiring a reflexive action each action to maintain. If she stops concentrating, the undead collapse. Each corpse animates with statistics appropriate to its species.',
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // NECROMANCY — Labyrinth Circle (circle 2)
  // ═══════════════════════════════════════════════════════════════════════════

  spell({
    uid: 'labyrinth-countermagic',
    name: 'Labyrinth Circle Countermagic',
    tradition: 'necromancy', circle: 2,
    costOpts: { motes: 20 },
    duration: 'instant',
    target: 'spell or necrotic working',
    description: 'Spending 20 motes reflexively, the necromancer dispels any Shadowlands or Labyrinth Circle working. Spending 30 motes she may attempt to counter Void Circle necromancy; both casters roll (Wits + Occult), and the higher total prevails. Workings of the Neverborn and entities from beyond Lethe cannot be countered by Labyrinth Countermagic.',
  }),

  spell({
    uid: 'labyrinth-lord-of-the-grave',
    name: 'Lord of the Grave',
    tradition: 'necromancy', circle: 2,
    costOpts: { motes: 25, willpower: 1 },
    duration: 'indefinite',
    target: 'one powerful ghost or revenant',
    description: 'The necromancer subjugates an Essence 4+ ghost, revenant, or ancestor spirit, binding it in absolute servitude. The bound dead retains its full personality and capabilities but must obey the necromancer\'s direct commands as if they were its deepest nature. It may not act against the necromancer or allow harm to come to her through inaction.',
  }),

  spell({
    uid: 'labyrinth-storm-of-the-ebon-dragon',
    name: 'Storm of the Ebon Dragon',
    tradition: 'necromancy', circle: 2,
    costOpts: { motes: 20 },
    duration: 'instant',
    target: 'all within 50 yards',
    description: 'The necromancer calls down a hurricane of Oblivion-aspected darkness. Every living creature within 50 yards suffers a 12A attack. The dead are unaffected. The storm also snuffs out all non-magical light sources and suppresses positive Essence for three ticks, preventing any life-aspected Essence use during that period.',
  }),

  spell({
    uid: 'labyrinth-tongue-of-the-void',
    name: 'Tongue of the Void',
    tradition: 'necromancy', circle: 2,
    costOpts: { motes: 20, willpower: 1 },
    duration: 'indefinite',
    target: 'one being',
    description: 'The necromancer carves a sliver of Oblivion into a target\'s soul. While the effect persists, the victim feels the constant tug of Oblivion, suffering a −2 internal penalty to all actions from existential despair. Each month the victim must succeed on (Wits + Integrity) at difficulty (caster\'s Essence) or lose one dot of a Virtue permanently as Oblivion erodes their sense of self.',
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // NECROMANCY — Void Circle (circle 3)
  // ═══════════════════════════════════════════════════════════════════════════

  spell({
    uid: 'void-countermagic',
    name: 'Void Circle Countermagic',
    tradition: 'necromancy', circle: 3,
    costOpts: { motes: 30 },
    duration: 'instant',
    target: 'necromantic working',
    description: 'The supreme countermagic of necromancy. Spending 30 motes reflexively, the necromancer unravels any Shadowlands, Labyrinth, or Void Circle working. Spending 50 motes she may attempt to counter workings of the Neverborn themselves; both parties roll (Wits + Occult) and the higher result prevails. Nothing known to Creation counters the Void itself.',
  }),

  spell({
    uid: 'void-damnation-of-lingering-pain',
    name: 'Damnation of Lingering Pain',
    tradition: 'necromancy', circle: 3,
    costOpts: { motes: 50, willpower: 1 },
    duration: 'indefinite',
    target: 'one victim',
    description: 'The necromancer cursed a target with suffering that transcends death itself. The victim suffers a recurring agony that inflicts −4 internal penalty to all actions and cannot be reduced by any pain-immunity effect. Even if the victim dies, their ghost inherits the curse. Only Void Circle countermagic or a direct petition to the Neverborn can lift this curse.',
  }),

  spell({
    uid: 'void-reclamation-of-the-dead',
    name: 'Reclamation of the Dead',
    tradition: 'necromancy', circle: 3,
    costOpts: { motes: 40, willpower: 1 },
    duration: 'permanent',
    target: 'one dead being',
    description: 'The necromancer tears a soul from Lethe or Oblivion and restores it to a prepared body, creating a potent Abyssal Exalted or powerful revenant under her permanent control. The returned being is not truly alive — it is undead with all attendant vulnerabilities — but retains all memories, skills, and personality from life. This ritual takes three days and requires a perfect preserved corpse.',
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // WEAVING — Man-Machine Protocol (circle 1)
  // ═══════════════════════════════════════════════════════════════════════════

  spell({
    uid: 'weaving-man-machine-countermagic',
    name: 'Weaving Countermagic (Man-Machine)',
    tradition: 'weaving', circle: 1,
    minimumClarity: 1,
    costOpts: { motes: 10 },
    duration: 'instant',
    target: 'weaving or construct-aspected effect',
    description: 'Spending 10 motes reflexively, the Alchemical dispels any Man-Machine Protocol working or lesser construct-aspected enchantment. Spending 20 motes she may attempt to counter a God-Machine Protocol effect; both casters roll (Wits + Occult), and the higher total prevails. God-Machine effects from fully awakened Divine Artificers cannot be countered by Man-Machine Countermagic.',
  }),

  spell({
    uid: 'weaving-awakening-the-soulless-shell',
    name: 'Awakening the Soulless Shell',
    tradition: 'weaving', circle: 1,
    minimumClarity: 1,
    costOpts: { motes: 15 },
    duration: 'one scene',
    target: 'one automaton',
    description: 'The Alchemical channels Man-Machine Protocol Essence into a constructed automaton, granting it temporary independent action. For the scene, the automaton operates intelligently under the Alchemical\'s general guidance, performing complex tasks without moment-to-moment control. It cannot learn or grow, but it executes its function with preternatural efficiency.',
  }),

  spell({
    uid: 'weaving-forge-of-iron-and-fire',
    name: 'Forge of Iron and Fire',
    tradition: 'weaving', circle: 1,
    minimumClarity: 1,
    costOpts: { motes: 15 },
    duration: 'instant',
    target: 'crafted object',
    description: 'The Alchemical channels Essence directly into a crafting project, completing work that would require weeks in a single scene. The resulting object is of Exceptional quality as a minimum. With a Clarity 3+ Alchemical casting this spell, the result is always Artifact quality. Raw materials must still be supplied; this spell cannot create matter from nothing.',
  }),

  spell({
    uid: 'weaving-knitting-the-brazen-frame',
    name: 'Knitting the Brazen Frame',
    tradition: 'weaving', circle: 1,
    minimumClarity: 1,
    costOpts: { motes: 10 },
    duration: 'instant',
    target: 'one construct or Alchemical',
    description: 'The Alchemical floods a construct or fellow Alchemical with healing Essence, repairing structural damage. The target heals (caster\'s Essence × 3) health levels of bashing damage, or (caster\'s Essence) levels of lethal. If used on an Alchemical, this heals damage to their chassis rather than organic tissue, bypassing natural healing limitations.',
  }),

  spell({
    uid: 'weaving-speak-with-the-machine-gods',
    name: 'Speak with the Machine Gods',
    tradition: 'weaving', circle: 1,
    minimumClarity: 1,
    costOpts: { motes: 10, willpower: 1 },
    duration: 'one scene',
    target: 'self',
    description: 'The Alchemical opens direct channels of communication with the machine-spirits and lesser gods of craft who inhabit Autochthonia. For the scene she may converse with any such entity willing to speak, ask questions about technical matters within their domain, and receive truthful answers. This cannot compel recalcitrant spirits to communicate.',
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // WEAVING — God-Machine Protocol (circle 2)
  // ═══════════════════════════════════════════════════════════════════════════

  spell({
    uid: 'weaving-god-machine-countermagic',
    name: 'Weaving Countermagic (God-Machine)',
    tradition: 'weaving', circle: 2,
    minimumClarity: 3,
    costOpts: { motes: 20 },
    duration: 'instant',
    target: 'weaving or construct-aspected effect',
    description: 'Spending 20 motes reflexively, the Alchemical dispels any Man-Machine or God-Machine Protocol working. Spending 30 motes she may attempt to counter workings of Autochthon himself or his Exarchs; both parties roll (Wits + Occult) and the higher result prevails. The direct will of Autochthon cannot be countered even by this working.',
  }),

  spell({
    uid: 'weaving-communion-of-the-divine-machinery',
    name: 'Communion of the Divine Machinery',
    tradition: 'weaving', circle: 2,
    minimumClarity: 3,
    costOpts: { motes: 25, willpower: 1 },
    duration: 'indefinite',
    target: 'one major structure or nation-district',
    description: 'The Alchemical bonds her Essence to the underlying machine-spirit of a great structure, factory-cathedral, or entire district of a metropolis. While bonded she perceives every person, process, and fault within the structure as if sensing her own body. She may redirect Essence flows, suppress Dissonance buildup, and issue commands to all lesser automata and machine-spirits within the area.',
  }),

  spell({
    uid: 'weaving-rewrite-the-holy-pattern',
    name: 'Rewrite the Holy Pattern',
    tradition: 'weaving', circle: 2,
    minimumClarity: 3,
    costOpts: { motes: 25, willpower: 1 },
    duration: 'permanent',
    target: 'one being or construct',
    description: 'The highest expression of God-Machine Protocol rewriting. The Alchemical permanently alters the fundamental Essence-pattern of a being, construct, or region — changing an automaton\'s function, removing a flaw from a factory-cathedral\'s design, or restructuring a nation-district\'s soul permanently. The change is irreversible without an equal or greater working. Casting takes one full week of ritual.',
  }),
];

// ── Write spell docs ──────────────────────────────────────────────────────────

for (const s of SPELLS) {
  const filename = `${s.system.spellUid}.json`;
  writeFileSync(join(OUT, filename), JSON.stringify(s, null, 2), 'utf-8');
}

console.log(`Written ${SPELLS.length} spells + ${TRADITIONS.length + Object.values(CIRCLES).flat().length} folder docs to ${OUT}/`);
