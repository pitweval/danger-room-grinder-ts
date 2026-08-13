import { describe, expect, it } from "vitest";

import { getEligibleEncounterMonsters } from "../../../src/encounter/index.js";
import { TEST_FAMILY, monster, monsterCatalog } from "./fixtures.js";

describe("getEligibleEncounterMonsters", () => {
  it("returns one matching procedural and affordable monster", () => {
    const goblin = monster("goblin");

    expect(
      getEligibleEncounterMonsters({
        monsterCatalog: monsterCatalog(goblin),
        family: TEST_FAMILY,
        budget: 100,
      }),
    ).toEqual([goblin]);
  });

  it("preserves catalog order for several candidates", () => {
    const zeta = monster("zeta");
    const alpha = monster("alpha");

    expect(
      getEligibleEncounterMonsters({
        monsterCatalog: monsterCatalog(zeta, alpha),
        family: TEST_FAMILY,
        budget: 100,
      }),
    ).toEqual([zeta, alpha]);
  });

  it("accepts a monster with multiple family memberships", () => {
    const shared = monster("shared", { families: ["other", TEST_FAMILY.id] });

    expect(
      getEligibleEncounterMonsters({
        monsterCatalog: monsterCatalog(shared),
        family: TEST_FAMILY,
        budget: 100,
      }),
    ).toEqual([shared]);
  });

  it("excludes monsters outside the selected family", () => {
    expect(
      getEligibleEncounterMonsters({
        monsterCatalog: monsterCatalog(monster("outsider", { families: ["other"] })),
        family: TEST_FAMILY,
        budget: 100,
      }),
    ).toEqual([]);
  });

  it("excludes nonprocedural monsters", () => {
    expect(
      getEligibleEncounterMonsters({
        monsterCatalog: monsterCatalog(monster("named-npc", { procedural: false })),
        family: TEST_FAMILY,
        budget: 100,
      }),
    ).toEqual([]);
  });

  it("includes a monster exactly equal to the raw XP budget", () => {
    expect(
      getEligibleEncounterMonsters({
        monsterCatalog: monsterCatalog(monster("exact", { xp: 200 })),
        family: TEST_FAMILY,
        budget: 200,
      }),
    ).toHaveLength(1);
  });

  it("excludes a monster one XP over budget", () => {
    expect(
      getEligibleEncounterMonsters({
        monsterCatalog: monsterCatalog(monster("over", { xp: 201 })),
        family: TEST_FAMILY,
        budget: 200,
      }),
    ).toEqual([]);
  });

  it("supports zero-XP monsters at the smallest budget", () => {
    expect(
      getEligibleEncounterMonsters({
        monsterCatalog: monsterCatalog(monster("vermin", { xp: 0, cr: "0" })),
        family: TEST_FAMILY,
        budget: 0,
      }),
    ).toHaveLength(1);
  });

  it("does not use CR as an independent eligibility filter", () => {
    const oddCr = monster("odd-cr", { cr: "30", xp: 100 });

    expect(
      getEligibleEncounterMonsters({
        monsterCatalog: monsterCatalog(oddCr),
        family: TEST_FAMILY,
        budget: 100,
      }),
    ).toEqual([oddCr]);
  });

  it.each(["underwater", "UNDERWATER"])("allows an underwater requirement in %s", (environment) => {
    const aquatic = monster("aquatic", { requirements: ["environment:underwater"] });
    expect(
      getEligibleEncounterMonsters({
        monsterCatalog: monsterCatalog(aquatic),
        family: TEST_FAMILY,
        budget: 100,
        environment,
      }),
    ).toEqual([aquatic]);
  });

  it("rejects an underwater requirement outside underwater", () => {
    expect(
      getEligibleEncounterMonsters({
        monsterCatalog: monsterCatalog(
          monster("aquatic", { requirements: ["environment:underwater"] }),
        ),
        family: TEST_FAMILY,
        budget: 100,
        environment: "water",
      }),
    ).toEqual([]);
  });

  it.each(["aquatic", "underwater", "water", "WATER"])(
    "allows terrain:water in %s",
    (environment) => {
      expect(
        getEligibleEncounterMonsters({
          monsterCatalog: monsterCatalog(
            monster("waterbound", { requirements: ["terrain:water"] }),
          ),
          family: TEST_FAMILY,
          budget: 100,
          environment,
        }),
      ).toHaveLength(1);
    },
  );

  it("uses Bash's default dungeon environment when omitted", () => {
    expect(
      getEligibleEncounterMonsters({
        monsterCatalog: monsterCatalog(monster("waterbound", { requirements: ["terrain:water"] })),
        family: TEST_FAMILY,
        budget: 100,
      }),
    ).toEqual([]);
  });

  it("rejects an explicitly empty environment as the Bash context validator does", () => {
    expect(() =>
      getEligibleEncounterMonsters({
        monsterCatalog: monsterCatalog(monster("candidate")),
        family: TEST_FAMILY,
        budget: 100,
        environment: "",
      }),
    ).toThrow(/invalid.*environment.*non-empty/i);
  });

  it("ignores preferred environments for eligibility", () => {
    const caveDweller = monster("cave-dweller", { preferredEnvironments: ["cave"] });

    expect(
      getEligibleEncounterMonsters({
        monsterCatalog: monsterCatalog(caveDweller),
        family: TEST_FAMILY,
        budget: 100,
        environment: "forest",
      }),
    ).toEqual([caveDweller]);
  });

  it("rejects an unsuitable zero-XP swimmer in a dry room", () => {
    expect(
      getEligibleEncounterMonsters({
        monsterCatalog: monsterCatalog(
          monster("free-seahorse", { xp: 0, cr: "0", tags: ["movement:swim"] }),
        ),
        family: TEST_FAMILY,
        budget: 0,
        environment: "dungeon",
      }),
    ).toEqual([]);
  });

  it("allows the same zero-XP swimmer in water", () => {
    expect(
      getEligibleEncounterMonsters({
        monsterCatalog: monsterCatalog(
          monster("free-seahorse", { xp: 0, cr: "0", tags: ["movement:swim"] }),
        ),
        family: TEST_FAMILY,
        budget: 0,
        environment: "water",
      }),
    ).toHaveLength(1);
  });

  it("applies Boss eligibility only in Boss context", () => {
    const excludedBoss = monster("ordinary-only", { bossEligible: false });

    expect(
      getEligibleEncounterMonsters({
        monsterCatalog: monsterCatalog(excludedBoss),
        family: TEST_FAMILY,
        budget: 100,
      }),
    ).toEqual([excludedBoss]);
    expect(
      getEligibleEncounterMonsters({
        monsterCatalog: monsterCatalog(excludedBoss),
        family: TEST_FAMILY,
        budget: 100,
        bossEncounter: true,
      }),
    ).toEqual([]);
  });

  it("matches any requested role and respects minion eligibility for minion matches", () => {
    const mixed = monster("mixed", {
      roles: ["soldier", "minion"],
      minionEligible: false,
    });

    expect(
      getEligibleEncounterMonsters({
        monsterCatalog: monsterCatalog(mixed),
        family: TEST_FAMILY,
        budget: 100,
        requiredRoles: ["soldier", "minion"],
      }),
    ).toEqual([mixed]);
    expect(
      getEligibleEncounterMonsters({
        monsterCatalog: monsterCatalog(mixed),
        family: TEST_FAMILY,
        budget: 100,
        requiredRoles: ["minion"],
      }),
    ).toEqual([]);
  });

  it("returns a frozen candidate collection without mutating inputs", () => {
    const candidate = monster("candidate");
    const catalog = monsterCatalog(candidate);
    const snapshot = structuredClone(catalog);
    const eligible = getEligibleEncounterMonsters({
      monsterCatalog: catalog,
      family: TEST_FAMILY,
      budget: 100,
    });

    expect(catalog).toEqual(snapshot);
    expect(Object.isFrozen(eligible)).toBe(true);
    expect(Object.isFrozen(eligible[0])).toBe(true);
  });
});
