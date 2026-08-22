import type { ParsedTsv } from "../types.js";
import type { TreasureCategory, TreasureRarity } from "../treasure/types.js";

export const VISITOR_SCENE_CONTEXTS = ["any", "encounter", "hazard", "peaceful"] as const;
export const SPORK_STOCK_TYPES = ["mundane", "companion"] as const;
export const SPORK_STOCK_RARITIES = ["mundane", "curiosity", "companion"] as const;

export type VisitorSceneContext = (typeof VISITOR_SCENE_CONTEXTS)[number];
export type SporkStockType = (typeof SPORK_STOCK_TYPES)[number];
export type SporkStockRarity = (typeof SPORK_STOCK_RARITIES)[number];

export interface RecurringVisitorDefinition {
  readonly id: string;
  readonly name: string;
  readonly period: number;
  readonly scheduleIndex: number;
  readonly firstEligibleRoom: number;
}

export interface RecurringVisitorSceneDefinition {
  readonly visitorId: string;
  readonly key: string;
  readonly context: VisitorSceneContext;
  readonly setup: string;
  readonly description: string;
  readonly dialogue: string;
  readonly outcome: string;
  readonly reward: string | undefined;
  readonly hook: string | undefined;
}

export interface SporkStockDefinition {
  readonly stockType: SporkStockType;
  readonly name: string;
  readonly rarity: SporkStockRarity;
  readonly story: string;
}

export type AuthoredSporkAvailability = "dm_choice" | "gift" | "sale" | "special";
export type AuthoredSporkRepeatability = "yes" | "no" | "dm";

export interface AuthoredSporkItemDefinition {
  readonly id: string;
  readonly name: string;
  readonly category: TreasureCategory;
  readonly rarity: TreasureRarity;
  readonly description: string;
  readonly presentation: string;
  readonly availability: AuthoredSporkAvailability;
  readonly repeatable: AuthoredSporkRepeatability;
  readonly source: string;
  readonly notes: string;
}

export interface RecurringVisitorCatalog {
  readonly visitors: readonly RecurringVisitorDefinition[];
  readonly scenes: readonly RecurringVisitorSceneDefinition[];
  readonly sporkStock: readonly SporkStockDefinition[];
  readonly authoredSporkItems: readonly AuthoredSporkItemDefinition[];
}

export interface LoadRecurringVisitorCatalogInput {
  readonly visitors: ParsedTsv;
  readonly scenes: ParsedTsv;
  readonly sporkStock: ParsedTsv;
  readonly authoredSporkItems?: ParsedTsv;
}
