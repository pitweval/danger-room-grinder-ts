import { CampaignProgressionError } from "./errors.js";

/** Exact cumulative XP thresholds used by active Bash progression. */
export const CAMPAIGN_XP_THRESHOLDS = Object.freeze([
  0, 300, 900, 2_700, 6_500, 14_000, 23_000, 34_000, 48_000, 64_000, 85_000, 100_000, 120_000,
  140_000, 165_000, 195_000, 225_000, 265_000, 305_000, 355_000,
] as const);

export const MAXIMUM_CAMPAIGN_LEVEL = CAMPAIGN_XP_THRESHOLDS.length;

export function campaignXpThresholdForLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1 || level > MAXIMUM_CAMPAIGN_LEVEL) {
    throw new CampaignProgressionError(
      "level",
      level,
      `an integer from 1 through ${MAXIMUM_CAMPAIGN_LEVEL}`,
    );
  }
  return CAMPAIGN_XP_THRESHOLDS[level - 1] as number;
}
