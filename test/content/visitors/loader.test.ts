import { describe, expect, it } from "vitest";

import {
  loadRecurringVisitorCatalog,
  parseTsv,
  RecurringVisitorCatalogError,
} from "../../../src/content/index.js";

describe("loadRecurringVisitorCatalog", () => {
  it("loads preferred schemas in source order and deeply freezes them", () => {
    const catalog = loadRecurringVisitorCatalog(validInput());
    expect(catalog.visitors.map((value) => value.id)).toEqual(["spork", "stranger"]);
    expect(catalog.scenes[0]).toMatchObject({
      visitorId: "spork",
      key: "rubble-rescue",
      reward: undefined,
      hook: "Tool marks.",
    });
    expect(catalog.sporkStock.map((value) => value.name)).toEqual(["Rope", "Mouse"]);
    expect(catalog.authoredSporkItems).toEqual([]);
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog.scenes)).toBe(true);
    expect(Object.isFrozen(catalog.scenes[0])).toBe(true);
  });

  it("accepts record-key compatibility schemas and verifies repeated display names", () => {
    const input = validInput();
    const catalog = loadRecurringVisitorCatalog({
      visitors: table(
        "record_type\tid\tname\tperiod\tschedule_index\tfirst_eligible_room",
        "visitor\tspork\tSpork\t20\t161\t7",
        "visitors.tsv",
      ),
      scenes: table(
        "record_type\tvisitor_id\tvisitor_name\tscene_key\tcontext\tsetup\tdescription\tdialogue\toutcome\treward\thook",
        "visitor\tspork\tSpork\trubble-rescue\tany\tSetup\tDescription.\tHello.\tLeaves.\t-\tHook.",
        "scenes.tsv",
      ),
      sporkStock: table(
        "record_type\tstock_type\tname\trarity\tstory",
        "stock\tmundane\tRope\tmundane\tKnotted.",
        "stock.tsv",
      ),
    });
    expect(catalog.scenes[0]?.visitorId).toBe("spork");
    expect(() =>
      loadRecurringVisitorCatalog({
        ...input,
        scenes: table(
          "record_type\tvisitor_id\tvisitor_name\tscene_key\tcontext\tsetup\tdescription\tdialogue\toutcome\treward\thook",
          "visitor\tspork\tWrong Name\trubble-rescue\tany\tSetup\tDescription.\tHello.\tLeaves.\t-\tHook.",
          "bad-name.tsv",
        ),
      }),
    ).toThrow("bad-name.tsv:2: Visitor display name does not match");
  });

  it("rejects duplicate visitor IDs/names and duplicate per-visitor scene keys", () => {
    const input = validInput();
    expect(() =>
      loadRecurringVisitorCatalog({
        ...input,
        visitors: table(
          VISITOR_HEADER,
          "spork\tSpork\t20\t161\t7\nspork\tOther\t20\t162\t2",
          "duplicate-visitors.tsv",
        ),
      }),
    ).toThrow(/Duplicate visitor ID/);
    expect(() =>
      loadRecurringVisitorCatalog({
        ...input,
        scenes: table(
          SCENE_HEADER,
          `${SCENE}\nspork\trubble-rescue\tany\tOther\tOther.\tHello.\tLeaves.\t-\t-`,
          "duplicate-scenes.tsv",
        ),
      }),
    ).toThrow(/duplicate-scenes\.tsv:3: Duplicate visitor scene key/);
  });

  it("rejects dangling references, invalid contexts, schedules, and stock metadata", () => {
    const input = validInput();
    expect(() =>
      loadRecurringVisitorCatalog({
        ...input,
        scenes: table(
          SCENE_HEADER,
          "unknown\tscene\tany\tSetup\tDescription.\tHello.\tLeaves.\t-\t-",
          "dangling.tsv",
        ),
      }),
    ).toThrow('dangling.tsv:2: Unknown visitor reference "unknown"');
    expect(() =>
      loadRecurringVisitorCatalog({
        ...input,
        scenes: table(SCENE_HEADER, SCENE.replace("\tany\t", "\tcombat\t"), "context.tsv"),
      }),
    ).toThrow('context.tsv:2: Unknown context "combat"');
    expect(() =>
      loadRecurringVisitorCatalog({
        ...input,
        visitors: table(VISITOR_HEADER, "spork\tSpork\t0\t161\t7", "schedule.tsv"),
      }),
    ).toThrow('schedule.tsv:2: Field "period" must be a positive integer');
    expect(() =>
      loadRecurringVisitorCatalog({
        ...input,
        sporkStock: table(STOCK_HEADER, "companion\tMouse\tmundane\tQuiet.", "stock.tsv"),
      }),
    ).toThrow('stock.tsv:2: Rarity "mundane" is invalid for companion stock');
    expect(() =>
      loadRecurringVisitorCatalog({
        ...input,
        sporkStock: table(
          STOCK_HEADER,
          "companion\tMouse\tcompanion\tIt grants an attack bonus.",
          "combat-stock.tsv",
        ),
      }),
    ).toThrow("combat-stock.tsv:2: Companion stock must not grant combat mechanics");
  });

  it("rejects malformed record keys, unsupported schemas, and empty tables", () => {
    const input = validInput();
    expect(() =>
      loadRecurringVisitorCatalog({
        ...input,
        sporkStock: table(
          "record_type\tstock_type\tname\trarity\tstory",
          "item\tmundane\tRope\tmundane\tKnotted.",
          "key.tsv",
        ),
      }),
    ).toThrow('key.tsv:2: Expected record_type "stock"');
    expect(() =>
      loadRecurringVisitorCatalog({
        ...input,
        scenes: table("name\twrong", "Scene\tvalue", "schema.tsv"),
      }),
    ).toThrow(RecurringVisitorCatalogError);
    expect(() =>
      loadRecurringVisitorCatalog({
        ...input,
        visitors: parseTsv(VISITOR_HEADER, { source: "empty.tsv" }),
      }),
    ).toThrow("empty.tsv:1: Table must contain at least one record");
  });

  it("loads optional authored Spork items with the canonical shared item taxonomy", () => {
    const catalog = loadRecurringVisitorCatalog({
      ...validInput(),
      authoredSporkItems: table(
        "id\tname\tcategory\trarity\tdescription\tpresentation\tavailability\trepeatable\tsource\tnotes",
        "orrery\tPocket Orrery\twondrous\trare\tA brass model.\tSpork polishes it.\tdm_choice\tdm\tTest pack\tDM decides its precision.",
        "spork_items.tsv",
      ),
    });
    expect(catalog.authoredSporkItems[0]).toMatchObject({
      id: "orrery",
      category: "wondrous",
      rarity: "rare",
      availability: "dm_choice",
      repeatable: "dm",
    });
  });
});

const VISITOR_HEADER = "id\tname\tperiod\tschedule_index\tfirst_eligible_room";
const SCENE_HEADER =
  "visitor_id\tscene_key\tcontext\tsetup\tdescription\tdialogue\toutcome\treward\thook";
const STOCK_HEADER = "stock_type\tname\trarity\tstory";
const SCENE = "spork\trubble-rescue\tany\tSetup\tDescription.\tHello.\tLeaves.\t-\tTool marks.";

function validInput() {
  return {
    visitors: table(
      VISITOR_HEADER,
      "spork\tSpork\t20\t161\t7\nstranger\tThe Stranger\t40\t163\t7",
      "visitors.tsv",
    ),
    scenes: table(
      SCENE_HEADER,
      `${SCENE}\nstranger\tshared-apple\tpeaceful\tMeal\tHe waits.\tShare?\tLeaves.\t-\t-`,
      "scenes.tsv",
    ),
    sporkStock: table(
      STOCK_HEADER,
      "mundane\tRope\tmundane\tKnotted.\ncompanion\tMouse\tcompanion\tIt follows crumbs.",
      "stock.tsv",
    ),
  };
}

function table(header: string, records: string, source: string) {
  return parseTsv(`${header}\n${records}`, { source });
}
