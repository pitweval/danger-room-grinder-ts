import type { ParsedTsv } from "../types.js";

export type RoomFrequency = "COMMON" | "UNCOMMON" | "UNIQUE";
export interface RoomNeighborhood {
  readonly id: string;
  readonly name: string;
  readonly environmentKeys: readonly string[];
}
export interface RoomSubtheme {
  readonly neighborhoodId: string;
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly architecture: string;
  readonly lighting: string;
  readonly sound: string;
  readonly smell: string;
}
export interface RoomEnvironment {
  readonly name: string;
  readonly description: string;
  readonly engineEnvironment: string;
  readonly frequency: RoomFrequency;
}
export interface RoomFeature {
  readonly name: string;
  readonly description: string;
  readonly interaction: string;
}
export interface WeightedRoomFeature {
  readonly neighborhoodId: string;
  readonly featureName: string;
  readonly weight: number;
}
export interface RoomExit {
  readonly name: string;
  readonly description: string;
}
export interface SignatureRoomDefinition {
  readonly name: string;
  readonly description: string;
  readonly engineEnvironment: string;
  readonly features: readonly RoomFeature[];
  readonly lighting: string;
  readonly sound: string;
  readonly smell: string;
  readonly story: string;
  readonly neighborhoods: readonly string[];
  readonly frequency: RoomFrequency;
}
export interface DepthRoomChoice {
  readonly depthBand: string;
  readonly neighborhoodId: string;
  readonly value: string;
  readonly weight: number;
}
export interface SubthemeEnvironmentCompatibility {
  readonly neighborhoodId: string;
  readonly subthemeId: string;
  readonly environmentNames: readonly string[];
}

export interface OrdinaryRoomCatalog {
  readonly neighborhoods: readonly RoomNeighborhood[];
  readonly subthemes: readonly RoomSubtheme[];
  readonly subthemeEnvironments: readonly SubthemeEnvironmentCompatibility[];
  readonly environments: readonly RoomEnvironment[];
  readonly features: readonly RoomFeature[];
  readonly neighborhoodFeatures: readonly WeightedRoomFeature[];
  readonly arrivals: readonly string[];
  readonly doorways: readonly string[];
  readonly exits: readonly RoomExit[];
  readonly signatures: readonly SignatureRoomDefinition[];
  readonly depthFamilies: readonly DepthRoomChoice[];
  readonly depthFormations: readonly DepthRoomChoice[];
}

export interface LoadOrdinaryRoomCatalogInput {
  readonly neighborhoods: ParsedTsv;
  readonly subthemes: ParsedTsv;
  readonly subthemeEnvironments: ParsedTsv;
  readonly environments: ParsedTsv;
  readonly features: ParsedTsv;
  readonly neighborhoodFeatures: ParsedTsv;
  readonly arrivals: ParsedTsv;
  readonly doorways: ParsedTsv;
  readonly exits: ParsedTsv;
  readonly signatures: ParsedTsv;
  readonly depthFamilies: ParsedTsv;
  readonly depthFormations: ParsedTsv;
}
