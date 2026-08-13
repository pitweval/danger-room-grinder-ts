import { describe, expect, it } from "vitest";

import {
  FamilyCatalogError,
  loadFamilyCatalog,
  parseTsv,
  type FamilyDefinition,
} from "../../../src/content/index.js";
import {
  legacyFamiliesTsv,
  legacyFamilyHeaders,
  legacyFamilyRow,
  preferredFamiliesTsv,
  preferredFamilyHeaders,
  preferredFamilyRow,
} from "./fixtures.js";

function load(text: string, source = "families.tsv") {
  return loadFamilyCatalog(parseTsv(text, { source }));
}

describe("loadFamilyCatalog", () => {
  describe("preferred schema", () => {
    it("loads a complete PRIMARY family", () => {
      const catalog = load(
        preferredFamiliesTsv(
          preferredFamilyRow({
            id: "constructs",
            name: "Constructs",
            family_type: "PRIMARY",
            description: "Machines, guardians, and artificial creatures.",
          }),
        ),
      );

      expect(catalog.families).toEqual([
        {
          id: "constructs",
          name: "Constructs",
          familyType: "PRIMARY",
          description: "Machines, guardians, and artificial creatures.",
        },
      ] satisfies readonly FamilyDefinition[]);
    });

    it("loads an INTERMITTENT family", () => {
      expect(load(preferredFamiliesTsv(preferredFamilyRow())).families[0]?.familyType).toBe(
        "INTERMITTENT",
      );
    });

    it("preserves deterministic source order without inventing lexical sorting", () => {
      const catalog = load(
        preferredFamiliesTsv(
          preferredFamilyRow({ id: "zeta", name: "Zeta" }),
          preferredFamilyRow({ id: "alpha", name: "Alpha" }),
          preferredFamilyRow({ id: "middle", name: "Middle" }),
        ),
      );

      expect(catalog.families.map((family) => family.id)).toEqual(["zeta", "alpha", "middle"]);
    });

    it("lowercases IDs while preserving Unicode display text and descriptions", () => {
      const family = load(
        preferredFamiliesTsv(
          preferredFamilyRow({
            id: "FEY_COURT2",
            name: "Cúirt na Sí",
            description: "A strange court — quiet, watchful, and #present.",
          }),
        ),
      ).families[0];

      expect(family).toMatchObject({
        id: "fey_court2",
        name: "Cúirt na Sí",
        description: "A strange court — quiet, watchful, and #present.",
      });
    });

    it("preserves meaningful display-name and description whitespace", () => {
      const family = load(
        preferredFamiliesTsv(
          preferredFamilyRow({
            name: " Archive Spirits ",
            description: "  Preserved description spacing.  ",
          }),
        ),
      ).families[0];

      expect(family?.name).toBe(" Archive Spirits ");
      expect(family?.description).toBe("  Preserved description spacing.  ");
    });
  });

  describe("legacy schema", () => {
    it("converts a legacy family with the PRIMARY default", () => {
      expect(load(legacyFamiliesTsv(legacyFamilyRow())).families[0]).toEqual({
        id: "archive_spirits",
        name: "Archive Spirits",
        familyType: "PRIMARY",
        description: "Keepers of memory, records, and forgotten #catalogs.",
      });
    });

    it("preserves multiple legacy families in source order", () => {
      const catalog = load(
        legacyFamiliesTsv(
          legacyFamilyRow({ id: "zeta", name: "Zeta" }),
          legacyFamilyRow({ id: "alpha", name: "Alpha" }),
        ),
      );

      expect(catalog.families.map((family) => family.id)).toEqual(["zeta", "alpha"]);
      expect(catalog.families.every((family) => family.familyType === "PRIMARY")).toBe(true);
    });
  });

  describe("headers and schema detection", () => {
    it("accepts the exact preferred header", () => {
      expect(() => load(preferredFamiliesTsv(preferredFamilyRow()))).not.toThrow();
    });

    it("accepts the exact legacy header", () => {
      expect(() => load(legacyFamiliesTsv(legacyFamilyRow()))).not.toThrow();
    });

    it.each([
      ["reordered", ["name", "id", "family_type", "description"]],
      ["missing", preferredFamilyHeaders.slice(0, -1)],
      ["additional", [...preferredFamilyHeaders, "extra"]],
      ["unknown", ["key", "value"]],
    ])("rejects an %s schema", (_description, headers) => {
      const header = headers.join("\t");
      const parsed = parseTsv(`${header}\n${header}`, {
        source: "schema.tsv",
      });

      expect(() => loadFamilyCatalog(parsed)).toThrow(
        /schema\.tsv:1: unsupported family schema.*3-column.*4-column/i,
      );
    });

    it("accepts an empty family catalog as the Bash pack loader does", () => {
      expect(load(preferredFamilyHeaders.join("\t"))).toEqual({ families: [] });
      expect(load(legacyFamilyHeaders.join("\t"))).toEqual({ families: [] });
    });

    it("inherits source and physical line context from parsed TSV", () => {
      const parsed = parseTsv(
        preferredFamiliesTsv(
          preferredFamilyRow({ id: "valid" }),
          "",
          preferredFamilyRow({ id: "bad-id" }),
        ),
        { source: "spaced.tsv" },
      );

      expect(() => loadFamilyCatalog(parsed)).toThrow(/spaced\.tsv:4: family id/i);
    });

    it("throws the public semantic error type", () => {
      let captured: unknown;

      try {
        load(preferredFamiliesTsv(preferredFamilyRow({ family_type: "RARE" })));
      } catch (error) {
        captured = error;
      }

      expect(captured).toBeInstanceOf(FamilyCatalogError);
      expect(captured).toMatchObject({ source: "families.tsv", lineNumber: 2 });
    });
  });

  describe("validation and duplicates", () => {
    it.each([
      ["empty ID", { id: "" }, /family id.*invalid value/i],
      ["leading digit", { id: "2fey" }, /family id.*invalid value/i],
      ["hyphen", { id: "fey-court" }, /family id.*invalid value/i],
      ["whitespace", { id: " fey " }, /family id.*invalid value/i],
      ["empty name", { name: "" }, /family name is required/i],
      ["empty type", { family_type: "" }, /family_type.*invalid value/i],
      ["lowercase type", { family_type: "primary" }, /family_type.*invalid value/i],
      ["partial type", { family_type: "INTERMIT" }, /family_type.*invalid value/i],
      ["unknown type", { family_type: "SEASONAL" }, /family_type.*invalid value/i],
      ["empty description", { description: "" }, /family description is required/i],
    ])("rejects %s", (_description, overrides, message) => {
      expect(() => load(preferredFamiliesTsv(preferredFamilyRow(overrides)))).toThrow(message);
    });

    it.each(["PRIMARY", "INTERMITTENT"])("accepts exact family type %s", (familyType) => {
      expect(
        load(preferredFamiliesTsv(preferredFamilyRow({ family_type: familyType }))).families[0]
          ?.familyType,
      ).toBe(familyType);
    });

    it("rejects duplicate IDs after case normalization and identifies both rows", () => {
      expect(() =>
        load(
          preferredFamiliesTsv(
            preferredFamilyRow({ id: "FEY", name: "First" }),
            preferredFamilyRow({ id: "fey", name: "Second" }),
          ),
        ),
      ).toThrow(/families\.tsv:3: duplicate family id "fey".*first defined.*:2/i);
    });

    it("rejects exact duplicate IDs", () => {
      expect(() =>
        load(
          preferredFamiliesTsv(
            preferredFamilyRow({ id: "fey", name: "First" }),
            preferredFamilyRow({ id: "fey", name: "Second" }),
          ),
        ),
      ).toThrow(/duplicate family id "fey"/i);
    });

    it("rejects case-insensitive duplicate names and identifies both rows", () => {
      expect(() =>
        load(
          preferredFamiliesTsv(
            preferredFamilyRow({ id: "alpha", name: "Same Name" }),
            preferredFamilyRow({ id: "beta", name: "same name" }),
          ),
        ),
      ).toThrow(/families\.tsv:3: duplicate family name "same name".*first defined.*:2/i);
    });

    it("rejects exact duplicate display names", () => {
      expect(() =>
        load(
          preferredFamiliesTsv(
            preferredFamilyRow({ id: "alpha", name: "Same Name" }),
            preferredFamilyRow({ id: "beta", name: "Same Name" }),
          ),
        ),
      ).toThrow(/duplicate family name "same name"/i);
    });
  });

  describe("immutability", () => {
    it("does not mutate the parsed TSV input", () => {
      const parsed = parseTsv(preferredFamiliesTsv(preferredFamilyRow()));
      const before = JSON.stringify(parsed);

      loadFamilyCatalog(parsed);

      expect(JSON.stringify(parsed)).toBe(before);
    });

    it("freezes catalog collections and family records", () => {
      const catalog = load(preferredFamiliesTsv(preferredFamilyRow()));

      expect(Object.isFrozen(catalog)).toBe(true);
      expect(Object.isFrozen(catalog.families)).toBe(true);
      expect(Object.isFrozen(catalog.families[0])).toBe(true);
    });
  });
});
