import { getTsvSource } from "../tsv-parser.js";
import type { ParsedTsv } from "../types.js";
import { EncounterBehaviorCatalogError } from "./errors.js";
import type {
  BehaviorDefinition,
  BehaviorRequirement,
  BehaviorRequirementKind,
  BehaviorSelectorKind,
  DispositionDefinition,
  EncounterBehaviorCatalog,
  LoadEncounterBehaviorCatalogInput,
} from "./types.js";

const CREATURE_TYPES = new Set([
  "Aberration",
  "Beast",
  "Celestial",
  "Construct",
  "Dragon",
  "Elemental",
  "Fey",
  "Fiend",
  "Giant",
  "Humanoid",
  "Monstrosity",
  "Ooze",
  "Plant",
  "Undead",
]);
const TAG = /^[a-z0-9][a-z0-9.:-]*$/;
const KEY = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const ENVIRONMENT = /^[a-z0-9][a-z0-9-]*$/;
const REQUIREMENT_VALUE = /^[A-Za-z0-9][A-Za-z0-9. _:-]*$/;

const BEHAVIOR_HEADERS = Object.freeze([
  "roll_min",
  "roll_max",
  "key",
  "title",
  "description",
  "requirements",
  "preferred_environments",
  "alertness_modifier",
]);

/** Loads the four authored tables used by the active ordinary behavior path. */
export function loadEncounterBehaviorCatalog(
  input: LoadEncounterBehaviorCatalogInput,
): EncounterBehaviorCatalog {
  const behaviors: BehaviorDefinition[] = [];
  const seenKeys = new Map<string, string>();
  loadBehaviorTable(input.byType, "type", behaviors, seenKeys);
  loadBehaviorTable(input.byTag, "tag", behaviors, seenKeys);
  loadBehaviorTable(input.fallback, "fallback", behaviors, seenKeys);
  const dispositions = loadDispositions(input.dispositions);
  return Object.freeze({
    behaviors: Object.freeze(behaviors),
    dispositions: Object.freeze(dispositions),
  });
}

function loadBehaviorTable(
  parsed: ParsedTsv,
  kind: BehaviorSelectorKind,
  output: BehaviorDefinition[],
  seenKeys: Map<string, string>,
): void {
  const source = getTsvSource(parsed) ?? `${kind} behavior table`;
  const selectorHeader = kind === "fallback" ? "scope" : kind;
  assertHeaders(parsed, [selectorHeader, ...BEHAVIOR_HEADERS], source);
  if (parsed.rows.length === 0) fail("Expected at least one behavior row.", source);
  const coverage = new Map<string, number[]>();

  for (const row of parsed.rows) {
    const value = (header: string): string => row.values[header] as string;
    const selector = validateSelector(value(selectorHeader), kind, source, row.lineNumber);
    const rollMinimum = parseRoll(value("roll_min"), source, row.lineNumber);
    const rollMaximum = parseRoll(value("roll_max"), source, row.lineNumber);
    if (rollMinimum > rollMaximum) fail("Roll minimum exceeds maximum.", source, row.lineNumber);
    const key = value("key");
    if (!KEY.test(key)) fail(`Invalid behavior key "${key}".`, source, row.lineNumber);
    const earlierSource = seenKeys.get(key);
    if (earlierSource !== undefined) {
      fail(
        `Duplicate behavior key "${key}"; first defined at ${earlierSource}.`,
        source,
        row.lineNumber,
      );
    }
    seenKeys.set(key, `${source}:${row.lineNumber}`);
    const title = required(value("title"), "title", source, row.lineNumber);
    const description = required(value("description"), "description", source, row.lineNumber);
    const ranges = coverage.get(selector) ?? Array.from({ length: 21 }, () => 0);
    for (let roll = rollMinimum; roll <= rollMaximum; roll += 1) {
      ranges[roll] = (ranges[roll] ?? 0) + 1;
    }
    coverage.set(selector, ranges);

    output.push(
      Object.freeze({
        selectorKind: kind,
        selector,
        rollMinimum,
        rollMaximum,
        key,
        title,
        description,
        requirements: parseRequirements(value("requirements"), source, row.lineNumber),
        preferredEnvironments: parseEnvironments(
          value("preferred_environments"),
          source,
          row.lineNumber,
        ),
        alertnessModifier: parseAlertness(value("alertness_modifier"), source, row.lineNumber),
      }),
    );
  }
  assertCoverage(coverage, source, "behavior selector");
}

function loadDispositions(parsed: ParsedTsv): DispositionDefinition[] {
  const source = getTsvSource(parsed) ?? "disposition table";
  assertHeaders(parsed, ["roll_min", "roll_max", "disposition"], source);
  if (parsed.rows.length === 0) fail("Expected at least one disposition row.", source);
  const coverage = new Map<string, number[]>([
    ["disposition", Array.from({ length: 21 }, () => 0)],
  ]);
  const output = parsed.rows.map((row) => {
    const rollMinimum = parseRoll(row.values.roll_min as string, source, row.lineNumber);
    const rollMaximum = parseRoll(row.values.roll_max as string, source, row.lineNumber);
    if (rollMinimum > rollMaximum) fail("Roll minimum exceeds maximum.", source, row.lineNumber);
    const ranges = coverage.get("disposition") as number[];
    for (let roll = rollMinimum; roll <= rollMaximum; roll += 1) {
      ranges[roll] = (ranges[roll] ?? 0) + 1;
    }
    return Object.freeze({
      rollMinimum,
      rollMaximum,
      description: required(
        row.values.disposition as string,
        "disposition",
        source,
        row.lineNumber,
      ),
    });
  });
  assertCoverage(coverage, source, "disposition table");
  return output;
}

function assertHeaders(parsed: ParsedTsv, expected: readonly string[], source: string): void {
  if (
    parsed.headers.length !== expected.length ||
    !parsed.headers.every((header, index) => header === expected[index])
  ) {
    fail(`Unexpected header "${parsed.headers.join("\\t")}".`, source, 1);
  }
}

function validateSelector(
  selector: string,
  kind: BehaviorSelectorKind,
  source: string,
  line: number,
): string {
  const valid =
    (kind === "type" && CREATURE_TYPES.has(selector)) ||
    (kind === "tag" && TAG.test(selector)) ||
    (kind === "fallback" && selector === "*");
  if (!valid) fail(`Invalid ${kind} behavior selector "${selector}".`, source, line);
  return selector;
}

function parseRoll(value: string, source: string, line: number): number {
  if (!/^[0-9]+$/.test(value)) fail(`Invalid d20 roll value "${value}".`, source, line);
  const roll = Number(value);
  if (roll < 1 || roll > 20) fail(`Invalid d20 roll value "${value}".`, source, line);
  return roll;
}

function parseRequirements(
  value: string,
  source: string,
  line: number,
): readonly BehaviorRequirement[] {
  if (value === "-") return Object.freeze([]);
  const requirements = value.split(",").map((item) => {
    const separator = item.indexOf(":");
    const kind = item.slice(0, separator) as BehaviorRequirementKind;
    const suppliedValue = item.slice(separator + 1);
    if (
      separator < 1 ||
      !(["environment", "type", "tag"] as const).includes(kind) ||
      !REQUIREMENT_VALUE.test(suppliedValue)
    ) {
      fail(`Invalid behavior requirement "${item}".`, source, line);
    }
    // Executable Bash retains nested colons for tag predicates such as
    // movement:fly, but its environment/type split observes only field two.
    const requirementValue =
      kind === "tag" ? suppliedValue : (suppliedValue.split(":")[0] as string);
    return Object.freeze({ kind, value: requirementValue });
  });
  return Object.freeze(requirements);
}

function parseEnvironments(value: string, source: string, line: number): readonly string[] {
  if (value === "-") return Object.freeze([]);
  const environments = value.split(",");
  if (environments.some((environment) => !ENVIRONMENT.test(environment))) {
    fail(`Invalid preferred environments "${value}".`, source, line);
  }
  return Object.freeze(environments);
}

function parseAlertness(value: string, source: string, line: number): number | undefined {
  if (value === "-") return undefined;
  if (!/^-?[0-9]+$/.test(value)) fail(`Invalid alertness modifier "${value}".`, source, line);
  const modifier = Number(value);
  if (modifier < -10 || modifier > 10) fail(`Invalid alertness modifier "${value}".`, source, line);
  return modifier;
}

function required(value: string, field: string, source: string, line: number): string {
  if (value.length === 0) fail(`Behavior ${field} is required.`, source, line);
  return value;
}

function assertCoverage(
  coverage: ReadonlyMap<string, readonly number[]>,
  source: string,
  label: string,
): void {
  for (const [selector, rolls] of coverage) {
    for (let roll = 1; roll <= 20; roll += 1) {
      if (rolls[roll] !== 1) {
        fail(
          `${label} "${selector}" has incomplete or overlapping coverage at roll ${roll}.`,
          source,
        );
      }
    }
  }
}

function fail(message: string, source: string, line?: number): never {
  throw new EncounterBehaviorCatalogError(message, source, line);
}
