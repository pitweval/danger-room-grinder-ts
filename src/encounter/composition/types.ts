import type { FamilyDefinition } from "../../content/families/types.js";
import type {
  MonsterCatalog,
  MonsterDefinition,
  MonsterRole,
} from "../../content/monsters/types.js";
import type { RandomGenerator } from "../../rng/index.js";

/** One ordered role slot; any listed role may satisfy it. */
export type EncounterFormationRoleSlot = readonly MonsterRole[];

/** One active ordinary encounter formation from the Bash d20 table. */
export interface EncounterFormation {
  readonly id: string;
  readonly name: string;
  readonly roleSlots: readonly EncounterFormationRoleSlot[];
  readonly maxCreatures: number;
  readonly rollMinimum: number;
  readonly rollMaximum: number;
}

export interface FormationSelectionOptions {
  readonly rng: Pick<RandomGenerator, "integer">;
  readonly requestedFormation?: string;
  /** Defaults to the six canonical ordinary formations. */
  readonly formations?: readonly EncounterFormation[];
}

export interface FormationSelectionResult {
  readonly formation: EncounterFormation;
  /** Explicit selection has no roll and consumes no randomness. */
  readonly roll: number | undefined;
}

export interface EncounterCompositionOptions {
  readonly monsterCatalog: MonsterCatalog;
  readonly family: FamilyDefinition;
  readonly formation: EncounterFormation;
  readonly xpBudget: number;
  readonly environment?: string;
}

export interface EncounterMonsterEntry {
  readonly monster: MonsterDefinition;
  readonly count: number;
}

/** Which Bash composition pass issued a role attempt. */
export type FormationAttemptPhase = "initial-pass" | "cyclic-fill";

/** The observable result of one ordered Bash role attempt. */
export type FormationAttemptOutcome =
  "selected" | "no-candidate" | "insufficient-budget" | "leader-already-selected";

/** One immutable decision in formation execution order. */
export interface FormationAttemptDiagnostic {
  readonly phase: FormationAttemptPhase;
  readonly roleSlotIndex: number;
  readonly requestedRoles: EncounterFormationRoleSlot;
  readonly budgetBefore: number;
  readonly budgetAfter: number;
  readonly creatureCountBefore: number;
  readonly creatureCountAfter: number;
  readonly outcome: FormationAttemptOutcome;
  readonly selectedMonsterId?: string;
  readonly xpSpent: number;
}

/** Why the finite Bash composition loop stopped. */
export type FormationExecutionTermination = "creature-cap" | "stalled-role-cycle";

/** Pick-by-pick formation history retained beside the aggregate roster. */
export interface FormationExecutionDiagnostic {
  readonly attempts: readonly FormationAttemptDiagnostic[];
  readonly termination: FormationExecutionTermination;
  readonly maxCreatures: number;
}

export interface ComposedEncounter {
  readonly formation: EncounterFormation;
  readonly family: FamilyDefinition;
  readonly entries: readonly EncounterMonsterEntry[];
  readonly xpBudget: number;
  readonly xpSpent: number;
  readonly xpRemaining: number;
  readonly creatureCount: number;
  readonly formationExecution: FormationExecutionDiagnostic;
}

export type EncounterCompositionErrorCode =
  | "NO_FORMATIONS"
  | "UNKNOWN_FORMATION"
  | "UNRESOLVED_FORMATION_ROLL"
  | "INVALID_COMPOSITION_CONTEXT"
  | "NO_MONSTERS_SELECTED";
