/**
 * A structural TSV validation failure.
 */
export class TsvParseError extends Error {
  public readonly source: string;
  public readonly lineNumber: number | undefined;

  public constructor(message: string, source: string, lineNumber?: number) {
    const location = lineNumber === undefined ? source : `${source}:${lineNumber}`;
    super(`${location}: ${message}`);

    this.name = "TsvParseError";
    this.source = source;
    this.lineNumber = lineNumber;
  }
}

/**
 * A filesystem failure encountered before TSV parsing could begin.
 */
export class TsvFileError extends Error {
  public readonly path: string;

  public constructor(path: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`Unable to read TSV file "${path}": ${detail}`, { cause });

    this.name = "TsvFileError";
    this.path = path;
  }
}
