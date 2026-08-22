import type { GaryClueGenerationErrorCode } from "./types.js";

/** A valid Gary-clue catalog cannot satisfy the requested room context. */
export class GaryClueGenerationError extends Error {
  public readonly code: GaryClueGenerationErrorCode;

  public constructor(code: GaryClueGenerationErrorCode, message: string) {
    super(message);
    this.name = "GaryClueGenerationError";
    this.code = code;
  }
}
