/** Invalid authored ordinary-room treasure content. */
export class TreasureCatalogError extends Error {
  public readonly source: string;
  public readonly lineNumber: number | undefined;

  public constructor(message: string, source: string, lineNumber?: number) {
    const location = lineNumber === undefined ? source : `${source}:${lineNumber}`;
    super(`${location}: ${message}`);
    this.name = "TreasureCatalogError";
    this.source = source;
    this.lineNumber = lineNumber;
  }
}
