import type { EncounterBehaviorErrorCode } from "./types.js";

/** A domain failure while resolving ordinary encounter behavior state. */
export class EncounterBehaviorError extends Error {
  public readonly code: EncounterBehaviorErrorCode;

  public constructor(code: EncounterBehaviorErrorCode, message: string) {
    super(message);
    this.name = "EncounterBehaviorError";
    this.code = code;
  }
}
