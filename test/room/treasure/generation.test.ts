import { describe, expect, it } from "vitest";

import type { TreasureCatalog } from "../../../src/content/index.js";
import {
  deriveRoomSeed,
  generateRoomTreasure,
  semanticTreasureRoll,
  TreasureGenerationError,
} from "../../../src/room/index.js";
import type { GenerateRoomTreasureOptions } from "../../../src/room/treasure/index.js";
import { TREASURE_CATALOG } from "../fixtures.js";

describe("Bash-compatible reward seed contract", () => {
  it("matches verified Bash seed and semantic rolls", () => {
    const rewardSeed = deriveRoomSeed(1010, 10_001);
    expect(rewardSeed).toBe(1_732_962_383);
    expect([
      semanticTreasureRoll(rewardSeed, 35, 9),
      semanticTreasureRoll(rewardSeed, 36, 3),
      semanticTreasureRoll(rewardSeed, 37, 2),
      semanticTreasureRoll(rewardSeed, 38, 100),
      semanticTreasureRoll(rewardSeed, 47, 6),
      semanticTreasureRoll(rewardSeed, 48, 4),
      semanticTreasureRoll(rewardSeed, 49, 6),
    ]).toEqual([6, 2, 1, 99, 6, 2, 5]);
  });

  it("records only treasure semantics and leaves Gary rolls 39-40 unclaimed", () => {
    const treasure = generateRoomTreasure(options());
    expect(Object.values(treasure.rolls).map((roll) => roll.index)).toEqual([
      35, 36, 37, 38, 47, 48, 49,
    ]);
  });

  it.each([
    [1, "common"],
    [4, "common"],
    [5, "uncommon"],
    [6, "rare"],
    [7, "very-rare"],
    [8, "legendary"],
  ] as const)("honors helpful weighted boundary %i", (wantedRoll, expectedRarity) => {
    const result = generateRoomTreasure(
      options({
        catalog: rankedCatalog(),
        roomSeed: seedForRoll(35, 8, wantedRoll),
        partyLevel: 20,
        depthBand: "shallow",
      }),
    );
    expect(result.helpful.rarity).toBe(expectedRarity);
  });

  it.each([
    [1, "Mundane story"],
    [2, "Story common"],
    [3, "Story uncommon"],
    [4, "Story rare"],
    [5, "Story very-rare"],
    [6, "Story legendary"],
  ] as const)("honors narrative row boundary %i", (wantedRoll, expectedName) => {
    const result = generateRoomTreasure(
      options({
        catalog: rankedCatalog(),
        roomSeed: seedForRoll(36, 6, wantedRoll),
        partyLevel: 20,
      }),
    );
    expect(result.narrative.name).toBe(expectedName);
  });
});

describe("generateRoomTreasure", () => {
  it("generates every active treasure object for a visible hazard", () => {
    const treasure = generateRoomTreasure(options());
    expect(treasure).toMatchObject({
      helpful: { name: "Potion of Healing", category: "potion", rarity: "common" },
      narrative: { name: "Prisoner's Seal", category: "quest", rarity: "uncommon" },
      valuables: {
        gpValue: 13,
        description: "13 gp in mixed coin and one small polished gemstone",
      },
      featureName: "Brazier",
      location: "Concealed beside the Brazier.",
      context: "Together, the finds resemble practical stores and abandoned belongings.",
      salvage: {
        hazardName: "Falling Net",
        materials: "weighted netting, trip wire, and release hooks",
        text: "Once made safe, the Falling Net provides weighted netting, trip wire, and release hooks.",
      },
    });
  });

  it("selects but does not expose salvage when the hazard is not retained", () => {
    const treasure = generateRoomTreasure(options({ retainHazard: false }));
    expect(treasure.salvage).toBeUndefined();
    expect(treasure.rolls.salvage.index).toBe(49);
  });

  it.each([
    ["shallow", 1],
    ["middle", 2],
    ["deep", 3],
    ["extreme", 5],
  ] as const)("weights %s helpful treasure toward rarity rank %i", (depthBand, rank) => {
    const catalog = rankedCatalog();
    const generated = Array.from(
      { length: 160 },
      (_, roomSeed) =>
        generateRoomTreasure(options({ catalog, roomSeed, depthBand, partyLevel: 20 })).helpful
          .rarity,
    );
    const targetRarity = ["", "common", "uncommon", "rare", "very-rare", "legendary"][rank];
    expect(generated.filter((value) => value === targetRarity).length).toBeGreaterThan(30);
  });

  it.each([
    [1, "uncommon"],
    [4, "uncommon"],
    [5, "rare"],
    [10, "rare"],
    [11, "very-rare"],
    [16, "very-rare"],
    [17, "legendary"],
    [20, "legendary"],
  ] as const)("caps level %i helpful and narrative rarity at %s", (partyLevel, maximum) => {
    const treasure = Array.from({ length: 100 }, (_, roomSeed) =>
      generateRoomTreasure(
        options({ catalog: rankedCatalog(), roomSeed, partyLevel, depthBand: "extreme" }),
      ),
    );
    const rank = (value: string) =>
      ["mundane", "curiosity", "common", "uncommon", "rare", "very-rare", "legendary"].indexOf(
        value,
      );
    expect(Math.max(...treasure.map((value) => rank(value.helpful.rarity)))).toBeLessThanOrEqual(
      rank(maximum),
    );
    expect(Math.max(...treasure.map((value) => rank(value.narrative.rarity)))).toBeLessThanOrEqual(
      rank(maximum),
    );
  });

  it.each([
    ["shallow", "low", 1, 7],
    ["middle", "moderate", 5, 52],
    ["deep", "high", 10, 148],
    ["extreme", "high", 20, 278],
  ] as const)(
    "uses exact valuables scaling for %s/%s at level %i",
    (depthBand, difficulty, partyLevel, expectedBase) => {
      const treasure = generateRoomTreasure(
        options({ depthBand, difficulty, partyLevel, roomSeed: seedForRoll(38, 100, 1) }),
      );
      expect(treasure.valuables.gpValue).toBe(expectedBase);
    },
  );

  it("uses first and second feature positions without modifying feature order", () => {
    const features = Object.freeze([{ name: "First" }, { name: "Second" }]);
    const first = generateRoomTreasure(options({ roomSeed: seedForRoll(37, 2, 1), features }));
    const second = generateRoomTreasure(options({ roomSeed: seedForRoll(37, 2, 2), features }));
    expect(first.featureName).toBe("First");
    expect(second.featureName).toBe("Second");
    expect(features).toEqual([{ name: "First" }, { name: "Second" }]);
  });

  it("uses neighborhood flavor only in the authored context sentence", () => {
    const treasure = generateRoomTreasure(
      options({ neighborhoodTreasureFlavor: "mining tools and ore samples" }),
    );
    expect(treasure.context).toContain("mining tools and ore samples");
  });

  it("excludes five recent choices and falls back deterministically when exhausted", () => {
    const history = Object.freeze({
      campaignSeed: 616,
      recentHelpfulNames: Object.freeze(["Potion of Healing"]),
      recentNarrativeNames: Object.freeze(["Carved Bone Statuette", "Prisoner's Seal"]),
      recentSalvageVariations: Object.freeze([1]),
    });
    const snapshot = structuredClone(history);
    const treasure = generateRoomTreasure(options({ history }));
    expect(treasure.helpful.name).toBe("Scroll of Knock");
    expect(treasure.narrative.name).toBe("Tiny Mechanical Crab");
    expect(treasure.salvage?.variation).not.toBe(1);
    expect(treasure.rolls).toMatchObject({
      helpful: { index: 136 },
      narrative: { index: 137 },
      salvage: { index: 139 },
    });
    expect(history).toEqual(snapshot);

    const exhausted = generateRoomTreasure(
      options({
        history: Object.freeze({
          campaignSeed: 616,
          recentHelpfulNames: Object.freeze(["Potion of Healing", "Scroll of Knock"]),
          recentNarrativeNames: Object.freeze([
            "Carved Bone Statuette",
            "Prisoner's Seal",
            "Tiny Mechanical Crab",
          ]),
          recentSalvageVariations: Object.freeze([]),
        }),
      }),
    );
    expect(exhausted.helpful.name).toBeTruthy();
    expect(exhausted.narrative.name).toBeTruthy();
  });

  it("is deterministic, deeply immutable, pure, and rejects invalid inputs", () => {
    const input = options();
    const snapshot = structuredClone(input.catalog);
    const first = generateRoomTreasure(input);
    const second = generateRoomTreasure(options());
    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.helpful)).toBe(true);
    expect(Object.isFrozen(first.valuables)).toBe(true);
    expect(Object.isFrozen(first.rolls)).toBe(true);
    expect(input.catalog).toEqual(snapshot);
    const mutableCatalog = structuredClone(TREASURE_CATALOG);
    generateRoomTreasure(options({ catalog: mutableCatalog }));
    expect(Object.isFrozen(mutableCatalog.items[0])).toBe(false);
    expect(() => generateRoomTreasure(options({ features: [{ name: "Only" }] }))).toThrow(
      TreasureGenerationError,
    );
    expect(() =>
      generateRoomTreasure(
        options({
          history: {
            campaignSeed: 1,
            recentHelpfulNames: ["a", "b", "c", "d", "e", "f"],
            recentNarrativeNames: [],
            recentSalvageVariations: [],
          },
        }),
      ),
    ).toThrow(/cannot exceed five/);
  });
});

function options(
  overrides: Partial<GenerateRoomTreasureOptions> = {},
): GenerateRoomTreasureOptions {
  return {
    catalog: TREASURE_CATALOG,
    roomSeed: 1010,
    roomNumber: 1,
    partyLevel: 1,
    depthBand: "shallow",
    difficulty: "low",
    features: Object.freeze([{ name: "Brazier" }, { name: "Crates" }]),
    neighborhoodTreasureFlavor: "practical stores and abandoned belongings",
    selectedHazard: Object.freeze({ name: "Falling Net", severity: "nuisance" }),
    retainHazard: true,
    ...overrides,
  };
}

function rankedCatalog(): TreasureCatalog {
  const rarities = ["common", "uncommon", "rare", "very-rare", "legendary"] as const;
  return Object.freeze({
    items: Object.freeze([
      ...rarities.map((rarity) =>
        Object.freeze({
          name: `Helpful ${rarity}`,
          category: "wondrous" as const,
          rarity,
          description: `${rarity} helpful item.`,
        }),
      ),
      Object.freeze({
        name: "Mundane story",
        category: "art" as const,
        rarity: "mundane" as const,
        description: "A story object.",
      }),
      ...rarities.map((rarity) =>
        Object.freeze({
          name: `Story ${rarity}`,
          category: "quest" as const,
          rarity,
          description: `${rarity} story item.`,
        }),
      ),
    ]),
    hazardSalvage: TREASURE_CATALOG.hazardSalvage,
  });
}

function seedForRoll(index: number, sides: number, wanted: number): number {
  for (let roomSeed = 0; roomSeed < 100_000; roomSeed += 1) {
    const rewardSeed = deriveRoomSeed(roomSeed, 10_001);
    if (semanticTreasureRoll(rewardSeed, index, sides) === wanted) return roomSeed;
  }
  throw new Error("Unable to find deterministic fixture seed.");
}
