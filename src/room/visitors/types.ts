import type {
  RecurringVisitorCatalog,
  AuthoredSporkItemDefinition,
  RecurringVisitorDefinition,
  RecurringVisitorSceneDefinition,
  SporkStockRarity,
} from "../../content/visitors/index.js";
import type { TreasureCatalog } from "../../content/treasure/index.js";
import type { OrdinaryRoomKind } from "../types.js";
import type { RoomTreasureRoll } from "../treasure/index.js";

export interface RecurringVisitorHistoryEntry {
  readonly roomNumber: number;
  readonly visitorId: string;
}

export interface RecurringVisitorHistory {
  readonly campaignSeed: number;
  readonly appearances: readonly RecurringVisitorHistoryEntry[];
}

export interface VisitorScheduleRoll extends RoomTreasureRoll {
  readonly visitorId: string;
  readonly scheduledRoom: number;
}

export type SporkInventoryStockType = "mundane" | "special" | "companion";

export interface SporkInventoryItem {
  readonly stockType: SporkInventoryStockType;
  readonly name: string;
  readonly rarity: SporkStockRarity | "common" | "uncommon";
  readonly story: string;
}

export type SporkAppraisal = "ordinary" | "overvalued" | "undervalued";

export interface SporkInventory {
  readonly items: readonly SporkInventoryItem[];
  readonly appraisal: SporkAppraisal;
  readonly inventorySeed: number;
  readonly rolls: {
    readonly mundaneCount: RoomTreasureRoll;
    readonly mundaneSelection: RoomTreasureRoll;
    readonly specialFrequency: RoomTreasureRoll;
    readonly specialSelection: RoomTreasureRoll | undefined;
    readonly companionFrequency: RoomTreasureRoll;
    readonly companionSelection: RoomTreasureRoll | undefined;
    readonly appraisal: RoomTreasureRoll;
  };
}

export interface RoomRecurringVisitor {
  readonly visitor: RecurringVisitorDefinition;
  readonly scene: RecurringVisitorSceneDefinition;
  readonly sceneSeed: number;
  readonly sceneRoll: RoomTreasureRoll;
  readonly sporkInventory: SporkInventory | undefined;
  readonly authoredSporkItems: readonly AuthoredSporkItemDefinition[];
}

export type RecurringVisitorAbsenceReason = "standalone" | "boss-room" | "unscheduled";

export interface RecurringVisitorAbsentResult {
  readonly present: false;
  readonly reason: RecurringVisitorAbsenceReason;
  readonly scheduleRolls: readonly VisitorScheduleRoll[];
  readonly conflictRoll: undefined;
  readonly appearance: undefined;
}

export interface RecurringVisitorPresentResult {
  readonly present: true;
  readonly reason: undefined;
  readonly scheduleRolls: readonly VisitorScheduleRoll[];
  readonly conflictRoll: RoomTreasureRoll | undefined;
  readonly appearance: RoomRecurringVisitor;
}

export type RecurringVisitorGenerationResult =
  RecurringVisitorAbsentResult | RecurringVisitorPresentResult;

export interface GenerateRecurringVisitorOptions {
  readonly catalog: RecurringVisitorCatalog;
  readonly treasureCatalog: TreasureCatalog;
  readonly roomNumber: number;
  readonly roomKind: OrdinaryRoomKind | "boss";
  readonly hasEncounter: boolean;
  readonly hasHazard: boolean;
  readonly partyLevel: number;
  readonly partySize: number;
  readonly history?: RecurringVisitorHistory;
}

export interface ReconstructRecurringVisitorHistoryOptions {
  readonly catalog: RecurringVisitorCatalog;
  readonly campaignSeed: number;
  /** Reconstruct appearances strictly before this room. */
  readonly targetRoom: number;
}

export interface GenerateSporkInventoryOptions {
  readonly catalog: RecurringVisitorCatalog;
  readonly treasureCatalog: TreasureCatalog;
  readonly partyLevel: number;
  readonly partySize: number;
  readonly appearanceSeed: number;
  readonly roomNumber: number;
}

export type RecurringVisitorGenerationErrorCode = "INVALID_OPTIONS" | "MISSING_CONTENT";
