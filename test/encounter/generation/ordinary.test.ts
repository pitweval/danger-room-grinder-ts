import { describe, expect, it, vi } from "vitest";

import type { FamilyCatalog, FamilyDefinition, FamilyType } from "../../../src/content/index.js";
import {
  OrdinaryEncounterGenerationError,
  createParty,
  generateOrdinaryEncounter,
} from "../../../src/encounter/index.js";
import { RandomGenerator } from "../../../src/rng/index.js";
import { TEST_BEHAVIOR_CATALOG } from "../behavior/fixtures.js";
import { monster, monsterCatalog } from "../monsters/fixtures.js";

function family(id: string, familyType: FamilyType = "PRIMARY"): FamilyDefinition {
  return Object.freeze({ id, name: id.toUpperCase(), familyType, description: `${id} family.` });
}

function familyCatalog(...families: readonly FamilyDefinition[]): FamilyCatalog {
  return Object.freeze({ families: Object.freeze([...families]) });
}

function recordingRng(...rolls: readonly number[]) {
  let index = 0;
  const integer = vi.fn((minimum: number, maximum: number) => {
    const roll = rolls[index];
    if (roll === undefined) throw new Error(`Unexpected RNG draw ${index + 1}.`);
    if (roll < minimum || roll > maximum) {
      throw new Error(`Fixture roll ${roll} is outside ${minimum}-${maximum}.`);
    }
    index += 1;
    return roll;
  });
  return { integer };
}

describe("generateOrdinaryEncounter", () => {
  it("orchestrates threat, budget, family, formation, and composition", () => {
    const goblinoids = family("goblinoids");
    const goblin = monster("goblin", {
      xp: 50,
      roles: ["minion"],
      families: ["goblinoids"],
    });
    const rng = recordingRng(1, 1, 1, 1, 1);
    const result = generateOrdinaryEncounter({
      party: createParty(1, 1),
      monsterCatalog: monsterCatalog(goblin),
      familyCatalog: familyCatalog(goblinoids),
      behaviorCatalog: TEST_BEHAVIOR_CATALOG,
      rng,
    });

    expect(result.threat).toEqual({ roll: 1, difficulty: "low" });
    expect(result.difficulty).toBe("low");
    expect(result.xpBudget).toBe(50);
    expect(result.family).toBe(goblinoids);
    expect(result.formation.id).toBe("swarm");
    expect(result.entries).toEqual([{ monster: goblin, count: 1 }]);
    expect(result).toMatchObject({ xpSpent: 50, xpRemaining: 0, creatureCount: 1 });
    expect(result.formationExecution).toMatchObject({
      termination: "stalled-role-cycle",
      maxCreatures: 12,
    });
    expect(result.formationExecution.attempts[0]).toMatchObject({
      phase: "initial-pass",
      requestedRoles: ["minion"],
      selectedMonsterId: "goblin",
      outcome: "selected",
    });
    expect(result.familyAttempts).toEqual(["goblinoids"]);
    expect(result.failedFamilyAttempts).toEqual([]);
    expect(result.selectionRolls).toEqual({ family: 1, formation: 1 });
    expect(result.behaviorState).toMatchObject({
      behavior: { key: "humanoid_low" },
      disposition: { description: "Neutral" },
      alertnessModifier: 0,
      rolls: { behavior: 1, disposition: 1 },
    });
    expect(rng.integer.mock.calls).toEqual([
      [1, 20],
      [1, 1],
      [1, 20],
      [1, 20],
      [1, 20],
    ]);
  });

  it("keeps family, monster membership, formation, and XP accounting consistent", () => {
    const undead = family("undead");
    const skeleton = monster("skeleton", {
      xp: 50,
      roles: ["soldier", "minion"],
      families: ["undead"],
    });
    const result = generateOrdinaryEncounter({
      party: createParty(2, 1),
      monsterCatalog: monsterCatalog(skeleton),
      familyCatalog: familyCatalog(undead),
      behaviorCatalog: TEST_BEHAVIOR_CATALOG,
      rng: recordingRng(10, 1, 9, 1, 1),
    });

    expect(
      result.entries.every(({ monster: selected }) => selected.families.includes("undead")),
    ).toBe(true);
    expect(result.formation.id).toBe("front_line");
    expect(result.xpSpent + result.xpRemaining).toBe(result.xpBudget);
    expect(result.entries.reduce((total, entry) => total + entry.monster.xp * entry.count, 0)).toBe(
      result.xpSpent,
    );
  });

  it("is deeply immutable and does not mutate either catalog", () => {
    const beasts = family("beasts");
    const wolf = monster("wolf", { xp: 50, roles: ["minion"], families: ["beasts"] });
    const monsters = monsterCatalog(wolf);
    const families = familyCatalog(beasts);
    const monsterSnapshot = structuredClone(monsters);
    const familySnapshot = structuredClone(families);
    const result = generateOrdinaryEncounter({
      party: createParty(1, 1),
      monsterCatalog: monsters,
      familyCatalog: families,
      behaviorCatalog: TEST_BEHAVIOR_CATALOG,
      rng: recordingRng(1, 1, 1, 1, 1),
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.party)).toBe(true);
    expect(Object.isFrozen(result.threat)).toBe(true);
    expect(Object.isFrozen(result.entries)).toBe(true);
    expect(Object.isFrozen(result.familyAttempts)).toBe(true);
    expect(Object.isFrozen(result.failedFamilyAttempts)).toBe(true);
    expect(Object.isFrozen(result.selectionRolls)).toBe(true);
    expect(Object.isFrozen(result.formationExecution)).toBe(true);
    expect(Object.isFrozen(result.formationExecution.attempts)).toBe(true);
    expect(monsters).toEqual(monsterSnapshot);
    expect(families).toEqual(familySnapshot);
  });

  it("is reproducible for a fixed seed", () => {
    const undead = family("undead");
    const skeleton = monster("skeleton", {
      xp: 50,
      roles: ["soldier", "minion"],
      families: ["undead"],
    });
    const options = {
      party: createParty(4, 1),
      monsterCatalog: monsterCatalog(skeleton),
      familyCatalog: familyCatalog(undead),
      behaviorCatalog: TEST_BEHAVIOR_CATALOG,
    } as const;

    expect(generateOrdinaryEncounter({ ...options, rng: new RandomGenerator(1010) })).toEqual(
      generateOrdinaryEncounter({ ...options, rng: new RandomGenerator(1010) }),
    );
  });

  it("explicit family removes only the family RNG draw", () => {
    const constructs = family("constructs");
    const clockwork = monster("clockwork", {
      xp: 50,
      roles: ["minion"],
      families: ["constructs"],
    });
    const rng = recordingRng(1, 1, 1, 1);

    generateOrdinaryEncounter({
      party: createParty(1, 1),
      monsterCatalog: monsterCatalog(clockwork),
      familyCatalog: familyCatalog(constructs),
      behaviorCatalog: TEST_BEHAVIOR_CATALOG,
      requestedFamily: "Constructs",
      rng,
    });

    expect(rng.integer.mock.calls).toEqual([
      [1, 20],
      [1, 20],
      [1, 20],
      [1, 20],
    ]);
  });

  it("explicit formation removes only the formation RNG draw", () => {
    const constructs = family("constructs");
    const clockwork = monster("clockwork", {
      xp: 50,
      roles: ["minion"],
      families: ["constructs"],
    });
    const rng = recordingRng(1, 1, 1, 1);

    generateOrdinaryEncounter({
      party: createParty(1, 1),
      monsterCatalog: monsterCatalog(clockwork),
      familyCatalog: familyCatalog(constructs),
      behaviorCatalog: TEST_BEHAVIOR_CATALOG,
      requestedFormation: "swarm",
      rng,
    });

    expect(rng.integer.mock.calls).toEqual([
      [1, 20],
      [1, 1],
      [1, 20],
      [1, 20],
    ]);
  });

  it("both explicit selectors leave only the threat RNG draw", () => {
    const constructs = family("constructs");
    const clockwork = monster("clockwork", {
      xp: 50,
      roles: ["minion"],
      families: ["constructs"],
    });
    const rng = recordingRng(1, 1, 1);

    generateOrdinaryEncounter({
      party: createParty(1, 1),
      monsterCatalog: monsterCatalog(clockwork),
      familyCatalog: familyCatalog(constructs),
      behaviorCatalog: TEST_BEHAVIOR_CATALOG,
      requestedFamily: "constructs",
      requestedFormation: "swarm",
      rng,
    });

    expect(rng.integer.mock.calls).toEqual([
      [1, 20],
      [1, 20],
      [1, 20],
    ]);
  });

  it("passes the environment unchanged into composition", () => {
    const beasts = family("beasts");
    const seahorse = monster("seahorse", {
      xp: 0,
      cr: "0",
      roles: ["minion"],
      families: ["beasts"],
      tags: ["movement:swim"],
      requirements: ["terrain:water"],
    });
    const result = generateOrdinaryEncounter({
      party: createParty(1, 1),
      monsterCatalog: monsterCatalog(seahorse),
      familyCatalog: familyCatalog(beasts),
      behaviorCatalog: TEST_BEHAVIOR_CATALOG,
      environment: "water",
      requestedFormation: "swarm",
      rng: recordingRng(1, 1, 1, 1),
    });

    expect(result.entries).toEqual([{ monster: seahorse, count: 12 }]);
    expect(result.xpSpent).toBe(0);
  });
});

describe("generateOrdinaryEncounter family fallback", () => {
  it("advances the weighted roll to the next distinct family without another RNG draw", () => {
    const blocked = family("blocked");
    const viable = family("viable");
    const blockedSoldier = monster("blocked-soldier", {
      xp: 50,
      roles: ["soldier"],
      families: ["blocked"],
    });
    const viableMinion = monster("viable-minion", {
      xp: 50,
      roles: ["minion"],
      families: ["viable"],
      tags: ["movement:fly"],
    });
    const rng = recordingRng(1, 1, 1, 1, 1);
    const result = generateOrdinaryEncounter({
      party: createParty(1, 1),
      monsterCatalog: monsterCatalog(blockedSoldier, viableMinion),
      familyCatalog: familyCatalog(blocked, viable),
      behaviorCatalog: TEST_BEHAVIOR_CATALOG,
      familyWeights: { blocked: 2, viable: 1 },
      rng,
    });

    expect(result.family).toBe(viable);
    expect(result.familyAttempts).toEqual(["blocked", "viable"]);
    expect(result.failedFamilyAttempts).toEqual(["blocked"]);
    expect(result.formation.id).toBe("swarm");
    expect(result.behaviorState.behavior.key).toBe("flying_low");
    expect(result.behaviorState.rolls).toEqual({ behavior: 1, disposition: 1 });
    expect(rng.integer.mock.calls).toEqual([
      [1, 20],
      [1, 3],
      [1, 20],
      [1, 20],
      [1, 20],
    ]);
  });

  it("retains an explicit formation across multiple failed families", () => {
    const first = family("first");
    const second = family("second");
    const third = family("third");
    const result = generateOrdinaryEncounter({
      party: createParty(1, 1),
      monsterCatalog: monsterCatalog(
        monster("first-soldier", { xp: 50, roles: ["soldier"], families: ["first"] }),
        monster("second-soldier", { xp: 50, roles: ["soldier"], families: ["second"] }),
        monster("third-minion", { xp: 50, roles: ["minion"], families: ["third"] }),
      ),
      familyCatalog: familyCatalog(first, second, third),
      behaviorCatalog: TEST_BEHAVIOR_CATALOG,
      familyWeights: { first: 1, second: 1, third: 1 },
      requestedFormation: "swarm",
      rng: recordingRng(1, 1, 1, 1),
    });

    expect(result.familyAttempts).toEqual(["first", "second", "third"]);
    expect(result.failedFamilyAttempts).toEqual(["first", "second"]);
    expect(result.formation.id).toBe("swarm");
  });

  it("retries weighted families exactly as Bash, including revisits after wrapping", () => {
    const first = family("first");
    const second = family("second");

    expect(() =>
      generateOrdinaryEncounter({
        party: createParty(1, 1),
        monsterCatalog: monsterCatalog(
          monster("first-soldier", { xp: 50, roles: ["soldier"], families: ["first"] }),
          monster("second-soldier", { xp: 50, roles: ["soldier"], families: ["second"] }),
        ),
        familyCatalog: familyCatalog(first, second),
        behaviorCatalog: TEST_BEHAVIOR_CATALOG,
        familyWeights: { first: 2, second: 1 },
        requestedFormation: "swarm",
        rng: recordingRng(1, 1, 1, 1),
      }),
    ).toThrow(OrdinaryEncounterGenerationError);

    try {
      generateOrdinaryEncounter({
        party: createParty(1, 1),
        monsterCatalog: monsterCatalog(
          monster("first-soldier", { xp: 50, roles: ["soldier"], families: ["first"] }),
          monster("second-soldier", { xp: 50, roles: ["soldier"], families: ["second"] }),
        ),
        familyCatalog: familyCatalog(first, second),
        behaviorCatalog: TEST_BEHAVIOR_CATALOG,
        familyWeights: { first: 2, second: 1 },
        requestedFormation: "swarm",
        rng: recordingRng(1, 1, 1, 1),
      });
    } catch (error) {
      expect(error).toMatchObject({
        code: "FAMILY_FALLBACK_EXHAUSTED",
        familyAttempts: ["first", "second", "first"],
      });
    }
  });

  it("fails an unusable explicitly requested family immediately", () => {
    const blocked = family("blocked");
    const viable = family("viable");
    const rng = recordingRng(1, 1, 1);

    expect(() =>
      generateOrdinaryEncounter({
        party: createParty(1, 1),
        monsterCatalog: monsterCatalog(
          monster("blocked-soldier", { xp: 50, roles: ["soldier"], families: ["blocked"] }),
          monster("viable-minion", { xp: 50, roles: ["minion"], families: ["viable"] }),
        ),
        familyCatalog: familyCatalog(blocked, viable),
        behaviorCatalog: TEST_BEHAVIOR_CATALOG,
        requestedFamily: "blocked",
        requestedFormation: "swarm",
        rng,
      }),
    ).toThrow(/requested family.*blocked.*could not compose/i);
    expect(rng.integer.mock.calls).toEqual([
      [1, 20],
      [1, 20],
      [1, 20],
    ]);
  });

  it("respects an authored weight map during initial selection and fallback", () => {
    const absent = family("absent");
    const blocked = family("blocked");
    const viable = family("viable");
    const result = generateOrdinaryEncounter({
      party: createParty(1, 1),
      monsterCatalog: monsterCatalog(
        monster("absent-minion", { xp: 50, roles: ["minion"], families: ["absent"] }),
        monster("blocked-soldier", { xp: 50, roles: ["soldier"], families: ["blocked"] }),
        monster("viable-minion", { xp: 50, roles: ["minion"], families: ["viable"] }),
      ),
      familyCatalog: familyCatalog(absent, blocked, viable),
      behaviorCatalog: TEST_BEHAVIOR_CATALOG,
      familyWeights: { blocked: 1, viable: 1 },
      requestedFormation: "swarm",
      rng: recordingRng(1, 1, 1, 1),
    });

    expect(result.familyAttempts).toEqual(["blocked", "viable"]);
    expect(result.family.id).toBe("viable");
  });

  it("does not reinterpret invalid composition context as a family retry", () => {
    const blocked = family("blocked");

    expect(() =>
      generateOrdinaryEncounter({
        party: createParty(1, 1),
        monsterCatalog: monsterCatalog(
          monster("blocked-minion", { xp: 50, roles: ["minion"], families: ["blocked"] }),
        ),
        familyCatalog: familyCatalog(blocked),
        behaviorCatalog: TEST_BEHAVIOR_CATALOG,
        environment: "",
        rng: recordingRng(1, 1, 1, 1, 1),
      }),
    ).toThrow(/environment/i);
  });
});
