/**
 * A semantic monster-schema or monster-record validation failure.
 */
export class MonsterCatalogError extends Error {
  public readonly source: string;
  public readonly lineNumber: number | undefined;

  public constructor(message: string, source: string, lineNumber?: number) {
    const location = lineNumber === undefined ? source : `${source}:${lineNumber}`;
    super(`${location}: ${message}`);

    this.name = "MonsterCatalogError";
    this.source = source;
    this.lineNumber = lineNumber;
  }
}
