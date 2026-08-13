import type { FamilyDefinition } from "../../content/families/types.js";
import type {
  MonsterCatalog,
  MonsterDefinition,
  MonsterRole,
} from "../../content/monsters/types.js";
import type { RandomGenerator } from "../../rng/index.js";

/** Inputs shared by candidate filtering and deterministic single-monster selection. */
export interface MonsterSelectionOptions {
  readonly monsterCatalog: MonsterCatalog;
  readonly family: FamilyDefinition;
  /** Raw XP available for this selection, equivalent to Bash's remaining budget. */
  readonly budget: number;
  /** Defaults to the Bash encounter engine's `dungeon` environment. */
  readonly environment?: string;
  /** A monster may satisfy any one requested role. */
  readonly requiredRoles?: readonly MonsterRole[];
  /** Applies the Bash `boss_` formation eligibility gate when true. */
  readonly bossEncounter?: boolean;
  /**
   * Accepted for pipeline composition and determinism auditing. The active
   * Bash single-monster selector consumes zero RNG draws, so this is unused.
   */
  readonly rng?: Pick<RandomGenerator, "integer">;
}

/** One monster chosen for a later encounter-composition stage. */
export interface MonsterSelectionResult {
  readonly monster: MonsterDefinition;
}

export type EncounterMonsterSelectionErrorCode =
  "INVALID_BUDGET" | "INVALID_ENVIRONMENT" | "NO_ELIGIBLE_MONSTERS";
