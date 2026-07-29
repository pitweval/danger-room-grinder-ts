import { readFile } from "node:fs/promises";

import { TsvFileError } from "./errors.js";
import { parseTsv } from "./tsv-parser.js";
import type { ParsedTsv, ParseTsvOptions } from "./types.js";

/**
 * Reads one UTF-8 TSV file in Node.js and delegates all parsing to `parseTsv`.
 */
export async function loadTsvFile(path: string, options: ParseTsvOptions = {}): Promise<ParsedTsv> {
  let text: string;

  try {
    text = await readFile(path, "utf8");
  } catch (cause) {
    throw new TsvFileError(path, cause);
  }

  return parseTsv(text, { ...options, source: path });
}
