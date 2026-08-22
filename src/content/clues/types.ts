import type { ParsedTsv } from "../types.js";

export const GARY_CLUE_CATEGORIES = [
  "practical",
  "maintenance",
  "observational",
  "personal",
] as const;
export const GARY_CLUE_PRESENTATIONS = ["direct", "misleading"] as const;
export const GARY_CLUE_PHASES = [0, 1, 2, 3, 4, 5] as const;
export const GARY_CLUE_DEPTH_BANDS = ["shallow", "middle", "deep", "extreme"] as const;

export type GaryClueCategory = (typeof GARY_CLUE_CATEGORIES)[number];
export type GaryCluePresentation = (typeof GARY_CLUE_PRESENTATIONS)[number];
export type GaryCluePhase = (typeof GARY_CLUE_PHASES)[number];
export type GaryClueDepthBand = (typeof GARY_CLUE_DEPTH_BANDS)[number];

/** One authored clue. Its title is the stable repetition-guard key used by Bash. */
export interface GaryClueDefinition {
  readonly depthBand: GaryClueDepthBand;
  readonly neighborhoodId: string;
  readonly phase: GaryCluePhase;
  readonly category: GaryClueCategory;
  readonly title: string;
  readonly description: string;
  readonly implication: string | undefined;
  readonly presentation: GaryCluePresentation;
}

export interface GaryClueCatalog {
  readonly clues: readonly GaryClueDefinition[];
}

export interface LoadGaryClueCatalogInput {
  readonly clues: ParsedTsv;
}
