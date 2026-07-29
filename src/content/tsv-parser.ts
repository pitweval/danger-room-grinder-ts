import { TsvParseError } from "./errors.js";
import type { ParsedTsv, ParseTsvOptions, TsvRow } from "./types.js";

const DEFAULT_SOURCE = "TSV input";
const BLANK_LINE = /^[\t ]*$/;
const COMMENT_LINE = /^[\t ]*#/;
const PARSED_SOURCES = new WeakMap<ParsedTsv, string>();

/**
 * Parses gameplay-neutral, header-based TSV text.
 *
 * Columns use literal tabs. Empty cells and all cell whitespace are preserved.
 * Empty lines are ignored. Comments are disabled by default. When explicitly
 * enabled, a line whose first non-space-or-tab character is `#` is ignored; a
 * `#` elsewhere remains data. LF and CRLF line endings are accepted, and
 * physical line numbers are retained for diagnostics.
 *
 * This function deliberately has no filesystem dependency so future browser
 * clients can parse fetched text. It validates only TSV structure; gameplay
 * schemas remain the responsibility of later content modules.
 */
export function parseTsv(text: string, options: ParseTsvOptions = {}): ParsedTsv {
  const source = options.source ?? DEFAULT_SOURCE;
  const allowComments = options.allowComments ?? false;
  const physicalLines = text.split("\n");
  let headers: readonly string[] | undefined;
  const rows: TsvRow[] = [];

  for (let index = 0; index < physicalLines.length; index += 1) {
    const physicalLine = physicalLines[index] as string;
    const line = physicalLine.endsWith("\r") ? physicalLine.slice(0, -1) : physicalLine;
    const lineNumber = index + 1;

    if (BLANK_LINE.test(line) || (allowComments && COMMENT_LINE.test(line))) {
      continue;
    }

    const fields = line.split("\t");

    if (headers === undefined) {
      headers = parseHeaders(fields, source, lineNumber);
      continue;
    }

    if (fields.length !== headers.length) {
      throw new TsvParseError(
        `Expected ${headers.length} fields, found ${fields.length}.`,
        source,
        lineNumber,
      );
    }

    const values = Object.freeze(
      Object.fromEntries(
        headers.map((header, fieldIndex) => [header, fields[fieldIndex] as string]),
      ),
    );

    rows.push(Object.freeze({ lineNumber, values }));
  }

  if (headers === undefined) {
    throw new TsvParseError("Missing header row.", source);
  }

  const parsed = Object.freeze({
    headers,
    rows: Object.freeze(rows),
  });
  PARSED_SOURCES.set(parsed, source);
  return parsed;
}

/**
 * Returns parser diagnostic context for downstream schema loaders.
 *
 * @internal
 */
export function getTsvSource(parsedTsv: ParsedTsv): string | undefined {
  return PARSED_SOURCES.get(parsedTsv);
}

function parseHeaders(
  fields: readonly string[],
  source: string,
  lineNumber: number,
): readonly string[] {
  const seen = new Set<string>();

  for (let index = 0; index < fields.length; index += 1) {
    const header = fields[index] as string;

    if (header.trim().length === 0) {
      throw new TsvParseError(`Empty header name at column ${index + 1}.`, source, lineNumber);
    }

    if (seen.has(header)) {
      throw new TsvParseError(`Duplicate header name "${header}".`, source, lineNumber);
    }

    seen.add(header);
  }

  return Object.freeze([...fields]);
}
