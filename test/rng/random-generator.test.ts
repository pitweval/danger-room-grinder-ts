import { describe, expect, it, vi } from "vitest";

import { RandomGenerator, type WeightedItem } from "../../src/rng/index.js";

describe("RandomGenerator", () => {
  describe("next", () => {
    it("repeats the same sequence for the same seed", () => {
      const first = new RandomGenerator(42);
      const second = new RandomGenerator(42);

      expect(Array.from({ length: 20 }, () => first.next())).toEqual(
        Array.from({ length: 20 }, () => second.next()),
      );
    });

    it("produces different sequences for different seeds", () => {
      const first = new RandomGenerator(42);
      const second = new RandomGenerator(43);

      expect(Array.from({ length: 20 }, () => first.next())).not.toEqual(
        Array.from({ length: 20 }, () => second.next()),
      );
    });

    it("always returns values from zero inclusive to one exclusive", () => {
      const generator = new RandomGenerator(8675309);

      for (let index = 0; index < 10_000; index += 1) {
        const value = generator.next();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it("repeats a 10,000-value sequence exactly", () => {
      const first = new RandomGenerator(-2026);
      const second = new RandomGenerator(-2026);

      for (let index = 0; index < 10_000; index += 1) {
        expect(first.next()).toBe(second.next());
      }
    });

    it("matches the canonical Mulberry32 sequence for seed zero", () => {
      const generator = new RandomGenerator(0);

      expect(Array.from({ length: 5 }, () => generator.next())).toEqual([
        0.26642920868471265, 0.0003297457005828619, 0.2232720274478197, 0.1462021479383111,
        0.46732782293111086,
      ]);
    });

    it("matches the canonical Mulberry32 sequence for seed 8675309", () => {
      const generator = new RandomGenerator(8675309);

      expect(Array.from({ length: 5 }, () => generator.next())).toEqual([
        0.6227154401130974, 0.5109282142948359, 0.7922766138799489, 0.1145998879801482,
        0.697027963353321,
      ]);
    });
  });

  describe("seed handling", () => {
    it("accepts zero, positive, and negative safe-integer seeds", () => {
      expect(() => new RandomGenerator(0)).not.toThrow();
      expect(() => new RandomGenerator(613)).not.toThrow();
      expect(() => new RandomGenerator(-613)).not.toThrow();
    });

    it("normalizes signed seeds to the same unsigned 32-bit state", () => {
      const negative = new RandomGenerator(-1);
      const unsigned = new RandomGenerator(0xffff_ffff);

      expect(Array.from({ length: 10 }, () => negative.next())).toEqual(
        Array.from({ length: 10 }, () => unsigned.next()),
      );
    });

    it("accepts and consistently normalizes both safe-integer limits", () => {
      const largest = new RandomGenerator(Number.MAX_SAFE_INTEGER);
      const largestNormalized = new RandomGenerator(0xffff_ffff);
      const smallest = new RandomGenerator(Number.MIN_SAFE_INTEGER);
      const smallestNormalized = new RandomGenerator(1);

      expect(Array.from({ length: 10 }, () => largest.next())).toEqual(
        Array.from({ length: 10 }, () => largestNormalized.next()),
      );
      expect(Array.from({ length: 10 }, () => smallest.next())).toEqual(
        Array.from({ length: 10 }, () => smallestNormalized.next()),
      );
    });

    it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
      "rejects non-finite seed %s",
      (seed) => {
        expect(() => new RandomGenerator(seed)).toThrow(/seed.*finite integer/i);
      },
    );

    it("rejects fractional seeds", () => {
      expect(() => new RandomGenerator(1.5)).toThrow(/seed.*integer/i);
    });

    it.each([Number.MAX_SAFE_INTEGER + 1, Number.MIN_SAFE_INTEGER - 1])(
      "rejects unsafe integer seed %s",
      (seed) => {
        expect(() => new RandomGenerator(seed)).toThrow(/seed.*safe integer/i);
      },
    );
  });

  describe("integer", () => {
    it("uses an inclusive lower bound", () => {
      const generator = new RandomGenerator(1);
      vi.spyOn(generator, "next").mockReturnValue(0);

      expect(generator.integer(1, 6)).toBe(1);
    });

    it("uses an inclusive upper bound", () => {
      const generator = new RandomGenerator(1);
      vi.spyOn(generator, "next").mockReturnValue(5 / 0x1_0000_0000);

      expect(generator.integer(1, 6)).toBe(6);
    });

    it("returns a single-value range without consuming randomness", () => {
      const generator = new RandomGenerator(1);
      const next = vi.spyOn(generator, "next");

      expect(generator.integer(7, 7)).toBe(7);
      expect(next).not.toHaveBeenCalled();
    });

    it("supports negative ranges", () => {
      const generator = new RandomGenerator(81);

      for (let index = 0; index < 1_000; index += 1) {
        const value = generator.integer(-12, -3);
        expect(value).toBeGreaterThanOrEqual(-12);
        expect(value).toBeLessThanOrEqual(-3);
      }
    });

    it("supports ranges spanning negative and positive values", () => {
      const generator = new RandomGenerator(82);

      for (let index = 0; index < 1_000; index += 1) {
        const value = generator.integer(-10, 10);
        expect(value).toBeGreaterThanOrEqual(-10);
        expect(value).toBeLessThanOrEqual(10);
      }
    });

    it("supports the largest range representable by one 32-bit draw", () => {
      const generator = new RandomGenerator(1);
      vi.spyOn(generator, "next").mockReturnValue(1 - 1 / 0x1_0000_0000);

      expect(generator.integer(0, 0xffff_ffff)).toBe(0xffff_ffff);
    });

    it.each([
      [1.5, 6],
      [1, 6.5],
      [Number.NaN, 6],
      [1, Number.POSITIVE_INFINITY],
      [Number.MIN_SAFE_INTEGER - 1, 0],
      [0, Number.MAX_SAFE_INTEGER + 1],
    ])("rejects invalid bounds %s and %s", (minimum, maximum) => {
      expect(() => new RandomGenerator(1).integer(minimum, maximum)).toThrow(
        /bound.*safe integer/i,
      );
    });

    it("rejects a minimum greater than its maximum", () => {
      expect(() => new RandomGenerator(1).integer(6, 1)).toThrow(/minimum.*maximum/i);
    });

    it("rejects a range wider than one unsigned 32-bit draw", () => {
      expect(() => new RandomGenerator(1).integer(0, 0x1_0000_0000)).toThrow(
        /range.*4,294,967,296/i,
      );
    });

    it("keeps repeated die rolls within inclusive bounds", () => {
      const generator = new RandomGenerator(99);

      for (let index = 0; index < 10_000; index += 1) {
        const value = generator.integer(1, 6);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(6);
      }
    });
  });

  describe("percent", () => {
    it("always returns an integer from 1 through 100", () => {
      const generator = new RandomGenerator(100);

      for (let index = 0; index < 1_000; index += 1) {
        const value = generator.percent();
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(100);
      }
    });

    it("reproduces percentage sequences for identical seeds", () => {
      const first = new RandomGenerator(100);
      const second = new RandomGenerator(100);

      expect(Array.from({ length: 100 }, () => first.percent())).toEqual(
        Array.from({ length: 100 }, () => second.percent()),
      );
    });
  });

  describe("pick", () => {
    it("selects deterministically without modifying the input", () => {
      const items = Object.freeze(["goblin", "construct", "undead"]);
      const first = new RandomGenerator(620);
      const second = new RandomGenerator(620);

      expect(first.pick(items)).toBe(second.pick(items));
      expect(items).toEqual(["goblin", "construct", "undead"]);
    });

    it("rejects an empty array", () => {
      expect(() => new RandomGenerator(1).pick([])).toThrow(/pick.*empty array/i);
    });
  });

  describe("shuffle", () => {
    it("returns a deterministic shuffled copy with the same elements", () => {
      const items = Object.freeze(["a", "b", "c", "d", "e"]);
      const first = new RandomGenerator(300);
      const second = new RandomGenerator(300);
      const firstResult = first.shuffle(items);
      const secondResult = second.shuffle(items);

      expect(firstResult).toEqual(secondResult);
      expect([...firstResult].sort()).toEqual([...items].sort());
      expect(firstResult).not.toBe(items);
      expect(items).toEqual(["a", "b", "c", "d", "e"]);
    });

    it("returns a new empty array", () => {
      const items: readonly string[] = Object.freeze([]);
      const result = new RandomGenerator(1).shuffle(items);

      expect(result).toEqual([]);
      expect(result).not.toBe(items);
    });

    it("returns a new one-item array", () => {
      const items = Object.freeze(["only"]);
      const result = new RandomGenerator(1).shuffle(items);

      expect(result).toEqual(["only"]);
      expect(result).not.toBe(items);
    });
  });

  describe("weightedPick", () => {
    it("selects deterministically without modifying items or entries", () => {
      const items: readonly WeightedItem<string>[] = Object.freeze([
        Object.freeze({ value: "common", weight: 7 }),
        Object.freeze({ value: "uncommon", weight: 2 }),
        Object.freeze({ value: "rare", weight: 1 }),
      ]);
      const first = new RandomGenerator(400);
      const second = new RandomGenerator(400);

      expect(first.weightedPick(items)).toBe(second.weightedPick(items));
      expect(items).toEqual([
        { value: "common", weight: 7 },
        { value: "uncommon", weight: 2 },
        { value: "rare", weight: 1 },
      ]);
    });

    it("always selects a sole positive-weight item", () => {
      const generator = new RandomGenerator(401);
      const items = [{ value: "only", weight: 0.25 }] as const;

      for (let index = 0; index < 100; index += 1) {
        expect(generator.weightedPick(items)).toBe("only");
      }
    });

    it("never selects zero-weight entries", () => {
      const generator = new RandomGenerator(402);
      const items = [
        { value: "never-first", weight: 0 },
        { value: "selected", weight: 1 },
        { value: "never-last", weight: 0 },
      ] as const;

      for (let index = 0; index < 1_000; index += 1) {
        expect(generator.weightedPick(items)).toBe("selected");
      }
    });

    it("supports finite fractional weights", () => {
      const generator = new RandomGenerator(403);
      const items = [
        { value: "one", weight: 0.1 },
        { value: "two", weight: 0.2 },
        { value: "three", weight: 0.7 },
      ] as const;

      expect(Array.from({ length: 10 }, () => generator.weightedPick(items))).toEqual([
        "three",
        "two",
        "two",
        "two",
        "three",
        "three",
        "one",
        "three",
        "three",
        "one",
      ]);
    });

    it("rejects an empty array", () => {
      expect(() => new RandomGenerator(1).weightedPick([])).toThrow(/weighted pick.*empty array/i);
    });

    it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0.1])(
      "rejects invalid weight %s",
      (weight) => {
        expect(() => new RandomGenerator(1).weightedPick([{ value: "bad", weight }])).toThrow(
          /weight.*finite non-negative/i,
        );
      },
    );

    it("rejects a non-finite total weight", () => {
      expect(() =>
        new RandomGenerator(1).weightedPick([
          { value: "one", weight: Number.MAX_VALUE },
          { value: "two", weight: Number.MAX_VALUE },
        ]),
      ).toThrow(/total weight.*finite/i);
    });

    it("rejects a zero total weight", () => {
      expect(() =>
        new RandomGenerator(1).weightedPick([
          { value: "one", weight: 0 },
          { value: "two", weight: 0 },
        ]),
      ).toThrow(/total weight.*greater than zero/i);
    });
  });
});
