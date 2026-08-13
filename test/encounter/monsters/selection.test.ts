import { describe, expect, it } from "vitest";

import {
  EncounterMonsterSelectionError,
  selectEncounterMonster,
} from "../../../src/encounter/index.js";
import { RandomGenerator } from "../../../src/rng/index.js";
import { TEST_FAMILY, monster, monsterCatalog } from "./fixtures.js";

describe("selectEncounterMonster", () => {
  it("selects the highest-XP affordable monster", () => {
    const weak = monster("weak", { xp: 50 });
    const strong = monster("strong", { xp: 200 });
    const result = selectEncounterMonster({
      monsterCatalog: monsterCatalog(weak, strong),
      family: TEST_FAMILY,
      budget: 200,
    });

    expect(result).toEqual({ monster: strong });
  });

  it("breaks equal-XP ties with higher environmental suitability", () => {
    const ordinary = monster("alpha-ordinary");
    const swimmer = monster("zeta-swimmer", { tags: ["movement:swim"] });

    expect(
      selectEncounterMonster({
        monsterCatalog: monsterCatalog(ordinary, swimmer),
        family: TEST_FAMILY,
        budget: 100,
        environment: "water",
      }).monster,
    ).toBe(swimmer);
  });

  it("breaks equal XP and suitability by lexicographically smaller ID", () => {
    const zeta = monster("zeta-guard");
    const alpha = monster("alpha-guard");

    expect(
      selectEncounterMonster({
        monsterCatalog: monsterCatalog(zeta, alpha),
        family: TEST_FAMILY,
        budget: 100,
      }).monster,
    ).toBe(alpha);
  });

  it("prefers ordinary enclosed creatures over Huge dinosaurs", () => {
    const dinosaur = monster("huge-dinosaur", {
      xp: 200,
      size: "Huge",
      roles: ["brute"],
      tags: ["dinosaur"],
    });
    const caveBrute = monster("cave-brute", { xp: 200, roles: ["brute"] });

    expect(
      selectEncounterMonster({
        monsterCatalog: monsterCatalog(dinosaur, caveBrute),
        family: TEST_FAMILY,
        budget: 200,
        environment: "dungeon",
        requiredRoles: ["brute"],
      }).monster,
    ).toBe(caveBrute);
  });

  it("selects a stored secondary role", () => {
    const captain = monster("captain", { roles: ["leader", "soldier"] });

    expect(
      selectEncounterMonster({
        monsterCatalog: monsterCatalog(captain),
        family: TEST_FAMILY,
        budget: 100,
        requiredRoles: ["soldier"],
      }).monster,
    ).toBe(captain);
  });

  it("does not consume randomness", () => {
    const rng = {
      integer: () => {
        throw new Error("RNG must not be used");
      },
    };
    const candidate = monster("candidate");

    expect(
      selectEncounterMonster({
        monsterCatalog: monsterCatalog(candidate),
        family: TEST_FAMILY,
        budget: 100,
        rng,
      }).monster,
    ).toBe(candidate);
  });

  it("has the same deterministic result for fixed seeded RNG instances", () => {
    const alpha = monster("alpha");
    const zeta = monster("zeta");
    const options = {
      monsterCatalog: monsterCatalog(zeta, alpha),
      family: TEST_FAMILY,
      budget: 100,
    } as const;

    expect(
      selectEncounterMonster({ ...options, rng: new RandomGenerator(8675309) }).monster.id,
    ).toBe("alpha");
    expect(
      selectEncounterMonster({ ...options, rng: new RandomGenerator(8675309) }).monster.id,
    ).toBe("alpha");
  });

  it("is reproducible regardless of catalog source order", () => {
    const alpha = monster("alpha", { xp: 100 });
    const zeta = monster("zeta", { xp: 100 });
    const options = { family: TEST_FAMILY, budget: 100 } as const;

    expect(
      selectEncounterMonster({ ...options, monsterCatalog: monsterCatalog(zeta, alpha) }).monster
        .id,
    ).toBe("alpha");
    expect(
      selectEncounterMonster({ ...options, monsterCatalog: monsterCatalog(alpha, zeta) }).monster
        .id,
    ).toBe("alpha");
  });

  it.each([0, 1_000_000])("supports a valid budget of %i", (budget) => {
    const candidate = monster("candidate", { xp: budget });
    expect(
      selectEncounterMonster({
        monsterCatalog: monsterCatalog(candidate),
        family: TEST_FAMILY,
        budget,
      }).monster,
    ).toBe(candidate);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid budget %s",
    (budget) => {
      expect(() =>
        selectEncounterMonster({
          monsterCatalog: monsterCatalog(monster("candidate")),
          family: TEST_FAMILY,
          budget,
        }),
      ).toThrow(/invalid.*budget/i);
    },
  );

  it("reports a domain error when no monster survives filtering", () => {
    let captured: unknown;

    try {
      selectEncounterMonster({
        monsterCatalog: monsterCatalog(monster("too-expensive", { xp: 101 })),
        family: TEST_FAMILY,
        budget: 100,
      });
    } catch (error) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(EncounterMonsterSelectionError);
    expect(captured).toMatchObject({ code: "NO_ELIGIBLE_MONSTERS", familyId: "test_family" });
  });

  it("does not relax failed role or requirement filters", () => {
    expect(() =>
      selectEncounterMonster({
        monsterCatalog: monsterCatalog(
          monster("water-soldier", {
            roles: ["soldier"],
            requirements: ["terrain:water"],
          }),
        ),
        family: TEST_FAMILY,
        budget: 100,
        environment: "dungeon",
        requiredRoles: ["leader"],
      }),
    ).toThrow(/no eligible monsters.*test_family/i);
  });

  it("returns an immutable result and leaves source models unchanged", () => {
    const candidate = monster("candidate");
    const catalog = monsterCatalog(candidate);
    const catalogSnapshot = structuredClone(catalog);
    const familySnapshot = structuredClone(TEST_FAMILY);
    const result = selectEncounterMonster({
      monsterCatalog: catalog,
      family: TEST_FAMILY,
      budget: 100,
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(catalog).toEqual(catalogSnapshot);
    expect(TEST_FAMILY).toEqual(familySnapshot);
  });
});
