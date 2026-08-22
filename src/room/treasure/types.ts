import type { TreasureCatalog, TreasureItemDefinition } from "../../content/treasure/types.js";
import type { RoomFeature, RoomHazard } from "../../content/rooms/types.js";
import type { RolledEncounterDifficulty } from "../../encounter/types.js";
import type { DungeonDepthBand } from "../types.js";

export interface RoomTreasureHistory {
  readonly campaignSeed: number;
  readonly recentHelpfulNames: readonly string[];
  readonly recentNarrativeNames: readonly string[];
  readonly recentSalvageVariations: readonly number[];
}

export interface RoomValuables {
  readonly gpValue: number;
  readonly description: string;
}

export interface RoomTreasureSalvage {
  readonly hazardName: string;
  readonly materials: string;
  readonly text: string;
  readonly variation: number;
}

export interface RoomTreasureRoll {
  readonly index: number;
  readonly value: number;
  readonly sides: number;
}

export interface RoomTreasureRolls {
  readonly helpful: RoomTreasureRoll;
  readonly narrative: RoomTreasureRoll;
  readonly feature: RoomTreasureRoll;
  readonly valuables: RoomTreasureRoll;
  readonly location: RoomTreasureRoll;
  readonly context: RoomTreasureRoll;
  readonly salvage: RoomTreasureRoll;
}

export interface RoomTreasure {
  readonly helpful: TreasureItemDefinition;
  readonly narrative: TreasureItemDefinition;
  readonly valuables: RoomValuables;
  readonly featureName: string;
  readonly location: string;
  readonly context: string;
  readonly salvage: RoomTreasureSalvage | undefined;
  readonly rewardSeed: number;
  readonly rolls: RoomTreasureRolls;
}

export interface GenerateRoomTreasureOptions {
  readonly catalog: TreasureCatalog;
  readonly roomSeed: number;
  readonly roomNumber: number;
  readonly partyLevel: number;
  readonly depthBand: DungeonDepthBand;
  readonly difficulty: RolledEncounterDifficulty;
  readonly features: readonly Pick<RoomFeature, "name">[];
  readonly neighborhoodTreasureFlavor: string;
  readonly selectedHazard: Pick<RoomHazard, "name" | "severity">;
  readonly retainHazard: boolean;
  readonly history?: RoomTreasureHistory;
}

export type TreasureGenerationErrorCode =
  "INVALID_OPTIONS" | "MISSING_HELPFUL_LOOT" | "MISSING_NARRATIVE_LOOT" | "MISSING_HAZARD_SALVAGE";
