import { MonsterCatalogError } from "./errors.js";

const MONSTER_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CHALLENGE_RATING = /^(?:0|1\/8|1\/4|1\/2|[1-9]|[12][0-9]|30)$/;
const NON_NEGATIVE_INTEGER = /^[0-9]+$/;
const SIZE =
  /^(?:Tiny|Small|Medium|Large|Huge|Gargantuan)(?: or (?:Tiny|Small|Medium|Large|Huge|Gargantuan))?$/;
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

export function validateMonsterId(value: string, source: string, lineNumber: number): string {
  if (!MONSTER_ID.test(value)) {
    throw new MonsterCatalogError(
      `ID must use lowercase ASCII kebab case; received "${value}".`,
      source,
      lineNumber,
    );
  }

  return value;
}

export function validateRequiredText(
  value: string,
  field: string,
  source: string,
  lineNumber: number,
): string {
  if (value.length === 0) {
    throw new MonsterCatalogError(`${field} is required.`, source, lineNumber);
  }

  return value;
}

export function validateChallengeRating(value: string, source: string, lineNumber: number): string {
  if (!CHALLENGE_RATING.test(value)) {
    throw new MonsterCatalogError(
      `Challenge rating has invalid value "${value}".`,
      source,
      lineNumber,
    );
  }

  return value;
}

export function parseXp(value: string, source: string, lineNumber: number): number {
  if (!NON_NEGATIVE_INTEGER.test(value)) {
    throw new MonsterCatalogError(
      `XP must be a non-negative safe integer; received "${value}".`,
      source,
      lineNumber,
    );
  }

  const xp = Number(value);
  if (!Number.isSafeInteger(xp)) {
    throw new MonsterCatalogError(
      `XP must be a non-negative safe integer; received "${value}".`,
      source,
      lineNumber,
    );
  }

  return xp;
}

export function validateSize(value: string, source: string, lineNumber: number): string {
  if (!SIZE.test(value)) {
    throw new MonsterCatalogError(`Size has invalid value "${value}".`, source, lineNumber);
  }

  return value;
}

export function validateCreatureType(value: string, source: string, lineNumber: number): string {
  if (!CREATURE_TYPES.has(value)) {
    throw new MonsterCatalogError(
      `Creature type has invalid value "${value}".`,
      source,
      lineNumber,
    );
  }

  return value;
}

export function parseEligibility(
  value: string,
  field: string,
  source: string,
  lineNumber: number,
): boolean {
  const normalized = value.trim().toLowerCase();

  if (normalized === "yes" || normalized === "auto") {
    return true;
  }

  if (normalized === "no") {
    return false;
  }

  throw new MonsterCatalogError(
    `${field} has invalid value "${value}"; expected yes, no, or auto.`,
    source,
    lineNumber,
  );
}

export function parseProcedural(value: string, source: string, lineNumber: number): boolean {
  const normalized = value.trim().toLowerCase();

  if (normalized === "yes") {
    return true;
  }

  if (normalized === "no") {
    return false;
  }

  throw new MonsterCatalogError(
    `procedural has invalid value "${value}"; expected yes or no.`,
    source,
    lineNumber,
  );
}

export function validateMetadata(
  value: string,
  field: string,
  source: string,
  lineNumber: number,
): string {
  if (value.length === 0) {
    throw new MonsterCatalogError(`${field} must contain text or -.`, source, lineNumber);
  }

  return value;
}
