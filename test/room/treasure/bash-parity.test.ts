import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { loadTreasureCatalog, parseTsv, type TreasureCatalog } from "../../../src/content/index.js";
import { generateRoomTreasure } from "../../../src/room/index.js";

let catalog: TreasureCatalog;

beforeAll(async () => {
  const root = resolve(import.meta.dirname, "../../..");
  const [lootText, salvageText] = await Promise.all([
    readFile(resolve(root, "data/treasure/loot.tsv"), "utf8"),
    readFile(resolve(root, "data/treasure/hazard_salvage.tsv"), "utf8"),
  ]);
  const hazardSalvage = parseTsv(salvageText, { source: "data/treasure/hazard_salvage.tsv" });
  catalog = loadTreasureCatalog(
    {
      loot: parseTsv(lootText, { source: "data/treasure/loot.tsv" }),
      hazardSalvage,
    },
    {
      hazards: hazardSalvage.rows.map((row) => ({ name: row.values.hazard_name as string })),
    },
  );
});

describe("active Bash treasure parity fixture", () => {
  it("ports all 150 loot records and all 40 hazard salvage records", () => {
    expect(catalog.items).toHaveLength(150);
    expect(catalog.hazardSalvage).toHaveLength(40);
    expect(new Set(catalog.items.map((value) => value.category))).toEqual(
      new Set([
        "coins",
        "gem",
        "art",
        "potion",
        "scroll",
        "weapon",
        "armor",
        "wondrous",
        "quest",
        "curiosity",
      ]),
    );
  });

  it("matches the verified Bash room-seed 1010 golden result", () => {
    const result = generateRoomTreasure({
      catalog,
      roomSeed: 1010,
      roomNumber: 1,
      partyLevel: 1,
      depthBand: "shallow",
      difficulty: "low",
      features: [{ name: "Brazier" }, { name: "Crates" }],
      neighborhoodTreasureFlavor: "practical stores and abandoned belongings",
      selectedHazard: { name: "Falling Net", severity: "nuisance" },
      retainHazard: true,
    });

    expect(result).toMatchObject({
      rewardSeed: 1_732_962_383,
      helpful: {
        name: "Sending Stones",
        category: "wondrous",
        rarity: "uncommon",
        description: "Two matching stones bear names that have been carefully filed away.",
      },
      narrative: {
        name: "Embroidered Vestments",
        category: "art",
        rarity: "uncommon",
        description: "Ceremonial vestments display a suppressed saint or rival religious order.",
      },
      valuables: {
        gpValue: 13,
        description: "13 gp in mixed coin and one small polished gemstone",
      },
      featureName: "Brazier",
      location: "Concealed beside the Brazier.",
      context: "Together, the finds resemble practical stores and abandoned belongings.",
      salvage: {
        text: "Once made safe, the Falling Net provides weighted netting, trip wire, and release hooks.",
      },
    });
  });
});
