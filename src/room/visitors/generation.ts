import type {
  RecurringVisitorDefinition,
  RecurringVisitorSceneDefinition,
} from "../../content/visitors/index.js";
import { deriveRoomSeed, semanticTreasureRoll } from "../treasure/index.js";
import { RecurringVisitorGenerationError } from "./errors.js";
import type {
  GenerateRecurringVisitorOptions,
  GenerateSporkInventoryOptions,
  RecurringVisitorGenerationResult,
  RecurringVisitorHistory,
  RecurringVisitorHistoryEntry,
  ReconstructRecurringVisitorHistoryOptions,
  SporkInventory,
  SporkInventoryItem,
  VisitorScheduleRoll,
} from "./types.js";

const COOLDOWN_ROOMS = 10;
const CONFLICT_INDEX = 164;
const SPECIAL_CATEGORIES = new Set(["potion", "scroll", "weapon", "armor", "wondrous"]);

/** Generates the active recurring-visitor overlay from explicit immutable history. */
export function generateRecurringVisitor(
  options: GenerateRecurringVisitorOptions,
): RecurringVisitorGenerationResult {
  validateGeneration(options);
  if (options.roomKind === "boss") return absent("boss-room", []);

  const selection = selectVisitor(options.catalog.visitors, options.roomNumber, options.history);
  if (selection.visitor === undefined)
    return absent(selection.reason ?? "unscheduled", selection.scheduleRolls);

  const sceneSeed = options.history?.campaignSeed ?? deriveRoomSeed(618, options.roomNumber);
  const scene = selectScene(options, selection.visitor, sceneSeed);
  const sporkInventory =
    selection.visitor.id === "spork"
      ? generateSporkInventory({
          catalog: options.catalog,
          treasureCatalog: options.treasureCatalog,
          partyLevel: options.partyLevel,
          partySize: options.partySize,
          appearanceSeed: sceneSeed,
          roomNumber: options.roomNumber,
        })
      : undefined;

  return deepFreeze({
    present: true,
    reason: undefined,
    scheduleRolls: selection.scheduleRolls,
    conflictRoll: selection.conflictRoll,
    appearance: {
      visitor: { ...selection.visitor },
      scene: { ...scene.value },
      sceneSeed,
      sceneRoll: scene.roll,
      sporkInventory,
      authoredSporkItems:
        selection.visitor.id === "spork"
          ? options.catalog.authoredSporkItems.map((value) => ({ ...value }))
          : [],
    },
  });
}

/** Replays only the deterministic schedule and returns actual prior appearances. */
export function reconstructRecurringVisitorHistory(
  options: ReconstructRecurringVisitorHistoryOptions,
): RecurringVisitorHistory {
  if (!nonnegativeInteger(options.campaignSeed) || !positiveInteger(options.targetRoom))
    invalid("Campaign seed must be nonnegative and target room must be a positive safe integer.");
  const appearances: RecurringVisitorHistoryEntry[] = [];
  for (let roomNumber = 1; roomNumber < options.targetRoom; roomNumber += 1) {
    const history = { campaignSeed: options.campaignSeed, appearances };
    const selection = selectVisitor(options.catalog.visitors, roomNumber, history);
    if (selection.visitor !== undefined)
      appearances.push({ roomNumber, visitorId: selection.visitor.id });
  }
  return deepFreeze({ campaignSeed: options.campaignSeed, appearances });
}

/** Builds Spork's non-persistent stock for this appearance only. */
export function generateSporkInventory(options: GenerateSporkInventoryOptions): SporkInventory {
  validateInventory(options);
  const inventorySeed = deriveRoomSeed(
    options.appearanceSeed + options.partyLevel * 1009 + options.partySize * 9176,
    options.roomNumber + 61_800,
  );
  const mundaneCountRoll = roll(inventorySeed, 180, 3);
  const mundaneCount = 2 + mundaneCountRoll.value;
  const mundane = options.catalog.sporkStock.filter((value) => value.stockType === "mundane");
  if (mundane.length === 0) missing("Spork has no mundane stock content.");
  const mundaneSelection = roll(options.appearanceSeed, 181, mundane.length);
  const start = (mundaneSelection.value - 1 + options.roomNumber) % mundane.length;
  const stride = mundaneStride(options.roomNumber, mundane.length);
  const items: SporkInventoryItem[] = Array.from({ length: mundaneCount }, (_, offset) => {
    const value = mundane[(start + offset * stride) % mundane.length] as (typeof mundane)[number];
    return { stockType: "mundane", name: value.name, rarity: value.rarity, story: value.story };
  });

  const specialFrequency = roll(inventorySeed, 182, 100);
  const specialCount = specialFrequency.value <= 5 ? 2 : specialFrequency.value <= 25 ? 1 : 0;
  let specialSelection;
  if (specialCount > 0) {
    const candidates = options.treasureCatalog.items.filter(
      (value) =>
        SPECIAL_CATEGORIES.has(value.category) &&
        (value.rarity === "common" || value.rarity === "uncommon"),
    );
    if (candidates.length === 0) missing("Spork has no legal Common or Uncommon special stock.");
    specialSelection = roll(inventorySeed, 183, candidates.length);
    const selected = (specialSelection.value - 1 + options.roomNumber) % candidates.length;
    for (let offset = 0; offset < specialCount; offset += 1) {
      const value = candidates[
        (selected + offset * 11) % candidates.length
      ] as (typeof candidates)[number];
      items.push({
        stockType: "special",
        name: value.name,
        rarity: value.rarity as "common" | "uncommon",
        story: value.description,
      });
    }
  }

  const companionFrequency = roll(inventorySeed, 184, 100);
  let companionSelection;
  if (companionFrequency.value === 1) {
    const companions = options.catalog.sporkStock.filter(
      (value) => value.stockType === "companion",
    );
    if (companions.length === 0) missing("Spork has no companion stock content.");
    companionSelection = roll(inventorySeed, 185, companions.length);
    const selected = (companionSelection.value - 1 + options.roomNumber) % companions.length;
    const value = companions[selected] as (typeof companions)[number];
    items.push({
      stockType: "companion",
      name: value.name,
      rarity: value.rarity,
      story: value.story,
    });
  }

  const appraisalRoll = roll(options.appearanceSeed, 186 + (options.roomNumber % 13), 12);
  const appraisal =
    appraisalRoll.value === 1
      ? "overvalued"
      : appraisalRoll.value === 2
        ? "undervalued"
        : "ordinary";
  return deepFreeze({
    items,
    appraisal,
    inventorySeed,
    rolls: {
      mundaneCount: mundaneCountRoll,
      mundaneSelection,
      specialFrequency,
      specialSelection,
      companionFrequency,
      companionSelection,
      appraisal: appraisalRoll,
    },
  });
}

function selectVisitor(
  visitors: readonly RecurringVisitorDefinition[],
  roomNumber: number,
  history: RecurringVisitorHistory | undefined,
) {
  if (history === undefined) {
    const visitor = roomNumber === 1 ? visitors.find((value) => value.id === "spork") : undefined;
    if (roomNumber === 1 && visitor === undefined) missing('Required visitor "spork" is missing.');
    return {
      visitor,
      reason: "standalone" as const,
      scheduleRolls: Object.freeze([]),
      conflictRoll: undefined,
    };
  }
  if (roomNumber === 1) {
    const visitor = visitors.find((value) => value.id === "spork");
    if (visitor === undefined) missing('Required visitor "spork" is missing.');
    return {
      visitor,
      reason: undefined,
      scheduleRolls: Object.freeze([]),
      conflictRoll: undefined,
    };
  }
  if (roomNumber % 10 === 0)
    return {
      visitor: undefined,
      reason: "unscheduled" as const,
      scheduleRolls: Object.freeze([]),
      conflictRoll: undefined,
    };

  const scheduleRolls: VisitorScheduleRoll[] = [];
  const eligible: RecurringVisitorDefinition[] = [];
  for (const [index, visitor] of visitors.entries()) {
    if (roomNumber < visitor.firstEligibleRoom) continue;
    const latest = history.appearances.findLast((value) => value.visitorId === visitor.id);
    if (latest !== undefined && roomNumber - latest.roomNumber < COOLDOWN_ROOMS) continue;
    const block = Math.floor((roomNumber - 1) / visitor.period);
    const scheduleSeed = deriveRoomSeed(history.campaignSeed + (index + 1) * 7919, block + 1);
    const scheduleRoll = roll(scheduleSeed, visitor.scheduleIndex, visitor.period);
    const scheduledRoom = block * visitor.period + scheduleRoll.value;
    scheduleRolls.push({ ...scheduleRoll, visitorId: visitor.id, scheduledRoom });
    if (scheduledRoom === roomNumber) eligible.push(visitor);
  }
  if (eligible.length === 0)
    return {
      visitor: undefined,
      reason: "unscheduled" as const,
      scheduleRolls: Object.freeze(scheduleRolls),
      conflictRoll: undefined,
    };
  const conflictRoll = roll(
    deriveRoomSeed(history.campaignSeed, roomNumber),
    CONFLICT_INDEX,
    eligible.length,
  );
  return {
    visitor: eligible[conflictRoll.value - 1],
    reason: undefined,
    scheduleRolls: Object.freeze(scheduleRolls),
    conflictRoll,
  };
}

function selectScene(
  options: GenerateRecurringVisitorOptions,
  visitor: RecurringVisitorDefinition,
  sceneSeed: number,
): { readonly value: RecurringVisitorSceneDefinition; readonly roll: ReturnType<typeof roll> } {
  const candidates = options.catalog.scenes.filter((scene) => {
    if (scene.visitorId !== visitor.id) return false;
    const introduction = scene.key.startsWith("lost-found-");
    if (visitor.id === "spork" && options.roomNumber === 1 && !introduction) return false;
    if (visitor.id === "spork" && options.roomNumber !== 1 && introduction) return false;
    return (
      scene.context === "any" ||
      (scene.context === "encounter" && options.hasEncounter) ||
      (scene.context === "hazard" && options.hasHazard) ||
      (scene.context === "peaceful" && !options.hasEncounter && !options.hasHazard)
    );
  });
  if (candidates.length === 0)
    missing(`No visitor scene is eligible for "${visitor.id}" in room ${options.roomNumber}.`);
  const sceneRoll = roll(sceneSeed, 170 + (options.roomNumber % 17), candidates.length);
  return {
    value: candidates[sceneRoll.value - 1] as RecurringVisitorSceneDefinition,
    roll: sceneRoll,
  };
}

function mundaneStride(roomNumber: number, rowCount: number): number {
  return [1, 3, 5, 9, 11, 13][Math.floor(roomNumber / rowCount) % 6] as number;
}

function absent(
  reason: "standalone" | "boss-room" | "unscheduled",
  scheduleRolls: readonly VisitorScheduleRoll[],
) {
  return deepFreeze({
    present: false as const,
    reason,
    scheduleRolls,
    conflictRoll: undefined,
    appearance: undefined,
  });
}

function roll(seed: number, index: number, sides: number) {
  return Object.freeze({ index, value: semanticTreasureRoll(seed, index, sides), sides });
}

function validateGeneration(options: GenerateRecurringVisitorOptions): void {
  if (!positiveInteger(options.roomNumber)) invalid("Room number must be a positive safe integer.");
  if (!positiveInteger(options.partyLevel) || !positiveInteger(options.partySize))
    invalid("Party level and size must be positive safe integers.");
  if (options.history === undefined) return;
  if (!nonnegativeInteger(options.history.campaignSeed)) invalid("Campaign seed is invalid.");
  let priorRoom = 0;
  for (const appearance of options.history.appearances) {
    if (!positiveInteger(appearance.roomNumber) || appearance.roomNumber >= options.roomNumber)
      invalid("History entries must identify prior positive room numbers.");
    if (appearance.roomNumber <= priorRoom)
      invalid("History entries must be strictly room-sorted.");
    if (!options.catalog.visitors.some((value) => value.id === appearance.visitorId))
      invalid(`History references unknown visitor "${appearance.visitorId}".`);
    priorRoom = appearance.roomNumber;
  }
}

function validateInventory(options: GenerateSporkInventoryOptions): void {
  if (
    !positiveInteger(options.partyLevel) ||
    !positiveInteger(options.partySize) ||
    !positiveInteger(options.roomNumber) ||
    !nonnegativeInteger(options.appearanceSeed)
  )
    invalid("Spork inventory inputs are invalid.");
  if (!options.catalog.visitors.some((value) => value.id === "spork"))
    missing('Required visitor "spork" is missing.');
  if (options.catalog.sporkStock.filter((value) => value.stockType === "mundane").length < 5)
    missing("Spork requires at least five mundane stock records.");
}

function positiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function nonnegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function invalid(message: string): never {
  throw new RecurringVisitorGenerationError("INVALID_OPTIONS", message);
}

function missing(message: string): never {
  throw new RecurringVisitorGenerationError("MISSING_CONTENT", message);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
