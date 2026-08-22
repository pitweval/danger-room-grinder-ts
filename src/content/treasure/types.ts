import type { ParsedTsv } from "../types.js";
import type { RoomHazard } from "../rooms/types.js";

export const TREASURE_CATEGORIES = [
  "coins",
  "gem",
  "art",
  "potion",
  "scroll",
  "weapon",
  "armor",
  "wondrous",
  "quest",
  "curiosity",
] as const;

export const TREASURE_RARITIES = [
  "mundane",
  "common",
  "uncommon",
  "rare",
  "very-rare",
  "legendary",
  "curiosity",
] as const;

export type TreasureCategory = (typeof TREASURE_CATEGORIES)[number];
export type TreasureRarity = (typeof TREASURE_RARITIES)[number];

export interface TreasureItemDefinition {
  readonly name: string;
  readonly category: TreasureCategory;
  readonly rarity: TreasureRarity;
  readonly description: string;
}

export interface HazardSalvageDefinition {
  readonly hazardName: string;
  readonly description: string;
}

export interface TreasureCatalog {
  readonly items: readonly TreasureItemDefinition[];
  readonly hazardSalvage: readonly HazardSalvageDefinition[];
}

export interface LoadTreasureCatalogInput {
  readonly loot: ParsedTsv;
  readonly hazardSalvage: ParsedTsv;
}

export interface LoadTreasureCatalogOptions {
  readonly hazards: readonly Pick<RoomHazard, "name">[];
}
