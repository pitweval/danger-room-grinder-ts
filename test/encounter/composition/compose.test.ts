import { describe, expect, it } from "vitest";

import {
  EncounterCompositionError,
  composeEncounter,
  getEligibleEncounterFormations,
} from "../../../src/encounter/index.js";
import { TEST_FAMILY, monster, monsterCatalog } from "../monsters/fixtures.js";

function formation(id: string) {
  const selected = getEligibleEncounterFormations().find((candidate) => candidate.id === id);
  if (selected === undefined) throw new Error(`Missing test formation: ${id}`);
  return selected;
}

describe("composeEncounter", () => {
  it("repeats and aggregates one role until exact budget exhaustion", () => {
    const minion = monster("minion", { xp: 50, roles: ["minion"] });
    const result = composeEncounter({
      monsterCatalog: monsterCatalog(minion),
      family: TEST_FAMILY,
      formation: formation("swarm"),
      xpBudget: 200,
    });

    expect(result.entries).toEqual([{ monster: minion, count: 4 }]);
    expect(result).toMatchObject({ xpBudget: 200, xpSpent: 200, xpRemaining: 0 });
  });

  it("accepts an underfilled encounter when the next monster is too expensive", () => {
    const brute = monster("brute", { xp: 200, roles: ["brute"] });
    const minion = monster("minion", { xp: 100, roles: ["minion"] });
    const result = composeEncounter({
      monsterCatalog: monsterCatalog(brute, minion),
      family: TEST_FAMILY,
      formation: formation("brute_support"),
      xpBudget: 250,
    });

    expect(result.entries).toEqual([{ monster: brute, count: 1 }]);
    expect(result).toMatchObject({ xpSpent: 200, xpRemaining: 50 });
  });

  it("processes initial role slots in their fixed formation order", () => {
    const captain = monster("captain", { xp: 100, roles: ["leader", "soldier"] });
    const guard = monster("guard", { xp: 50, roles: ["soldier"] });
    const result = composeEncounter({
      monsterCatalog: monsterCatalog(captain, guard),
      family: TEST_FAMILY,
      formation: formation("leader_guards"),
      xpBudget: 150,
    });

    expect(result.entries).toEqual([
      { monster: captain, count: 1 },
      { monster: guard, count: 1 },
    ]);
  });

  it("does not reuse a multi-role leader in later slots", () => {
    const captain = monster("captain", { xp: 100, roles: ["leader", "soldier"] });
    const result = composeEncounter({
      monsterCatalog: monsterCatalog(captain),
      family: TEST_FAMILY,
      formation: formation("leader_guards"),
      xpBudget: 500,
    });

    expect(result.entries).toEqual([{ monster: captain, count: 1 }]);
    expect(result.xpRemaining).toBe(400);
  });

  it("allows repeated non-leaders while cycling role slots", () => {
    const brute = monster("brute", { xp: 100, roles: ["brute"] });
    const result = composeEncounter({
      monsterCatalog: monsterCatalog(brute),
      family: TEST_FAMILY,
      formation: formation("brute_support"),
      xpBudget: 400,
    });

    expect(result.entries).toEqual([{ monster: brute, count: 4 }]);
  });

  it("uses alternate roles within one slot", () => {
    const alternateFormation = Object.freeze({
      id: "alternate",
      name: "Alternate",
      roleSlots: Object.freeze([Object.freeze(["leader", "brute"] as const)]),
      maxCreatures: 1,
      rollMinimum: 0,
      rollMaximum: 0,
    });
    const brute = monster("brute", { roles: ["brute"] });

    expect(
      composeEncounter({
        monsterCatalog: monsterCatalog(brute),
        family: TEST_FAMILY,
        formation: alternateFormation,
        xpBudget: 100,
      }).entries,
    ).toEqual([{ monster: brute, count: 1 }]);
  });

  it("respects minion eligibility during composition", () => {
    const barred = monster("barred", {
      xp: 100,
      roles: ["soldier", "minion"],
      minionEligible: false,
    });

    expect(() =>
      composeEncounter({
        monsterCatalog: monsterCatalog(barred),
        family: TEST_FAMILY,
        formation: formation("swarm"),
        xpBudget: 100,
      }),
    ).toThrow(/no monsters.*swarm/i);
  });

  it("does not apply Boss eligibility to ordinary formations", () => {
    const ordinaryOnly = monster("ordinary-only", {
      roles: ["minion"],
      bossEligible: false,
    });

    expect(
      composeEncounter({
        monsterCatalog: monsterCatalog(ordinaryOnly),
        family: TEST_FAMILY,
        formation: formation("swarm"),
        xpBudget: 100,
      }).entries,
    ).toEqual([{ monster: ordinaryOnly, count: 1 }]);
  });

  it("uses inherited XP, suitability, and ID ranking for every slot", () => {
    const zeta = monster("zeta", { xp: 100, roles: ["minion"] });
    const alpha = monster("alpha", { xp: 100, roles: ["minion"] });
    const swimmer = monster("swimmer", {
      xp: 100,
      roles: ["minion"],
      tags: ["movement:swim"],
    });

    expect(
      composeEncounter({
        monsterCatalog: monsterCatalog(zeta, alpha, swimmer),
        family: TEST_FAMILY,
        formation: formation("swarm"),
        xpBudget: 100,
        environment: "water",
      }).entries,
    ).toEqual([{ monster: swimmer, count: 1 }]);
  });

  it("aggregates entries in monster catalog order, matching Bash output order", () => {
    const minion = monster("minion", { xp: 50, roles: ["minion"] });
    const brute = monster("brute", { xp: 100, roles: ["brute"] });
    const result = composeEncounter({
      monsterCatalog: monsterCatalog(minion, brute),
      family: TEST_FAMILY,
      formation: formation("brute_support"),
      xpBudget: 250,
    });

    expect(result.entries).toEqual([
      { monster: minion, count: 1 },
      { monster: brute, count: 2 },
    ]);
  });

  it("caps repeated suitable zero-XP creatures and terminates", () => {
    const vermin = monster("vermin", { xp: 0, cr: "0", roles: ["minion"] });
    const result = composeEncounter({
      monsterCatalog: monsterCatalog(vermin),
      family: TEST_FAMILY,
      formation: formation("swarm"),
      xpBudget: 0,
    });

    expect(result.entries).toEqual([{ monster: vermin, count: 12 }]);
    expect(result).toMatchObject({ xpSpent: 0, xpRemaining: 0, creatureCount: 12 });
  });

  it("fails only when no role slot can select any monster", () => {
    let captured: unknown;

    try {
      composeEncounter({
        monsterCatalog: monsterCatalog(monster("soldier", { roles: ["soldier"] })),
        family: TEST_FAMILY,
        formation: formation("swarm"),
        xpBudget: 100,
      });
    } catch (error) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(EncounterCompositionError);
    expect(captured).toMatchObject({
      code: "NO_MONSTERS_SELECTED",
      familyId: "test_family",
      formationId: "swarm",
    });
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid XP budget %s as a composition-domain error",
    (xpBudget) => {
      expect(() =>
        composeEncounter({
          monsterCatalog: monsterCatalog(monster("minion", { roles: ["minion"] })),
          family: TEST_FAMILY,
          formation: formation("swarm"),
          xpBudget,
        }),
      ).toThrow(EncounterCompositionError);
    },
  );

  it("rejects an empty role slot instead of broadening it to every role", () => {
    const invalidFormation = Object.freeze({
      id: "invalid",
      name: "Invalid",
      roleSlots: Object.freeze([Object.freeze([])]),
      maxCreatures: 1,
      rollMinimum: 0,
      rollMaximum: 0,
    });

    expect(() =>
      composeEncounter({
        monsterCatalog: monsterCatalog(monster("candidate")),
        family: TEST_FAMILY,
        formation: invalidFormation,
        xpBudget: 100,
      }),
    ).toThrow(/empty role slot/i);
  });

  it("returns deeply immutable output without modifying its inputs", () => {
    const minion = monster("minion", { roles: ["minion"] });
    const catalog = monsterCatalog(minion);
    const selectedFormation = formation("swarm");
    const catalogSnapshot = structuredClone(catalog);
    const familySnapshot = structuredClone(TEST_FAMILY);
    const result = composeEncounter({
      monsterCatalog: catalog,
      family: TEST_FAMILY,
      formation: selectedFormation,
      xpBudget: 100,
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.entries)).toBe(true);
    expect(result.entries.every(Object.isFrozen)).toBe(true);
    expect(catalog).toEqual(catalogSnapshot);
    expect(TEST_FAMILY).toEqual(familySnapshot);
    expect(result.formation).toBe(selectedFormation);
    expect(result.family).toBe(TEST_FAMILY);
  });
});
