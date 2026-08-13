/** An invalid value supplied to the pure encounter-budgeting API. */
export class EncounterValidationError extends RangeError {
  public readonly field: string;
  public readonly value: unknown;

  public constructor(field: string, value: unknown, expected: string) {
    super(`Invalid encounter ${field} "${String(value)}"; expected ${expected}.`);

    this.name = "EncounterValidationError";
    this.field = field;
    this.value = value;
  }
}
