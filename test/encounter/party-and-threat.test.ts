import { describe, expect, it, vi } from "vitest";

import {
  EncounterValidationError,
  createParty,
  rollEncounterThreat,
  type EncounterDifficulty,
} from "../../src/encounter/index.js";
import { RandomGenerator } from "../../src/rng/index.js";

describe("createParty", () => {
  it.each([
    [1, 1],
    [6, 10],
    [10, 20],
  ])("creates an immutable %i-character level-%i party", (characterCount, characterLevel) => {
    const party = createParty(characterCount, characterLevel);

    expect(party).toEqual({ characterCount, characterLevel });
    expect(Object.isFrozen(party)).toBe(true);
  });

  it.each([
    [0, 1],
    [-1, 1],
    [11, 1],
    [1.5, 1],
    [Number.NaN, 1],
  ])("rejects invalid character count %s", (characterCount, characterLevel) => {
    expect(() => createParty(characterCount, characterLevel)).toThrow(
      new EncounterValidationError(
        "characterCount",
        characterCount,
        "an integer from 1 through 10",
      ),
    );
  });

  it.each([
    [1, 0],
    [1, -1],
    [1, 21],
    [1, 2.5],
    [1, Number.POSITIVE_INFINITY],
  ])("rejects invalid character level %s", (characterCount, characterLevel) => {
    expect(() => createParty(characterCount, characterLevel)).toThrow(
      new EncounterValidationError(
        "characterLevel",
        characterLevel,
        "an integer from 1 through 20",
      ),
    );
  });
});

describe("rollEncounterThreat", () => {
  it.each([
    [1, "low"],
    [4, "low"],
    [5, "low"],
    [6, "moderate"],
    [14, "moderate"],
    [15, "moderate"],
    [16, "high"],
    [19, "high"],
    [20, "high"],
  ] satisfies readonly (readonly [number, EncounterDifficulty])[])(
    "maps a threat roll of %i to %s",
    (roll, difficulty) => {
      const rng = new RandomGenerator(1);
      const integer = vi.spyOn(rng, "integer").mockReturnValue(roll);
      const threat = rollEncounterThreat(rng);

      expect(threat).toEqual({ roll, difficulty });
      expect(Object.isFrozen(threat)).toBe(true);
      expect(integer).toHaveBeenCalledOnce();
      expect(integer).toHaveBeenCalledWith(1, 20);
    },
  );

  it.each([
    [0, { roll: 19, difficulty: "high" }],
    [1, { roll: 8, difficulty: "moderate" }],
    [42, { roll: 17, difficulty: "high" }],
    [8675309, { roll: 11, difficulty: "moderate" }],
  ] as const)("is deterministic for seed %i", (seed, expected) => {
    expect(rollEncounterThreat(new RandomGenerator(seed))).toEqual(expected);
    expect(rollEncounterThreat(new RandomGenerator(seed))).toEqual(expected);
  });
});
