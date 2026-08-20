export { composeEncounter } from "./compose.js";
export { EncounterCompositionError } from "./errors.js";
export { getEligibleEncounterFormations } from "./formations.js";
export { selectEncounterFormation } from "./selection.js";
export type {
  ComposedEncounter,
  EncounterCompositionErrorCode,
  EncounterCompositionOptions,
  EncounterFormation,
  EncounterFormationRoleSlot,
  EncounterMonsterEntry,
  FormationAttemptDiagnostic,
  FormationAttemptOutcome,
  FormationAttemptPhase,
  FormationExecutionDiagnostic,
  FormationExecutionTermination,
  FormationSelectionOptions,
  FormationSelectionResult,
} from "./types.js";
