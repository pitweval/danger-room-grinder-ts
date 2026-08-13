import { FamilyCatalogError } from "./errors.js";
import type { FamilyType } from "./types.js";

const FAMILY_ID = /^[a-z][a-z0-9_]*$/;

export function normalizeFamilyId(value: string, source: string, lineNumber: number): string {
  const normalized = value.toLowerCase();
  if (!FAMILY_ID.test(normalized)) {
    throw new FamilyCatalogError(
      `Family ID has invalid value "${value}"; expected letters, digits, and underscores beginning with a letter.`,
      source,
      lineNumber,
    );
  }
  return normalized;
}

export function validateFamilyText(
  value: string,
  field: "name" | "description",
  source: string,
  lineNumber: number,
): string {
  if (value.length === 0) {
    throw new FamilyCatalogError(`Family ${field} is required.`, source, lineNumber);
  }
  return value;
}

export function parseFamilyType(value: string, source: string, lineNumber: number): FamilyType {
  if (value === "PRIMARY" || value === "INTERMITTENT") return value;
  throw new FamilyCatalogError(
    `family_type has invalid value "${value}"; expected PRIMARY or INTERMITTENT.`,
    source,
    lineNumber,
  );
}
