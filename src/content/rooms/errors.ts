export class OrdinaryRoomCatalogError extends Error {
  public readonly source: string;
  public readonly lineNumber: number;
  public constructor(message: string, source: string, lineNumber: number) {
    super(`${source}:${lineNumber}: ${message}`);
    this.name = "OrdinaryRoomCatalogError";
    this.source = source;
    this.lineNumber = lineNumber;
  }
}
