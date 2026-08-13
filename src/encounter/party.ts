import { EncounterValidationError } from "./errors.js";
import type { Party } from "./types.js";

const MINIMUM_CHARACTER_COUNT = 1;
const MAXIMUM_CHARACTER_COUNT = 10;
const MINIMUM_CHARACTER_LEVEL = 1;
const MAXIMUM_CHARACTER_LEVEL = 20;

/** Creates the immutable party representation used by encounter budgeting. */
export function createParty(characterCount: number, characterLevel: number): Party {
  assertValidPartyValues(characterCount, characterLevel);
  return Object.freeze({ characterCount, characterLevel });
}

/** Validates party-like values that may have crossed an untyped boundary. */
export function assertValidParty(party: Party): void {
  assertValidPartyValues(party.characterCount, party.characterLevel);
}

function assertValidPartyValues(characterCount: number, characterLevel: number): void {
  if (
    !Number.isInteger(characterCount) ||
    characterCount < MINIMUM_CHARACTER_COUNT ||
    characterCount > MAXIMUM_CHARACTER_COUNT
  ) {
    throw new EncounterValidationError(
      "characterCount",
      characterCount,
      "an integer from 1 through 10",
    );
  }

  if (
    !Number.isInteger(characterLevel) ||
    characterLevel < MINIMUM_CHARACTER_LEVEL ||
    characterLevel > MAXIMUM_CHARACTER_LEVEL
  ) {
    throw new EncounterValidationError(
      "characterLevel",
      characterLevel,
      "an integer from 1 through 20",
    );
  }
}
