import type { TreasureGenerationErrorCode } from "./types.js";

/** A valid treasure catalog cannot satisfy the requested room context. */
export class TreasureGenerationError extends Error {
  public readonly code: TreasureGenerationErrorCode;

  public constructor(code: TreasureGenerationErrorCode, message: string) {
    super(message);
    this.name = "TreasureGenerationError";
    this.code = code;
  }
}
