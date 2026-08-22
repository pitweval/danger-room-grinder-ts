import type { OrdinaryEncounterResult } from "../../encounter/generation/types.js";

/** The settled campaign state used by active Bash XP progression. */
export interface CampaignProgressionState {
  readonly startingLevel: number;
  readonly partySize: number;
  readonly accumulatedXp: number;
  readonly currentLevel: number;
  readonly lastCompletedRoomNumber: number;
}

export interface CreateCampaignProgressionOptions {
  readonly startingLevel?: number;
  readonly partySize?: number;
  readonly accumulatedXp?: number;
  readonly currentLevel?: number;
  readonly lastCompletedRoomNumber?: number;
}

/** The minimum room shape required to settle active Bash encounter XP. */
export interface CompletedRoomForProgression {
  readonly roomNumber: number;
  readonly encounter: Pick<OrdinaryEncounterResult, "xpSpent"> | undefined;
}

export interface LevelUpTransition {
  readonly fromLevel: number;
  readonly toLevel: number;
  readonly gainedLevels: readonly number[];
}

export interface CampaignProgressionTransition {
  readonly state: CampaignProgressionState;
  readonly completedRoomNumber: number;
  readonly applied: boolean;
  readonly xpBefore: number;
  readonly xpAwarded: number;
  readonly xpAfter: number;
  readonly levelBefore: number;
  readonly levelAfter: number;
  readonly levelUp: LevelUpTransition | undefined;
}

export interface CampaignLevelForXpOptions {
  readonly startingLevel: number;
  readonly accumulatedXp: number;
  readonly partySize: number;
}
