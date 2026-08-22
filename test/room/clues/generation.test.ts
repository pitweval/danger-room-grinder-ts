import { describe, expect, it } from "vitest";

import type {
  GaryClueCatalog,
  GaryClueDefinition,
  GaryCluePhase,
} from "../../../src/content/index.js";
import {
  deriveRoomSeed,
  frequencyThreshold,
  garyCluePhaseFor,
  generateGaryClue,
  GaryClueGenerationError,
  semanticTreasureRoll,
} from "../../../src/room/index.js";
import type { GenerateGaryClueOptions } from "../../../src/room/clues/index.js";

describe("Gary clue frequency", () => {
  it.each([
    ["shallow", 15],
    ["middle", 20],
    ["deep", 25],
    ["extreme", 30],
  ] as const)("uses the inclusive %s threshold %i", (depthBand, threshold) => {
    expect(frequencyThreshold(depthBand)).toBe(threshold);
    for (const wanted of [1, threshold - 1, threshold, threshold + 1, 100]) {
      const result = generateGaryClue(
        options({
          depthBand,
          treasure: treasureForFrequency(wanted),
          catalog: catalogFor(depthBand),
        }),
      );
      expect(result.present).toBe(wanted <= threshold);
      expect(result.frequencyRoll).toEqual({ index: 39, value: wanted, sides: 100 });
      if (!result.present) expect(result.selectionRoll).toBeUndefined();
    }
  });
});

describe("Gary clue phase and campaign history", () => {
  it("derives all six phases only from campaign seed and room number", () => {
    expect(Array.from({ length: 6 }, (_, index) => garyCluePhaseFor(0, index + 1))).toEqual([
      1, 2, 3, 4, 5, 0,
    ]);
    expect(garyCluePhaseFor(626, 25)).toBe(3);
  });

  it("filters by phase and falls back to all eligible clues when that phase is empty", () => {
    const catalog = makeCatalog([clue("Phase zero", 0), clue("Phase one", 1)]);
    const phaseOne = generateGaryClue(
      options({ catalog, history: history(0), roomNumber: 1, treasure: treasureForFrequency(1) }),
    );
    expect(phaseOne.phase).toBe(1);
    expect(phaseOne.clue?.definition.title).toBe("Phase one");

    const fallback = generateGaryClue(
      options({ catalog, history: history(0), roomNumber: 2, treasure: treasureForFrequency(1) }),
    );
    expect(fallback.phase).toBe(2);
    expect(["Phase zero", "Phase one"]).toContain(fallback.clue?.definition.title);
  });

  it("blocks virtual choices from the previous five room numbers only", () => {
    const catalog = makeCatalog([clue("Alpha", 0), clue("Bravo", 0), clue("Charlie", 0)]);
    const campaignSeed = campaignSeedFor(0, 12, 2, 3);
    const base = {
      catalog,
      roomNumber: 12,
      treasure: treasureForFrequency(1),
    } as const;
    const noHistory = generateGaryClue(options({ ...base, history: history(campaignSeed) }));
    expect(noHistory.clue?.definition.title).toBe("Bravo");

    const oneRecent = generateGaryClue(
      options({
        ...base,
        history: history(campaignSeed, { roomNumber: 11, clueTitle: "Bravo" }),
      }),
    );
    expect(oneRecent.clue?.definition.title).not.toBe("Bravo");

    const oldOnly = generateGaryClue(
      options({
        ...base,
        history: history(campaignSeed, { roomNumber: 6, clueTitle: "Bravo" }),
      }),
    );
    expect(oldOnly.clue?.definition.title).toBe("Bravo");

    const multiple = generateGaryClue(
      options({
        ...base,
        history: history(
          campaignSeed,
          { roomNumber: 7, clueTitle: "Alpha" },
          { roomNumber: 9, clueTitle: "Bravo" },
        ),
      }),
    );
    expect(multiple.clue?.definition.title).toBe("Charlie");
  });

  it("falls back to the complete phased pool when every candidate is recent", () => {
    const catalog = makeCatalog([clue("Alpha", 0), clue("Bravo", 0)]);
    const campaignSeed = campaignSeedFor(0, 12, 2, 2);
    const result = generateGaryClue(
      options({
        catalog,
        roomNumber: 12,
        treasure: treasureForFrequency(1),
        history: history(
          campaignSeed,
          { roomNumber: 10, clueTitle: "Alpha" },
          { roomNumber: 11, clueTitle: "Bravo" },
        ),
      }),
    );
    expect(result.selectionRoll.sides).toBe(2);
    expect(["Alpha", "Bravo"]).toContain(result.clue.definition.title);
  });
});

describe("Gary clue selection and integration contract", () => {
  it.each([
    [1, "First"],
    [2, "Middle"],
    [3, "Last"],
  ] as const)("maps standalone selection %i to source-order candidate %s", (wanted, title) => {
    const catalog = makeCatalog([clue("First", 0), clue("Middle", 3), clue("Last", 5)]);
    const rewardSeed = rewardSeedForRolls(1, wanted, 3);
    const result = generateGaryClue(
      options({ catalog, treasure: treasure(rewardSeed, "Brazier") }),
    );
    expect(result.phase).toBeUndefined();
    expect(result.selectionRoll).toEqual({ index: 40, value: wanted, sides: 3 });
    expect(result.clue?.definition.title).toBe(title);
  });

  it("uses the exact treasure feature for placement without mutating treasure", () => {
    const rewardSeed = rewardSeedForRolls(1, 1, 1);
    for (const featureName of ["First Feature", "Second Feature"]) {
      const selectedTreasure = Object.freeze(treasure(rewardSeed, featureName));
      const snapshot = structuredClone(selectedTreasure);
      const result = generateGaryClue(options({ treasure: selectedTreasure }));
      expect(result.clue?.placementFeatureName).toBe(featureName);
      expect(selectedTreasure).toEqual(snapshot);
    }
  });

  it("matches focused active-Bash standalone and campaign golden results", () => {
    const bashCatalog = makeCatalog([
      clue("Safe Footing Card", 1),
      clue("West Bridge Warning", 2),
      clue("Draft Test", 1),
      clue("Lamp Schedule", 4, "maintenance"),
      clue("Replacement Pin", 5, "maintenance"),
      clue("Drain Cleaning Stub", 0, "maintenance"),
      clue("Patrol Timing", 3, "observational"),
    ]);
    const standalone = generateGaryClue(
      options({ catalog: bashCatalog, treasure: treasure(616, "Brazier") }),
    );
    // Bash semantic roll 39 is 77 for seed 616, so force the verified selection
    // fixture through a seed with the same roll-40 boundary and a present roll-39.
    const selection = semanticTreasureRoll(616, 40, 7);
    const equivalentSeed = rewardSeedForRolls(1, selection, 7);
    const equivalent = generateGaryClue(
      options({ catalog: bashCatalog, treasure: treasure(equivalentSeed, "Brazier") }),
    );
    expect(standalone.present).toBe(false);
    expect(equivalent.clue?.definition.title).toBe(bashCatalog.clues[selection - 1]?.title);

    const campaign = generateGaryClue(
      options({
        catalog: bashCatalog,
        roomNumber: 1,
        treasure: treasureForFrequency(1),
        history: history(0),
      }),
    );
    expect(campaign.clue?.definition.title).toBe("Draft Test");
  });

  it("is deterministic, deeply immutable, pure, and validates inputs", () => {
    const input = options({ treasure: treasureForFrequency(1) });
    const catalogSnapshot = structuredClone(input.catalog);
    const first = generateGaryClue(input);
    const second = generateGaryClue(options({ treasure: treasureForFrequency(1) }));
    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.clue)).toBe(true);
    expect(Object.isFrozen(first.clue?.definition)).toBe(true);
    expect(input.catalog).toEqual(catalogSnapshot);
    expect(() => generateGaryClue(options({ roomNumber: 0 }))).toThrow(GaryClueGenerationError);
    expect(() =>
      generateGaryClue(
        options({
          roomNumber: 2,
          history: history(1, { roomNumber: 2, clueTitle: "Future" }),
        }),
      ),
    ).toThrow(/current or a future room/);
  });
});

function options(overrides: Partial<GenerateGaryClueOptions> = {}): GenerateGaryClueOptions {
  return {
    catalog: makeCatalog([clue("First", 1)]),
    roomNumber: 1,
    depthBand: "shallow",
    neighborhoodId: "lost-mines",
    treasure: treasureForFrequency(1),
    ...overrides,
  };
}

function clue(
  title: string,
  phase: GaryCluePhase,
  category: GaryClueDefinition["category"] = "practical",
  depthBand: GaryClueDefinition["depthBand"] = "shallow",
): GaryClueDefinition {
  return Object.freeze({
    depthBand,
    neighborhoodId: "*",
    phase,
    category,
    title,
    description: `${title} description.`,
    implication: undefined,
    presentation: "direct",
  });
}

function catalogFor(depthBand: GaryClueDefinition["depthBand"]): GaryClueCatalog {
  return makeCatalog([clue(`${depthBand} clue`, 1, "practical", depthBand)]);
}

function makeCatalog(clues: readonly GaryClueDefinition[]): GaryClueCatalog {
  return Object.freeze({ clues: Object.freeze([...clues]) });
}

function history(campaignSeed: number, ...recentSelections: GaryClueHistoryEntryFixture[]) {
  return Object.freeze({ campaignSeed, recentSelections: Object.freeze(recentSelections) });
}

type GaryClueHistoryEntryFixture = { readonly roomNumber: number; readonly clueTitle: string };

function treasure(rewardSeed: number, featureName: string) {
  return { rewardSeed, featureName };
}

function treasureForFrequency(wanted: number) {
  return treasure(seedForRoll(39, 100, wanted), "Brazier");
}

function rewardSeedForRolls(frequency: number, selection: number, selectionSides: number): number {
  for (let seed = 0; seed < 1_000_000; seed += 1) {
    if (
      semanticTreasureRoll(seed, 39, 100) === frequency &&
      semanticTreasureRoll(seed, 40, selectionSides) === selection
    )
      return seed;
  }
  throw new Error("No matching reward seed found.");
}

function campaignSeedFor(
  phase: GaryCluePhase,
  roomNumber: number,
  selected: number,
  sides: number,
): number {
  for (let seed = 0; seed < 1_000_000; seed += 1) {
    if (
      garyCluePhaseFor(seed, roomNumber) === phase &&
      semanticTreasureRoll(deriveRoomSeed(seed, roomNumber), 138, sides) === selected
    )
      return seed;
  }
  throw new Error("No matching campaign seed found.");
}

function seedForRoll(index: number, sides: number, wanted: number): number {
  for (let seed = 0; seed < 1_000_000; seed += 1)
    if (semanticTreasureRoll(seed, index, sides) === wanted) return seed;
  throw new Error("No matching semantic seed found.");
}
