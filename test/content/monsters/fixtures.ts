export const preferredHeaders = [
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
  "preferred_environments",
  "boss_eligible",
  "minion_eligible",
  "procedural",
  "source",
  "notes",
] as const;

export const legacyHeaders = preferredHeaders.slice(0, 10);

type PreferredField = (typeof preferredHeaders)[number];

const preferredDefaults: Readonly<Record<PreferredField, string>> = {
  id: "archive-keeper",
  name: "Archive Keeper",
  cr: "1/2",
  xp: "100",
  size: "Medium",
  type: "Construct",
  roles: "boss-leader,artillery,soldier",
  tags: "clockwork,source:homebrew",
  requirements: "-",
  families: "archive_spirits,constructs",
  preferred_environments: " Arcane Lab ,UNDER_DARK ",
  boss_eligible: "auto",
  minion_eligible: "no",
  procedural: "yes",
  source: "Bryan #1",
  notes: "Keeps records; asks, “Why?”",
};

export function preferredRow(overrides: Partial<Record<PreferredField, string>> = {}): string {
  const record = { ...preferredDefaults, ...overrides };
  return preferredHeaders.map((header) => record[header]).join("\t");
}

export function legacyRow(overrides: Partial<Record<PreferredField, string>> = {}): string {
  const record = { ...preferredDefaults, ...overrides };
  return legacyHeaders.map((header) => record[header]).join("\t");
}

export function preferredTsv(...rows: readonly string[]): string {
  return [preferredHeaders.join("\t"), ...rows].join("\n");
}

export function legacyTsv(...rows: readonly string[]): string {
  return [legacyHeaders.join("\t"), ...rows].join("\n");
}
