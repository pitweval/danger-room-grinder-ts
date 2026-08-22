import { getTsvSource } from "../tsv-parser.js";
import type { ParsedTsv, TsvRow } from "../types.js";
import { GaryClueCatalogError } from "./errors.js";
import {
  GARY_CLUE_CATEGORIES,
  GARY_CLUE_DEPTH_BANDS,
  GARY_CLUE_PHASES,
  GARY_CLUE_PRESENTATIONS,
  type GaryClueCatalog,
  type GaryClueDefinition,
  type GaryCluePhase,
  type LoadGaryClueCatalogInput,
} from "./types.js";

const PREFERRED_SCHEMA = [
  "depth_band",
  "neighborhood",
  "phase",
  "category",
  "title",
  "description",
  "implication",
  "presentation",
] as const;
const LEGACY_SCHEMA = [
  "record_type",
  "depth_band",
  "neighborhood",
  "category",
  "title",
  "description",
  "implication",
  "presentation",
] as const;

/** Loads the authored Gary-clue catalog in deterministic source order. */
export function loadGaryClueCatalog(input: LoadGaryClueCatalogInput): GaryClueCatalog {
  const table = input.clues;
  const legacy = schema(table);
  const source = getTsvSource(table) ?? "Gary clue catalog";
  if (table.rows.length === 0)
    throw new GaryClueCatalogError("Table must contain at least one record.", source, 1);

  const clues = Object.freeze(
    table.rows.map((row, index) => {
      if (legacy && text(row, "record_type", table) !== "clue")
        throw rowError(row, table, `Expected record_type "clue".`);
      const value: GaryClueDefinition = {
        depthBand: allowed(row, "depth_band", GARY_CLUE_DEPTH_BANDS, table),
        neighborhoodId: neighborhood(row, table),
        phase: legacy ? (((index + 1) % 6) as GaryCluePhase) : phase(row, table),
        category: allowed(row, "category", GARY_CLUE_CATEGORIES, table),
        title: text(row, "title", table),
        description: text(row, "description", table),
        implication: optionalText(row, "implication", table),
        presentation: allowed(row, "presentation", GARY_CLUE_PRESENTATIONS, table),
      };
      return Object.freeze(value);
    }),
  );

  const seen = new Map<string, number>();
  for (const [index, clue] of clues.entries()) {
    const key = clue.title.toLowerCase();
    const earlier = seen.get(key);
    if (earlier !== undefined) {
      const row = table.rows[index] as TsvRow;
      const prior = table.rows[earlier] as TsvRow;
      throw rowError(
        row,
        table,
        `Duplicate clue title "${clue.title}"; earlier source ${source}:${prior.lineNumber}.`,
      );
    }
    seen.set(key, index);
  }

  return Object.freeze({ clues });
}

function schema(table: ParsedTsv): boolean {
  const actual = table.headers.join("\t");
  if (actual === PREFERRED_SCHEMA.join("\t")) return false;
  if (actual === LEGACY_SCHEMA.join("\t")) return true;
  throw new GaryClueCatalogError(
    `Unsupported schema "${actual.replaceAll("\t", "\\t")}"; expected "${PREFERRED_SCHEMA.join("\\t")}".`,
    getTsvSource(table) ?? "Gary clue catalog",
    1,
  );
}

function text(row: TsvRow, key: string, table: ParsedTsv): string {
  const value = row.values[key] as string;
  if (value.length === 0 || value === "-")
    throw rowError(row, table, `Field "${key}" must not be empty.`);
  return value;
}

function optionalText(row: TsvRow, key: string, table: ParsedTsv): string | undefined {
  const value = row.values[key] as string;
  if (value.length === 0) throw rowError(row, table, `Field "${key}" must not be empty.`);
  return value === "-" ? undefined : value;
}

function allowed<T extends string>(
  row: TsvRow,
  key: string,
  values: readonly T[],
  table: ParsedTsv,
): T {
  const value = text(row, key, table);
  if (!(values as readonly string[]).includes(value))
    throw rowError(row, table, `Unknown Gary clue ${key.replaceAll("_", " ")} "${value}".`);
  return value as T;
}

function phase(row: TsvRow, table: ParsedTsv): GaryCluePhase {
  const value = text(row, "phase", table);
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || !(GARY_CLUE_PHASES as readonly number[]).includes(numeric))
    throw rowError(row, table, `Unknown Gary clue phase "${value}".`);
  return numeric as GaryCluePhase;
}

function neighborhood(row: TsvRow, table: ParsedTsv): string {
  const value = text(row, "neighborhood", table);
  if (value !== "*" && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))
    throw rowError(row, table, `Invalid Gary clue neighborhood "${value}".`);
  return value;
}

function rowError(row: TsvRow, table: ParsedTsv, message: string): GaryClueCatalogError {
  return new GaryClueCatalogError(
    message,
    getTsvSource(table) ?? "Gary clue catalog",
    row.lineNumber,
  );
}
