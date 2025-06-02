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
