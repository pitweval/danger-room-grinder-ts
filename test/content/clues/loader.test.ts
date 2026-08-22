import { describe, expect, it } from "vitest";

import { GaryClueCatalogError, loadGaryClueCatalog, parseTsv } from "../../../src/content/index.js";

describe("loadGaryClueCatalog", () => {
  it("loads the preferred schema in source order and deeply freezes it", () => {
    const catalog = loadGaryClueCatalog({ clues: preferred() });
    expect(catalog.clues).toEqual([
      {
        depthBand: "shallow",
        neighborhoodId: "*",
        phase: 0,
        category: "practical",
        title: "First",
        description: "A note signed Gary.",
        implication: undefined,
        presentation: "direct",
      },
      {
        depthBand: "middle",
        neighborhoodId: "lost-mines",
        phase: 5,
        category: "personal",
        title: "Second",
        description: "Another note.",
        implication: "It is true.",
        presentation: "misleading",
      },
    ]);
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog.clues)).toBe(true);
    expect(Object.isFrozen(catalog.clues[0])).toBe(true);
  });

  it("accepts active record-key rows and derives phase from global clue ordinal", () => {
    const clues = parseTsv(
      [
        "record_type\tdepth_band\tneighborhood\tcategory\ttitle\tdescription\timplication\tpresentation",
        "clue\tshallow\t*\tpractical\tOne\tText.\t-\tdirect",
        "clue\textreme\t*\tpersonal\tTwo\tText.\tTruth.\tmisleading",
        "clue\tdeep\t*\tmaintenance\tThree\tText.\t-\tdirect",
        "clue\tmiddle\t*\tobservational\tFour\tText.\t-\tdirect",
        "clue\tshallow\t*\tpractical\tFive\tText.\t-\tdirect",
        "clue\tshallow\t*\tpractical\tSix\tText.\t-\tdirect",
      ].join("\n"),
      { source: "legacy.tsv" },
    );
    expect(loadGaryClueCatalog({ clues }).clues.map((value) => value.phase)).toEqual([
      1, 2, 3, 4, 5, 0,
    ]);
  });

  it.each([
    ["phase", "6", "Unknown Gary clue phase"],
    ["category", "comic", "Unknown Gary clue category"],
    ["depth_band", "abyssal", "Unknown Gary clue depth band"],
    ["presentation", "false", "Unknown Gary clue presentation"],
    ["neighborhood", "Lost Mines", "Invalid Gary clue neighborhood"],
  ] as const)("rejects invalid %s with source-aware diagnostics", (field, value, message) => {
    const columns = {
      depth_band: "shallow",
      neighborhood: "*",
      phase: "0",
      category: "practical",
      title: "First",
      description: "Text.",
      implication: "-",
      presentation: "direct",
      [field]: value,
    };
    const clues = parseTsv(
      `${HEADER}\n${HEADER.split("\t")
        .map((key) => columns[key as keyof typeof columns])
        .join("\t")}`,
      { source: "bad.tsv" },
    );
    expect(() => loadGaryClueCatalog({ clues })).toThrow(`bad.tsv:2: ${message}`);
  });

  it("rejects duplicate titles, malformed rows, record keys, and schemas", () => {
    expect(() =>
      loadGaryClueCatalog({
        clues: parseTsv(
          `${HEADER}\nshallow\t*\t0\tpractical\tSame\tOne.\t-\tdirect\nshallow\t*\t1\tmaintenance\tSAME\tTwo.\t-\tdirect`,
          { source: "duplicate.tsv" },
        ),
      }),
    ).toThrow(/duplicate\.tsv:3: Duplicate clue title.*duplicate\.tsv:2/);
    expect(() => loadGaryClueCatalog({ clues: parseTsv(HEADER, { source: "empty.tsv" }) })).toThrow(
      "empty.tsv:1: Table must contain at least one record",
    );
    expect(() =>
      loadGaryClueCatalog({
        clues: parseTsv(
          "record_type\tdepth_band\tneighborhood\tcategory\ttitle\tdescription\timplication\tpresentation\nitem\tshallow\t*\tpractical\tOne\tText.\t-\tdirect",
          { source: "key.tsv" },
        ),
      }),
    ).toThrow('key.tsv:2: Expected record_type "clue"');
    expect(() =>
      loadGaryClueCatalog({
        clues: parseTsv("title\twrong\nOne\tvalue", { source: "schema.tsv" }),
      }),
    ).toThrow(GaryClueCatalogError);
  });
});

const HEADER =
  "depth_band\tneighborhood\tphase\tcategory\ttitle\tdescription\timplication\tpresentation";

function preferred() {
  return parseTsv(
    `${HEADER}\nshallow\t*\t0\tpractical\tFirst\tA note signed Gary.\t-\tdirect\nmiddle\tlost-mines\t5\tpersonal\tSecond\tAnother note.\tIt is true.\tmisleading`,
    { source: "clues.tsv" },
  );
}
