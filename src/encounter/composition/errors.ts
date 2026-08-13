import type { EncounterCompositionErrorCode } from "./types.js";

/** A domain failure during ordinary formation selection or composition. */
export class EncounterCompositionError extends Error {
  public readonly code: EncounterCompositionErrorCode;
  public readonly familyId: string | undefined;
  public readonly formationId: string | undefined;

  public constructor(
    code: EncounterCompositionErrorCode,
    message: string,
    details: { readonly familyId?: string; readonly formationId?: string } = {},
  ) {
    super(message);

    this.name = "EncounterCompositionError";
    this.code = code;
    this.familyId = details.familyId;
    this.formationId = details.formationId;
  }
}
