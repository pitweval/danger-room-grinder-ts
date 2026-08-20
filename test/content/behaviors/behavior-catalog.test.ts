import { describe, expect, it } from "vitest";

import {
  EncounterBehaviorCatalogError,
  loadEncounterBehaviorCatalog,
  parseTsv,
} from "../../../src/content/index.js";

const behaviorHeader =
  "roll_min\troll_max\tkey\ttitle\tdescription\trequirements\tpreferred_environments\talertness_modifier";

function behaviorTable(selector: "type" | "tag" | "scope", value: string): string {
  return [
    `${selector}\t${behaviorHeader}`,
    `${value}\t1\t10\tfirst_behavior\tFirst\tFirst description.\t-\t-\t0`,
    `${value}\t11\t20\tsecond_behavior\tSecond\tSecond description.\tenvironment:dungeon\tdungeon\t-1`,
  ].join("\n");
}

function load(
  overrides: Partial<Record<"byType" | "byTag" | "fallback" | "dispositions", string>> = {},
) {
  return loadEncounterBehaviorCatalog({
    byType: parseTsv(overrides.byType ?? behaviorTable("type", "Construct"), {
      source: "types.tsv",
    }),
    byTag: parseTsv(
      overrides.byTag ??
        behaviorTable("tag", "movement:fly")
          .replaceAll("first_behavior", "tag_first")
          .replaceAll("second_behavior", "tag_second"),
      { source: "tags.tsv" },
    ),
    fallback: parseTsv(
      overrides.fallback ??
        behaviorTable("scope", "*")
          .replaceAll("first_behavior", "fallback_first")
          .replaceAll("second_behavior", "fallback_second"),
      { source: "fallback.tsv" },
    ),
    dispositions: parseTsv(
      overrides.dispositions ??
        [
          "roll_min\troll_max\tdisposition",
          "1\t5\tNeutral",
          "6\t10\tAggressive",
          "11\t15\tAngry",
          "16\t20\tHateful",
        ].join("\n"),
      { source: "dispositions.tsv" },
    ),
  });
}

describe("loadEncounterBehaviorCatalog", () => {
  it("loads, normalizes, and deeply freezes all four authored tables", () => {
    const catalog = load();

    expect(catalog.behaviors).toHaveLength(6);
    expect(catalog.dispositions).toHaveLength(4);
    expect(catalog.behaviors[1]).toMatchObject({
      selectorKind: "type",
      selector: "Construct",
      requirements: [{ kind: "environment", value: "dungeon" }],
      preferredEnvironments: ["dungeon"],
      alertnessModifier: -1,
    });
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog.behaviors)).toBe(true);
    expect(catalog.behaviors.every(Object.isFrozen)).toBe(true);
  });

  it.each([
    ["invalid selector", { byType: behaviorTable("type", "Unknown") }],
    ["invalid range", { byType: behaviorTable("type", "Construct").replace("1\t10", "0\t10") }],
    ["coverage gap", { byType: behaviorTable("type", "Construct").replace("11\t20", "12\t20") }],
    [
      "coverage overlap",
      { byType: behaviorTable("type", "Construct").replace("11\t20", "10\t20") },
    ],
    [
      "invalid requirement",
      { byType: behaviorTable("type", "Construct").replace("environment:dungeon", "mood:bad") },
    ],
    [
      "invalid alertness",
      { byType: behaviorTable("type", "Construct").replace("\tdungeon\t-1", "\tdungeon\t11") },
    ],
    [
      "disposition gap",
      {
        dispositions: "roll_min\troll_max\tdisposition\n1\t5\tNeutral\n7\t20\tAggressive",
      },
    ],
  ])("rejects %s with source-aware diagnostics", (_label, overrides) => {
    expect(() => load(overrides)).toThrow(EncounterBehaviorCatalogError);
  });

  it("rejects behavior keys duplicated across authored tables", () => {
    expect(() =>
      load({
        byTag: behaviorTable("tag", "movement:fly"),
      }),
    ).toThrow(/duplicate behavior key.*types\.tsv/i);
  });
});
