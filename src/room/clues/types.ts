import type {
  GaryClueCatalog,
  GaryClueDefinition,
  GaryCluePhase,
} from "../../content/clues/index.js";
import type { DungeonDepthBand } from "../types.js";
import type { RoomTreasure, RoomTreasureRoll } from "../treasure/index.js";

/**
 * One virtual clue choice made for a prior room.
 *
 * Active Bash reconstructs one choice for every prior room number, including
 * rooms where the clue frequency check failed. Persistence is deferred, so
 * callers supply those choices explicitly.
 */
export interface GaryClueHistoryEntry {
  readonly roomNumber: number;
  readonly clueTitle: string;
}

export interface GaryClueHistory {
  readonly campaignSeed: number;
  readonly recentSelections: readonly GaryClueHistoryEntry[];
}

export interface RoomGaryClue {
  readonly definition: GaryClueDefinition;
  readonly placementFeatureName: string;
}

export interface GaryClueAbsentResult {
  readonly present: false;
  readonly threshold: number;
  readonly phase: GaryCluePhase | undefined;
  readonly frequencyRoll: RoomTreasureRoll;
  readonly selectionRoll: undefined;
  readonly clue: undefined;
}

export interface GaryCluePresentResult {
  readonly present: true;
  readonly threshold: number;
  readonly phase: GaryCluePhase | undefined;
  readonly frequencyRoll: RoomTreasureRoll;
  readonly selectionRoll: RoomTreasureRoll;
  readonly clue: RoomGaryClue;
}

export type GaryClueGenerationResult = GaryClueAbsentResult | GaryCluePresentResult;

export interface GenerateGaryClueOptions {
  readonly catalog: GaryClueCatalog;
  readonly roomNumber: number;
  readonly depthBand: DungeonDepthBand;
  readonly neighborhoodId: string;
  readonly treasure: Pick<RoomTreasure, "featureName" | "rewardSeed">;
  readonly history?: GaryClueHistory;
}

export type GaryClueGenerationErrorCode = "INVALID_OPTIONS" | "MISSING_CONTENT";
