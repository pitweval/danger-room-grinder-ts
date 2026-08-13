export type FamilyType = "PRIMARY" | "INTERMITTENT";

/** One normalized family shared by preferred and legacy catalogs. */
export interface FamilyDefinition {
  readonly id: string;
  readonly name: string;
  readonly familyType: FamilyType;
  readonly description: string;
}

export interface FamilyCatalog {
  readonly families: readonly FamilyDefinition[];
}

export interface LoadFamilyCatalogOptions {
  /** Human-readable input name used in semantic diagnostics. */
  readonly source?: string;
}

export interface ValidateMonsterFamilyReferencesOptions {
  /** Overrides the monster catalog source in reference diagnostics. */
  readonly source?: string;
}

export interface MissingMonsterFamilyReference {
  readonly monsterId: string;
  readonly monsterName: string;
  readonly familyId: string;
}
