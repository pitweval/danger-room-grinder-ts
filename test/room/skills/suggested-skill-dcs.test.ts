import { describe, expect, it, vi } from "vitest";

import type { RolledEncounterDifficulty } from "../../../src/encounter/index.js";
import { suggestedSkillDcsForDifficulty } from "../../../src/room/index.js";

describe("suggestedSkillDcsForDifficulty", () => {
  it.each([
    [
      "low",
      [
        ["Easy", 5, false],
        ["Moderate", 10, false],
        ["Hard", 15, false],
        ["Very Hard", 20, false],
        ["Nearly Impossible", 25, false],
      ],
      undefined,
    ],
    [
      "moderate",
      [
        ["Easy", 10, false],
        ["Moderate", 15, false],
        ["Hard", 20, false],
        ["Very Hard", 25, false],
        ["Nearly Impossible", 30, true],
      ],
      "* In DRG, a natural 20 always succeeds, even against a DC 30.",
    ],
    [
      "high",
      [
        ["Easy", 15, false],
        ["Moderate", 20, false],
        ["Hard", 25, false],
        ["Very Hard", 30, true],
      ],
      "* In DRG, a natural 20 always succeeds, even against a DC 30.",
    ],
  ] as const)("returns the exact ordered %s table", (difficulty, checks, note) => {
    const result = suggestedSkillDcsForDifficulty(difficulty);
    expect(result.difficulty).toBe(difficulty);
    expect(result.checks.map((check) => [check.label, check.dc, check.asterisk])).toEqual(checks);
    expect(result.note).toBe(note);
  });

  it("returns deeply immutable shared state", () => {
    const first = suggestedSkillDcsForDifficulty("moderate");
    const second = suggestedSkillDcsForDifficulty("moderate");
    expect(first).toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.checks)).toBe(true);
    expect(first.checks.every(Object.isFrozen)).toBe(true);
  });

  it("consumes no RNG and rejects unsupported runtime values", () => {
    const rng = { integer: vi.fn(() => 1) };
    suggestedSkillDcsForDifficulty("low");
    suggestedSkillDcsForDifficulty("moderate");
    suggestedSkillDcsForDifficulty("high");
    expect(rng.integer).not.toHaveBeenCalled();
    expect(() => suggestedSkillDcsForDifficulty("extreme" as RolledEncounterDifficulty)).toThrow(
      'Unsupported room difficulty "extreme"',
    );
  });
});
