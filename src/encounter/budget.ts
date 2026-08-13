import { EncounterValidationError } from "./errors.js";
import { assertValidParty } from "./party.js";
import type { EncounterDifficulty, Party } from "./types.js";

const BOSS_BUDGET_PERCENT = 125;

// Active DRG 2024 encounter budgets per character, indexed by level minus one.
const XP_BUDGETS: Readonly<Record<EncounterDifficulty, readonly number[]>> = Object.freeze({
  trivial: Object.freeze([
    25, 50, 75, 125, 250, 300, 375, 500, 650, 800, 950, 1100, 1300, 1450, 1650, 1900, 2150, 2400,
    2650, 2900,
  ]),
  low: Object.freeze([
    50, 100, 150, 250, 500, 600, 750, 1000, 1300, 1600, 1900, 2200, 2600, 2900, 3300, 3800, 4300,
    4800, 5300, 5800,
  ]),
  moderate: Object.freeze([
    75, 150, 225, 375, 750, 1000, 1300, 1700, 2000, 2300, 2900, 3700, 4200, 4900, 5400, 6100, 7200,
    8700, 10700, 13200,
  ]),
  high: Object.freeze([
    100, 200, 400, 500, 1100, 1400, 1700, 2100, 2600, 3100, 3700, 4700, 5400, 6200, 7800, 9800,
    11700, 14200, 17200, 22000,
  ]),
  deadly: Object.freeze([
    125, 250, 500, 625, 1375, 1750, 2125, 2625, 3250, 3875, 4625, 5875, 6750, 7750, 9750, 12250,
    14625, 17750, 21500, 27500,
  ]),
});

/** Calculates an ordinary encounter's XP budget with active Bash parity. */
export function calculateEncounterXpBudget(party: Party, difficulty: EncounterDifficulty): number {
  return calculateScaledEncounterXpBudget(party, difficulty, 100);
}

/** Calculates the established Boss Room budget: 125% of the High budget. */
export function calculateBossEncounterXpBudget(party: Party): number {
  return calculateScaledEncounterXpBudget(party, "high", BOSS_BUDGET_PERCENT);
}

function calculateScaledEncounterXpBudget(
  party: Party,
  difficulty: EncounterDifficulty,
  budgetPercent: number,
): number {
  assertValidParty(party);
  const table = XP_BUDGETS[difficulty];

  if (table === undefined) {
    throw new EncounterValidationError(
      "difficulty",
      difficulty,
      "trivial, low, moderate, high, or deadly",
    );
  }

  const perCharacterBudget = table[party.characterLevel - 1];
  if (perCharacterBudget === undefined) {
    // Party validation protects this invariant; retain an explicit guard for
    // strict indexed-access safety and future table edits.
    throw new EncounterValidationError(
      "characterLevel",
      party.characterLevel,
      "a level represented in the XP budget table",
    );
  }

  // Match Bash integer arithmetic: multiply all factors before truncation.
  return Math.trunc((perCharacterBudget * party.characterCount * budgetPercent) / 100);
}
