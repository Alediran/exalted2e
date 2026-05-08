#!/usr/bin/env node
// scripts/add-mop-spells.mjs
// Adds spells found in MoP books (Dragon-Blooded, Sidereals, Abyssals, Infernals)
// that are outside the standard White/Black Treatise sections.
// Run after parse-spells.mjs: node scripts/add-mop-spells.mjs

import { writeFileSync } from 'fs';
import { join } from 'path';

const OUT = 'src/packs/spells';

function deterministicId(str) {
  let h = 2166136261n;
  for (const c of str) { h ^= BigInt(c.charCodeAt(0)); h = BigInt.asUintN(32, h * 16777619n); }
  const lo = h.toString(16).padStart(8, '0');
  let h2 = h ^ 0xdeadbeefn; h2 = BigInt.asUintN(32, h2 * 16777619n);
  const hi = h2.toString(16).padStart(8, '0');
  return (hi + lo).slice(0, 16);
}

function stats() {
  return { coreVersion: '13', systemId: 'exalted2e', systemVersion: '1.0.0', createdTime: 0, modifiedTime: 0, lastModifiedBy: null };
}

const CIRCLES = {
  sorcery:   [{ circle: 1, label: 'Terrestrial Circle' }, { circle: 2, label: 'Celestial Circle' }, { circle: 3, label: 'Solar Circle' }],
  necromancy:[{ circle: 1, label: 'Shadowlands Circle' }, { circle: 2, label: 'Labyrinth Circle' }, { circle: 3, label: 'Void Circle' }],
};

const tradIds = {
  sorcery: deterministicId('folder-tradition-sorcery'),
  necromancy: deterministicId('folder-tradition-necromancy'),
};

function circleId(tradition, circle) {
  const label = CIRCLES[tradition][circle - 1].label;
  return deterministicId(`folder-${tradition}-${label}`);
}

function toUid(tradition, circle, name) {
  const circleLabel = CIRCLES[tradition][circle - 1].label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${circleLabel}-${slug}`;
}

function spell({ name, tradition, circle, motes, willpower = 0, lethal = 0, target, duration, description }) {
  const uid = toUid(tradition, circle, name);
  const id = deterministicId(`spell-${uid}`);
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
      minimumClarity: 0,
      cost: { motes, willpower, bashingHealth: 0, lethalHealth: lethal, aggravatedHealth: 0, xp: 0 },
      duration,
      target,
      description: `<p>${description}</p>`,
    },
    folder: circleId(tradition, circle),
    ownership: { default: 0 },
    flags: {},
  };
}

const SPELLS = [

  // ── Dragon-Blooded MoP ───────────────────────────────────────────────────────

  spell({
    name: "Sworn Brothers' Oath",
    tradition: 'sorcery', circle: 1,
    motes: 10, // + 1m per bound Exalt (variable, use base)
    target: 'Exalts to be bound',
    duration: 'permanent',
    description: "This Terrestrial Circle spell binds the Essences of a group of Exalts together to create a sworn brotherhood. The ritual takes one hour per pair, plus one hour per additional Exalt. The sorcerer need not be among those bound. Upon casting, the sorcerer's player rolls (Intelligence + Occult); successes create an Oathbond trait shared by all brotherhood members. Oathbond grants three benefits: Familiarity (members know each other's direction and rough distance), Devotion (each member gains a pool of dice equal to Oathbond, refreshed once per story, usable only to aid other members), and Loyalty (members must succeed on an extended Conviction roll at difficulty equal to Oathbond to take actions that knowingly harm a brother; each failure reduces Oathbond by one). The sorcerer may bind no more Dragon-Blooded than twice his Essence rating; an Exalt may only belong to one brotherhood. The Oathbond cannot exceed five times the Essence of the lowest-Essence member.",
  }),

  // ── Sidereals MoP ────────────────────────────────────────────────────────────

  spell({
    name: 'Gift of Knowledge',
    tradition: 'sorcery', circle: 2,
    motes: 25,
    target: 'Touched creature',
    duration: 'permanent',
    description: "This spell directly transfers knowledge from the sorcerer to the subject through an hour-long ritual during which both must remain in continuous physical contact. The sorcerer enters a deep trance as small points of light flow from caster to target. The spell can impart a specific memory, or provide full mechanical understanding of a trait — Attributes, Abilities, specialties, spells, Charms, or Combos. Using this spell eliminates all training time for the chosen trait, as long as the caster's rating in that trait exceeds the subject's. The subject must still pay the experience point cost; only one dot of any trait may be transferred per casting. Essence cannot be affected. The spell cannot grant access to traits otherwise unavailable to the subject: a mortal cannot learn Celestial Circle spells, and a Dragon-Blood cannot learn Sidereal Charms.",
  }),

  // ── Abyssals MoP ─────────────────────────────────────────────────────────────

  spell({
    name: 'Black Investiture',
    tradition: 'necromancy', circle: 2,
    motes: 20, // or 60m for talisman version
    target: 'One creature or one talisman',
    duration: 'indefinite (committed)',
    description: "The necromancer doubles over and coughs her control over all currently-commanded undead into her windpipe, then expels it with a great roar into a single target within 10 yards. She commits one mote to the target; as long as that mote remains committed, the target gains control of the specified undead for the same duration the necromancer would have retained them. For 40 additional motes (60 total), the necromancer may instead coalesce this control into a solid talisman the size of an acorn — anyone who holds the talisman receives the necromancer's command authority. The necromancer may withdraw her committed mote at any time to reclaim full control.",
  }),

  spell({
    name: 'Dimming of the Light',
    tradition: 'necromancy', circle: 3,
    motes: 80,
    target: 'One Solar Exaltation',
    duration: 'permanent',
    description: "This rite transforms a Solar Exalt into an Abyssal, performed only inside an Inauspicious Citadel or in the Labyrinth. The Solar must be inside the Monstrance of Celestial Portion and agree to the transformation, whether deliberately or because their will is broken. In a ceremony from dusk to midnight the Solar renounces the Unconquered Sun, formally curses each Charm she knows, and pledges fealty to the Neverborn. When the transformation occurs, the Solar's anima flares iconic as her caste shifts to its Abyssal analogue (Dawn to Dusk, etc.). Her caste mark turns black and streams blood. She loses all Solar Charms and gains an equivalent number of Abyssal Charms, loses all Combos, and may no longer access Solar Circle sorcery. The Great Curse recedes, replaced by Dark Fate.",
  }),

  spell({
    name: 'Call the Black Sun',
    tradition: 'necromancy', circle: 3,
    motes: 40,
    target: 'One Abyssal Exaltation',
    duration: 'permanent',
    description: "When an Abyssal Exaltation is left without a Monstrance, this spell retrieves and binds it. It requires a blank Monstrance, the name of the Exaltation's previous host, part of the previous host's body, and one additional arcane link. The ritual lasts from dusk to midnight. At the end, the lost Exaltation appears inside the Monstrance and is bound to it henceforth. If two necromancers simultaneously attempt to capture the same Exaltation, the one with higher Essence wins; ties go to higher Willpower; if still tied, each has an equal chance. The spell cannot function if the lost Exaltation is currently bound to a Monstrance.",
  }),

  // ── Infernals MoP ────────────────────────────────────────────────────────────

  spell({
    name: 'Slave-Spawn Summons',
    tradition: 'sorcery', circle: 1,
    motes: 20,
    target: 'One First Circle demon',
    duration: 'indefinite',
    description: "Infernal sorcerers only. This spell functions identically to Demon of the First Circle (Exalted core, pp. 252–253) but does not require a lengthy ritual — it may be accomplished within a normal Emerald Circle casting. The laws of fate and the Unconquered Sun's warding normally block this spell from Creation, Yu-Shan, and realms where the Loom holds sway, except for a single window at sunset each day. The spell functions in shadowlands but not the Underworld. Demons bound by another casting of Slave-Spawn Summons may be stolen away through an opposed roll contest; neither sorcerer may spend Essence on the contest, and stealing a demon does not remove the need for a second roll to bind it when it arrives. When the spell successfully binds a demon, it immediately develops an Intimacy of terrified awe toward the caster.",
  }),

  spell({
    name: 'Fiend-Vassal Conscription',
    tradition: 'sorcery', circle: 2,
    motes: 30,
    target: 'One Second Circle demon',
    duration: 'indefinite',
    description: "Infernal sorcerers only. The Sapphire Circle equivalent of Slave-Spawn Summons. Functions identically except the demon may only be summoned (without a ritual, as a basic Sapphire Circle casting) at twilight on the new moon or during Calibration. The demon travels through Elsewhere rather than Cecelyne and arrives at midnight with one Willpower drained by the journey. The cost to lower the demon's resistance pools during an ownership contest is 10 motes. The Intimacy created by a successful binding is based on either respect or hate (sorcerer's choice).",
  }),

  spell({
    name: 'All-Commanding Oversoul Beckoning',
    tradition: 'sorcery', circle: 3,
    motes: 40,
    target: 'One Third Circle demon',
    duration: 'one scene',
    description: "Infernal sorcerers only. The Adamant Circle equivalent of Slave-Spawn Summons. May be cast at sunset on the night of the new moon or any night of Calibration, requiring a ritual lasting until midnight. At that time, the targeted Third Circle demon teleports to the sorcerer's presence as a Blasphemy effect with severity equal to the demon's Essence. This cannot summon an already-bound demon, nor can the sorcerer bind the demon's will — though an irresistible Compulsion prevents the demon from knowingly harming the sorcerer until he attempts to harm it or until the first light of dawn. The demon's MDV is halved against the sorcerer during this period. Once the grace period ends, the demon may act as it sees fit.",
  }),

  spell({
    name: 'Universal Precept Shroud',
    tradition: 'sorcery', circle: 2,
    motes: 20,
    target: 'Caster',
    duration: 'indefinite',
    description: "The sorcerer makes the Mudra of Nirvishesha Shamed and whispers an obscenity mocking the cosmological shinma of identity. Until the caster is targeted by countermagic capable of breaking the spell, all spells she casts show no trace of Yozi warping — they appear to be standard sorcery of the appropriate circle. While this aids in subtlety, it carries a drawback: Yozi initiations ban certain types of spells that require warping of imagery to become acceptable to cast; Universal Precept Shroud prevents such warping, so normally-permissible spells may become unavailable. When an akuma with Essence 5+ casts this spell, it also cloaks their Yozi taint as a perfect Illusion, making them appear as though they had never fallen — only perfect detection such as Eye of the Unconquered Sun can penetrate it. Obvious Infernal Charms still drop the Illusion until the akuma's next action.",
  }),

  spell({
    name: 'Soul-Twisting Defilement Radiance',
    tradition: 'sorcery', circle: 3,
    motes: 50,
    target: 'Area within (Essence) miles',
    duration: 'indefinite (committed)',
    description: "The sorcerer begins casting at dawn and chants discordant hymns of praise to the Yozis throughout the day, committing the requisite motes for the full duration. The ritual ends at sunset, when serpentine shadows sparking with green fire strike every being within (Essence) miles. Creatures of darkness regain all spent Willpower from the surge of unholy Essence. Beings who are not creatures of darkness gain the 'creature of darkness' mutation as a Desecration effect and become natives of Malfeas; Essence users may spend one Willpower to resist this Shaping effect. The sorcerer may also inflict one derangement mutation of their choice on all newly-created creatures of darkness. Least gods always resist this effect automatically.",
  }),

  spell({
    name: "Spirit-Uplifting Mercy Halo",
    tradition: 'sorcery', circle: 3,
    motes: 50,
    target: 'Area within (Essence) miles',
    duration: 'indefinite (committed)',
    description: "Non-Infernal version of Soul-Twisting Defilement Radiance. Cast from dusk until dawn with paeans to the Unconquered Sun. Tongues of golden flames and lightning play about all those affected as a Holy effect. Natural creatures of darkness such as demons and ghosts within the radius suffer three levels of unsoakable aggravated damage. Beings who are not creatures of darkness regain all Willpower from sacred affirmation. Creatures of darkness within the radius who are not naturally so — such as those bearing the appropriate mutation — lose that status. Non-akuma Solars may explicitly cast this spell even if they have been marked as creatures of darkness.",
  }),

  spell({
    name: 'In Darkness Drowned',
    tradition: 'necromancy', circle: 3,
    motes: 50,
    target: 'Area within (Essence) miles',
    duration: 'indefinite (committed)',
    description: "Void Circle necromancy variant of Soul-Twisting Defilement Radiance. The necromancer chants mad glossolalia and requiems for the Neverborn throughout the day; at sunset barbed tentacles of shadow and pyre flame strike every being within (Essence) miles. Rather than making targets natives of Malfeas, it converts beings into creatures of death. Living beings made into creatures of death still respire the Essence of Creation rather than the Underworld until (Essence) years have passed carrying the creature of death mutation; removing that mutation before then restores their connection to living Essence.",
  }),

];

let count = 0;
for (const doc of SPELLS) {
  const filename = `${doc.system.spellUid}.json`;
  writeFileSync(join(OUT, filename), JSON.stringify(doc, null, 2), 'utf-8');
  console.log(`Written: ${doc.name} → ${filename}`);
  count++;
}
console.log(`\nAdded ${count} MoP spells to ${OUT}/`);
