import { CampaignProgressionError } from "./errors.js";
import { campaignXpThresholdForLevel, MAXIMUM_CAMPAIGN_LEVEL } from "./thresholds.js";
import type {
  CampaignLevelForXpOptions,
  CampaignProgressionState,
  CampaignProgressionTransition,
  CompletedRoomForProgression,
  CreateCampaignProgressionOptions,
  LevelUpTransition,
} from "./types.js";

const MINIMUM_PARTY_SIZE = 1;
const MAXIMUM_PARTY_SIZE = 10;

/** Creates or validates one immutable settled progression state. */
export function createCampaignProgression(
  options: CreateCampaignProgressionOptions = {},
): CampaignProgressionState {
  const startingLevel = options.startingLevel ?? 1;
  const partySize = options.partySize ?? 6;
  const accumulatedXp = options.accumulatedXp ?? 0;
  const lastCompletedRoomNumber = options.lastCompletedRoomNumber ?? 0;
  validateLevel("startingLevel", startingLevel);
  validatePartySize(partySize);
  validateNonnegativeInteger("accumulatedXp", accumulatedXp);
  validateNonnegativeInteger("lastCompletedRoomNumber", lastCompletedRoomNumber);
  const calculatedLevel = levelForCampaignXp({ startingLevel, accumulatedXp, partySize });
  if (options.currentLevel !== undefined && options.currentLevel !== calculatedLevel) {
    throw new CampaignProgressionError(
      "currentLevel",
      options.currentLevel,
      `the calculated level ${calculatedLevel}`,
    );
  }
  return Object.freeze({
    startingLevel,
    partySize,
    accumulatedXp,
    currentLevel: calculatedLevel,
    lastCompletedRoomNumber,
  });
}

/** Calculates party level from the configured baseline plus party-total dungeon XP. */
export function levelForCampaignXp(options: CampaignLevelForXpOptions): number {
  validateLevel("startingLevel", options.startingLevel);
  validatePartySize(options.partySize);
  validateNonnegativeInteger("accumulatedXp", options.accumulatedXp);
  const baselinePartyXp = campaignXpThresholdForLevel(options.startingLevel) * options.partySize;
  const partyXp = checkedSum(baselinePartyXp, options.accumulatedXp, "accumulatedXp");
  let level = options.startingLevel;
  while (level < MAXIMUM_CAMPAIGN_LEVEL) {
    const nextPartyThreshold = campaignXpThresholdForLevel(level + 1) * options.partySize;
    if (partyXp < nextPartyThreshold) break;
    level += 1;
  }
  return level;
}

/**
 * Settles one completed room exactly once.
 *
 * Bash awards actual selected-monster XP (`encounter.xpSpent`), never the room
 * budget. Encounter-free rooms still advance completion and award zero XP.
 */
export function applyCompletedRoomToProgression(
  state: CampaignProgressionState,
  room: CompletedRoomForProgression,
): CampaignProgressionTransition {
  validateState(state);
  validateNonnegativeInteger("roomNumber", room.roomNumber);
  if (room.encounter !== undefined)
    validateNonnegativeInteger("encounter.xpSpent", room.encounter.xpSpent);

  const applied = room.roomNumber > state.lastCompletedRoomNumber;
  const xpAwarded = applied ? (room.encounter?.xpSpent ?? 0) : 0;
  const accumulatedXp = checkedSum(state.accumulatedXp, xpAwarded, "accumulatedXp");
  const currentLevel = applied
    ? levelForCampaignXp({
        startingLevel: state.startingLevel,
        accumulatedXp,
        partySize: state.partySize,
      })
    : state.currentLevel;
  const nextState = applied
    ? createCampaignProgression({
        startingLevel: state.startingLevel,
        partySize: state.partySize,
        accumulatedXp,
        currentLevel,
        lastCompletedRoomNumber: room.roomNumber,
      })
    : state;
  const levelUp =
    currentLevel > state.currentLevel ? createLevelUp(state.currentLevel, currentLevel) : undefined;
  return deepFreeze({
    state: nextState,
    completedRoomNumber: room.roomNumber,
    applied,
    xpBefore: state.accumulatedXp,
    xpAwarded,
    xpAfter: accumulatedXp,
    levelBefore: state.currentLevel,
    levelAfter: currentLevel,
    levelUp,
  });
}

function createLevelUp(fromLevel: number, toLevel: number): LevelUpTransition {
  return {
    fromLevel,
    toLevel,
    gainedLevels: Array.from({ length: toLevel - fromLevel }, (_, index) => fromLevel + index + 1),
  };
}

function validateState(state: CampaignProgressionState): void {
  createCampaignProgression({
    startingLevel: state.startingLevel,
    partySize: state.partySize,
    accumulatedXp: state.accumulatedXp,
    currentLevel: state.currentLevel,
    lastCompletedRoomNumber: state.lastCompletedRoomNumber,
  });
}

function validateLevel(field: string, value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > MAXIMUM_CAMPAIGN_LEVEL)
    throw new CampaignProgressionError(
      field,
      value,
      `an integer from 1 through ${MAXIMUM_CAMPAIGN_LEVEL}`,
    );
}

function validatePartySize(value: number): void {
  if (!Number.isInteger(value) || value < MINIMUM_PARTY_SIZE || value > MAXIMUM_PARTY_SIZE)
    throw new CampaignProgressionError(
      "partySize",
      value,
      `an integer from ${MINIMUM_PARTY_SIZE} through ${MAXIMUM_PARTY_SIZE}`,
    );
}

function validateNonnegativeInteger(field: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new CampaignProgressionError(field, value, "a nonnegative safe integer");
}

function checkedSum(left: number, right: number, field: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result))
    throw new CampaignProgressionError(field, result, "a nonnegative safe integer");
  return result;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
