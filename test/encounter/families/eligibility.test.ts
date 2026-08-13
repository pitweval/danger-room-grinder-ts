import { describe, expect, it } from "vitest";

import { MonsterFamilyReferenceError } from "../../../src/content/index.js";
import { getEligibleEncounterFamilies } from "../../../src/encounter/index.js";
import { family, familyCatalog, monster, monsterCatalog } from "./fixtures.js";

describe("getEligibleEncounterFamilies", () => {
  it("includes a family with one procedural member", () => {
    const goblinoids = family("goblinoids");

    expect(
      getEligibleEncounterFamilies(
        monsterCatalog(monster("goblin", ["goblinoids"])),
        familyCatalog(goblinoids),
      ),
    ).toEqual([goblinoids]);
  });

  it("includes a family only once when several procedural monsters belong to it", () => {
    const undead = family("undead");
    const eligible = getEligibleEncounterFamilies(
      monsterCatalog(monster("skeleton", ["undead"]), monster("zombie", ["undead"])),
      familyCatalog(undead),
    );

    expect(eligible).toEqual([undead]);
  });

  it("does not duplicate a candidate for repeated membership data", () => {
    const undead = family("undead");

    expect(
      getEligibleEncounterFamilies(
        monsterCatalog(monster("restless-dead", ["undead", "undead"])),
        familyCatalog(undead),
      ),
    ).toEqual([undead]);
  });

  it("excludes a defined family with no member monsters", () => {
    expect(
      getEligibleEncounterFamilies(monsterCatalog(), familyCatalog(family("constructs"))),
    ).toEqual([]);
  });

  it("excludes a family whose only members are nonprocedural", () => {
    expect(
      getEligibleEncounterFamilies(
        monsterCatalog(monster("named-dragon", ["dragons"], false)),
        familyCatalog(family("dragons")),
      ),
    ).toEqual([]);
  });

  it("uses only procedural membership, not later monster-selection metadata", () => {
    const aquatic = Object.freeze({
      ...monster("seahorse", ["beasts"]),
      xp: 0,
      requirements: Object.freeze(["terrain:water"]),
      bossEligible: false,
      minionEligible: false,
    });

    expect(
      getEligibleEncounterFamilies(monsterCatalog(aquatic), familyCatalog(family("beasts"))),
    ).toHaveLength(1);
  });

  it("preserves family source order rather than monster or lexical order", () => {
    const families = familyCatalog(
      family("zeta"),
      family("alpha", "INTERMITTENT"),
      family("middle"),
    );
    const monsters = monsterCatalog(
      monster("a", ["alpha"]),
      monster("m", ["middle"]),
      monster("z", ["zeta"]),
    );

    expect(getEligibleEncounterFamilies(monsters, families).map(({ id }) => id)).toEqual([
      "zeta",
      "alpha",
      "middle",
    ]);
  });

  it("returns an empty immutable collection for a header-only family catalog", () => {
    const eligible = getEligibleEncounterFamilies(monsterCatalog(), familyCatalog());

    expect(eligible).toEqual([]);
    expect(Object.isFrozen(eligible)).toBe(true);
  });

  it("invokes the existing monster-family reference validator at its boundary", () => {
    expect(() =>
      getEligibleEncounterFamilies(
        monsterCatalog(monster("lost-creature", ["missing_family"])),
        familyCatalog(family("known_family")),
      ),
    ).toThrow(MonsterFamilyReferenceError);
  });

  it("does not mutate either catalog or expose a mutable candidate array", () => {
    const monsters = monsterCatalog(monster("goblin", ["goblinoids"]));
    const families = familyCatalog(family("goblinoids"));
    const monsterSnapshot = structuredClone(monsters);
    const familySnapshot = structuredClone(families);
    const eligible = getEligibleEncounterFamilies(monsters, families);

    expect(monsters).toEqual(monsterSnapshot);
    expect(families).toEqual(familySnapshot);
    expect(Object.isFrozen(eligible)).toBe(true);
    expect(Object.isFrozen(eligible[0])).toBe(true);
  });
});
