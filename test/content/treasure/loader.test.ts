import { describe, expect, it } from "vitest";

import { loadTreasureCatalog, parseTsv, TreasureCatalogError } from "../../../src/content/index.js";

const HAZARDS = Object.freeze([{ name: "Falling Net" }, { name: "Hidden Pit" }]);

describe("loadTreasureCatalog", () => {
  it("loads preferred schemas in source order and deeply freezes them", () => {
    const catalog = loadTreasureCatalog(validInput(), { hazards: HAZARDS });
    expect(catalog.items.map((value) => value.name)).toEqual(["Healing Potion", "Old Mask"]);
    expect(catalog.hazardSalvage[0]).toEqual({
      hazardName: "Falling Net",
      description: "weighted netting",
    });
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog.items)).toBe(true);
    expect(Object.isFrozen(catalog.items[0])).toBe(true);
  });

  it("accepts the active record-key compatibility schemas", () => {
    const catalog = loadTreasureCatalog(
      {
        loot: table(
          "record_type\tname\tcategory\trarity\tdescription",
          "loot\tHealing Potion\tpotion\tcommon\tUseful.",
          "loot.tsv",
        ),
        hazardSalvage: table(
          "record_type\thazard_name\tdescription",
          "salvage\tFalling Net\tweighted netting",
          "salvage.tsv",
        ),
      },
      { hazards: [{ name: "Falling Net" }] },
    );
    expect(catalog.items[0]?.category).toBe("potion");
  });

  it.each([
    ["category", "unknown", "Unknown treasure category"],
    ["rarity", "mythic", "Unknown treasure rarity"],
  ] as const)(
    "rejects invalid %s values with source-aware diagnostics",
    (field, value, message) => {
      const values = { category: "potion", rarity: "common", [field]: value };
      expect(() =>
        loadTreasureCatalog(
          {
            ...validInput(),
            loot: table(
              "name\tcategory\trarity\tdescription",
              `Item\t${values.category}\t${values.rarity}\tUseful.`,
              "bad-loot.tsv",
            ),
          },
          { hazards: HAZARDS },
        ),
      ).toThrow(`bad-loot.tsv:2: ${message}`);
    },
  );

  it("rejects case-insensitive duplicates and identifies the earlier source", () => {
    expect(() =>
      loadTreasureCatalog(
        {
          ...validInput(),
          loot: table(
            "name\tcategory\trarity\tdescription",
            "Old Mask\tart\tmundane\tOne.\nOLD MASK\tart\tmundane\tTwo.",
            "duplicate.tsv",
          ),
        },
        { hazards: HAZARDS },
      ),
    ).toThrow(/duplicate\.tsv:3: Duplicate item name.*earlier source duplicate\.tsv:2/);
  });

  it("rejects dangling, duplicate, and missing hazard salvage", () => {
    const input = validInput();
    expect(() =>
      loadTreasureCatalog(
        {
          ...input,
          hazardSalvage: table(
            "hazard_name\tdescription",
            "Unknown Trap\tparts\nHidden Pit\thinges",
            "dangling.tsv",
          ),
        },
        { hazards: HAZARDS },
      ),
    ).toThrow('dangling.tsv:2: Unknown hazard reference "Unknown Trap"');
    expect(() =>
      loadTreasureCatalog(
        {
          ...input,
          hazardSalvage: table(
            "hazard_name\tdescription",
            "Falling Net\tparts\nfalling net\tother parts\nHidden Pit\thinges",
            "duplicate-salvage.tsv",
          ),
        },
        { hazards: HAZARDS },
      ),
    ).toThrow(TreasureCatalogError);
    expect(() =>
      loadTreasureCatalog(
        {
          ...input,
          hazardSalvage: table("hazard_name\tdescription", "Falling Net\tparts", "missing.tsv"),
        },
        { hazards: HAZARDS },
      ),
    ).toThrow('Missing salvage for hazard "Hidden Pit"');
  });

  it("rejects empty tables, malformed record keys, and unsupported schemas", () => {
    expect(() =>
      loadTreasureCatalog(
        {
          ...validInput(),
          loot: parseTsv("name\tcategory\trarity\tdescription", { source: "empty.tsv" }),
        },
        { hazards: HAZARDS },
      ),
    ).toThrow("empty.tsv:1: Table must contain at least one record");
    expect(() =>
      loadTreasureCatalog(
        {
          ...validInput(),
          loot: table(
            "record_type\tname\tcategory\trarity\tdescription",
            "item\tName\tpotion\tcommon\tText.",
            "key.tsv",
          ),
        },
        { hazards: HAZARDS },
      ),
    ).toThrow('key.tsv:2: Expected record_type "loot"');
    expect(() =>
      loadTreasureCatalog(
        { ...validInput(), loot: table("name\twrong", "Item\tvalue", "schema.tsv") },
        { hazards: HAZARDS },
      ),
    ).toThrow("schema.tsv:1: Unsupported schema");
  });
});

function validInput() {
  return {
    loot: table(
      "name\tcategory\trarity\tdescription",
      "Healing Potion\tpotion\tcommon\tUseful.\nOld Mask\tart\tmundane\tInteresting.",
      "loot.tsv",
    ),
    hazardSalvage: table(
      "hazard_name\tdescription",
      "Falling Net\tweighted netting\nHidden Pit\thinges and springs",
      "salvage.tsv",
    ),
  } as const;
}

function table(header: string, records: string, source: string) {
  return parseTsv(`${header}\n${records}`, { source });
}
