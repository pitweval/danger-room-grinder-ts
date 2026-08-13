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

export interface ComposedEncounter {
  readonly formation: EncounterFormation;
  readonly family: FamilyDefinition;
  readonly entries: readonly EncounterMonsterEntry[];
  readonly xpBudget: number;
  readonly xpSpent: number;
  readonly xpRemaining: number;
  readonly creatureCount: number;
}

export type EncounterCompositionErrorCode =
  | "NO_FORMATIONS"
  | "UNKNOWN_FORMATION"
  | "UNRESOLVED_FORMATION_ROLL"
  | "INVALID_COMPOSITION_CONTEXT"
  | "NO_MONSTERS_SELECTED";
