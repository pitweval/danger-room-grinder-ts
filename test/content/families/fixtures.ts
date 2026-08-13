export const preferredFamilyHeaders = ["id", "name", "family_type", "description"] as const;

export const legacyFamilyHeaders = ["id", "name", "description"] as const;

type FamilyField = (typeof preferredFamilyHeaders)[number];

const defaults: Readonly<Record<FamilyField, string>> = {
  id: "archive_spirits",
  name: "Archive Spirits",
  family_type: "INTERMITTENT",
  description: "Keepers of memory, records, and forgotten #catalogs.",
};

export function preferredFamilyRow(overrides: Partial<Record<FamilyField, string>> = {}): string {
  const record = { ...defaults, ...overrides };
  return preferredFamilyHeaders.map((header) => record[header]).join("\t");
}

export function legacyFamilyRow(overrides: Partial<Record<FamilyField, string>> = {}): string {
  const record = { ...defaults, ...overrides };
  return legacyFamilyHeaders.map((header) => record[header]).join("\t");
}

export function preferredFamiliesTsv(...rows: readonly string[]): string {
  return [preferredFamilyHeaders.join("\t"), ...rows].join("\n");
}

export function legacyFamiliesTsv(...rows: readonly string[]): string {
  return [legacyFamilyHeaders.join("\t"), ...rows].join("\n");
}
