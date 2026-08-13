/** Canonical DRG difficulties accepted by encounter XP budgeting. */
export type EncounterDifficulty = "trivial" | "low" | "moderate" | "high" | "deadly";

/** The three ordinary difficulties produced by a random threat roll. */
export type RolledEncounterDifficulty = Extract<EncounterDifficulty, "low" | "moderate" | "high">;

/** The party information consumed by encounter XP budgeting. */
export interface Party {
  readonly characterCount: number;
  readonly characterLevel: number;
}

/** One ordinary threat roll and its corresponding encounter difficulty. */
export interface ThreatResult {
  readonly roll: number;
  readonly difficulty: RolledEncounterDifficulty;
}
