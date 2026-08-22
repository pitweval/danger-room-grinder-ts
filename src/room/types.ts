import type {
  OrdinaryRoomCatalog,
  RoomEnvironment,
  RoomExit,
  RoomFeature,
  RoomHazard,
  RoomSubtheme,
} from "../content/rooms/types.js";
import type { EncounterBehaviorCatalog } from "../content/behaviors/types.js";
import type { FamilyCatalog } from "../content/families/types.js";
import type { MonsterCatalog } from "../content/monsters/types.js";
import type { OrdinaryEncounterResult } from "../encounter/generation/types.js";
import type { Party, RolledEncounterDifficulty } from "../encounter/types.js";
import type { RandomGenerator } from "../rng/index.js";

export type DungeonDepthBand = "shallow" | "middle" | "deep" | "extreme";
export type OrdinaryRoomKind = "ordinary" | "signature" | "long-corridor";

export interface RoomAtmosphere {
  readonly lighting: string;
  readonly sound: string;
  readonly smell: string;
  readonly order: readonly ("lighting" | "sound" | "smell")[];
}

export interface OrdinaryRoomRolls {
  readonly difficulty: number | undefined;
  readonly family: number | undefined;
  readonly formation: number | undefined;
  readonly arrival: number;
  readonly doorway: number;
  readonly signatureFrequency: number;
  readonly signatureSelection: number | undefined;
  readonly subtheme: number | undefined;
  readonly environmentPreference: number | undefined;
  readonly environment: number | undefined;
  readonly firstFeature: number | undefined;
  readonly secondFeature: number | undefined;
  readonly atmosphereOrder: number;
  readonly hazard: number;
  readonly exits: number;
}

export interface OrdinaryRoom {
  readonly roomNumber: number;
  readonly title: string;
  readonly depthBand: DungeonDepthBand;
  readonly difficulty: RolledEncounterDifficulty;
  readonly neighborhood: { readonly id: string; readonly name: string };
  readonly kind: OrdinaryRoomKind;
  readonly arrival: string;
  readonly doorway: string;
  readonly environment: RoomEnvironment;
  readonly subtheme: RoomSubtheme | undefined;
  readonly architecture: string;
  readonly atmosphere: RoomAtmosphere;
  readonly features: readonly RoomFeature[];
  readonly exits: readonly RoomExit[];
  readonly hasHazard: boolean;
  readonly hazard: RoomHazard | undefined;
  readonly encounterPreference: { readonly family: string; readonly formation: string };
  readonly encounter: OrdinaryEncounterResult | undefined;
  readonly rolls: OrdinaryRoomRolls;
}

export interface GenerateOrdinaryRoomOptions {
  readonly roomNumber: number;
  readonly party: Party;
  readonly roomCatalog: OrdinaryRoomCatalog;
  readonly monsterCatalog: MonsterCatalog;
  readonly familyCatalog: FamilyCatalog;
  readonly behaviorCatalog: EncounterBehaviorCatalog;
  readonly rng: Pick<RandomGenerator, "integer">;
  readonly neighborhood?: string;
  readonly includeEncounter?: boolean;
  readonly includeHazard?: boolean;
  readonly exitCount?: number;
  readonly requestedDifficulty?: RolledEncounterDifficulty;
  readonly requestedFamily?: string;
  readonly requestedFormation?: string;
}

export type RoomGenerationErrorCode =
  "INVALID_OPTIONS" | "MISSING_CONTENT" | "FORCED_FAMILY_UNUSABLE";
