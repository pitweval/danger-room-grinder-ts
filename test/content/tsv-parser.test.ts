import { describe, expect, it } from "vitest";

import { parseTsv, TsvParseError, type ParsedTsv } from "../../src/content/index.js";

describe("parseTsv", () => {
  describe("basic parsing", () => {
    it("parses headers and multiple data rows in source order", () => {
      const parsed = parseTsv("id\tname\tkind\nsecond\tSecond row\tbeta\nfirst\tFirst row\talpha");

      expect(parsed).toEqual({
        headers: ["id", "name", "kind"],
        rows: [
          {
            lineNumber: 2,
            values: { id: "second", name: "Second row", kind: "beta" },
          },
          {
            lineNumber: 3,
            values: { id: "first", name: "First row", kind: "alpha" },
          },
        ],
      });
    });

    it("parses one-column input", () => {
      expect(parseTsv("name\nalpha\nbeta")).toEqual({
        headers: ["name"],
        rows: [
          { lineNumber: 2, values: { name: "alpha" } },
          { lineNumber: 3, values: { name: "beta" } },
        ],
      });
    });

    it("preserves empty and trailing empty cells", () => {
      const parsed = parseTsv("first\tmiddle\tlast\none\t\t");

      expect(parsed.rows[0]?.values).toEqual({
        first: "one",
        middle: "",
        last: "",
      });
    });

    it.each([
      ["with a final newline", "id\tname\n1\tone\n"],
      ["without a final newline", "id\tname\n1\tone"],
    ])("parses input %s", (_description, text) => {
      expect(parseTsv(text).rows).toEqual([{ lineNumber: 2, values: { id: "1", name: "one" } }]);
    });

    it("preserves Unicode text", () => {
      const parsed = parseTsv("id\tdescription\ncafé\tAncient repairs — complete");

      expect(parsed.rows[0]?.values).toEqual({
        id: "café",
        description: "Ancient repairs — complete",
      });
    });

    it("does not trim headers or data values", () => {
      const parsed = parseTsv(" id \tname\n value \t  spaced text  ");

      expect(parsed.headers).toEqual([" id ", "name"]);
      expect(parsed.rows[0]?.values).toEqual({
        " id ": " value ",
        name: "  spaced text  ",
      });
    });
  });

  describe("line endings", () => {
    it("parses LF and CRLF input identically", () => {
      const lf = parseTsv("id\tname\n1\tone\n2\ttwo\n");
      const crlf = parseTsv("id\tname\r\n1\tone\r\n2\ttwo\r\n");

      expect(crlf).toEqual(lf);
    });
  });

  describe("comments and blank lines", () => {
    it("ignores empty and whitespace-only lines", () => {
      const parsed = parseTsv("\n \t \nid\tname\n\n1\tone\n\t \n2\ttwo\n");

      expect(parsed.headers).toEqual(["id", "name"]);
      expect(parsed.rows.map((row) => row.lineNumber)).toEqual([5, 7]);
    });

    it("ignores full-line comments before the header and between rows", () => {
      const parsed = parseTsv(
        "# catalog note\n  # indented note\nid\tname\n1\tone\n# another note\n2\ttwo",
        { allowComments: true },
      );

      expect(parsed.headers).toEqual(["id", "name"]);
      expect(parsed.rows).toEqual([
        { lineNumber: 4, values: { id: "1", name: "one" } },
        { lineNumber: 6, values: { id: "2", name: "two" } },
      ]);
    });

    it("preserves comment markers inside data cells", () => {
      const parsed = parseTsv(
        "id\tdescription\n1\tA # marker remains data\n2\t#starts-inside-second-cell",
        { allowComments: true },
      );

      expect(parsed.rows.map((row) => row.values.description)).toEqual([
        "A # marker remains data",
        "#starts-inside-second-cell",
      ]);
    });

    it("treats a comment before the header as ordinary malformed input by default", () => {
      expect(() => parseTsv("# catalog note\nid\tname", { source: "comments.tsv" })).toThrow(
        /comments\.tsv:2: expected 1 fields, found 2/i,
      );
    });

    it("treats a comment between rows as ordinary malformed input by default", () => {
      expect(() =>
        parseTsv("id\tname\n1\tone\n# another note\n2\ttwo", {
          source: "comments.tsv",
        }),
      ).toThrow(/comments\.tsv:3: expected 2 fields, found 1/i);
    });

    it("parses a comment-shaped line as data when its field count is valid", () => {
      const parsed = parseTsv("id\tdescription\n# catalog note\tordinary row");

      expect(parsed.rows[0]?.values).toEqual({
        id: "# catalog note",
        description: "ordinary row",
      });
    });

    it("documents leading-whitespace comments as opt-in behavior", () => {
      const text = "id\tname\n  # indented note\tordinary row";

      expect(parseTsv(text).rows).toHaveLength(1);
      expect(parseTsv(text, { allowComments: true }).rows).toHaveLength(0);
    });
  });

  describe("validation", () => {
    it.each([
      ["empty input", ""],
      ["blank input", "\n \t\n"],
    ])("rejects a missing header in %s", (_description, text) => {
      expect(() => parseTsv(text, { source: "empty.tsv" })).toThrow(
        /empty\.tsv: missing header row/i,
      );
    });

    it("rejects comment-only input as a missing header when comments are enabled", () => {
      expect(() =>
        parseTsv("# one\n  # two\n", {
          allowComments: true,
          source: "empty.tsv",
        }),
      ).toThrow(/empty\.tsv: missing header row/i);
    });

    it.each([
      ["an empty first header", "\tname"],
      ["an empty middle header", "id\t\tname"],
      ["an empty trailing header", "id\tname\t"],
      ["a whitespace-only header", "id\t \tname"],
    ])("rejects %s", (_description, text) => {
      expect(() => parseTsv(text, { source: "headers.tsv" })).toThrow(
        /headers\.tsv:1: empty header name/i,
      );
    });

    it("rejects duplicate header names", () => {
      expect(() =>
        parseTsv("# comment\nid\tname\tid", {
          allowComments: true,
          source: "duplicates.tsv",
        }),
      ).toThrow(/duplicates\.tsv:2: duplicate header name "id"/i);
    });

    it("rejects rows with too few fields", () => {
      expect(() =>
        parseTsv("id\tname\tdescription\n1\tone", {
          source: "short.tsv",
        }),
      ).toThrow(/short\.tsv:2: expected 3 fields, found 2/i);
    });

    it("rejects rows with too many fields", () => {
      expect(() => parseTsv("id\tname\n1\tone\textra", { source: "long.tsv" })).toThrow(
        /long\.tsv:2: expected 2 fields, found 3/i,
      );
    });

    it("throws a public parse-error type with source information", () => {
      let captured: unknown;

      try {
        parseTsv("id\tname\n1", { source: "typed.tsv" });
      } catch (error) {
        captured = error;
      }

      expect(captured).toBeInstanceOf(TsvParseError);
      expect(captured).toMatchObject({
        source: "typed.tsv",
        lineNumber: 2,
      });
    });
  });

  describe("immutability and safety", () => {
    it("does not modify its input text", () => {
      const text = "id\tname\n1\tone";
      const original = text;

      parseTsv(text);

      expect(text).toBe(original);
    });

    it("gives every row a distinct values object", () => {
      const parsed = parseTsv("id\tname\n1\tone\n2\ttwo");

      expect(parsed.rows[0]?.values).not.toBe(parsed.rows[1]?.values);
    });

    it("returns readonly data that is frozen at runtime", () => {
      const parsed: ParsedTsv = parseTsv("id\tname\n1\tone");

      expect(Object.isFrozen(parsed)).toBe(true);
      expect(Object.isFrozen(parsed.headers)).toBe(true);
      expect(Object.isFrozen(parsed.rows)).toBe(true);
      expect(Object.isFrozen(parsed.rows[0])).toBe(true);
      expect(Object.isFrozen(parsed.rows[0]?.values)).toBe(true);
    });
  });
});
