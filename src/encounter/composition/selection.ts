import { EncounterCompositionError } from "./errors.js";
import { getEligibleEncounterFormations } from "./formations.js";
import type { FormationSelectionOptions, FormationSelectionResult } from "./types.js";

/** Selects one ordinary formation with the active Bash d20 mapping. */
export function selectEncounterFormation(
  options: FormationSelectionOptions,
): FormationSelectionResult {
  const formations = options.formations ?? getEligibleEncounterFormations();
  if (formations.length === 0) {
    throw new EncounterCompositionError("NO_FORMATIONS", "No encounter formations are available.");
  }

  if (options.requestedFormation !== undefined && options.requestedFormation.length > 0) {
    const selector = normalizeSelector(options.requestedFormation);
    const selected = formations.find(
      (candidate) => candidate.id.toLowerCase() === selector.toLowerCase(),
    );
    if (selected === undefined) {
      throw new EncounterCompositionError(
        "UNKNOWN_FORMATION",
        `Unknown encounter formation "${options.requestedFormation}".`,
        { formationId: options.requestedFormation },
      );
    }
    return Object.freeze({ formation: selected, roll: undefined });
  }

  const roll = options.rng.integer(1, 20);
  const selected = formations.find(
    (candidate) => roll >= candidate.rollMinimum && roll <= candidate.rollMaximum,
  );
  if (selected === undefined) {
    throw new EncounterCompositionError(
      "UNRESOLVED_FORMATION_ROLL",
      `No encounter formation contains roll ${roll}.`,
    );
  }

  return Object.freeze({ formation: selected, roll });
}

function normalizeSelector(value: string): string {
  return value.toLowerCase().replace(/[ -]/g, "_");
}
