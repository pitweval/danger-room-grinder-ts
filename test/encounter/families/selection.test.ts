import { describe, expect, it, vi } from "vitest";

import {
  EncounterFamilySelectionError,
  selectEncounterFamily,
} from "../../../src/encounter/index.js";
import { RandomGenerator } from "../../../src/rng/index.js";
import { family, familyCatalog, monster, monsterCatalog } from "./fixtures.js";

function selectionFixture() {
  const alpha = family("alpha", "PRIMARY", "Alpha Host");
  const beta = family("beta", "INTERMITTENT", "Beta Visitors");
  const gamma = family("gamma", "PRIMARY", "Gamma Guard");

  return {
    alpha,
    beta,
    gamma,
    families: familyCatalog(alpha, beta, gamma),
    monsters: monsterCatalog(
      monster("alpha-one", ["alpha"]),
      monster("beta-one", ["beta"]),
      monster("gamma-one", ["gamma"]),
    ),
  };
}

describe("selectEncounterFamily natural selection", () => {
  it("makes one weighted selection call even with one eligible family", () => {
    const constructs = family("constructs");
    const integer = vi.fn(() => 1);

    expect(
      selectEncounterFamily({
        monsterCatalog: monsterCatalog(monster("golem", ["constructs"])),
        familyCatalog: familyCatalog(constructs),
        rng: { integer },
      }),
    ).toEqual({ family: constructs });
    expect(integer).toHaveBeenCalledOnce();
    expect(integer).toHaveBeenCalledWith(1, 1);
  });

  it.each([
    [1, 1],
    [4, 1],
    [5, 2],
    [8, 2],
    [9, 3],
  ])("reduces INTERMITTENT base weight %i to %i", (baseWeight, effectiveWeight) => {
    const intermittent = family("fey", "INTERMITTENT");
    const integer = vi.fn(() => effectiveWeight);

    selectEncounterFamily({
      monsterCatalog: monsterCatalog(monster("sprite", ["fey"])),
      familyCatalog: familyCatalog(intermittent),
      familyWeights: { fey: baseWeight },
      rng: { integer },
    });

    expect(integer).toHaveBeenCalledWith(1, effectiveWeight);
  });

  it("keeps PRIMARY base weights unchanged", () => {
    const primary = family("undead");
    const integer = vi.fn(() => 7);

    selectEncounterFamily({
      monsterCatalog: monsterCatalog(monster("wight", ["undead"])),
      familyCatalog: familyCatalog(primary),
      familyWeights: { undead: 7 },
      rng: { integer },
    });

    expect(integer).toHaveBeenCalledWith(1, 7);
  });

  it("treats a supplied weight map as the complete active authored pool", () => {
    const { beta, families, monsters } = selectionFixture();

    expect(
      selectEncounterFamily({
        monsterCatalog: monsters,
        familyCatalog: families,
        familyWeights: { beta: 4 },
        rng: { integer: vi.fn(() => 1) },
      }).family,
    ).toBe(beta);
  });

  it.each([
    [8, "undead"],
    [20, "constructs"],
  ])("matches the core Bash d20 family pool at roll %i", (roll, expectedId) => {
    const familyIds = ["goblinoids", "kobolds", "undead", "beasts", "cultists", "constructs"];
    const families = familyCatalog(...familyIds.map((id) => family(id)));
    const monsters = monsterCatalog(...familyIds.map((id) => monster(`${id}-member`, [id])));

    expect(
      selectEncounterFamily({
        monsterCatalog: monsters,
        familyCatalog: families,
        familyWeights: {
          goblinoids: 4,
          kobolds: 3,
          undead: 4,
          beasts: 3,
          cultists: 3,
          constructs: 3,
        },
        rng: { integer: vi.fn(() => roll) },
      }).family.id,
    ).toBe(expectedId);
  });

  it.each([
    [4, "alpha"],
    [5, "beta"],
  ])("uses the exact PRIMARY/INTERMITTENT boundary at roll %i", (roll, expectedId) => {
    const { alpha, beta } = selectionFixture();

    expect(
      selectEncounterFamily({
        monsterCatalog: monsterCatalog(
          monster("alpha-one", ["alpha"]),
          monster("beta-one", ["beta"]),
        ),
        familyCatalog: familyCatalog(alpha, beta),
        familyWeights: { alpha: 4, beta: 4 },
        rng: { integer: vi.fn(() => roll) },
      }).family.id,
    ).toBe(expectedId);
  });

  it("processes several INTERMITTENT candidates in source order with no participation rolls", () => {
    const first = family("first", "INTERMITTENT");
    const second = family("second", "INTERMITTENT");
    const third = family("third", "INTERMITTENT");
    const integer = vi.fn(() => 2);

    const result = selectEncounterFamily({
      monsterCatalog: monsterCatalog(
        monster("one", ["first"]),
        monster("two", ["second"]),
        monster("three", ["third"]),
      ),
      familyCatalog: familyCatalog(first, second, third),
      familyWeights: { first: 4, second: 4, third: 4 },
      rng: { integer },
    });

    expect(result.family).toBe(second);
    expect(integer).toHaveBeenCalledOnce();
    expect(integer).toHaveBeenCalledWith(1, 3);
  });

  it.each([
    [1, "alpha"],
    [7, "gamma"],
  ])("selects the first and last weighted indexes", (roll, expectedId) => {
    const { families, monsters } = selectionFixture();

    expect(
      selectEncounterFamily({
        monsterCatalog: monsters,
        familyCatalog: families,
        familyWeights: { alpha: 4, beta: 8, gamma: 1 },
        rng: { integer: vi.fn(() => roll) },
      }).family.id,
    ).toBe(expectedId);
  });

  it.each([
    [1, "gamma"],
    [42, "alpha"],
    [627, "beta"],
    [8675309, "gamma"],
  ])("is reproducible for fixed seed %i", (seed, expectedId) => {
    const { families, monsters } = selectionFixture();
    const options = {
      monsterCatalog: monsters,
      familyCatalog: families,
      familyWeights: { alpha: 4, beta: 8, gamma: 1 },
    } as const;

    expect(selectEncounterFamily({ ...options, rng: new RandomGenerator(seed) }).family.id).toBe(
      expectedId,
    );
    expect(selectEncounterFamily({ ...options, rng: new RandomGenerator(seed) }).family.id).toBe(
      expectedId,
    );
  });

  it("returns a frozen result without mutating input catalogs", () => {
    const { families, monsters } = selectionFixture();
    const familySnapshot = structuredClone(families);
    const monsterSnapshot = structuredClone(monsters);
    const result = selectEncounterFamily({
      monsterCatalog: monsters,
      familyCatalog: families,
      rng: { integer: vi.fn(() => 1) },
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(families).toEqual(familySnapshot);
    expect(monsters).toEqual(monsterSnapshot);
  });
});

describe("selectEncounterFamily explicit selection", () => {
  it("selects a PRIMARY family without consuming randomness", () => {
    const primary = family("undead", "PRIMARY", "Undead");
    const integer = vi.fn(() => 1);

    expect(
      selectEncounterFamily({
        monsterCatalog: monsterCatalog(monster("skeleton", ["undead"])),
        familyCatalog: familyCatalog(primary),
        requestedFamily: "undead",
        rng: { integer },
      }).family,
    ).toBe(primary);
    expect(integer).not.toHaveBeenCalled();
  });

  it.each(["archive_spirits", "ARCHIVE_SPIRITS", "Archive-Spirits", "Archive Spirits"])(
    "matches the normalized family ID selector %s",
    (requestedFamily) => {
      const archiveSpirits = family("archive_spirits", "INTERMITTENT", "Archive Spirits");
      const integer = vi.fn(() => 1);

      const result = selectEncounterFamily({
        monsterCatalog: monsterCatalog(monster("keeper", ["archive_spirits"])),
        familyCatalog: familyCatalog(archiveSpirits),
        requestedFamily,
        rng: { integer },
      });

      expect(result.family).toBe(archiveSpirits);
      expect(integer).not.toHaveBeenCalled();
    },
  );

  it("does not independently match a display name", () => {
    expect(() =>
      selectEncounterFamily({
        monsterCatalog: monsterCatalog(monster("keeper", ["scribes"])),
        familyCatalog: familyCatalog(family("scribes", "PRIMARY", "Archive Spirits")),
        requestedFamily: "Archive Spirits",
        rng: { integer: vi.fn(() => 1) },
      }),
    ).toThrow(/unknown.*archive spirits/i);
  });

  it("bypasses INTERMITTENT weighting", () => {
    const intermittent = family("oozes", "INTERMITTENT", "Oozes");
    const integer = vi.fn(() => 1);

    expect(
      selectEncounterFamily({
        monsterCatalog: monsterCatalog(monster("gray-ooze", ["oozes"])),
        familyCatalog: familyCatalog(intermittent),
        familyWeights: { oozes: 999 },
        requestedFamily: "oozes",
        rng: { integer },
      }).family,
    ).toBe(intermittent);
    expect(integer).not.toHaveBeenCalled();
  });

  it("rejects a defined family with no procedural members", () => {
    expect(() =>
      selectEncounterFamily({
        monsterCatalog: monsterCatalog(monster("named-fey", ["fey"], false)),
        familyCatalog: familyCatalog(family("fey", "INTERMITTENT", "Fey")),
        requestedFamily: "fey",
        rng: { integer: vi.fn(() => 1) },
      }),
    ).toThrow(/family.*fey.*no procedural/i);
  });
});

describe("selectEncounterFamily failures", () => {
  it("rejects an empty family catalog during natural selection", () => {
    expect(() =>
      selectEncounterFamily({
        monsterCatalog: monsterCatalog(),
        familyCatalog: familyCatalog(),
        rng: { integer: vi.fn(() => 1) },
      }),
    ).toThrow(/no encounter families.*procedural/i);
  });

  it("rejects a missing requested family with a domain error", () => {
    let captured: unknown;

    try {
      selectEncounterFamily({
        monsterCatalog: monsterCatalog(),
        familyCatalog: familyCatalog(),
        requestedFamily: "missing",
        rng: { integer: vi.fn(() => 1) },
      });
    } catch (error) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(EncounterFamilySelectionError);
    expect(captured).toMatchObject({ code: "UNKNOWN_FAMILY", familySelector: "missing" });
  });

  it("rejects a catalog with no eligible families", () => {
    expect(() =>
      selectEncounterFamily({
        monsterCatalog: monsterCatalog(),
        familyCatalog: familyCatalog(family("undead")),
        rng: { integer: vi.fn(() => 1) },
      }),
    ).toThrow(/no encounter families.*procedural/i);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid base weight %s",
    (weight) => {
      expect(() =>
        selectEncounterFamily({
          monsterCatalog: monsterCatalog(monster("goblin", ["goblinoids"])),
          familyCatalog: familyCatalog(family("goblinoids")),
          familyWeights: { goblinoids: weight },
          rng: { integer: vi.fn(() => 1) },
        }),
      ).toThrow(/invalid.*weight.*goblinoids/i);
    },
  );
});
