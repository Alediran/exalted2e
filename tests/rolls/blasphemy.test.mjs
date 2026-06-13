import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";
import { postBlasphemyAlert, rollBlasphemySensing } from "../../module/rolls/blasphemy.mjs";
import { ExaltedRoll } from "../../module/rolls/exalted-roll.mjs";

vi.mock("../../module/rolls/exalted-roll.mjs", () => ({
  ExaltedRoll: {
    rollPool: vi.fn().mockResolvedValue({ successes: 5 })
  }
}));

// ── test environment setup ────────────────────────────────────────────────────

const mockActor = {
  id:     "infernal-1",
  name:   "The Raging Infernal",
  system: { essence: { value: 3 } },
};

const mockCharm = {
  name: "The Ebon Dragon's Laughter",
  img:  "icons/charm.png",
};

beforeAll(() => {
  globalThis.canvas = { scene: { name: "Test Scene", tokens: { contents: [] } } };
  game.users = { filter: vi.fn().mockReturnValue([{ id: "gm-1" }]) };
});

beforeEach(() => {
  vi.clearAllMocks();
  ExaltedRoll.rollPool.mockResolvedValue({ successes: 5 });
  game.users.filter.mockReturnValue([{ id: "gm-1" }]);
  globalThis.canvas = { scene: { name: "Test Scene", tokens: { contents: [] } } };
});

// ── postBlasphemyAlert ────────────────────────────────────────────────────────

describe("postBlasphemyAlert", () => {
  it("calls ChatMessage.create", async () => {
    await postBlasphemyAlert(mockActor, mockCharm);
    expect(ChatMessage.create).toHaveBeenCalled();
  });

  it("whispers to GMs from game.users.filter", async () => {
    await postBlasphemyAlert(mockActor, mockCharm);
    const callArg = ChatMessage.create.mock.calls[0][0];
    expect(callArg.whisper).toEqual(["gm-1"]);
  });

  it("difficulty is max(1, 10 - essence)", async () => {
    await postBlasphemyAlert(mockActor, mockCharm);
    expect(foundry.applications.handlebars.renderTemplate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ difficulty: 7 }) // max(1, 10-3)
    );
  });

  it("clamps minimum difficulty to 1", async () => {
    const highEssenceActor = { ...mockActor, system: { essence: { value: 10 } } };
    await postBlasphemyAlert(highEssenceActor, mockCharm);
    expect(foundry.applications.handlebars.renderTemplate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ difficulty: 1 }) // max(1, 10-10) = 1
    );
  });

  it("passes actor name and charm info to the template", async () => {
    await postBlasphemyAlert(mockActor, mockCharm);
    expect(foundry.applications.handlebars.renderTemplate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        infernalName: "The Raging Infernal",
        charmName:    "The Ebon Dragon's Laughter",
        infernalId:   "infernal-1",
      })
    );
  });

  it("passes sceneName from canvas.scene.name", async () => {
    canvas.scene.name = "Realm of Malfeas";
    await postBlasphemyAlert(mockActor, mockCharm);
    expect(foundry.applications.handlebars.renderTemplate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ sceneName: "Realm of Malfeas" })
    );
  });

  it("defaults sceneName to empty string when canvas.scene is null", async () => {
    globalThis.canvas = { scene: null };
    await postBlasphemyAlert(mockActor, mockCharm);
    expect(foundry.applications.handlebars.renderTemplate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ sceneName: "" })
    );
  });
});

// ── rollBlasphemySensing ──────────────────────────────────────────────────────

function makeCelestialToken(type, id, perception = 3, occult = 2) {
  return {
    actor: {
      id,
      name:   `${type} Celestial`,
      type:   "character",
      system: {
        exaltType:  type,
        attributes: { perception: { value: perception } },
        abilities:  { occult:     { value: occult } },
      },
    }
  };
}

describe("rollBlasphemySensing – no celestials", () => {
  it("posts 'no celestials' message when scene has no tokens", async () => {
    canvas.scene.tokens.contents = [];
    await rollBlasphemySensing("infernal-1", 3);
    expect(ChatMessage.create).toHaveBeenCalled();
    const content = ChatMessage.create.mock.calls[0][0].content;
    expect(content).toContain("EX2E.BlasphemyNoCelestials");
  });

  it("does not call ExaltedRoll.rollPool when no celestials", async () => {
    canvas.scene.tokens.contents = [];
    await rollBlasphemySensing("infernal-1", 3);
    expect(ExaltedRoll.rollPool).not.toHaveBeenCalled();
  });

  it("filters out the infernal actor itself by id", async () => {
    canvas.scene.tokens.contents = [makeCelestialToken("solar", "infernal-1")];
    await rollBlasphemySensing("infernal-1", 3);
    expect(ExaltedRoll.rollPool).not.toHaveBeenCalled();
  });

  it("filters out non-celestial exalt types", async () => {
    canvas.scene.tokens.contents = [
      makeCelestialToken("dragonblooded", "dbt-1"),
      makeCelestialToken("infernal", "inf-2"),
    ];
    await rollBlasphemySensing("infernal-1", 3);
    // No rolls — neither is a CELESTIAL_TYPES member
    expect(ExaltedRoll.rollPool).not.toHaveBeenCalled();
  });
});

describe("rollBlasphemySensing – with celestials", () => {
  it("calls ExaltedRoll.rollPool once per celestial", async () => {
    canvas.scene.tokens.contents = [
      makeCelestialToken("solar",    "solar-1"),
      makeCelestialToken("lunar",    "lunar-1"),
      makeCelestialToken("sidereal", "sid-1"),
    ];
    await rollBlasphemySensing("infernal-1", 3);
    expect(ExaltedRoll.rollPool).toHaveBeenCalledTimes(3);
  });

  it("passes correct pool (perception + occult) to rollPool", async () => {
    canvas.scene.tokens.contents = [makeCelestialToken("solar", "solar-1", 4, 3)];
    await rollBlasphemySensing("infernal-1", 3);
    expect(ExaltedRoll.rollPool.mock.calls[0][1].pool).toBe(7); // 4 + 3
  });

  it("includes abyssal exalt type as celestial", async () => {
    canvas.scene.tokens.contents = [makeCelestialToken("abyssal", "aby-1")];
    await rollBlasphemySensing("infernal-1", 3);
    expect(ExaltedRoll.rollPool).toHaveBeenCalledTimes(1);
  });

  it("posts a result ChatMessage per celestial", async () => {
    canvas.scene.tokens.contents = [
      makeCelestialToken("solar", "solar-1"),
      makeCelestialToken("abyssal", "aby-1"),
    ];
    await rollBlasphemySensing("infernal-1", 3);
    // 2 rolls = 2 result messages
    expect(ChatMessage.create).toHaveBeenCalledTimes(2);
  });

  it("difficulty is max(1, 10 - essence)", async () => {
    canvas.scene.tokens.contents = [makeCelestialToken("solar", "solar-1")];
    await rollBlasphemySensing("infernal-1", 5);
    // difficulty = max(1, 10-5) = 5
    // successes = 5, 5 >= 5 → success
    const content = ChatMessage.create.mock.calls[0][0].content;
    expect(content).toContain("EX2E.BlasphemySensingSuccess");
  });

  it("posts failure message when successes < difficulty", async () => {
    ExaltedRoll.rollPool.mockResolvedValue({ successes: 2 });
    canvas.scene.tokens.contents = [makeCelestialToken("solar", "solar-1")];
    await rollBlasphemySensing("infernal-1", 3);
    // difficulty = max(1, 10-3) = 7; 2 < 7 → failure
    const content = ChatMessage.create.mock.calls[0][0].content;
    expect(content).toContain("EX2E.BlasphemySensingFailure");
  });

  it("posts success message when successes >= difficulty", async () => {
    ExaltedRoll.rollPool.mockResolvedValue({ successes: 8 });
    canvas.scene.tokens.contents = [makeCelestialToken("solar", "solar-1")];
    await rollBlasphemySensing("infernal-1", 3);
    // difficulty = 7; 8 >= 7 → success
    const content = ChatMessage.create.mock.calls[0][0].content;
    expect(content).toContain("EX2E.BlasphemySensingSuccess");
  });
});
