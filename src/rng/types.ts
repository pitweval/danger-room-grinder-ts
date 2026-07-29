/**
 * A value and its relative selection weight.
 *
 * A zero weight keeps a value in the catalog while making it ineligible for
 * selection. Positive weights may be finite integers or decimal values.
 */
export interface WeightedItem<T> {
  readonly value: T;
  readonly weight: number;
}
