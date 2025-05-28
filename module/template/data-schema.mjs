const fields = foundry.data.fields;

export function attributeField(type, key) {
  return new fields.SchemaField({
    favored: new fields.BooleanField({ initial: false }),
    caste: new fields.BooleanField({ initial: false }),
    min: new fields.NumberField({ initial: 0 }),
    value: new fields.NumberField({ initial: 1 }),
    type: new fields.StringField({ initial: type }),
    upgrade: new fields.NumberField({ initial: 0 }),
  });
}

export function abilityField(prefAttribute) {
  return new fields.SchemaField({
    favored: new fields.BooleanField({ initial: false }),
    caste: new fields.BooleanField({ initial: false }),
    min: new fields.NumberField({ initial: 0 }),
    value: new fields.NumberField({ initial: 0 }),
    prefattribute: new fields.StringField({ initial: prefAttribute }),
  });
}

export function specialtyField(ability, name) {
  return new fields.SchemaField({
    parentAbility: new fields.StringField({ initial: ability }),
    label: new fields.StringField({ initial: name }),
    favored: new fields.BooleanField({ initial: false }),
    value: new fields.NumberField({ initial: 0 }),
  });
}

export function valueField(initial, max) {
  return new fields.SchemaField({
    min: new fields.NumberField({ initial: 0 }),
    value: new fields.NumberField({ initial, max }),
    max: new fields.NumberField({ initial: max }),
  });
}
export function resourceField(initial, max) {
  return new fields.SchemaField({
    min: new fields.NumberField({ initial: 0 }),
    value: new fields.NumberField({ initial, max }),
    max: new fields.NumberField({ initial: max }),
    temp: new fields.NumberField({ initial: 0 }),
  });
}
