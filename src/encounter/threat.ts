import type { RandomGenerator } from "../rng/index.js";
import type { RolledEncounterDifficulty, ThreatResult } from "./types.js";

/**
 * Rolls one d20 and maps it to the active Bash engine's ordinary threat bands.
 *
 * This function consumes exactly one `RandomGenerator.integer(1, 20)` result.
 */
export function rollEncounterThreat(rng: Pick<RandomGenerator, "integer">): ThreatResult {
  const roll = rng.integer(1, 20);
  return Object.freeze({ roll, difficulty: difficultyForThreatRoll(roll) });
}

function difficultyForThreatRoll(roll: number): RolledEncounterDifficulty {
  if (roll <= 5) return "low";
  if (roll <= 15) return "moderate";
  return "high";
}
