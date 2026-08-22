/** An invalid value supplied to the pure campaign-progression API. */
export class CampaignProgressionError extends RangeError {
  public readonly field: string;
  public readonly value: unknown;

  public constructor(field: string, value: unknown, expected: string) {
    super(`Invalid campaign progression ${field} "${String(value)}"; expected ${expected}.`);
    this.name = "CampaignProgressionError";
    this.field = field;
    this.value = value;
  }
}
