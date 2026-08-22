import type { GaryClueDefinition, GaryCluePhase } from "../../content/clues/index.js";
import { deriveRoomSeed, semanticTreasureRoll } from "../treasure/index.js";
import { GaryClueGenerationError } from "./errors.js";
import type {
  GaryClueGenerationResult,
  GaryClueHistory,
  GenerateGaryClueOptions,
} from "./types.js";

const FREQUENCY_INDEX = 39;
const STANDALONE_SELECTION_INDEX = 40;
const CAMPAIGN_SELECTION_INDEX = 138;
const RECENT_ROOM_WINDOW = 5;

/** Generates one optional Bash-compatible clue without consuming the room RNG. */
export function generateGaryClue(options: GenerateGaryClueOptions): GaryClueGenerationResult {
  validate(options);
  const threshold = frequencyThreshold(options.depthBand);
  const frequencyRoll = roll(options.treasure.rewardSeed, FREQUENCY_INDEX, 100);
  if (frequencyRoll.value > threshold)
    return deepFreeze({
      present: false,
      threshold,
      phase: undefined,
      frequencyRoll,
      selectionRoll: undefined,
      clue: undefined,
    });

  const eligible = options.catalog.clues.filter(
    (clue) =>
      clue.depthBand === options.depthBand &&
      (clue.neighborhoodId === "*" || clue.neighborhoodId === options.neighborhoodId),
  );
  if (eligible.length === 0)
    throw new GaryClueGenerationError(
      "MISSING_CONTENT",
      `No Gary clues are eligible for ${options.depthBand}/${options.neighborhoodId}.`,
    );

  let candidates = eligible;
  let phase: GaryCluePhase | undefined;
  let selectionRoll;
  if (options.history === undefined) {
    selectionRoll = roll(
      options.treasure.rewardSeed,
      STANDALONE_SELECTION_INDEX,
      candidates.length,
    );
  } else {
    phase = garyCluePhaseFor(options.history.campaignSeed, options.roomNumber);
    const phased = eligible.filter((clue) => clue.phase === phase);
    candidates = phased.length === 0 ? eligible : phased;
    const blocked = recentTitles(options.history, options.roomNumber);
    const nonRecent = candidates.filter((clue) => !blocked.has(clue.title));
    if (nonRecent.length > 0) candidates = nonRecent;
    selectionRoll = roll(
      deriveRoomSeed(options.history.campaignSeed, options.roomNumber),
      CAMPAIGN_SELECTION_INDEX,
      candidates.length,
    );
  }

  const definition = candidates[selectionRoll.value - 1] as GaryClueDefinition;
  return deepFreeze({
    present: true,
    threshold,
    phase,
    frequencyRoll,
    selectionRoll,
    clue: {
      definition: { ...definition },
      placementFeatureName: options.treasure.featureName,
    },
  });
}

/** Bash campaign phase: the campaign seed plus room number, modulo six. */
export function garyCluePhaseFor(campaignSeed: number, roomNumber: number): GaryCluePhase {
  if (!nonnegativeInteger(campaignSeed) || !positiveInteger(roomNumber))
    throw new GaryClueGenerationError(
      "INVALID_OPTIONS",
      "Campaign seed must be nonnegative and room number must be positive safe integers.",
    );
  return (((campaignSeed % 6) + (roomNumber % 6)) % 6) as GaryCluePhase;
}

export function frequencyThreshold(depthBand: GenerateGaryClueOptions["depthBand"]): number {
  return { shallow: 15, middle: 20, deep: 25, extreme: 30 }[depthBand];
}

function recentTitles(history: GaryClueHistory, roomNumber: number): ReadonlySet<string> {
  const firstRecentRoom = Math.max(1, roomNumber - RECENT_ROOM_WINDOW);
  return new Set(
    history.recentSelections
      .filter(
        (selection) => selection.roomNumber >= firstRecentRoom && selection.roomNumber < roomNumber,
      )
      .map((selection) => selection.clueTitle),
  );
}

function roll(seed: number, index: number, sides: number) {
  return Object.freeze({ index, value: semanticTreasureRoll(seed, index, sides), sides });
}

function validate(options: GenerateGaryClueOptions): void {
  if (!positiveInteger(options.roomNumber)) invalid("Room number must be a positive safe integer.");
  if (options.neighborhoodId.length === 0) invalid("Neighborhood ID must not be empty.");
  if (options.treasure.featureName.length === 0)
    invalid("Treasure feature name must not be empty.");
  if (!nonnegativeInteger(options.treasure.rewardSeed)) invalid("Reward seed is invalid.");
  if (options.history === undefined) return;
  if (!nonnegativeInteger(options.history.campaignSeed)) invalid("Campaign seed is invalid.");
  const rooms = new Set<number>();
  for (const selection of options.history.recentSelections) {
    if (!positiveInteger(selection.roomNumber)) invalid("History room numbers must be positive.");
    if (selection.roomNumber >= options.roomNumber)
      invalid("History cannot contain the current or a future room.");
    if (selection.clueTitle.length === 0) invalid("History clue titles must not be empty.");
    if (rooms.has(selection.roomNumber))
      invalid("History cannot contain two choices for one room.");
    rooms.add(selection.roomNumber);
  }
}

function positiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function nonnegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function invalid(message: string): never {
  throw new GaryClueGenerationError("INVALID_OPTIONS", message);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
