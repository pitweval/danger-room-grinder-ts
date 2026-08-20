import type { FamilyDefinition } from "../../content/families/types.js";
import { EncounterFamilySelectionError } from "./errors.js";
import { getEligibleEncounterFamilies } from "./eligibility.js";
import type { FamilySelectionOptions } from "./types.js";

const MAXIMUM_RNG_RANGE = 0x1_0000_0000;

/** @internal One family range in the effective weighted selection pool. */
export interface WeightedEncounterFamily {
  readonly family: FamilyDefinition;
  readonly weight: number;
}

/** @internal Shared weighted representation used by selection and fallback. */
export interface EncounterFamilySelectionPool {
  readonly entries: readonly WeightedEncounterFamily[];
  readonly totalWeight: number;
}

/** @internal Builds the one authoritative effective family-weight pool. */
export function buildEncounterFamilySelectionPool(
  options: Pick<FamilySelectionOptions, "monsterCatalog" | "familyCatalog" | "familyWeights">,
): EncounterFamilySelectionPool {
  const eligibleFamilies = getEligibleEncounterFamilies(
    options.monsterCatalog,
    options.familyCatalog,
  );
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

  const entries = weightedPool.map((family) =>
    Object.freeze({
      family,
      weight: effectiveFamilyWeight(family, familyWeights?.[family.id] ?? 1),
    }),
  );
  const totalWeight = entries.reduce((total, candidate) => total + candidate.weight, 0);
  if (!Number.isSafeInteger(totalWeight) || totalWeight > MAXIMUM_RNG_RANGE) {
    throw new EncounterFamilySelectionError(
      "INVALID_FAMILY_WEIGHT",
      `Invalid total encounter family weight "${String(totalWeight)}".`,
    );
  }

  return Object.freeze({ entries: Object.freeze(entries), totalWeight });
}

/** @internal Resolves one inclusive weighted roll. */
export function encounterFamilyAtRoll(
  pool: EncounterFamilySelectionPool,
  roll: number,
): FamilyDefinition | undefined {
  let cumulativeWeight = 0;
  for (const candidate of pool.entries) {
    cumulativeWeight += candidate.weight;
    if (roll <= cumulativeWeight) return candidate.family;
  }
  return undefined;
}

/** @internal Implements Bash's cyclic next-distinct-range fallback. */
export function nextDistinctEncounterFamily(
  pool: EncounterFamilySelectionPool,
  currentRoll: number,
  currentFamilyId: string,
): { readonly family: FamilyDefinition; readonly roll: number } | undefined {
  for (let offset = 1; offset <= pool.totalWeight; offset += 1) {
    const roll = ((currentRoll - 1 + offset) % pool.totalWeight) + 1;
    const family = encounterFamilyAtRoll(pool, roll);
    if (family !== undefined && family.id !== currentFamilyId) {
      return Object.freeze({ family, roll });
    }
  }
  return undefined;
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
