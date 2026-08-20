import type { RoomGenerationErrorCode } from "./types.js";

export class RoomGenerationError extends Error {
  public readonly code: RoomGenerationErrorCode;
  public constructor(code: RoomGenerationErrorCode, message: string, options: ErrorOptions = {}) {
    super(message, options);
    this.name = "RoomGenerationError";
    this.code = code;
  }
}
