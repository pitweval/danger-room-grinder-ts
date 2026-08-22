import { getTsvSource } from "../tsv-parser.js";
import type { ParsedTsv, TsvRow } from "../types.js";
import { TreasureCatalogError } from "./errors.js";
import {
  TREASURE_CATEGORIES,
  TREASURE_RARITIES,
  type HazardSalvageDefinition,
  type LoadTreasureCatalogInput,
  type LoadTreasureCatalogOptions,
  type TreasureCatalog,
  type TreasureCategory,
  type TreasureItemDefinition,
  type TreasureRarity,
} from "./types.js";

const VALUE_SOURCES = new WeakMap<object, { readonly source: string; readonly line: number }>();

/** Loads the two authored catalogs used by active ordinary-room treasure generation. */
export function loadTreasureCatalog(
  input: LoadTreasureCatalogInput,
  options: LoadTreasureCatalogOptions,
): TreasureCatalog {
  const items = loadItems(input.loot);
  const hazardSalvage = loadSalvage(input.hazardSalvage);

  assertUnique(items, (value) => value.name.toLowerCase(), "item name");
  assertUnique(hazardSalvage, (value) => value.hazardName.toLowerCase(), "hazard salvage");

  const hazardNames = new Set(options.hazards.map((value) => value.name));
  for (const salvage of hazardSalvage) {
    if (!hazardNames.has(salvage.hazardName)) {
      const location = VALUE_SOURCES.get(salvage);
      throw new TreasureCatalogError(
        `Unknown hazard reference "${salvage.hazardName}".`,
        location?.source ?? "hazard salvage catalog",
        location?.line,
      );
    }
  }
  for (const hazard of options.hazards) {
    if (!hazardSalvage.some((value) => value.hazardName === hazard.name))
      throw new TreasureCatalogError(
        `Missing salvage for hazard "${hazard.name}".`,
        getTsvSource(input.hazardSalvage) ?? "hazard salvage catalog",
      );
  }

  return Object.freeze({ items, hazardSalvage });
}

function loadItems(table: ParsedTsv): readonly TreasureItemDefinition[] {
  const hasRecordType = schema(
    table,
    ["name", "category", "rarity", "description"],
    ["record_type", "name", "category", "rarity", "description"],
  );
  return convert(table, (row) => {
    if (hasRecordType && text(row, "record_type", table) !== "loot")
      throw rowError(row, table, `Expected record_type "loot".`);
    return {
      name: text(row, "name", table),
      category: category(row, table),
      rarity: rarity(row, table),
      description: text(row, "description", table),
    };
  });
}

function loadSalvage(table: ParsedTsv): readonly HazardSalvageDefinition[] {
  const hasRecordType = schema(
    table,
    ["hazard_name", "description"],
    ["record_type", "hazard_name", "description"],
  );
  return convert(table, (row) => {
    if (hasRecordType && text(row, "record_type", table) !== "salvage")
      throw rowError(row, table, `Expected record_type "salvage".`);
    return {
      hazardName: text(row, "hazard_name", table),
      description: text(row, "description", table),
    };
  });
}

function schema(
  table: ParsedTsv,
  preferred: readonly string[],
  legacy: readonly string[],
): boolean {
  const actual = table.headers.join("\t");
  if (actual === preferred.join("\t")) return false;
  if (actual === legacy.join("\t")) return true;
  throw new TreasureCatalogError(
    `Unsupported schema "${actual.replaceAll("\t", "\\t")}"; expected "${preferred.join("\\t")}".`,
    getTsvSource(table) ?? "treasure catalog",
    1,
  );
}

function convert<T extends object>(table: ParsedTsv, convertRow: (row: TsvRow) => T): readonly T[] {
  const source = getTsvSource(table) ?? "treasure catalog";
  if (table.rows.length === 0)
    throw new TreasureCatalogError("Table must contain at least one record.", source, 1);
  return Object.freeze(
    table.rows.map((row) => {
      const value = Object.freeze(convertRow(row));
      VALUE_SOURCES.set(value, { source, line: row.lineNumber });
      return value;
    }),
  );
}

function text(row: TsvRow, key: string, table: ParsedTsv): string {
  const value = row.values[key] as string;
  if (value.length === 0 || value === "-")
    throw rowError(row, table, `Field "${key}" must not be empty.`);
  return value;
}

function category(row: TsvRow, table: ParsedTsv): TreasureCategory {
  const value = text(row, "category", table);
  if (!(TREASURE_CATEGORIES as readonly string[]).includes(value))
    throw rowError(row, table, `Unknown treasure category "${value}".`);
  return value as TreasureCategory;
}

function rarity(row: TsvRow, table: ParsedTsv): TreasureRarity {
  const value = text(row, "rarity", table);
  if (!(TREASURE_RARITIES as readonly string[]).includes(value))
    throw rowError(row, table, `Unknown treasure rarity "${value}".`);
  return value as TreasureRarity;
}

function assertUnique<T extends object>(
  values: readonly T[],
  key: (value: T) => string,
  label: string,
): void {
  const seen = new Map<string, T>();
  for (const value of values) {
    const identity = key(value);
    const earlier = seen.get(identity);
    if (earlier !== undefined) {
      const current = VALUE_SOURCES.get(value);
      const prior = VALUE_SOURCES.get(earlier);
      throw new TreasureCatalogError(
        `Duplicate ${label} "${identity}"; earlier source ${prior?.source ?? "unknown"}:${prior?.line ?? 1}.`,
        current?.source ?? "treasure catalog",
        current?.line,
      );
    }
    seen.set(identity, value);
  }
}

function rowError(row: TsvRow, table: ParsedTsv, message: string): TreasureCatalogError {
  return new TreasureCatalogError(
    message,
    getTsvSource(table) ?? "treasure catalog",
    row.lineNumber,
  );
}
