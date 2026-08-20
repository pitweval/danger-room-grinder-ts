import type {
  BehaviorDefinition,
  DispositionDefinition,
  EncounterBehaviorCatalog,
} from "../../content/behaviors/types.js";
import type { EncounterMonsterEntry } from "../composition/types.js";

export interface EncounterBehaviorRolls {
  readonly behavior: number;
  readonly disposition: number;
}

export interface GenerateEncounterBehaviorOptions {
  readonly catalog: EncounterBehaviorCatalog;
  readonly rolls: EncounterBehaviorRolls;
  readonly environment: string;
  readonly entries: readonly EncounterMonsterEntry[];
}

/** The active metadata-driven behavior state attached to an encounter. */
export interface EncounterBehaviorState {
  readonly behavior: BehaviorDefinition;
  readonly disposition: DispositionDefinition;
  readonly alertnessModifier: number | undefined;
  /** Bash's compatibility activity field, retained as structured output data. */
  readonly activity: string;
  readonly rolls: EncounterBehaviorRolls;
}

export type EncounterBehaviorErrorCode =
  "INVALID_BEHAVIOR_CONTEXT" | "NO_MATCHING_BEHAVIOR" | "NO_MATCHING_DISPOSITION";
