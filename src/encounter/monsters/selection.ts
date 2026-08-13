import type { MonsterDefinition } from "../../content/monsters/types.js";
import { EncounterMonsterSelectionError } from "./errors.js";
import { environmentSuitability, getEligibleEncounterMonsters } from "./eligibility.js";
import type { MonsterSelectionOptions, MonsterSelectionResult } from "./types.js";

/**
 * Selects Bash's strongest affordable monster with zero RNG consumption.
 * Equal XP is resolved by environmental suitability, then lexical monster ID.
 */
export function selectEncounterMonster(options: MonsterSelectionOptions): MonsterSelectionResult {
  const candidates = getEligibleEncounterMonsters(options);

  if (candidates.length === 0) {
    throw new EncounterMonsterSelectionError(
      "NO_ELIGIBLE_MONSTERS",
      `No eligible monsters found for family "${options.family.id}".`,
      options.family.id,
      options.budget,
    );
  }

  const environment = options.environment ?? "dungeon";
  let best: MonsterDefinition | undefined;

  for (const candidate of candidates) {
    if (best === undefined || isBetterCandidate(candidate, best, environment)) best = candidate;
  }

  return Object.freeze({ monster: best as MonsterDefinition });
}

function isBetterCandidate(
  candidate: MonsterDefinition,
  best: MonsterDefinition,
  environment: string,
): boolean {
  if (candidate.xp !== best.xp) return candidate.xp > best.xp;

  const candidateSuitability = environmentSuitability(candidate, environment);
  const bestSuitability = environmentSuitability(best, environment);
  if (candidateSuitability !== bestSuitability) return candidateSuitability > bestSuitability;

  return candidate.id < best.id;
}
