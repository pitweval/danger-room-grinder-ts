/**
 * Options shared by TSV text parsers.
 */
export interface ParseTsvOptions {
  /**
   * Ignore full-line comments when true. Defaults to false.
   */
  readonly allowComments?: boolean;

  /**
   * Human-readable input name included in validation errors.
   */
  readonly source?: string;
}

/**
 * One parsed TSV data row and its physical source line.
 */
export interface TsvRow {
  readonly lineNumber: number;
  readonly values: Readonly<Record<string, string>>;
}

/**
 * A validated TSV header and its data rows in source order.
 */
export interface ParsedTsv {
  readonly headers: readonly string[];
  readonly rows: readonly TsvRow[];
}
