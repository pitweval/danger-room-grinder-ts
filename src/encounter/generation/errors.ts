import type { OrdinaryEncounterGenerationErrorCode } from "./types.js";

/** A failure after valid lower-level encounter inputs could not form a roster. */
export class OrdinaryEncounterGenerationError extends Error {
  public readonly code: OrdinaryEncounterGenerationErrorCode;
  public readonly familyAttempts: readonly string[];
  public readonly cause: unknown;

  public constructor(
    code: OrdinaryEncounterGenerationErrorCode,
    message: string,
    familyAttempts: readonly string[],
    cause: unknown,
  ) {
    super(message);

    this.name = "OrdinaryEncounterGenerationError";
    this.code = code;
    this.familyAttempts = Object.freeze([...familyAttempts]);
    this.cause = cause;
  }
}
