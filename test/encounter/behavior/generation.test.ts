import { describe, expect, it, vi } from "vitest";

import type { BehaviorDefinition, EncounterBehaviorCatalog } from "../../../src/content/index.js";
import {
  EncounterBehaviorError,
  generateEncounterBehavior,
  rollEncounterBehaviorState,
} from "../../../src/encounter/index.js";
import { monster } from "../monsters/fixtures.js";
import { TEST_BEHAVIOR_CATALOG } from "./fixtures.js";

function entry(id: string, overrides: Parameters<typeof monster>[1] = {}) {
  return Object.freeze({ monster: monster(id, overrides), count: 1 });
}

function behavior(overrides: Partial<BehaviorDefinition>): BehaviorDefinition {
  return Object.freeze({
    selectorKind: "fallback",
    selector: "*",
    rollMinimum: 1,
    rollMaximum: 20,
    key: "fallback",
    title: "Fallback",
    description: "Fallback behavior.",
    requirements: Object.freeze([]),
    preferredEnvironments: Object.freeze([]),
    alertnessModifier: undefined,
    ...overrides,
  });
}

function catalog(...behaviors: readonly BehaviorDefinition[]): EncounterBehaviorCatalog {
  return Object.freeze({
    behaviors: Object.freeze(behaviors),
    dispositions: TEST_BEHAVIOR_CATALOG.dispositions,
  });
}

describe("rollEncounterBehaviorState", () => {
  it("draws behavior d20 before disposition d20 exactly once each", () => {
    const integer = vi.fn().mockReturnValueOnce(4).mockReturnValueOnce(17);

    expect(rollEncounterBehaviorState({ integer })).toEqual({ behavior: 4, disposition: 17 });
    expect(integer.mock.calls).toEqual([
      [1, 20],
      [1, 20],
    ]);
  });
});

describe("generateEncounterBehavior", () => {
  it.each([
    [1, "Neutral"],
    [5, "Neutral"],
    [6, "Aggressive"],
    [10, "Aggressive"],
    [11, "Angry"],
    [15, "Angry"],
    [16, "Hateful"],
    [20, "Hateful"],
  ])("maps disposition boundary roll %i to %s", (disposition, expected) => {
    const result = generateEncounterBehavior({
      catalog: TEST_BEHAVIOR_CATALOG,
      rolls: Object.freeze({ behavior: 1, disposition }),
      environment: "dungeon",
      entries: [entry("worker")],
    });

    expect(result.disposition.description).toBe(expected);
  });

  it.each([
    [1, "humanoid_low"],
    [10, "humanoid_low"],
    [11, "humanoid_high"],
    [20, "humanoid_high"],
  ])("maps behavior boundary roll %i to %s", (roll, expected) => {
    expect(
      generateEncounterBehavior({
        catalog: TEST_BEHAVIOR_CATALOG,
        rolls: Object.freeze({ behavior: roll, disposition: 1 }),
        environment: "dungeon",
        entries: [entry("worker")],
      }).behavior.key,
    ).toBe(expected);
  });

  it("ranks matching tag above type above fallback", () => {
    expect(
      generateEncounterBehavior({
        catalog: TEST_BEHAVIOR_CATALOG,
        rolls: Object.freeze({ behavior: 1, disposition: 1 }),
        environment: "dungeon",
        entries: [entry("flyer", { tags: ["movement:fly"] })],
      }).behavior.key,
    ).toBe("flying_low");
  });

  it("enforces environment, type, and tag requirements as an AND list", () => {
    const specialized = behavior({
      selectorKind: "tag",
      selector: "movement:swim",
      key: "aquatic_hunt",
      requirements: Object.freeze([
        Object.freeze({ kind: "environment", value: "underwater" }),
        Object.freeze({ kind: "type", value: "Humanoid" }),
        Object.freeze({ kind: "tag", value: "movement:swim" }),
      ]),
    });
    const behaviorCatalog = catalog(specialized, behavior({ key: "generic" }));
    const swimmer = entry("swimmer", { tags: ["movement:swim"] });

    expect(
      generateEncounterBehavior({
        catalog: behaviorCatalog,
        rolls: Object.freeze({ behavior: 1, disposition: 1 }),
        environment: "dungeon",
        entries: [swimmer],
      }).behavior.key,
    ).toBe("generic");
    expect(
      generateEncounterBehavior({
        catalog: behaviorCatalog,
        rolls: Object.freeze({ behavior: 1, disposition: 1 }),
        environment: "underwater",
        entries: [swimmer],
      }).behavior.key,
    ).toBe("aquatic_hunt");
  });

  it("uses preferred environment then lexical behavior key for equal-specificity ties", () => {
    const behaviorCatalog = catalog(
      behavior({
        selectorKind: "tag",
        selector: "movement:fly",
        key: "flying_patrol",
      }),
      behavior({
        selectorKind: "tag",
        selector: "spellcaster",
        key: "spellcaster_rehearsal",
        preferredEnvironments: Object.freeze(["temple"]),
      }),
      behavior({ selectorKind: "tag", selector: "cleric", key: "alpha_key" }),
      behavior({ key: "generic" }),
    );
    const caster = entry("caster", {
      tags: ["cleric", "movement:fly", "spellcaster"],
    });

    expect(
      generateEncounterBehavior({
        catalog: behaviorCatalog,
        rolls: Object.freeze({ behavior: 1, disposition: 1 }),
        environment: "temple",
        entries: [caster],
      }).behavior.key,
    ).toBe("spellcaster_rehearsal");
    expect(
      generateEncounterBehavior({
        catalog: behaviorCatalog,
        rolls: Object.freeze({ behavior: 1, disposition: 1 }),
        environment: "dungeon",
        entries: [caster],
      }).behavior.key,
    ).toBe("alpha_key");
  });

  it("uses metadata from every species in the aggregate roster", () => {
    const result = generateEncounterBehavior({
      catalog: TEST_BEHAVIOR_CATALOG,
      rolls: Object.freeze({ behavior: 12, disposition: 20 }),
      environment: "dungeon",
      entries: [entry("grounded"), entry("flyer", { tags: ["movement:fly"] })],
    });

    expect(result).toMatchObject({
      behavior: { key: "flying_high" },
      disposition: { description: "Hateful" },
      alertnessModifier: 2,
      activity: "Perching: They watch from above.",
      rolls: { behavior: 12, disposition: 20 },
    });
  });

  it("returns deeply immutable deterministic state without mutating the catalog", () => {
    const snapshot = structuredClone(TEST_BEHAVIOR_CATALOG);
    const options = {
      catalog: TEST_BEHAVIOR_CATALOG,
      rolls: Object.freeze({ behavior: 1, disposition: 1 }),
      environment: "dungeon",
      entries: [entry("worker")],
    } as const;
    const first = generateEncounterBehavior(options);

    expect(first).toEqual(generateEncounterBehavior(options));
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.rolls)).toBe(true);
    expect(TEST_BEHAVIOR_CATALOG).toEqual(snapshot);
  });

  it.each([
    [{ behavior: 0, disposition: 1 }, "roll"],
    [{ behavior: 1, disposition: 21 }, "roll"],
  ])("rejects invalid behavior context %#", (rolls, expected) => {
    expect(() =>
      generateEncounterBehavior({
        catalog: TEST_BEHAVIOR_CATALOG,
        rolls,
        environment: "dungeon",
        entries: [entry("worker")],
      }),
    ).toThrow(expected);
  });

  it("reports a missing behavior without swallowing the domain error", () => {
    expect(() =>
      generateEncounterBehavior({
        catalog: catalog(),
        rolls: Object.freeze({ behavior: 1, disposition: 1 }),
        environment: "dungeon",
        entries: [entry("worker")],
      }),
    ).toThrow(EncounterBehaviorError);
  });
});
