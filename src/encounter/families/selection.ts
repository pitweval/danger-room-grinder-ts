import type { FamilyDefinition } from "../../content/families/types.js";
import { EncounterFamilySelectionError } from "./errors.js";
import { getEligibleEncounterFamilies } from "./eligibility.js";
import type { FamilySelectionOptions, FamilySelectionResult } from "./types.js";

const MAXIMUM_RNG_RANGE = 0x1_0000_0000;

/** Selects one encounter family using the active Bash weighting policy. */
export function selectEncounterFamily(options: FamilySelectionOptions): FamilySelectionResult {
  const eligibleFamilies = getEligibleEncounterFamilies(
    options.monsterCatalog,
    options.familyCatalog,
  );

  if (options.requestedFamily !== undefined && options.requestedFamily.length > 0) {
    return selectRequestedFamily(options, eligibleFamilies);
  }

  if (eligibleFamilies.length === 0) {
    throw new EncounterFamilySelectionError(
      "NO_ELIGIBLE_FAMILIES",
      "No encounter families contain a procedural monster.",
    );
  }

  const familyWeights = options.familyWeights;
  const weightedPool =
    familyWeights === undefined
      ? eligibleFamilies
      : eligibleFamilies.filter((family) => Object.hasOwn(familyWeights, family.id));

  if (weightedPool.length === 0) {
    throw new EncounterFamilySelectionError(
      "NO_ELIGIBLE_FAMILIES",
      "No eligible encounter families are present in the active weighted pool.",
    );
  }

  const weightedFamilies = weightedPool.map((family) => ({
    family,
    weight: effectiveFamilyWeight(family, familyWeights?.[family.id] ?? 1),
  }));
  const totalWeight = weightedFamilies.reduce((total, candidate) => total + candidate.weight, 0);

  if (!Number.isSafeInteger(totalWeight) || totalWeight > MAXIMUM_RNG_RANGE) {
    throw new EncounterFamilySelectionError(
      "INVALID_FAMILY_WEIGHT",
      `Invalid total encounter family weight "${String(totalWeight)}".`,
    );
  }

  const roll = options.rng.integer(1, totalWeight);
  let cumulativeWeight = 0;

  for (const candidate of weightedFamilies) {
    cumulativeWeight += candidate.weight;
    if (roll <= cumulativeWeight) return frozenResult(candidate.family);
  }

  // The RNG contract guarantees an in-range roll, so this is unreachable for
  // a conforming RandomGenerator and protects structurally supplied adapters.
  throw new EncounterFamilySelectionError(
    "INVALID_FAMILY_WEIGHT",
    `Encounter family roll "${roll}" exceeded total weight "${totalWeight}".`,
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

function effectiveFamilyWeight(family: FamilyDefinition, baseWeight: number): number {
  if (!Number.isSafeInteger(baseWeight) || baseWeight < 1) {
    throw new EncounterFamilySelectionError(
      "INVALID_FAMILY_WEIGHT",
      `Invalid encounter family weight "${String(baseWeight)}" for family "${family.id}"; expected a positive safe integer.`,
      { familyId: family.id },
    );
  }

  if (family.familyType === "PRIMARY") return baseWeight;
  return Math.max(1, Math.ceil(baseWeight / 4));
}

function normalizeFamilySelector(value: string): string {
  return value.toLowerCase().replace(/[ -]/g, "_");
}

function frozenResult(family: FamilyDefinition): FamilySelectionResult {
  return Object.freeze({ family });
}
