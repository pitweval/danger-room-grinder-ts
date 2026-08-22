import { describe, expect, it, vi } from "vitest";

import type { FamilyCatalog } from "../../src/content/index.js";
import { createParty } from "../../src/encounter/index.js";
import { RandomGenerator } from "../../src/rng/index.js";
import {
  depthBandFor,
  depthDifficulty,
  generateOrdinaryRoom,
  RoomGenerationError,
} from "../../src/room/index.js";
import { TEST_BEHAVIOR_CATALOG } from "../encounter/behavior/fixtures.js";
import { monster, monsterCatalog } from "../encounter/monsters/fixtures.js";
import { ROOM_CATALOG, TREASURE_CATALOG } from "./fixtures.js";

const FAMILIES: FamilyCatalog = Object.freeze({
  families: Object.freeze([
    { id: "goblinoids", name: "Goblinoids", familyType: "PRIMARY", description: "Goblinoids." },
  ]),
});
const MONSTERS = monsterCatalog(
  monster("goblin", { xp: 50, roles: ["minion"], families: ["goblinoids"] }),
);

describe("ordinary room depth rules", () => {
  it.each([
    [1, "shallow"],
    [10, "shallow"],
    [11, "middle"],
    [50, "middle"],
    [51, "deep"],
    [200, "deep"],
    [201, "extreme"],
  ] as const)("maps room %i to %s", (room, expected) => expect(depthBandFor(room)).toBe(expected));
  it.each([
    ["shallow", 10, "low"],
    ["shallow", 11, "moderate"],
    ["shallow", 18, "moderate"],
    ["shallow", 19, "high"],
    ["middle", 4, "low"],
    ["middle", 5, "moderate"],
    ["middle", 13, "moderate"],
    ["middle", 14, "high"],
    ["deep", 1, "low"],
    ["deep", 2, "moderate"],
    ["deep", 8, "moderate"],
    ["deep", 9, "high"],
    ["extreme", 1, "high"],
    ["extreme", 20, "high"],
  ] as const)("maps %s roll %i to %s", (band, roll, expected) =>
    expect(depthDifficulty(band, roll)).toBe(expected),
  );
});

describe("generateOrdinaryRoom", () => {
  it("builds room context before embedding an environment-aware encounter", () => {
    const rng = recordingRng(10, 1, 1, 2, 1, 2, 2, 1, 1, 1, 1, 4, 1, 6, 6, 3);
    const room = generateOrdinaryRoom(baseOptions(rng));

    expect(room).toMatchObject({
      roomNumber: 1,
      title: "Dungeon Room 1",
      depthBand: "shallow",
      difficulty: "low",
      kind: "ordinary",
      neighborhood: { id: "subterranean-dungeon", name: "Subterranean Dungeon" },
      arrival: "Three steps rise.",
      doorway: "An oak door waits.",
      environment: { name: "Guard Post", engineEnvironment: "dungeon" },
      subtheme: { id: "stores" },
      encounterPreference: { family: "goblinoids", formation: "swarm" },
      hasHazard: true,
      hazard: { name: "Falling Net", severity: "nuisance" },
      suggestedSkillDcs: {
        difficulty: "low",
        checks: [
          { label: "Easy", dc: 5, asterisk: false },
          { label: "Moderate", dc: 10, asterisk: false },
          { label: "Hard", dc: 15, asterisk: false },
          { label: "Very Hard", dc: 20, asterisk: false },
          { label: "Nearly Impossible", dc: 25, asterisk: false },
        ],
        note: undefined,
      },
    });
    expect(room.features.map((value) => value.name)).toEqual(["Brazier", "Crates"]);
    expect(room.atmosphere.order).toEqual(["sound", "smell", "lighting"]);
    expect(room.exits.map((value) => value.name)).toEqual(["South", "East", "North"]);
    expect(room.encounter).toMatchObject({
      difficulty: "low",
      environment: "dungeon",
      xpBudget: 300,
      creatureCount: 6,
    });
    expect(room.encounter?.threat.roll).toBe(10);
    expect(rng.integer.mock.calls).toEqual([
      [1, 20],
      [1, 1],
      [1, 1],
      [1, 2],
      [1, 2],
      [1, 50],
      [1, 2],
      [1, 10],
      [1, 1],
      [1, 3],
      [1, 2],
      [1, 6],
      [1, 4],
      [1, 20],
      [1, 20],
      [1, 4],
    ]);
  });

  it("uses the active one-in-fifty signature branch and its authored features", () => {
    const room = generateOrdinaryRoom(
      baseOptions(recordingRng(10, 1, 1, 1, 1, 1, 1, 6, 1, 1), false),
    );
    expect(room.kind).toBe("signature");
    expect(room.environment.name).toBe("Impossible Geometry");
    expect(room.subtheme).toBeUndefined();
    expect(room.features.map((value) => value.name)).toEqual(["Turning Arch", "Tesseract"]);
    expect(room.rolls.subtheme).toBeUndefined();
  });

  it("classifies the active long-corridor branch without inventing corridor internals", () => {
    const room = generateOrdinaryRoom(
      baseOptions(recordingRng(10, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1), false),
    );
    expect(room.kind).toBe("long-corridor");
    expect(room.environment.name).toBe("Long Corridor");
  });

  it("supports encounter-free rooms and explicit overrides without irrelevant selection draws", () => {
    const rng = recordingRng(1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1);
    const room = generateOrdinaryRoom({
      ...baseOptions(rng, false),
      requestedDifficulty: "high",
      requestedFamily: "goblinoids",
      requestedFormation: "swarm",
      includeHazard: false,
      exitCount: 1,
    });
    expect(room.difficulty).toBe("high");
    expect(room.encounter).toBeUndefined();
    expect(room.hasHazard).toBe(false);
    expect(room.hazard).toBeUndefined();
    expect(room.rolls).toMatchObject({
      difficulty: undefined,
      family: undefined,
      formation: undefined,
      hazard: 1,
    });
    expect(rng.integer.mock.calls[0]).toEqual([1, 2]);
    expect(rng.integer.mock.calls.at(-2)).toEqual([1, 4]);
    expect(rng.integer.mock.calls.at(-1)).toEqual([1, 4]);
  });

  it("is reproducible and deeply immutable without mutating catalogs", () => {
    const options = baseOptions(new RandomGenerator(1010));
    const snapshot = structuredClone(ROOM_CATALOG);
    const first = generateOrdinaryRoom(options);
    const second = generateOrdinaryRoom(baseOptions(new RandomGenerator(1010)));
    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.features)).toBe(true);
    expect(Object.isFrozen(first.exits)).toBe(true);
    expect(Object.isFrozen(first.hazard)).toBe(true);
    expect(Object.isFrozen(first.suggestedSkillDcs)).toBe(true);
    expect(Object.isFrozen(first.suggestedSkillDcs.checks)).toBe(true);
    expect(Object.isFrozen(first.rolls)).toBe(true);
    expect(ROOM_CATALOG).toEqual(snapshot);
  });

  it("treats a depth-selected family as a preference and uses encounter fallback", () => {
    const blockedFamily = Object.freeze({
      id: "blocked",
      name: "Blocked",
      familyType: "PRIMARY" as const,
      description: "Has no monsters.",
    });
    const roomCatalog = Object.freeze({
      ...ROOM_CATALOG,
      depthFamilies: Object.freeze([
        Object.freeze({ depthBand: "shallow", neighborhoodId: "*", value: "blocked", weight: 1 }),
      ]),
    });
    const familyCatalog = Object.freeze({
      families: Object.freeze([blockedFamily, ...FAMILIES.families]),
    });
    const room = generateOrdinaryRoom({
      ...baseOptions(new RandomGenerator(77)),
      roomCatalog,
      familyCatalog,
    });

    expect(room.encounterPreference.family).toBe("blocked");
    expect(room.encounter?.family.id).toBe("goblinoids");
  });

  it("rejects an unusable explicitly forced family", () => {
    const blockedFamily = Object.freeze({
      id: "blocked",
      name: "Blocked",
      familyType: "PRIMARY" as const,
      description: "Has no monsters.",
    });
    expect(() =>
      generateOrdinaryRoom({
        ...baseOptions(new RandomGenerator(77)),
        familyCatalog: Object.freeze({
          families: Object.freeze([blockedFamily, ...FAMILIES.families]),
        }),
        requestedFamily: "blocked",
      }),
    ).toThrow(/Forced family "blocked"/);
  });

  it("rejects invalid room numbers and impossible exit counts", () => {
    expect(() => generateOrdinaryRoom({ ...baseOptions(recordingRng()), roomNumber: 0 })).toThrow(
      RoomGenerationError,
    );
    expect(() => generateOrdinaryRoom({ ...baseOptions(recordingRng()), exitCount: 5 })).toThrow(
      /Exit count/,
    );
  });
});

function baseOptions(
  rng: { integer: (minimum: number, maximum: number) => number } | RandomGenerator,
  includeEncounter = true,
) {
  return {
    roomNumber: 1,
    party: createParty(6, 1),
    roomCatalog: ROOM_CATALOG,
    monsterCatalog: MONSTERS,
    familyCatalog: FAMILIES,
    behaviorCatalog: TEST_BEHAVIOR_CATALOG,
    rng,
    roomSeed: 1010,
    treasureCatalog: TREASURE_CATALOG,
    includeEncounter,
  } as const;
}

function recordingRng(...rolls: readonly number[]) {
  let index = 0;
  return {
    integer: vi.fn((minimum: number, maximum: number) => {
      const value = rolls[index++];
      if (value === undefined) throw new Error(`Unexpected RNG draw ${index}.`);
      if (value < minimum || value > maximum)
        throw new Error(`Fixture roll ${value} is outside ${minimum}-${maximum}.`);
      return value;
    }),
  };
}
