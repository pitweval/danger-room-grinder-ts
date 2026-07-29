export type MonsterRole = "leader" | "brute" | "controller" | "soldier" | "skirmisher" | "minion";

/**
 * One validated monster record shared by preferred and legacy catalogs.
 */
export interface MonsterDefinition {
  readonly id: string;
  readonly name: string;
  readonly cr: string;
  readonly xp: number;
  readonly size: string;
  readonly type: string;
  readonly roles: readonly MonsterRole[];
  readonly tags: readonly string[];
  readonly requirements: readonly string[];
  readonly families: readonly string[];
  readonly preferredEnvironments: readonly string[];
  readonly bossEligible: boolean;
  readonly minionEligible: boolean;
  readonly procedural: boolean;
  readonly source: string;
  readonly notes: string;
}

export interface MonsterCatalog {
  readonly monsters: readonly MonsterDefinition[];
}

export interface LoadMonsterCatalogOptions {
  /**
   * Human-readable input name included in semantic validation errors.
   */
  readonly source?: string;
}
