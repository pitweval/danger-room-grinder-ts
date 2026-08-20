import { describe, expect, it } from "vitest";

import {
  composeEncounter,
  getEligibleEncounterFormations,
  type EncounterFormation,
} from "../../../src/encounter/index.js";
import type { MonsterRole } from "../../../src/content/index.js";
import { TEST_FAMILY, monster, monsterCatalog } from "../monsters/fixtures.js";

function formation(id: string): EncounterFormation {
  const selected = getEligibleEncounterFormations().find((candidate) => candidate.id === id);
  if (selected === undefined) throw new Error(`Missing test formation: ${id}`);
  return selected;
}

const FORMATION_SEMANTICS = [
  ["swarm", [["minion"]], 12],
  ["skirmishers", [["skirmisher"], ["minion"]], 10],
  ["front_line", [["soldier"], ["minion"]], 10],
  ["brute_support", [["brute"], ["minion"]], 8],
  ["leader_guards", [["leader"], ["soldier"], ["minion"]], 8],
  ["mixed_force", [["leader"], ["brute"], ["skirmisher"], ["soldier"], ["minion"]], 8],
] as const satisfies readonly (readonly [string, readonly (readonly MonsterRole[])[], number])[];

describe("ordinary formation execution semantics", () => {
  it.each(FORMATION_SEMANTICS)(
    "%s executes its source-ordered initial role pass and formation-specific cap",
    (id, roleSlots, maxCreatures) => {
      const candidates = [
        monster("role-leader", { xp: 0, roles: ["leader"] }),
        monster("role-brute", { xp: 0, roles: ["brute"] }),
        monster("role-skirmisher", { xp: 0, roles: ["skirmisher"] }),
        monster("role-soldier", { xp: 0, roles: ["soldier"] }),
        monster("role-minion", { xp: 0, roles: ["minion"] }),
      ];
      const result = composeEncounter({
        monsterCatalog: monsterCatalog(...candidates),
        family: TEST_FAMILY,
        formation: formation(id),
        xpBudget: 0,
      });
      const initialAttempts = result.formationExecution.attempts.filter(
        ({ phase }) => phase === "initial-pass",
      );

      expect(initialAttempts.map(({ requestedRoles }) => requestedRoles)).toEqual(roleSlots);
      expect(initialAttempts.every(({ outcome }) => outcome === "selected")).toBe(true);
      expect(result.creatureCount).toBe(maxCreatures);
      expect(result.formationExecution).toMatchObject({
        termination: "creature-cap",
        maxCreatures,
      });
    },
  );

  it.each(FORMATION_SEMANTICS)(
    "%s treats earlier missing roles as optional and continues to a later satisfiable role",
    (id, roleSlots) => {
      const lastRole = roleSlots.at(-1)?.[0] as MonsterRole;
      const candidate = monster(`${id}-candidate`, { xp: 50, roles: [lastRole] });
      const result = composeEncounter({
        monsterCatalog: monsterCatalog(candidate),
        family: TEST_FAMILY,
        formation: formation(id),
        xpBudget: 50,
      });

      expect(result.entries).toEqual([{ monster: candidate, count: 1 }]);
      expect(result.formationExecution.attempts.some(({ outcome }) => outcome === "selected")).toBe(
        true,
      );
      expect(result.formationExecution.termination).toBe("stalled-role-cycle");
    },
  );
});

describe("DRG-TS-010 review regressions", () => {
  it.each([
    ["Hobgoblin", "hobgoblin", 100],
    ["Animated Flying Sword", "animated-flying-sword", 50],
  ])("explains brute_support made entirely from %s", (_name, id, xp) => {
    const candidate = monster(id, { xp, roles: ["soldier", "minion"] });
    const budget = xp * 6;
    const result = composeEncounter({
      monsterCatalog: monsterCatalog(candidate),
      family: TEST_FAMILY,
      formation: formation("brute_support"),
      xpBudget: budget,
    });

    expect(result.entries).toEqual([{ monster: candidate, count: 6 }]);
    expect(result.xpSpent).toBe(budget);
    expect(
      result.formationExecution.attempts
        .filter(({ requestedRoles }) => requestedRoles.includes("brute"))
        .every(({ outcome }) => outcome === "no-candidate"),
    ).toBe(true);
    expect(
      result.formationExecution.attempts.filter(
        ({ selectedMonsterId }) => selectedMonsterId === id,
      ),
    ).toHaveLength(6);
  });

  it("retains undead leader_guards pick order before catalog-order aggregation", () => {
    const shadow = monster("shadow", { xp: 100, roles: ["minion"] });
    const skeleton = monster("skeleton", { xp: 50, roles: ["minion"] });
    const willOWisp = monster("will-o-wisp", {
      xp: 450,
      roles: ["soldier", "skirmisher"],
    });
    const result = composeEncounter({
      monsterCatalog: monsterCatalog(shadow, skeleton, willOWisp),
      family: TEST_FAMILY,
      formation: formation("leader_guards"),
      xpBudget: 600,
    });

    expect(result.entries).toEqual([
      { monster: shadow, count: 1 },
      { monster: skeleton, count: 1 },
      { monster: willOWisp, count: 1 },
    ]);
    expect(
      result.formationExecution.attempts.flatMap(({ selectedMonsterId }) =>
        selectedMonsterId === undefined ? [] : [selectedMonsterId],
      ),
    ).toEqual(["will-o-wisp", "shadow", "skeleton"]);
    expect(result.xpSpent).toBe(600);
  });

  it("accepts one Priest after front_line's later minion attempts fail", () => {
    const priest = monster("priest", { xp: 450, roles: ["soldier"] });
    const result = composeEncounter({
      monsterCatalog: monsterCatalog(priest),
      family: TEST_FAMILY,
      formation: formation("front_line"),
      xpBudget: 450,
    });

    expect(result.entries).toEqual([{ monster: priest, count: 1 }]);
    expect(result.formationExecution.attempts[0]).toMatchObject({
      phase: "initial-pass",
      requestedRoles: ["soldier"],
      selectedMonsterId: "priest",
      outcome: "selected",
    });
    expect(result.formationExecution.termination).toBe("stalled-role-cycle");
  });

  it("accepts one Cultist Fanatic when later guard stages cannot afford candidates", () => {
    const fanatic = monster("cultist-fanatic", { xp: 450, roles: ["leader"] });
    const guard = monster("guard", { xp: 50, roles: ["soldier", "minion"] });
    const result = composeEncounter({
      monsterCatalog: monsterCatalog(fanatic, guard),
      family: TEST_FAMILY,
      formation: formation("leader_guards"),
      xpBudget: 450,
    });

    expect(result.entries).toEqual([{ monster: fanatic, count: 1 }]);
    expect(result.formationExecution.attempts[0]).toMatchObject({
      requestedRoles: ["leader"],
      selectedMonsterId: "cultist-fanatic",
      outcome: "selected",
    });
    expect(
      result.formationExecution.attempts.filter(({ outcome }) => outcome === "insufficient-budget"),
    ).not.toHaveLength(0);
    expect(
      result.formationExecution.attempts.some(
        ({ outcome }) => outcome === "leader-already-selected",
      ),
    ).toBe(true);
  });
});

describe("formation cap and diagnostic integrity", () => {
  it.each([
    [225, 9, 0, "stalled-role-cycle"],
    [250, 10, 0, "creature-cap"],
    [275, 10, 25, "creature-cap"],
  ] as const)(
    "front_line with Kobolds at %i XP stops at the exact cap boundary",
    (xpBudget, count, xpRemaining, termination) => {
      const kobold = monster("kobold", { xp: 25, roles: ["minion"] });
      const result = composeEncounter({
        monsterCatalog: monsterCatalog(kobold),
        family: TEST_FAMILY,
        formation: formation("front_line"),
        xpBudget,
      });

      expect(result.entries).toEqual([{ monster: kobold, count }]);
      expect(result).toMatchObject({ creatureCount: count, xpRemaining });
      expect(result.formationExecution.termination).toBe(termination);
    },
  );

  it("records repeated zero-XP picks and terminates at the formation cap", () => {
    const vermin = monster("vermin", { xp: 0, roles: ["minion"] });
    const result = composeEncounter({
      monsterCatalog: monsterCatalog(vermin),
      family: TEST_FAMILY,
      formation: formation("swarm"),
      xpBudget: 0,
    });

    expect(result.formationExecution.attempts).toHaveLength(12);
    expect(result.formationExecution.attempts.every(({ xpSpent }) => xpSpent === 0)).toBe(true);
    expect(result.formationExecution.termination).toBe("creature-cap");
  });

  it("returns immutable deterministic diagnostics consistent with aggregate accounting", () => {
    const minion = monster("minion", { xp: 50, roles: ["minion"] });
    const options = {
      monsterCatalog: monsterCatalog(minion),
      family: TEST_FAMILY,
      formation: formation("swarm"),
      xpBudget: 150,
    } as const;
    const first = composeEncounter(options);
    const second = composeEncounter(options);
    const selectedAttempts = first.formationExecution.attempts.filter(
      ({ outcome }) => outcome === "selected",
    );

    expect(first.formationExecution).toEqual(second.formationExecution);
    expect(Object.isFrozen(first.formationExecution)).toBe(true);
    expect(Object.isFrozen(first.formationExecution.attempts)).toBe(true);
    expect(first.formationExecution.attempts.every(Object.isFrozen)).toBe(true);
    expect(selectedAttempts).toHaveLength(first.creatureCount);
    expect(selectedAttempts.reduce((total, attempt) => total + attempt.xpSpent, 0)).toBe(
      first.xpSpent,
    );
    expect(selectedAttempts.map(({ selectedMonsterId }) => selectedMonsterId)).toEqual([
      "minion",
      "minion",
      "minion",
    ]);
  });
});
