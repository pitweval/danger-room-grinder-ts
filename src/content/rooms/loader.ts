import { getTsvSource } from "../tsv-parser.js";
import type { ParsedTsv, TsvRow } from "../types.js";
import { OrdinaryRoomCatalogError } from "./errors.js";
import type {
  LoadOrdinaryRoomCatalogInput,
  OrdinaryRoomCatalog,
  RoomFrequency,
  RoomHazardSeverity,
} from "./types.js";

const ROW_SOURCES = new WeakMap<TsvRow, string>();
const VALUE_SOURCES = new WeakMap<
  object,
  { readonly source: string; readonly lineNumber: number }
>();

/** Loads the authored tables needed by the active non-boss room shell. */
export function loadOrdinaryRoomCatalog(input: LoadOrdinaryRoomCatalogInput): OrdinaryRoomCatalog {
  const neighborhoods = rows(
    input.neighborhoods,
    ["id", "name", "environment_keys", "treasure_flavor"],
    (row) => ({
      id: text(row, "id"),
      name: text(row, "name"),
      environmentKeys: list(row, "environment_keys"),
      treasureFlavor: text(row, "treasure_flavor"),
    }),
  );
  const subthemes = rows(
    input.subthemes,
    ["neighborhood_id", "id", "name", "description", "architecture", "lighting", "sound", "smell"],
    (row) => ({
      neighborhoodId: text(row, "neighborhood_id"),
      id: text(row, "id"),
      name: text(row, "name"),
      description: text(row, "description"),
      architecture: text(row, "architecture"),
      lighting: text(row, "lighting"),
      sound: text(row, "sound"),
      smell: text(row, "smell"),
    }),
  );
  const subthemeEnvironments = rows(
    input.subthemeEnvironments,
    ["neighborhood_id", "subtheme_id", "environment_names"],
    (row) => ({
      neighborhoodId: text(row, "neighborhood_id"),
      subthemeId: text(row, "subtheme_id"),
      environmentNames: list(row, "environment_names"),
    }),
  );
  const environments = rows(
    input.environments,
    ["name", "description", "engine_environment", "frequency"],
    (row) => ({
      name: text(row, "name"),
      description: text(row, "description"),
      engineEnvironment: text(row, "engine_environment"),
      frequency: roomFrequency(row),
    }),
  );
  const features = rows(input.features, ["name", "description", "interaction"], (row) => ({
    name: text(row, "name"),
    description: text(row, "description"),
    interaction: text(row, "interaction"),
  }));
  const neighborhoodFeatures = rows(
    input.neighborhoodFeatures,
    ["neighborhood_id", "feature_name", "weight"],
    (row) => ({
      neighborhoodId: text(row, "neighborhood_id"),
      featureName: text(row, "feature_name"),
      weight: positiveInteger(row, "weight"),
    }),
  );
  const hazards = rows(
    input.hazards,
    ["name", "severity", "trigger", "effect", "counterplay"],
    (row) => ({
      name: text(row, "name"),
      severity: hazardSeverity(row),
      trigger: text(row, "trigger"),
      effect: text(row, "effect"),
      counterplay: text(row, "counterplay"),
    }),
  );
  const neighborhoodHazards = rows(
    input.neighborhoodHazards,
    ["neighborhood_id", "hazard_name", "weight"],
    (row) => ({
      neighborhoodId: text(row, "neighborhood_id"),
      hazardName: text(row, "hazard_name"),
      weight: positiveInteger(row, "weight"),
    }),
  );
  const arrivals = rows(input.arrivals, ["text"], (row) => text(row, "text"));
  const doorways = rows(input.doorways, ["text"], (row) => text(row, "text"));
  const exits = rows(input.exits, ["name", "description"], (row) => ({
    name: text(row, "name"),
    description: text(row, "description"),
  }));
  const signatures = rows(
    input.signatures,
    [
      "name",
      "description",
      "engine_environment",
      "feature_one",
      "feature_one_description",
      "feature_one_interaction",
      "feature_two",
      "feature_two_description",
      "feature_two_interaction",
      "lighting",
      "sound",
      "smell",
      "story",
      "neighborhoods",
      "frequency",
    ],
    (row) => ({
      name: text(row, "name"),
      description: text(row, "description"),
      engineEnvironment: text(row, "engine_environment"),
      features: frozen([
        {
          name: text(row, "feature_one"),
          description: text(row, "feature_one_description"),
          interaction: text(row, "feature_one_interaction"),
        },
        {
          name: text(row, "feature_two"),
          description: text(row, "feature_two_description"),
          interaction: text(row, "feature_two_interaction"),
        },
      ]),
      lighting: text(row, "lighting"),
      sound: text(row, "sound"),
      smell: text(row, "smell"),
      story: text(row, "story"),
      neighborhoods: list(row, "neighborhoods"),
      frequency: roomFrequency(row),
    }),
  );
  const depthFamilies = depthRows(input.depthFamilies);
  const depthFormations = depthRows(input.depthFormations);

  assertUnique(neighborhoods, (value) => value.id, "neighborhood ID");
  assertUnique(subthemes, (value) => `${value.neighborhoodId}/${value.id}`, "subtheme");
  assertUnique(environments, (value) => value.name.toLowerCase(), "environment name");
  assertUnique(features, (value) => value.name.toLowerCase(), "feature name");
  assertUnique(hazards, (value) => value.name.toLowerCase(), "hazard name");
  assertUnique(
    neighborhoodHazards,
    (value) => `${value.neighborhoodId}/${value.hazardName.toLowerCase()}`,
    "neighborhood hazard",
  );
  assertUnique(exits, (value) => value.name.toLowerCase(), "exit name");
  assertUnique(signatures, (value) => value.name.toLowerCase(), "signature-room name");

  const neighborhoodIds = new Set(neighborhoods.map((value) => value.id));
  const subthemeIds = new Set(subthemes.map((value) => `${value.neighborhoodId}\0${value.id}`));
  const environmentNames = new Set(environments.map((value) => value.name));
  const featureNames = new Set(features.map((value) => value.name));
  const hazardNames = new Set(hazards.map((value) => value.name));
  for (const value of subthemes)
    requireReference(neighborhoodIds, value.neighborhoodId, "neighborhood", value);
  for (const value of subthemeEnvironments) {
    requireReference(
      subthemeIds,
      `${value.neighborhoodId}\0${value.subthemeId}`,
      "subtheme",
      value,
    );
    for (const name of value.environmentNames)
      requireReference(environmentNames, name, "environment", value);
  }
  for (const value of neighborhoodFeatures) {
    requireReference(neighborhoodIds, value.neighborhoodId, "neighborhood", value);
    requireReference(featureNames, value.featureName, "feature", value);
  }
  for (const value of neighborhoodHazards) {
    requireReference(neighborhoodIds, value.neighborhoodId, "neighborhood", value);
    requireReference(hazardNames, value.hazardName, "hazard", value);
  }

  return Object.freeze({
    neighborhoods,
    subthemes,
    subthemeEnvironments,
    environments,
    features,
    neighborhoodFeatures,
    hazards,
    neighborhoodHazards,
    arrivals,
    doorways,
    exits,
    signatures,
    depthFamilies,
    depthFormations,
  });
}

function rows<T>(
  table: ParsedTsv,
  headers: readonly string[],
  convert: (row: TsvRow) => T,
): readonly T[] {
  const source = getTsvSource(table) ?? "room catalog";
  if (table.headers.join("\t") !== headers.join("\t"))
    throw new OrdinaryRoomCatalogError(
      `Unsupported schema "${table.headers.join("\\t")}"; expected "${headers.join("\\t")}".`,
      source,
      1,
    );
  if (table.rows.length === 0)
    throw new OrdinaryRoomCatalogError("Table must contain at least one record.", source, 1);
  for (const row of table.rows) ROW_SOURCES.set(row, source);
  return frozen(
    table.rows.map((row) => {
      const value = Object.freeze(convert(row));
      if (typeof value === "object" && value !== null)
        VALUE_SOURCES.set(value, { source, lineNumber: row.lineNumber });
      return value;
    }),
  );
}

function depthRows(table: ParsedTsv) {
  return rows(table, ["depth_band", "neighborhood_id", "value", "weight"], (row) => ({
    depthBand: text(row, "depth_band"),
    neighborhoodId: text(row, "neighborhood_id"),
    value: text(row, "value"),
    weight: positiveInteger(row, "weight"),
  }));
}

function text(row: TsvRow, key: string): string {
  const value = row.values[key] as string;
  if (value.length === 0 || value === "-") throw rowError(row, `Field "${key}" must not be empty.`);
  return value;
}

function list(row: TsvRow, key: string): readonly string[] {
  const values = text(row, key).split(",");
  if (values.some((value) => value.length === 0))
    throw rowError(row, `Field "${key}" contains an empty list value.`);
  return frozen(values);
}

function positiveInteger(row: TsvRow, key: string): number {
  const raw = text(row, key);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0)
    throw rowError(row, `Field "${key}" must be a positive integer; received "${raw}".`);
  return value;
}

function roomFrequency(row: TsvRow): RoomFrequency {
  const value = text(row, "frequency");
  if (value !== "COMMON" && value !== "UNCOMMON" && value !== "UNIQUE")
    throw rowError(row, `Unknown room frequency "${value}".`);
  return value;
}

function hazardSeverity(row: TsvRow): RoomHazardSeverity {
  const value = text(row, "severity");
  if (value !== "nuisance" && value !== "deadly")
    throw rowError(row, `Unknown hazard severity "${value}".`);
  return value;
}

function requireReference(
  values: ReadonlySet<string>,
  value: string,
  kind: string,
  owner?: object,
): void {
  const location = owner === undefined ? undefined : VALUE_SOURCES.get(owner);
  if (!values.has(value))
    throw new OrdinaryRoomCatalogError(
      `Unknown ${kind} reference "${value.replace("\0", "/")}".`,
      location?.source ?? "room catalog",
      location?.lineNumber ?? 1,
    );
}

function assertUnique<T>(values: readonly T[], key: (value: T) => string, label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    const candidate = key(value);
    if (seen.has(candidate))
      throw new OrdinaryRoomCatalogError(`Duplicate ${label} "${candidate}".`, "room catalog", 1);
    seen.add(candidate);
  }
}

function frozen<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

function rowError(row: TsvRow, message: string): OrdinaryRoomCatalogError {
  return new OrdinaryRoomCatalogError(
    message,
    ROW_SOURCES.get(row) ?? "room catalog",
    row.lineNumber,
  );
}
