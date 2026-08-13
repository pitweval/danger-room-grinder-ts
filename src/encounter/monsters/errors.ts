import type { EncounterMonsterSelectionErrorCode } from "./types.js";

/** A domain failure while filtering or selecting an encounter monster. */
export class EncounterMonsterSelectionError extends Error {
  public readonly code: EncounterMonsterSelectionErrorCode;
  public readonly familyId: string;
  public readonly budget: number;

  public constructor(
    code: EncounterMonsterSelectionErrorCode,
    message: string,
    familyId: string,
    budget: number,
  ) {
    super(message);

    this.name = "EncounterMonsterSelectionError";
    this.code = code;
    this.familyId = familyId;
    this.budget = budget;
  }
}
