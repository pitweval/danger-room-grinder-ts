import type { FamilyCatalog, FamilyDefinition } from "../../content/families/types.js";
import type { MonsterCatalog } from "../../content/monsters/types.js";
import type { RandomGenerator } from "../../rng/index.js";

/** Base family weights from the active procedural selection context. */
export type EncounterFamilyWeights = Readonly<Record<string, number>>;

/** Inputs to deterministic encounter-family selection. */
export interface FamilySelectionOptions {
  readonly monsterCatalog: MonsterCatalog;
  readonly familyCatalog: FamilyCatalog;
  readonly rng: Pick<RandomGenerator, "integer">;
  /** A Bash-compatible family ID selector; spaces and hyphens become underscores. */
  readonly requestedFamily?: string;
  /** When present, defines the complete active weighted family pool. */
  readonly familyWeights?: EncounterFamilyWeights;
}

/** The family chosen for a later encounter-generation stage. */
export interface FamilySelectionResult {
  readonly family: FamilyDefinition;
}

export type EncounterFamilySelectionErrorCode =
  "UNKNOWN_FAMILY" | "INELIGIBLE_FAMILY" | "NO_ELIGIBLE_FAMILIES" | "INVALID_FAMILY_WEIGHT";
