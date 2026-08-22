import { getTsvSource } from "../tsv-parser.js";
import type { ParsedTsv, TsvRow } from "../types.js";
import { RecurringVisitorCatalogError } from "./errors.js";
import { TREASURE_CATEGORIES, TREASURE_RARITIES } from "../treasure/types.js";
import {
  SPORK_STOCK_RARITIES,
  SPORK_STOCK_TYPES,
  VISITOR_SCENE_CONTEXTS,
  type LoadRecurringVisitorCatalogInput,
  type AuthoredSporkItemDefinition,
  type RecurringVisitorCatalog,
  type RecurringVisitorDefinition,
  type RecurringVisitorSceneDefinition,
  type SporkStockDefinition,
} from "./types.js";

const VISITOR_SCHEMA = ["id", "name", "period", "schedule_index", "first_eligible_room"];
const VISITOR_COMPATIBILITY_SCHEMA = [
  "record_type",
  "id",
  "name",
  "period",
  "schedule_index",
  "first_eligible_room",
];
const SCENE_SCHEMA = [
  "visitor_id",
  "scene_key",
  "context",
  "setup",
  "description",
  "dialogue",
  "outcome",
  "reward",
  "hook",
];
const SCENE_COMPATIBILITY_SCHEMA = [
  "record_type",
  "visitor_id",
  "visitor_name",
  ...SCENE_SCHEMA.slice(1),
];
const STOCK_SCHEMA = ["stock_type", "name", "rarity", "story"];
const STOCK_COMPATIBILITY_SCHEMA = ["record_type", ...STOCK_SCHEMA];
const AUTHORED_SPORK_SCHEMA = [
  "id",
  "name",
  "category",
  "rarity",
  "description",
  "presentation",
  "availability",
  "repeatable",
  "source",
  "notes",
];
const AUTHORED_AVAILABILITY = ["dm_choice", "gift", "sale", "special"] as const;
const AUTHORED_REPEATABILITY = ["yes", "no", "dm"] as const;

/** Loads schedule, scene, and Spork-stock metadata in deterministic source order. */
export function loadRecurringVisitorCatalog(
  input: LoadRecurringVisitorCatalogInput,
): RecurringVisitorCatalog {
  const visitorsCompatibility = schema(
    input.visitors,
    VISITOR_SCHEMA,
    VISITOR_COMPATIBILITY_SCHEMA,
  );
  const visitors = convert(input.visitors, (row) => {
    if (visitorsCompatibility) recordType(row, input.visitors, "visitor");
    return {
      id: identifier(row, "id", input.visitors),
      name: text(row, "name", input.visitors),
      period: positiveInteger(row, "period", input.visitors),
      scheduleIndex: positiveInteger(row, "schedule_index", input.visitors),
      firstEligibleRoom: positiveInteger(row, "first_eligible_room", input.visitors),
    } satisfies RecurringVisitorDefinition;
  });
  unique(visitors, (value) => value.id.toLowerCase(), "visitor ID", input.visitors);
  unique(visitors, (value) => value.name.toLowerCase(), "visitor display name", input.visitors);

  const sceneCompatibility = schema(input.scenes, SCENE_SCHEMA, SCENE_COMPATIBILITY_SCHEMA);
  const scenes = convert(input.scenes, (row) => {
    if (sceneCompatibility) recordType(row, input.scenes, "visitor");
    const visitorId = identifier(row, "visitor_id", input.scenes);
    const visitor = visitors.find((value) => value.id === visitorId);
    if (visitor === undefined)
      throw rowError(row, input.scenes, `Unknown visitor reference "${visitorId}".`);
    if (sceneCompatibility && text(row, "visitor_name", input.scenes) !== visitor.name)
      throw rowError(row, input.scenes, `Visitor display name does not match "${visitorId}".`);
    return {
      visitorId,
      key: identifier(row, "scene_key", input.scenes),
      context: allowed(row, "context", VISITOR_SCENE_CONTEXTS, input.scenes),
      setup: text(row, "setup", input.scenes),
      description: text(row, "description", input.scenes),
      dialogue: text(row, "dialogue", input.scenes),
      outcome: text(row, "outcome", input.scenes),
      reward: optionalText(row, "reward", input.scenes),
      hook: optionalText(row, "hook", input.scenes),
    } satisfies RecurringVisitorSceneDefinition;
  });
  unique(
    scenes,
    (value) => `${value.visitorId}\0${value.key.toLowerCase()}`,
    "visitor scene key",
    input.scenes,
  );

  const stockCompatibility = schema(input.sporkStock, STOCK_SCHEMA, STOCK_COMPATIBILITY_SCHEMA);
  const sporkStock = convert(input.sporkStock, (row) => {
    if (stockCompatibility) recordType(row, input.sporkStock, "stock");
    const stockType = allowed(row, "stock_type", SPORK_STOCK_TYPES, input.sporkStock);
    const rarity = allowed(row, "rarity", SPORK_STOCK_RARITIES, input.sporkStock);
    if (
      (stockType === "mundane" && rarity === "companion") ||
      (stockType === "companion" && rarity !== "companion")
    )
      throw rowError(
        row,
        input.sporkStock,
        `Rarity "${rarity}" is invalid for ${stockType} stock.`,
      );
    const story = text(row, "story", input.sporkStock);
    if (
      stockType === "companion" &&
      /combat bonus|attack bonus|damage|armor class|hit points/i.test(story)
    )
      throw rowError(row, input.sporkStock, "Companion stock must not grant combat mechanics.");
    return {
      stockType,
      name: text(row, "name", input.sporkStock),
      rarity,
      story,
    } satisfies SporkStockDefinition;
  });
  unique(sporkStock, (value) => value.name.toLowerCase(), "Spork stock name", input.sporkStock);

  const authoredSporkItems =
    input.authoredSporkItems === undefined
      ? Object.freeze([])
      : convertAuthoredSporkItems(input.authoredSporkItems);

  return Object.freeze({ visitors, scenes, sporkStock, authoredSporkItems });
}

function convertAuthoredSporkItems(table: ParsedTsv): readonly AuthoredSporkItemDefinition[] {
  schema(table, AUTHORED_SPORK_SCHEMA, AUTHORED_SPORK_SCHEMA);
  if (table.rows.length === 0) return Object.freeze([]);
  const values = convert(table, (row) => ({
    id: identifier(row, "id", table),
    name: text(row, "name", table),
    category: allowed(row, "category", TREASURE_CATEGORIES, table),
    rarity: allowed(row, "rarity", TREASURE_RARITIES, table),
    description: text(row, "description", table),
    presentation: text(row, "presentation", table),
    availability: allowed(row, "availability", AUTHORED_AVAILABILITY, table),
    repeatable: allowed(row, "repeatable", AUTHORED_REPEATABILITY, table),
    source: text(row, "source", table),
    notes: text(row, "notes", table),
  }));
  unique(values, (value) => value.id.toLowerCase(), "authored Spork item ID", table);
  unique(values, (value) => value.name.toLowerCase(), "authored Spork item name", table);
  return values;
}

function schema(table: ParsedTsv, preferred: readonly string[], compatibility: readonly string[]) {
  const actual = table.headers.join("\t");
  if (actual === preferred.join("\t")) return false;
  if (actual === compatibility.join("\t")) return true;
  throw new RecurringVisitorCatalogError(
    `Unsupported schema "${actual.replaceAll("\t", "\\t")}"; expected "${preferred.join("\\t")}".`,
    source(table),
    1,
  );
}

function convert<T extends object>(table: ParsedTsv, converter: (row: TsvRow) => T): readonly T[] {
  if (table.rows.length === 0)
    throw new RecurringVisitorCatalogError(
      "Table must contain at least one record.",
      source(table),
      1,
    );
  return Object.freeze(table.rows.map((row) => Object.freeze(converter(row))));
}

function unique<T>(
  values: readonly T[],
  key: (value: T) => string,
  label: string,
  table: ParsedTsv,
): void {
  const seen = new Map<string, number>();
  for (const [index, value] of values.entries()) {
    const identity = key(value);
    const earlier = seen.get(identity);
    if (earlier !== undefined) {
      const row = table.rows[index] as TsvRow;
      const prior = table.rows[earlier] as TsvRow;
      throw rowError(
        row,
        table,
        `Duplicate ${label} "${identity.replace("\0", "/")}"; earlier source ${source(table)}:${prior.lineNumber}.`,
      );
    }
    seen.set(identity, index);
  }
}

function recordType(row: TsvRow, table: ParsedTsv, expected: string): void {
  const actual = text(row, "record_type", table);
  if (actual !== expected) throw rowError(row, table, `Expected record_type "${expected}".`);
}

function text(row: TsvRow, key: string, table: ParsedTsv): string {
  const value = row.values[key] as string;
  if (value.length === 0 || value === "-")
    throw rowError(row, table, `Field "${key}" must not be empty.`);
  return value;
}

function optionalText(row: TsvRow, key: string, table: ParsedTsv): string | undefined {
  const value = row.values[key] as string;
  if (value.length === 0) throw rowError(row, table, `Field "${key}" must use text or a dash.`);
  return value === "-" ? undefined : value;
}

function identifier(row: TsvRow, key: string, table: ParsedTsv): string {
  const value = text(row, key, table);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))
    throw rowError(row, table, `Invalid ${key.replaceAll("_", " ")} "${value}".`);
  return value;
}

function positiveInteger(row: TsvRow, key: string, table: ParsedTsv): number {
  const value = Number(text(row, key, table));
  if (!Number.isSafeInteger(value) || value < 1)
    throw rowError(row, table, `Field "${key}" must be a positive integer.`);
  return value;
}

function allowed<T extends string>(
  row: TsvRow,
  key: string,
  values: readonly T[],
  table: ParsedTsv,
): T {
  const value = text(row, key, table);
  if (!(values as readonly string[]).includes(value))
    throw rowError(row, table, `Unknown ${key.replaceAll("_", " ")} "${value}".`);
  return value as T;
}

function rowError(row: TsvRow, table: ParsedTsv, message: string) {
  return new RecurringVisitorCatalogError(message, source(table), row.lineNumber);
}

function source(table: ParsedTsv): string {
  return getTsvSource(table) ?? "recurring visitor catalog";
}
