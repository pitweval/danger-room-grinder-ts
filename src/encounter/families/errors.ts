import type { EncounterFamilySelectionErrorCode } from "./types.js";

/** A domain failure while resolving or selecting an encounter family. */
export class EncounterFamilySelectionError extends Error {
  public readonly code: EncounterFamilySelectionErrorCode;
  public readonly familySelector: string | undefined;
  public readonly familyId: string | undefined;

  public constructor(
    code: EncounterFamilySelectionErrorCode,
    message: string,
    details: { readonly familySelector?: string; readonly familyId?: string } = {},
  ) {
    super(message);

    this.name = "EncounterFamilySelectionError";
    this.code = code;
    this.familySelector = details.familySelector;
    this.familyId = details.familyId;
  }
}
