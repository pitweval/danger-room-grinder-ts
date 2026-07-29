export const LEGACY_MONSTER_HEADERS = Object.freeze([
  "id",
  "name",
  "cr",
  "xp",
  "size",
  "type",
  "roles",
  "tags",
  "requirements",
  "families",
] as const);

export const PREFERRED_MONSTER_HEADERS = Object.freeze([
  ...LEGACY_MONSTER_HEADERS,
  "preferred_environments",
  "boss_eligible",
  "minion_eligible",
  "procedural",
  "source",
  "notes",
] as const);

export type MonsterSchema = "legacy" | "preferred";

export function detectMonsterSchema(headers: readonly string[]): MonsterSchema | undefined {
  if (headersEqual(headers, LEGACY_MONSTER_HEADERS)) {
    return "legacy";
  }

  if (headersEqual(headers, PREFERRED_MONSTER_HEADERS)) {
    return "preferred";
  }

  return undefined;
}

function headersEqual(actual: readonly string[], expected: readonly string[]): boolean {
  return (
    actual.length === expected.length && actual.every((header, index) => header === expected[index])
  );
}
