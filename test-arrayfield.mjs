import { WeaponData } from "./module/data/item/weapon-data.mjs";

const schema = WeaponData.defineSchema();
const modesField = schema.modes;
console.log("modes field type:", modesField.constructor.name);
console.log("modes field properties:", Object.getOwnPropertyNames(modesField).slice(0, 30));
console.log("has .element:", modesField.element);
console.log("has .schema:", modesField.schema);
console.log("constructor check:", modesField._field ? "has _field" : "no _field");
if (modesField._field) {
  console.log("_field type:", modesField._field.constructor.name);
  console.log("_field properties:", Object.getOwnPropertyNames(modesField._field).slice(0, 20));
}
