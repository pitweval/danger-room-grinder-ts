import { describe, expect, it, vi } from "vitest";

import {
  EncounterCompositionError,
  getEligibleEncounterFormations,
  selectEncounterFormation,
  type EncounterFormation,
} from "../../../src/encounter/index.js";
import { RandomGenerator } from "../../../src/rng/index.js";

const EXPECTED_FORMATIONS = [
  ["swarm", "Swarm", [["minion"]], 12],
  ["skirmishers", "Skirmishers", [["skirmisher"], ["minion"]], 10],
  ["front_line", "Front line", [["soldier"], ["minion"]], 10],
  ["brute_support", "Brute with support", [["brute"], ["minion"]], 8],
  ["leader_guards", "Leader with guards", [["leader"], ["soldier"], ["minion"]], 8],
  [
    "mixed_force",
    "Mixed force",
    [["leader"], ["brute"], ["skirmisher"], ["soldier"], ["minion"]],
    8,
  ],
] as const;

describe("getEligibleEncounterFormations", () => {
  it("returns the six ordinary Bash formations in source order", () => {
    expect(
      getEligibleEncounterFormations().map(({ id, name, roleSlots, maxCreatures }) => [
        id,
        name,
        roleSlots,
        maxCreatures,
      ]),
    ).toEqual(EXPECTED_FORMATIONS);
  });

  it("returns frozen formations, slots, and collection", () => {
    const formations = getEligibleEncounterFormations();

    expect(Object.isFrozen(formations)).toBe(true);
    expect(formations.every(Object.isFrozen)).toBe(true);
    expect(formations.every((formation) => Object.isFrozen(formation.roleSlots))).toBe(true);
    expect(formations.flatMap(({ roleSlots }) => roleSlots).every(Object.isFrozen)).toBe(true);
  });
});

describe("selectEncounterFormation", () => {
  it.each([
    [1, "swarm"],
    [4, "swarm"],
    [5, "skirmishers"],
    [8, "skirmishers"],
    [9, "front_line"],
    [12, "front_line"],
    [13, "brute_support"],
    [16, "brute_support"],
    [17, "leader_guards"],
    [19, "leader_guards"],
    [20, "mixed_force"],
  ])("maps d20 roll %i to %s", (roll, expectedId) => {
    const integer = vi.fn(() => roll);
    const result = selectEncounterFormation({ rng: { integer } });

    expect(result).toMatchObject({ roll, formation: { id: expectedId } });
    expect(integer).toHaveBeenCalledOnce();
    expect(integer).toHaveBeenCalledWith(1, 20);
  });

  it.each([
    [0, "leader_guards", 19],
    [1, "skirmishers", 8],
    [42, "leader_guards", 17],
    [8675309, "front_line", 11],
  ])("is reproducible for seed %i", (seed, expectedId, expectedRoll) => {
    expect(selectEncounterFormation({ rng: new RandomGenerator(seed) })).toMatchObject({
      roll: expectedRoll,
      formation: { id: expectedId },
    });
    expect(selectEncounterFormation({ rng: new RandomGenerator(seed) })).toMatchObject({
      roll: expectedRoll,
      formation: { id: expectedId },
    });
  });

  it.each(["leader_guards", "LEADER_GUARDS", "Leader-Guards", "Leader Guards"])(
    "normalizes explicit formation ID %s without consuming RNG",
    (requestedFormation) => {
      const integer = vi.fn(() => 1);
      const result = selectEncounterFormation({ rng: { integer }, requestedFormation });

      expect(result).toEqual({
        formation: getEligibleEncounterFormations()[4],
        roll: undefined,
      });
      expect(integer).not.toHaveBeenCalled();
    },
  );

  it("does not match display names independently", () => {
    expect(() =>
      selectEncounterFormation({
        rng: { integer: vi.fn(() => 1) },
        requestedFormation: "Brute with support",
      }),
    ).toThrow(/unknown.*brute with support/i);
  });

  it("selects the only formation when its range contains the roll", () => {
    const only: EncounterFormation = Object.freeze({
      id: "only",
      name: "Only",
      roleSlots: Object.freeze([Object.freeze(["soldier"])]),
      maxCreatures: 1,
      rollMinimum: 1,
      rollMaximum: 20,
    });

    expect(
      selectEncounterFormation({
        rng: { integer: vi.fn(() => 20) },
        formations: [only],
      }).formation,
    ).toBe(only);
  });

  it("rejects an empty formation candidate collection", () => {
    expect(() =>
      selectEncounterFormation({
        rng: { integer: vi.fn(() => 1) },
        formations: [],
      }),
    ).toThrow(EncounterCompositionError);
  });

  it("rejects a candidate set that cannot resolve the d20 roll", () => {
    const incomplete: EncounterFormation = Object.freeze({
      id: "only_one",
      name: "Only One",
      roleSlots: Object.freeze([Object.freeze(["soldier"])]),
      maxCreatures: 1,
      rollMinimum: 1,
      rollMaximum: 1,
    });

    expect(() =>
      selectEncounterFormation({
        rng: { integer: vi.fn(() => 2) },
        formations: [incomplete],
      }),
    ).toThrow(/no encounter formation.*roll 2/i);
  });
});
