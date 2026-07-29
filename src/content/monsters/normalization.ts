import { MonsterCatalogError } from "./errors.js";
import type { MonsterRole } from "./types.js";

const ROLE_ORDER = Object.freeze([
  "leader",
  "brute",
  "controller",
  "soldier",
  "skirmisher",
  "minion",
] as const satisfies readonly MonsterRole[]);

const ROLE_ALIASES: Readonly<Record<string, MonsterRole>> = Object.freeze({
  artillery: "controller",
  cavalry: "skirmisher",
  scout: "skirmisher",
  hunter: "skirmisher",
  bruiser: "brute",
  support: "controller",
  engineer: "controller",
  "divine-caster": "controller",
  merchant: "controller",
  hermit: "skirmisher",
  "boss-controller": "controller",
  "boss-leader": "leader",
  "boss-brute": "brute",
  "final-boss": "leader",
});

const CANONICAL_ROLES = new Set<string>(ROLE_ORDER);
const TAG = /^[a-z0-9][a-z0-9.:-]*$/;
const FAMILY = /^[a-z][a-z0-9_]*$/;
const PREFERRED_ENVIRONMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REQUIREMENTS = new Set(["environment:underwater", "terrain:water"]);

export function normalizeRoles(
  value: string,
  source: string,
  lineNumber: number,
): readonly MonsterRole[] {
  const selected = new Set<MonsterRole>();

  for (const supplied of value.split(",")) {
    const normalized = supplied.trim().toLowerCase().replace(/[ _]+/g, "-");
    const role = ROLE_ALIASES[normalized] ?? normalized;

    if (!CANONICAL_ROLES.has(role)) {
      throw new MonsterCatalogError(
        `Roles contain an unknown or empty role: "${normalized}".`,
        source,
        lineNumber,
      );
    }

    selected.add(role as MonsterRole);
  }

  const roles = ROLE_ORDER.filter((role) => selected.has(role));
  if (roles.length === 0) {
    throw new MonsterCatalogError("Roles contain an unknown or empty role.", source, lineNumber);
  }

  return Object.freeze([...roles]);
}

export function parseTags(value: string, source: string, lineNumber: number): readonly string[] {
  return parseStrictSortedList(value, "Tags", TAG, source, lineNumber, true);
}

export function parseRequirements(
  value: string,
  source: string,
  lineNumber: number,
): readonly string[] {
  if (value === "" || value === "-") {
    return Object.freeze([]);
  }

  return parseStrictSortedList(
    value,
    "Requirements",
    undefined,
    source,
    lineNumber,
    false,
    REQUIREMENTS,
  );
}

export function normalizeFamilies(
  value: string,
  source: string,
  lineNumber: number,
): readonly string[] {
  const supplied = value.split(",");
  const normalized = supplied.map((item) => item.trim().toLowerCase());

  if (normalized.some((item) => item.length === 0)) {
    throw new MonsterCatalogError("Families contain an empty value.", source, lineNumber);
  }

  validateUniqueAndSorted(normalized, "Families", source, lineNumber);

  for (const family of normalized) {
    if (!FAMILY.test(family)) {
      throw new MonsterCatalogError(
        `Families contain an invalid value: "${family}".`,
        source,
        lineNumber,
      );
    }
  }

  return Object.freeze(normalized);
}

export function normalizePreferredEnvironments(
  value: string,
  source: string,
  lineNumber: number,
): readonly string[] {
  if (value.trim() === "-") {
    return Object.freeze([]);
  }

  const normalized = value
    .split(",")
    .map((item) => item.trim().toLowerCase().replace(/[ _]+/g, "-"));
  const seen = new Set<string>();

  for (const environment of normalized) {
    if (!PREFERRED_ENVIRONMENT.test(environment)) {
      throw new MonsterCatalogError(
        `Preferred environment contains an invalid value: "${environment}".`,
        source,
        lineNumber,
      );
    }

    if (seen.has(environment)) {
      throw new MonsterCatalogError(
        `Preferred environment contains a duplicate value: "${environment}".`,
        source,
        lineNumber,
      );
    }

    seen.add(environment);
  }

  return Object.freeze(normalized);
}

function parseStrictSortedList(
  value: string,
  field: string,
  pattern: RegExp | undefined,
  source: string,
  lineNumber: number,
  allowEmpty: boolean,
  allowedValues?: ReadonlySet<string>,
): readonly string[] {
  if (value === "" && allowEmpty) {
    return Object.freeze([]);
  }

  const items = value.split(",");

  for (const item of items) {
    if (
      item.length === 0 ||
      (pattern !== undefined && !pattern.test(item)) ||
      (allowedValues !== undefined && !allowedValues.has(item))
    ) {
      throw new MonsterCatalogError(
        `${field} contain an invalid value: "${item}".`,
        source,
        lineNumber,
      );
    }
  }

  validateUniqueAndSorted(items, field, source, lineNumber);
  return Object.freeze(items);
}

function validateUniqueAndSorted(
  items: readonly string[],
  field: string,
  source: string,
  lineNumber: number,
): void {
  const seen = new Set<string>();
  let previous: string | undefined;

  for (const item of items) {
    if (seen.has(item)) {
      throw new MonsterCatalogError(
        `${field} contain a duplicate value: "${item}".`,
        source,
        lineNumber,
      );
    }

    if (previous !== undefined && item < previous) {
      throw new MonsterCatalogError(`${field} must be sorted.`, source, lineNumber);
    }

    seen.add(item);
    previous = item;
  }
}
