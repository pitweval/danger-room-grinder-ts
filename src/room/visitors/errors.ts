import type { RecurringVisitorGenerationErrorCode } from "./types.js";

/** Valid visitor content cannot satisfy the requested room context. */
export class RecurringVisitorGenerationError extends Error {
  public readonly code: RecurringVisitorGenerationErrorCode;

  public constructor(code: RecurringVisitorGenerationErrorCode, message: string) {
    super(message);
    this.name = "RecurringVisitorGenerationError";
    this.code = code;
  }
}
