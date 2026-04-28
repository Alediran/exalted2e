import { register } from "./cleanup.mjs";

/**
 * Create a real character Actor with stat overrides. All overrides are
 * sparse — unspecified stats use the "average human heroic" defaults.
 * The returned Actor is auto-registered for cleanup; tests don't need to
 * call register() themselves.
 *
 * `playerOwner: true` shadows the Actor's hasPlayerOwner getter on the
 * instance so tests of the player-defender knockdown branch work without
 * needing to provision a non-GM player user in the test world.
 */
export async function createTempCharacter({
  name = "Quench Character",
  str = 2, dex = 3, sta = 2,
  cha = 2, man = 2, app = 2,
  per = 2, intel = 2, wit = 2,
  ath = 2, res = 2,
  playerOwner = false
} = {}) {
  const actor = await Actor.create({
    name,
    type: "character",
    system: {
      attributes: {
        strength:     { value: str },  dexterity:    { value: dex },   stamina:    { value: sta },
        charisma:     { value: cha },  manipulation: { value: man },   appearance: { value: app },
        perception:   { value: per },  intelligence: { value: intel }, wits:       { value: wit }
      },
      abilities: {
        athletics:  { value: ath },
        resistance: { value: res }
      }
    }
  });
  register(actor);
  if (playerOwner) {
    Object.defineProperty(actor, "hasPlayerOwner", { value: true, configurable: true });
  }
  return actor;
}
