import type { RolledEncounterDifficulty } from "../../encounter/types.js";

export type SuggestedSkillDcLabel =
  "Easy" | "Moderate" | "Hard" | "Very Hard" | "Nearly Impossible";

export interface SuggestedSkillDc {
  readonly label: SuggestedSkillDcLabel;
  readonly dc: number;
  readonly asterisk: boolean;
}

export interface SuggestedSkillDcs {
  readonly difficulty: RolledEncounterDifficulty;
  readonly checks: readonly SuggestedSkillDc[];
  readonly note: string | undefined;
}
