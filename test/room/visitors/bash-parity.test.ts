import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import {
  loadRecurringVisitorCatalog,
  loadTreasureCatalog,
  parseTsv,
  type RecurringVisitorCatalog,
  type TreasureCatalog,
} from "../../../src/content/index.js";
import {
  generateRecurringVisitor,
  generateSporkInventory,
  reconstructRecurringVisitorHistory,
  renderRecurringVisitor,
  type GenerateRecurringVisitorOptions,
  type RecurringVisitorHistory,
} from "../../../src/room/index.js";

let catalog: RecurringVisitorCatalog;
let treasureCatalog: TreasureCatalog;

beforeAll(async () => {
  const root = resolve(import.meta.dirname, "../../..");
  const [visitors, scenes, stock, loot, salvage] = await Promise.all([
    readFile(resolve(root, "data/visitors/visitors.tsv"), "utf8"),
    readFile(resolve(root, "data/visitors/scenes.tsv"), "utf8"),
    readFile(resolve(root, "data/visitors/spork_stock.tsv"), "utf8"),
    readFile(resolve(root, "data/treasure/loot.tsv"), "utf8"),
    readFile(resolve(root, "data/treasure/hazard_salvage.tsv"), "utf8"),
  ]);
  catalog = loadRecurringVisitorCatalog({
    visitors: parseTsv(visitors, { source: "data/visitors/visitors.tsv" }),
    scenes: parseTsv(scenes, { source: "data/visitors/scenes.tsv" }),
    sporkStock: parseTsv(stock, { source: "data/visitors/spork_stock.tsv" }),
  });
  const hazardSalvage = parseTsv(salvage, { source: "data/treasure/hazard_salvage.tsv" });
  treasureCatalog = loadTreasureCatalog(
    { loot: parseTsv(loot), hazardSalvage },
    { hazards: hazardSalvage.rows.map((row) => ({ name: row.values.hazard_name as string })) },
  );
});

describe("active recurring-visitor catalog", () => {
  it("ports all visitors, scenes, and Spork stock in source order", () => {
    expect(catalog.visitors.map((value) => [value.id, value.period, value.scheduleIndex])).toEqual([
      ["spork", 20, 161],
      ["job-goblin", 20, 162],
      ["stranger", 40, 163],
    ]);
    expect(catalog.scenes).toHaveLength(33);
    expect(catalog.sporkStock).toHaveLength(36);
    expect(catalog.sporkStock.filter((value) => value.stockType === "mundane")).toHaveLength(28);
    expect(catalog.sporkStock.filter((value) => value.stockType === "companion")).toHaveLength(8);
  });
});

describe("active Bash visitor schedule parity", () => {
  it("reconstructs the complete verified seed-618 schedule", () => {
    const history = reconstructRecurringVisitorHistory({
      catalog,
      campaignSeed: 618,
      targetRoom: 101,
    });
    expect(history.appearances).toEqual([
      { roomNumber: 1, visitorId: "spork" },
      { roomNumber: 11, visitorId: "spork" },
      { roomNumber: 17, visitorId: "job-goblin" },
      { roomNumber: 29, visitorId: "job-goblin" },
      { roomNumber: 38, visitorId: "stranger" },
      { roomNumber: 47, visitorId: "job-goblin" },
      { roomNumber: 53, visitorId: "stranger" },
      { roomNumber: 55, visitorId: "spork" },
      { roomNumber: 71, visitorId: "job-goblin" },
      { roomNumber: 76, visitorId: "spork" },
      { roomNumber: 81, visitorId: "job-goblin" },
      { roomNumber: 94, visitorId: "stranger" },
    ]);
  });

  it("forces Spork in Room 1 and otherwise suppresses standalone recurrence", () => {
    const first = generateRecurringVisitor(options({ roomNumber: 1 }));
    expect(first).toMatchObject({
      present: true,
      conflictRoll: undefined,
      appearance: { visitor: { id: "spork" } },
    });
    expect(generateRecurringVisitor(options({ roomNumber: 7 }))).toMatchObject({
      present: false,
      reason: "standalone",
      scheduleRolls: [],
    });
  });

  it("suppresses Boss Rooms before resolving schedule rolls", () => {
    const result = generateRecurringVisitor(
      options({
        roomNumber: 10,
        roomKind: "boss",
        history: reconstructed(10),
      }),
    );
    expect(result).toEqual({
      present: false,
      reason: "boss-room",
      scheduleRolls: [],
      conflictRoll: undefined,
      appearance: undefined,
    });
  });

  it("matches verified scene branches and dynamic semantic indices", () => {
    const cases = [
      [true, false, "lost-found-encounter"],
      [false, true, "lost-found-hazard"],
      [false, false, "lost-found-peaceful"],
      [true, true, "lost-found-hazard"],
    ] as const;
    for (const [hasEncounter, hasHazard, expected] of cases) {
      const result = generateRecurringVisitor(options({ hasEncounter, hasHazard }));
      expect(result.appearance?.scene.key).toBe(expected);
      expect(result.appearance?.sceneRoll.index).toBe(171);
    }

    const later = generateRecurringVisitor(
      options({ roomNumber: 11, history: reconstructed(11), hasEncounter: true, hasHazard: true }),
    );
    expect(later.appearance?.visitor.id).toBe("spork");
    expect(later.appearance?.scene.key).toBe("rubble-rescue");
    expect(later.appearance?.sceneRoll.index).toBe(181);

    const jobGoblin = generateRecurringVisitor(
      options({ roomNumber: 17, history: reconstructed(17), hasEncounter: true, hasHazard: true }),
    );
    expect(jobGoblin.appearance?.visitor.id).toBe("job-goblin");
    expect(jobGoblin.appearance?.scene.key).toBe("wall-patch");

    const stranger = generateRecurringVisitor(
      options({ roomNumber: 38, history: reconstructed(38), hasEncounter: true, hasHazard: true }),
    );
    expect(stranger.appearance?.visitor.id).toBe("stranger");
    expect(stranger.appearance?.scene.key).toBe("listening-wall");
  });

  it("allows visitors in signature and encounter-free rooms", () => {
    expect(
      generateRecurringVisitor(options({ roomKind: "signature", hasEncounter: false })).present,
    ).toBe(true);
    const peaceful = generateRecurringVisitor(
      options({ roomKind: "ordinary", hasEncounter: false, hasHazard: false }),
    );
    expect(peaceful.appearance?.scene.context).toBe("peaceful");
  });
});

describe("cooldown and conflict semantics", () => {
  it("excludes at 9 rooms and permits exactly 10 and 11 rooms later", () => {
    const everyRoom = scheduleCatalog(["alpha"]);
    expect(
      generateRecurringVisitor(
        options({
          catalog: everyRoom,
          roomNumber: 11,
          history: history(1, { roomNumber: 2, visitorId: "alpha" }),
        }),
      ).present,
    ).toBe(false);
    expect(
      generateRecurringVisitor(
        options({
          catalog: everyRoom,
          roomNumber: 12,
          history: history(1, { roomNumber: 2, visitorId: "alpha" }),
        }),
      ).present,
    ).toBe(true);
    expect(
      generateRecurringVisitor(
        options({
          catalog: everyRoom,
          roomNumber: 13,
          history: history(1, { roomNumber: 2, visitorId: "alpha" }),
        }),
      ).present,
    ).toBe(true);
  });

  it("tracks visitor cooldowns independently and emits at most one conflict winner", () => {
    const everyRoom = scheduleCatalog(["alpha", "beta", "gamma"]);
    const result = generateRecurringVisitor(
      options({
        catalog: everyRoom,
        roomNumber: 13,
        history: history(1, { roomNumber: 9, visitorId: "alpha" }),
      }),
    );
    expect(result.present).toBe(true);
    expect(result.appearance?.visitor.id).not.toBe("alpha");
    expect(result.conflictRoll).toMatchObject({ index: 164, sides: 2 });
  });

  it("maps first, interior, and last conflict boundaries in catalog order", () => {
    const everyRoom = scheduleCatalog(["alpha", "beta", "gamma"]);
    for (const wanted of [1, 2, 3]) {
      const campaignSeed = seedForConflict(13, wanted, 3);
      const result = generateRecurringVisitor(
        options({ catalog: everyRoom, roomNumber: 13, history: history(campaignSeed) }),
      );
      expect(result.appearance?.visitor.id).toBe(["alpha", "beta", "gamma"][wanted - 1]);
    }
  });
});

describe("Spork inventory parity", () => {
  it("matches the verified direct seed-618 Room 1 inventory", () => {
    const inventory = generateSporkInventory({
      catalog,
      treasureCatalog,
      partyLevel: 1,
      partySize: 6,
      appearanceSeed: 618,
      roomNumber: 1,
    });
    expect(inventory.items.map((value) => [value.stockType, value.name, value.rarity])).toEqual([
      ["mundane", "Tiny Brass Bell", "curiosity"],
      ["mundane", "Painted Stone Animals", "curiosity"],
      ["mundane", "Patchwork Rope Bundle", "mundane"],
    ]);
    expect(inventory.rolls).toMatchObject({
      mundaneCount: { index: 180 },
      mundaneSelection: { index: 181 },
      specialFrequency: { index: 182 },
      companionFrequency: { index: 184 },
      appraisal: { index: 187 },
    });
  });

  it("is deterministic per appearance, varies naturally, and enforces rarity limits", () => {
    const input = {
      catalog,
      treasureCatalog,
      partyLevel: 1,
      partySize: 6,
      appearanceSeed: 618,
      roomNumber: 55,
    } as const;
    const first = generateSporkInventory(input);
    expect(generateSporkInventory(input)).toEqual(first);
    expect(generateSporkInventory({ ...input, roomNumber: 76 })).not.toEqual(first);
    expect(
      first.items
        .filter((value) => value.stockType === "special")
        .every((value) => value.rarity === "common" || value.rarity === "uncommon"),
    ).toBe(true);
    expect(
      first.items.filter((value) => value.stockType === "mundane").length,
    ).toBeGreaterThanOrEqual(3);
    expect(first.items.filter((value) => value.stockType === "mundane").length).toBeLessThanOrEqual(
      5,
    );
  });

  it.each([
    [1, 2],
    [5, 2],
    [6, 1],
    [25, 1],
    [26, 0],
    [100, 0],
  ] as const)("maps special-stock frequency boundary %i to %i items", (wanted, count) => {
    const inventory = inventoryForRoll("specialFrequency", wanted);
    expect(inventory.items.filter((value) => value.stockType === "special")).toHaveLength(count);
    expect(inventory.rolls.specialSelection === undefined).toBe(count === 0);
  });

  it.each([
    [1, true],
    [2, false],
    [100, false],
  ] as const)("maps companion frequency boundary %i", (wanted, present) => {
    const inventory = inventoryForRoll("companionFrequency", wanted);
    expect(inventory.items.some((value) => value.stockType === "companion")).toBe(present);
    expect(inventory.rolls.companionSelection !== undefined).toBe(present);
  });

  it("keeps companions rare across the verified 200-room fixture", () => {
    const count = Array.from({ length: 200 }, (_, index) =>
      generateSporkInventory({
        catalog,
        treasureCatalog,
        partyLevel: 1,
        partySize: 6,
        appearanceSeed: 618,
        roomNumber: index + 1,
      }),
    ).filter((value) => value.items.some((item) => item.stockType === "companion")).length;
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(5);
  });
});

describe("visitor rendering and immutability", () => {
  it("renders exact Stranger timing for encounter, hazard, and peaceful context", () => {
    const result = generateRecurringVisitor(
      options({ roomNumber: 38, history: reconstructed(38), hasEncounter: true }),
    );
    if (!result.present) throw new Error("Expected Stranger fixture.");
    expect(result.appearance.visitor.id).toBe("stranger");
    expect(renderRecurringVisitor(result, true, false)).toContain(
      "Timing: The Stranger appears only after the encounter is resolved.\n",
    );
    expect(renderRecurringVisitor(result, false, true)).toContain(
      "Timing: The Stranger appears only after the immediate hazard or trap is resolved.\n",
    );
    expect(renderRecurringVisitor(result, false, false)).toContain(
      "Timing: The Stranger is already present when the party enters.\n",
    );
  });

  it("renders the complete exact Job Goblin visitor block", () => {
    const result = generateRecurringVisitor(
      options({ roomNumber: 17, history: reconstructed(17), hasEncounter: true, hasHazard: true }),
    );
    if (!result.present) throw new Error("Expected Job Goblin fixture.");
    expect(renderRecurringVisitor(result, true, true)).toBe(
      [
        "SPECIAL VISITOR",
        "===============",
        "Visitor: The Job Goblin",
        "Scene: A professional repair",
        "The Job Goblin applies mortar to an ancient crack whose edges continue well beyond his ladder.",
        "Dialogue: “Temporary repair. Estimated duration: longer than my shift.”",
        "Outcome: He completes a neat patch and asks the party not to lean on it until tomorrow.",
        "Hook: The crack carries a faint draft from an unmapped space.",
        "",
        "",
      ].join("\n"),
    );
  });

  it("does not mutate catalog/history and deeply freezes deterministic results", () => {
    const prior = reconstructed(11);
    const catalogSnapshot = structuredClone(catalog);
    const historySnapshot = structuredClone(prior);
    const first = generateRecurringVisitor(options({ roomNumber: 11, history: prior }));
    const second = generateRecurringVisitor(options({ roomNumber: 11, history: prior }));
    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.appearance)).toBe(true);
    expect(Object.isFrozen(first.appearance?.scene)).toBe(true);
    expect(Object.isFrozen(first.appearance?.sporkInventory?.items)).toBe(true);
    expect(catalog).toEqual(catalogSnapshot);
    expect(prior).toEqual(historySnapshot);
  });

  it("renders authored Spork items separately without changing generated stock or RNG", () => {
    const base = generateRecurringVisitor(options());
    const withAuthoredCatalog = {
      ...catalog,
      authoredSporkItems: [
        {
          id: "orrery",
          name: "Pocket Orrery",
          category: "wondrous" as const,
          rarity: "rare" as const,
          description: "A palm-sized brass model.",
          presentation: "Spork polishes one tiny gear.",
          availability: "dm_choice" as const,
          repeatable: "dm" as const,
          source: "Test pack",
          notes: "DM decides its precision.",
        },
      ],
    };
    const result = generateRecurringVisitor(options({ catalog: withAuthoredCatalog }));
    expect(result.appearance?.sporkInventory).toEqual(base.appearance?.sporkInventory);
    if (!result.present) throw new Error("Expected Spork fixture.");
    expect(renderRecurringVisitor(result, true, false)).toContain(
      [
        "AUTHORED SPORK ITEMS",
        "====================",
        "These items are optional DM-controlled content and are not part of Spork’s ordinary generated stock.",
        "",
        "Pocket Orrery — rare",
        "  Description: A palm-sized brass model.",
        "  Presentation: Spork polishes one tiny gear.",
        "  Availability: DM choice",
        "  Repeatability: DM decides",
        "",
      ].join("\n"),
    );
  });

  it("rejects unsorted, future, and unknown history entries", () => {
    expect(() =>
      generateRecurringVisitor(
        options({
          roomNumber: 20,
          history: history(
            1,
            { roomNumber: 12, visitorId: "spork" },
            { roomNumber: 2, visitorId: "spork" },
          ),
        }),
      ),
    ).toThrow(/strictly room-sorted/);
    expect(() =>
      generateRecurringVisitor(
        options({ roomNumber: 20, history: history(1, { roomNumber: 20, visitorId: "spork" }) }),
      ),
    ).toThrow(/prior positive room numbers/);
    expect(() =>
      generateRecurringVisitor(
        options({ roomNumber: 20, history: history(1, { roomNumber: 2, visitorId: "unknown" }) }),
      ),
    ).toThrow(/unknown visitor/);
  });
});

function options(
  overrides: Partial<GenerateRecurringVisitorOptions> = {},
): GenerateRecurringVisitorOptions {
  return {
    catalog,
    treasureCatalog,
    roomNumber: 1,
    roomKind: "ordinary",
    hasEncounter: true,
    hasHazard: false,
    partyLevel: 1,
    partySize: 6,
    ...overrides,
  };
}

function reconstructed(roomNumber: number) {
  return reconstructRecurringVisitorHistory({ catalog, campaignSeed: 618, targetRoom: roomNumber });
}

function history(
  campaignSeed: number,
  ...appearances: RecurringVisitorHistory["appearances"]
): RecurringVisitorHistory {
  return { campaignSeed, appearances };
}

function scheduleCatalog(ids: readonly string[]): RecurringVisitorCatalog {
  return {
    visitors: ids.map((id, index) => ({
      id,
      name: id,
      period: 1,
      scheduleIndex: 161 + index,
      firstEligibleRoom: 2,
    })),
    scenes: ids.map((id) => ({
      visitorId: id,
      key: "scene",
      context: "any",
      setup: "Setup",
      description: "Description.",
      dialogue: "Hello.",
      outcome: "Leaves.",
      reward: undefined,
      hook: undefined,
    })),
    sporkStock: catalog.sporkStock,
    authoredSporkItems: [],
  };
}

function seedForConflict(roomNumber: number, wanted: number, sides: number): number {
  for (let seed = 0; seed < 10_000; seed += 1) {
    const result = generateRecurringVisitor(
      options({
        catalog: scheduleCatalog(["alpha", "beta", "gamma"]),
        roomNumber,
        history: history(seed),
      }),
    );
    if (result.conflictRoll?.sides === sides && result.conflictRoll.value === wanted) return seed;
  }
  throw new Error("No conflict seed found.");
}

function inventoryForRoll(key: "specialFrequency" | "companionFrequency", wanted: number) {
  for (let appearanceSeed = 0; appearanceSeed < 100_000; appearanceSeed += 1) {
    const inventory = generateSporkInventory({
      catalog,
      treasureCatalog,
      partyLevel: 1,
      partySize: 6,
      appearanceSeed,
      roomNumber: 1,
    });
    if (inventory.rolls[key].value === wanted) return inventory;
  }
  throw new Error(`No inventory seed found for ${key}=${wanted}.`);
}
