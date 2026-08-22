import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { loadGaryClueCatalog, parseTsv, type GaryClueCatalog } from "../../../src/content/index.js";
import { generateGaryClue } from "../../../src/room/index.js";

let catalog: GaryClueCatalog;

beforeAll(async () => {
  const root = resolve(import.meta.dirname, "../../..");
  const text = await readFile(resolve(root, "data/clues/gary_clues.tsv"), "utf8");
  catalog = loadGaryClueCatalog({
    clues: parseTsv(text, { source: "data/clues/gary_clues.tsv" }),
  });
});

describe("active Bash Gary-clue parity fixtures", () => {
  it("ports every authored record, category, presentation, and ordinal-derived phase", () => {
    expect(catalog.clues).toHaveLength(64);
    expect(new Set(catalog.clues.map((value) => value.category))).toEqual(
      new Set(["practical", "maintenance", "observational", "personal"]),
    );
    expect(catalog.clues.filter((value) => value.presentation === "misleading")).toHaveLength(2);
    expect(catalog.clues.slice(0, 6).map((value) => value.phase)).toEqual([1, 2, 3, 4, 5, 0]);
  });

  it("matches verified standalone source-order selection", () => {
    const result = generateGaryClue({
      catalog,
      roomNumber: 1,
      depthBand: "shallow",
      neighborhoodId: "lost-mines",
      treasure: { rewardSeed: 40, featureName: "Brazier" },
    });
    expect(result).toMatchObject({
      present: true,
      phase: undefined,
      frequencyRoll: { index: 39, value: 1, sides: 100 },
      selectionRoll: { index: 40, value: 3, sides: 11 },
      clue: {
        placementFeatureName: "Brazier",
        definition: { title: "Pressure Mark Key", phase: 4 },
      },
    });
  });

  it("matches every verified phase fixture and the phase-empty fallback", () => {
    const expected = [
      "Draft Test",
      "West Bridge Warning",
      "Patrol Timing",
      "Pressure Mark Key",
      "Replacement Pin",
      "Drain Cleaning Stub",
    ];
    const actual = Array.from({ length: 6 }, (_, index) =>
      generateGaryClue({
        catalog,
        roomNumber: index + 1,
        depthBand: "shallow",
        neighborhoodId: "lost-mines",
        treasure: { rewardSeed: 40, featureName: "Brazier" },
        history: { campaignSeed: 0, recentSelections: [] },
      }),
    );
    expect(actual.map((value) => value.clue?.definition.title)).toEqual(expected);
    expect(actual.map((value) => value.phase)).toEqual([1, 2, 3, 4, 5, 0]);

    const fallback = generateGaryClue({
      catalog,
      roomNumber: 2,
      depthBand: "shallow",
      neighborhoodId: "unknown-neighborhood",
      treasure: { rewardSeed: 40, featureName: "Crates" },
      history: { campaignSeed: 0, recentSelections: [] },
    });
    expect(fallback.present).toBe(true);
  });

  it("matches verified recent exclusion and exhausted-pool fallback", () => {
    const recentExcluded = generateGaryClue({
      catalog,
      roomNumber: 2,
      depthBand: "shallow",
      neighborhoodId: "lost-mines",
      treasure: { rewardSeed: 40, featureName: "Brazier" },
      history: {
        campaignSeed: 5,
        recentSelections: [{ roomNumber: 1, clueTitle: "Safe Footing Card" }],
      },
    });
    expect(recentExcluded.clue?.definition.title).toBe("Draft Test");

    const exhausted = generateGaryClue({
      catalog,
      roomNumber: 7,
      depthBand: "shallow",
      neighborhoodId: "lost-mines",
      treasure: { rewardSeed: 40, featureName: "Brazier" },
      history: {
        campaignSeed: 0,
        recentSelections: [
          { roomNumber: 2, clueTitle: "Safe Footing Card" },
          { roomNumber: 3, clueTitle: "Draft Test" },
          { roomNumber: 4, clueTitle: "Draft Test" },
          { roomNumber: 5, clueTitle: "Draft Test" },
          { roomNumber: 6, clueTitle: "Draft Test" },
        ],
      },
    });
    expect(exhausted.selectionRoll.sides).toBe(2);
    expect(exhausted.clue.definition.title).toBe("Draft Test");
  });
});
