import type { RolledEncounterDifficulty } from "../../encounter/types.js";
import type { SuggestedSkillDc, SuggestedSkillDcs } from "./types.js";

const NATURAL_TWENTY_NOTE = "* In DRG, a natural 20 always succeeds, even against a DC 30.";

const TABLE = Object.freeze({
  low: skillDcs("low", [
    check("Easy", 5),
    check("Moderate", 10),
    check("Hard", 15),
    check("Very Hard", 20),
    check("Nearly Impossible", 25),
  ]),
  moderate: skillDcs(
    "moderate",
    [
      check("Easy", 10),
      check("Moderate", 15),
      check("Hard", 20),
      check("Very Hard", 25),
      check("Nearly Impossible", 30, true),
    ],
    NATURAL_TWENTY_NOTE,
  ),
  high: skillDcs(
    "high",
    [check("Easy", 15), check("Moderate", 20), check("Hard", 25), check("Very Hard", 30, true)],
    NATURAL_TWENTY_NOTE,
  ),
});

/** Returns the immutable Bash-parity suggested skill checks for one room difficulty. */
export function suggestedSkillDcsForDifficulty(
  difficulty: RolledEncounterDifficulty,
): SuggestedSkillDcs {
  const result = TABLE[difficulty];
  if (result === undefined)
    throw new RangeError(`Unsupported room difficulty "${String(difficulty)}".`);
  return result;
}

function check(label: SuggestedSkillDc["label"], dc: number, asterisk = false): SuggestedSkillDc {
  return Object.freeze({ label, dc, asterisk });
}

function skillDcs(
  difficulty: RolledEncounterDifficulty,
  checks: readonly SuggestedSkillDc[],
  note?: string,
): SuggestedSkillDcs {
  return Object.freeze({ difficulty, checks: Object.freeze([...checks]), note });
}
