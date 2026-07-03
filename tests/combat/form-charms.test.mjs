import { describe, it, expect, vi } from 'vitest';

vi.mock('../../module/documents/item.mjs', () => ({
  evaluateCharmFormula: (formula, _rollData, fallback = 0) => {
    if (formula === '' || formula == null) return fallback;
    const n = Number(formula);
    return isNaN(n) ? fallback : Math.floor(n);
  },
}));

vi.mock('../../module/helpers/charm-deactivation.mjs', () => ({
  initialRemainingActions: () => null,
}));

import { buildCharmSynthAEs } from '../../module/combat/form-charms.mjs';

function makeCharm(systemOverrides = {}) {
  return {
    id: 'c1',
    name: 'Test',
    img: 'icons/svg/aura.svg',
    effects: [],
    system: {
      duration: 'permanent',
      keywords: [],
      soakBonus:   { enabled: false, bashing: 0, lethal: 0, aggravated: 0, hardnessAdd: 0, options: [] },
      healthGrant: { enabled: false, options: [] },
      woundReduction: { enabled: false },
      statBoost:   { enabled: false },
      dvBonus:     { enabled: false },
      rateBonus:   { enabled: false },
      speedModifier: { enabled: false },
      moteRecovery:  { enabled: false },
      motePoolBonus: { enabled: false },
      extraActions:  { enabled: false },
      attackBonus:   { enabled: false },
      hazardImmunity:{ enabled: false },
      enhancesCharmUid: '',
      purchaseLevel: 1,
      ...systemOverrides,
    },
  };
}

// ─── soakBonus flat path (no options) ─────────────────────────────────────

describe('buildCharmSynthAEs soakBonus — flat values', () => {
  it('adds soak changes when soakBonus.enabled and no options', () => {
    const charm = makeCharm({ soakBonus: { enabled: true, bashing: 4, lethal: 3, aggravated: 0, hardnessAdd: 2, options: [] } });
    const aes = buildCharmSynthAEs(charm, {});
    expect(aes).toHaveLength(1);
    const changes = aes[0].changes;
    expect(changes).toContainEqual({ key: 'system.bonuses.soakBashing', type: 'add', value: '4' });
    expect(changes).toContainEqual({ key: 'system.bonuses.soakLethal',  type: 'add', value: '3' });
    expect(changes).toContainEqual({ key: 'system.bonuses.hardnessAdd', type: 'add', value: '2' });
  });

  it('returns empty array when soakBonus.enabled is false', () => {
    const charm = makeCharm({ soakBonus: { enabled: false, bashing: 4, lethal: 3, aggravated: 0, hardnessAdd: 0, options: [] } });
    expect(buildCharmSynthAEs(charm, {})).toHaveLength(0);
  });
});

// ─── soakBonus options path ───────────────────────────────────────────────

describe('buildCharmSynthAEs soakBonus — options path', () => {
  const OPTIONS = [
    { label: 'Subcutaneous', bashing: 3, lethal: 2, aggravated: 0, hardnessAdd: 1 },
    { label: 'Exoskeletal',  bashing: 4, lethal: 3, aggravated: 0, hardnessAdd: 2 },
  ];

  it('uses options[selectedOption=0] — Subcutaneous values', () => {
    const charm = makeCharm({
      soakBonus: { enabled: true, bashing: 0, lethal: 0, aggravated: 0, hardnessAdd: 0,
                   selectedOption: 0, options: OPTIONS },
    });
    const changes = buildCharmSynthAEs(charm, {})[0].changes;
    expect(changes).toContainEqual({ key: 'system.bonuses.soakBashing', type: 'add', value: '3' });
    expect(changes).toContainEqual({ key: 'system.bonuses.soakLethal',  type: 'add', value: '2' });
    expect(changes).toContainEqual({ key: 'system.bonuses.hardnessAdd', type: 'add', value: '1' });
  });

  it('uses options[selectedOption=1] — Exoskeletal values', () => {
    const charm = makeCharm({
      soakBonus: { enabled: true, bashing: 0, lethal: 0, aggravated: 0, hardnessAdd: 0,
                   selectedOption: 1, options: OPTIONS },
    });
    const changes = buildCharmSynthAEs(charm, {})[0].changes;
    expect(changes).toContainEqual({ key: 'system.bonuses.soakBashing', type: 'add', value: '4' });
    expect(changes).toContainEqual({ key: 'system.bonuses.soakLethal',  type: 'add', value: '3' });
    expect(changes).toContainEqual({ key: 'system.bonuses.hardnessAdd', type: 'add', value: '2' });
  });

  it('clamps out-of-range selectedOption to last valid index', () => {
    const charm = makeCharm({
      soakBonus: { enabled: true, bashing: 0, lethal: 0, aggravated: 0, hardnessAdd: 0,
                   selectedOption: 99, options: OPTIONS },
    });
    const changes = buildCharmSynthAEs(charm, {})[0].changes;
    // clamped to index 1 (Exoskeletal)
    expect(changes).toContainEqual({ key: 'system.bonuses.soakBashing', type: 'add', value: '4' });
  });

  it('ignores flat soak fields when options are present', () => {
    // flat bashing=99 should NOT appear; option values are used instead
    const charm = makeCharm({
      soakBonus: { enabled: true, bashing: 99, lethal: 99, aggravated: 0, hardnessAdd: 0,
                   selectedOption: 0, options: OPTIONS },
    });
    const changes = buildCharmSynthAEs(charm, {})[0].changes;
    expect(changes).toContainEqual({ key: 'system.bonuses.soakBashing', type: 'add', value: '3' });
    expect(changes).not.toContainEqual({ key: 'system.bonuses.soakBashing', type: 'add', value: '99' });
  });

  it('applies bashingFormula on top of option base value when formula is set', () => {
    // mock returns Math.floor(Number(formula)), so "6" → 6, overriding the option base of 3
    const charm = makeCharm({
      soakBonus: { enabled: true, bashing: 0, lethal: 0, aggravated: 0, hardnessAdd: 0,
                   bashingFormula: '6', selectedOption: 0, options: OPTIONS },
    });
    const changes = buildCharmSynthAEs(charm, {})[0].changes;
    expect(changes).toContainEqual({ key: 'system.bonuses.soakBashing', type: 'add', value: '6' });
  });
});
