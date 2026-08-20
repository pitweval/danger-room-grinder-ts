import type { FamilyCatalog, FamilyDefinition } from "../../content/families/types.js";
import type { MonsterCatalog } from "../../content/monsters/types.js";
import type { RandomGenerator } from "../../rng/index.js";
import type {
  EncounterMonsterEntry,
  EncounterFormation,
  FormationExecutionDiagnostic,
} from "../composition/types.js";
import type { EncounterFamilyWeights } from "../families/types.js";
import type { EncounterBehaviorCatalog } from "../../content/behaviors/types.js";
import type { EncounterBehaviorState } from "../behavior/types.js";
import type { Party, RolledEncounterDifficulty, ThreatResult } from "../types.js";

export interface OrdinaryEncounterGenerationOptions {
  readonly party: Party;
  readonly monsterCatalog: MonsterCatalog;
  readonly familyCatalog: FamilyCatalog;
  readonly behaviorCatalog: EncounterBehaviorCatalog;
  readonly rng: Pick<RandomGenerator, "integer">;
  readonly environment?: string;
  readonly familyWeights?: EncounterFamilyWeights;
  readonly requestedFamily?: string;
  readonly requestedFormation?: string;
}

export interface OrdinaryEncounterResult {
  readonly party: Party;
  readonly environment: string;
  readonly threat: ThreatResult;
  readonly difficulty: RolledEncounterDifficulty;
  readonly xpBudget: number;
  readonly family: FamilyDefinition;
  readonly formation: EncounterFormation;
  readonly entries: readonly EncounterMonsterEntry[];
  readonly xpSpent: number;
  readonly xpRemaining: number;
  readonly creatureCount: number;
  readonly formationExecution: FormationExecutionDiagnostic;
  readonly familyAttempts: readonly string[];
  readonly failedFamilyAttempts: readonly string[];
  readonly behaviorState: EncounterBehaviorState;
}

export type OrdinaryEncounterGenerationErrorCode =
  "REQUESTED_FAMILY_UNUSABLE" | "FAMILY_FALLBACK_EXHAUSTED";
