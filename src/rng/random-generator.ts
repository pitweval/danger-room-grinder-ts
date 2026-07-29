import type { WeightedItem } from "./types.js";

const UINT32_RANGE = 0x1_0000_0000;
const UINT32_RANGE_BIGINT = 0x1_0000_0000n;
const MULBERRY32_INCREMENT = 0x6d2b79f5;

/**
 * A deterministic, noncryptographic Mulberry32 random-number generator.
 *
 * Mulberry32 is compact, has stable 32-bit JavaScript operations, and works
 * identically in Node.js and browsers. Seeds are finite safe integers reduced
 * modulo 2^32, so signed values normalize to an unsigned 32-bit initial state.
 *
 * The seed and exact sequence of method calls determine every result. Adding
 * or removing a call changes all subsequent values. The algorithm and method
 * call behavior are therefore part of DRG's generator compatibility contract;
 * changing either requires an intentional generator-version change.
 *
 * Integer bounds are inclusive. Integer selection uses rejection sampling over
 * one or more 32-bit draws to avoid modulo bias.
 */
export class RandomGenerator {
  private state: number;

  public constructor(seed: number) {
    if (!Number.isFinite(seed)) {
      throw new TypeError("Seed must be a finite integer.");
    }

    if (!Number.isInteger(seed)) {
      throw new TypeError("Seed must be an integer.");
    }

    if (!Number.isSafeInteger(seed)) {
      throw new RangeError("Seed must be a safe integer.");
    }

    this.state = seed >>> 0;
  }

  /**
   * Returns the next value in the range zero inclusive to one exclusive.
   */
  public next(): number {
    this.state = (this.state + MULBERRY32_INCREMENT) >>> 0;

    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE;
  }

  /**
   * Returns an integer between the inclusive minimum and maximum.
   */
  public integer(minimum: number, maximum: number): number {
    this.assertSafeBound(minimum, "Minimum");
    this.assertSafeBound(maximum, "Maximum");

    if (minimum > maximum) {
      throw new RangeError("Minimum bound must not exceed maximum bound.");
    }

    if (minimum === maximum) {
      return minimum;
    }

    const rangeBigInt = BigInt(maximum) - BigInt(minimum) + 1n;
    if (rangeBigInt > UINT32_RANGE_BIGINT) {
      throw new RangeError("Integer range cannot exceed 4,294,967,296 possible values.");
    }

    const range = Number(rangeBigInt);
    const acceptanceLimit = UINT32_RANGE - (UINT32_RANGE % range);
    let sample: number;

    do {
      sample = Math.floor(this.next() * UINT32_RANGE);
    } while (sample >= acceptanceLimit);

    return minimum + (sample % range);
  }

  /**
   * Returns an integer percentage roll from 1 through 100 inclusive.
   */
  public percent(): number {
    return this.integer(1, 100);
  }

  /**
   * Selects one item without modifying the supplied array.
   */
  public pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new RangeError("Cannot pick from an empty array.");
    }

    return items[this.integer(0, items.length - 1)] as T;
  }

  /**
   * Returns a Fisher–Yates shuffled copy of the supplied array.
   */
  public shuffle<T>(items: readonly T[]): T[] {
    const shuffled = [...items];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const selectedIndex = this.integer(0, index);
      [shuffled[index], shuffled[selectedIndex]] = [
        shuffled[selectedIndex] as T,
        shuffled[index] as T,
      ];
    }

    return shuffled;
  }

  /**
   * Selects one value according to finite, non-negative relative weights.
   */
  public weightedPick<T>(items: readonly WeightedItem<T>[]): T {
    if (items.length === 0) {
      throw new RangeError("Cannot perform a weighted pick from an empty array.");
    }

    let totalWeight = 0;
    let lastPositiveItem: WeightedItem<T> | undefined;

    for (const item of items) {
      if (!Number.isFinite(item.weight) || item.weight < 0) {
        throw new RangeError("Each weight must be a finite non-negative number.");
      }

      totalWeight += item.weight;
      if (item.weight > 0) {
        lastPositiveItem = item;
      }
    }

    if (!Number.isFinite(totalWeight)) {
      throw new RangeError("Total weight must be finite.");
    }

    if (totalWeight === 0 || lastPositiveItem === undefined) {
      throw new RangeError("Total weight must be greater than zero.");
    }

    const threshold = this.next() * totalWeight;
    let cumulativeWeight = 0;

    for (const item of items) {
      if (item.weight === 0) {
        continue;
      }

      cumulativeWeight += item.weight;
      if (threshold < cumulativeWeight) {
        return item.value;
      }
    }

    // Floating-point accumulation can round the final boundary down slightly.
    return lastPositiveItem.value;
  }

  private assertSafeBound(value: number, name: string): void {
    if (!Number.isSafeInteger(value)) {
      throw new RangeError(`${name} bound must be a safe integer.`);
    }
  }
}
