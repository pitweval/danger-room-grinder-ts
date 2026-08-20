import type { FamilyDefinition } from "../../content/families/types.js";
import { EncounterFamilySelectionError } from "./errors.js";
import { getEligibleEncounterFamilies } from "./eligibility.js";
import { buildEncounterFamilySelectionPool, encounterFamilyAtRoll } from "./pool.js";
import type { FamilySelectionOptions, FamilySelectionResult } from "./types.js";

/** Selects one encounter family using the active Bash weighting policy. */
export function selectEncounterFamily(options: FamilySelectionOptions): FamilySelectionResult {
  const eligibleFamilies = getEligibleEncounterFamilies(
    options.monsterCatalog,
    options.familyCatalog,
  );

  if (options.requestedFamily !== undefined && options.requestedFamily.length > 0) {
    return selectRequestedFamily(options, eligibleFamilies);
  }

  const pool = buildEncounterFamilySelectionPool(options);
  const roll = options.rng.integer(1, pool.totalWeight);
  const selected = encounterFamilyAtRoll(pool, roll);
  if (selected !== undefined) return frozenResult(selected);

  // The RNG contract guarantees an in-range roll, so this is unreachable for
  // a conforming RandomGenerator and protects structurally supplied adapters.
  throw new EncounterFamilySelectionError(
    "INVALID_FAMILY_WEIGHT",
    `Encounter family roll "${roll}" exceeded total weight "${pool.totalWeight}".`,
  );
}

function selectRequestedFamily(
  options: FamilySelectionOptions,
  eligibleFamilies: readonly FamilyDefinition[],
): FamilySelectionResult {
  const selector = options.requestedFamily as string;
  const normalizedSelector = normalizeFamilySelector(selector);
  const requested = options.familyCatalog.families.find(
    (family) => family.id.toLowerCase() === normalizedSelector.toLowerCase(),
  );

  if (requested === undefined) {
    throw new EncounterFamilySelectionError(
      "UNKNOWN_FAMILY",
      `Unknown encounter family "${selector}".`,
      { familySelector: selector },
    );
  }

  if (!eligibleFamilies.some((family) => family.id === requested.id)) {
    throw new EncounterFamilySelectionError(
      "INELIGIBLE_FAMILY",
      `Encounter family "${requested.id}" has no procedural member monsters.`,
      { familySelector: selector, familyId: requested.id },
    );
  }

  return frozenResult(requested);
}

function normalizeFamilySelector(value: string): string {
  return value.toLowerCase().replace(/[ -]/g, "_");
}

function frozenResult(family: FamilyDefinition): FamilySelectionResult {
  return Object.freeze({ family });
}
