export type RoomRenderingErrorCode = "UNSUPPORTED_LONG_CORRIDOR";

export class RoomRenderingError extends Error {
  public readonly code: RoomRenderingErrorCode;
  public constructor(code: RoomRenderingErrorCode, message: string) {
    super(message);
    this.name = "RoomRenderingError";
    this.code = code;
  }
}
