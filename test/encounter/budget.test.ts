import { describe, expect, it } from "vitest";

import {
  EncounterValidationError,
  calculateBossEncounterXpBudget,
  calculateEncounterXpBudget,
  createParty,
  type EncounterDifficulty,
  type Party,
} from "../../src/encounter/index.js";

describe("calculateEncounterXpBudget", () => {
  it.each([
    [1, 1, "trivial", 25],
    [1, 1, "low", 50],
    [1, 1, "moderate", 75],
    [1, 1, "high", 100],
    [1, 1, "deadly", 125],
    [6, 1, "low", 300],
    [6, 1, "moderate", 450],
    [6, 1, "high", 600],
    [4, 10, "low", 6400],
    [4, 10, "moderate", 9200],
    [4, 10, "high", 12400],
    [4, 10, "deadly", 15500],
    [10, 20, "low", 58000],
    [10, 20, "moderate", 132000],
    [10, 20, "high", 220000],
    [1, 18, "low", 4800],
    [1, 18, "moderate", 8700],
    [1, 18, "high", 14200],
  ] satisfies readonly (readonly [number, number, EncounterDifficulty, number])[])(
    "%i characters at level %i have a %s budget of %i XP",
    (characterCount, characterLevel, difficulty, expected) => {
      const party = createParty(characterCount, characterLevel);

      expect(calculateEncounterXpBudget(party, difficulty)).toBe(expected);
    },
  );

  it("validates structurally supplied parties instead of trusting TypeScript types", () => {
    const invalidParty: Party = { characterCount: 0, characterLevel: 1 };

    expect(() => calculateEncounterXpBudget(invalidParty, "low")).toThrow(EncounterValidationError);
  });

  it("rejects an unsupported difficulty supplied across an untyped boundary", () => {
    expect(() =>
      calculateEncounterXpBudget(createParty(4, 1), "impossible" as EncounterDifficulty),
    ).toThrow(/difficulty.*impossible.*trivial, low, moderate, high, or deadly/i);
  });
});

describe("calculateBossEncounterXpBudget", () => {
  it.each([
    [6, 1, 750],
    [5, 5, 6875],
    [1, 18, 17750],
    [10, 20, 275000],
  ])("matches a representative Bash Boss budget", (characterCount, characterLevel, expected) => {
    expect(calculateBossEncounterXpBudget(createParty(characterCount, characterLevel))).toBe(
      expected,
    );
  });

  it("applies 125% after party scaling and returns whole XP", () => {
    const party = createParty(1, 1);
    const highBudget = calculateEncounterXpBudget(party, "high");

    expect(calculateBossEncounterXpBudget(party)).toBe(Math.trunc((highBudget * 125) / 100));
    expect(Number.isInteger(calculateBossEncounterXpBudget(party))).toBe(true);
  });
});
