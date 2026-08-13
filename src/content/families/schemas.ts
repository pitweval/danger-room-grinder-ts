export const LEGACY_FAMILY_HEADERS = Object.freeze(["id", "name", "description"] as const);

export const PREFERRED_FAMILY_HEADERS = Object.freeze([
  "id",
  "name",
  "family_type",
  "description",
] as const);

export type FamilySchema = "legacy" | "preferred";

export function detectFamilySchema(headers: readonly string[]): FamilySchema | undefined {
  if (headersEqual(headers, LEGACY_FAMILY_HEADERS)) return "legacy";
  if (headersEqual(headers, PREFERRED_FAMILY_HEADERS)) return "preferred";
  return undefined;
}

function headersEqual(actual: readonly string[], expected: readonly string[]): boolean {
  return (
    actual.length === expected.length && actual.every((header, index) => header === expected[index])
  );
}
