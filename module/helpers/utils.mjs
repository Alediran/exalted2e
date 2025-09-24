export function getValue(obj, path) {
  return path.reduce(
    (acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined),
    obj
  );
}

export function parseCounterStates(states) {
  return states.split(",").reduce((obj, state) => {
    const [k, v] = state.split(":");
    obj[k] = v;
    return obj;
  }, {});
}

export function cleanCasteAbilities(data) {
  data.abilities.archery.caste = false;
  data.abilities.martialarts.caste = false;
  data.abilities.melee.caste = false;
  data.abilities.thrown.caste = false;
  data.abilities.war.caste = false;
  data.abilities.integrity.caste = false;
  data.abilities.performance.caste = false;
  data.abilities.presence.caste = false;
  data.abilities.resistance.caste = false;
  data.abilities.survival.caste = false;
  data.abilities.craft.caste = false;
  data.abilities.investigation.caste = false;
  data.abilities.lore.caste = false;
  data.abilities.medicine.caste = false;
  data.abilities.occult.caste = false;
  data.abilities.athletics.caste = false;
  data.abilities.awareness.caste = false;
  data.abilities.dodge.caste = false;
  data.abilities.larceny.caste = false;
  data.abilities.stealth.caste = false;
  data.abilities.bureaucracy.caste = false;
  data.abilities.linguistics.caste = false;
  data.abilities.ride.caste = false;
  data.abilities.sail.caste = false;
  data.abilities.socialize.caste = false;
}
