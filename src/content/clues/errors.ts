/** Invalid authored Gary-clue content. */
export class GaryClueCatalogError extends Error {
  public readonly source: string;
  public readonly lineNumber: number | undefined;

  public constructor(message: string, source: string, lineNumber?: number) {
    const location = lineNumber === undefined ? source : `${source}:${lineNumber}`;
    super(`${location}: ${message}`);
    this.name = "GaryClueCatalogError";
    this.source = source;
    this.lineNumber = lineNumber;
  }
}
