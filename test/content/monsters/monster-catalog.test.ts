import { describe, expect, it } from "vitest";

import {
  loadMonsterCatalog,
  MonsterCatalogError,
  parseTsv,
  type MonsterDefinition,
} from "../../../src/content/index.js";
import { legacyRow, legacyTsv, preferredHeaders, preferredRow, preferredTsv } from "./fixtures.js";

function load(text: string, source = "monsters.tsv") {
  return loadMonsterCatalog(parseTsv(text, { source }), { source });
}

describe("loadMonsterCatalog", () => {
  describe("preferred schema", () => {
    it("loads and normalizes a complete monster definition", () => {
      const catalog = load(preferredTsv(preferredRow()));

      expect(catalog.monsters).toEqual([
        {
          id: "archive-keeper",
          name: "Archive Keeper",
          cr: "1/2",
          xp: 100,
          size: "Medium",
          type: "Construct",
          roles: ["leader", "controller", "soldier"],
          tags: ["clockwork", "source:homebrew"],
          requirements: [],
          families: ["archive_spirits", "constructs"],
          preferredEnvironments: ["arcane-lab", "under-dark"],
          bossEligible: true,
          minionEligible: false,
          procedural: true,
          source: "Bryan #1",
          notes: "Keeps records; asks, “Why?”",
        },
      ] satisfies readonly MonsterDefinition[]);
    });

    it("preserves deterministic source order", () => {
      const catalog = load(
        preferredTsv(
          preferredRow({ id: "alpha", name: "Alpha" }),
          preferredRow({ id: "beta", name: "Beta" }),
          preferredRow({ id: "gamma", name: "Gamma" }),
        ),
      );

      expect(catalog.monsters.map((monster) => monster.id)).toEqual(["alpha", "beta", "gamma"]);
    });

    it("supports empty optional tag and requirement lists", () => {
      const monster = load(preferredTsv(preferredRow({ tags: "", requirements: "" }))).monsters[0];

      expect(monster?.tags).toEqual([]);
      expect(monster?.requirements).toEqual([]);
    });

    it("supports one-entry and multiple-entry lists", () => {
      const monster = load(
        preferredTsv(
          preferredRow({
            roles: "brute",
            tags: "clockwork",
            requirements: "environment:underwater,terrain:water",
            families: "constructs",
            preferred_environments: "forge,workshop",
          }),
        ),
      ).monsters[0];

      expect(monster).toMatchObject({
        roles: ["brute"],
        tags: ["clockwork"],
        requirements: ["environment:underwater", "terrain:water"],
        families: ["constructs"],
        preferredEnvironments: ["forge", "workshop"],
      });
    });

    it("preserves Unicode names, source text, notes, and embedded comment markers", () => {
      const monster = load(
        preferredTsv(
          preferredRow({
            name: "Cait Sìth",
            source: "Bryan’s Campaign #4",
            notes: "Quiet — but not harmless. #not-a-comment",
          }),
        ),
      ).monsters[0];

      expect(monster).toMatchObject({
        name: "Cait Sìth",
        source: "Bryan’s Campaign #4",
        notes: "Quiet — but not harmless. #not-a-comment",
      });
    });

    it.each([
      ["yes", true],
      ["no", false],
      ["auto", true],
    ])("maps boss and minion eligibility %s deterministically", (token, expected) => {
      const monster = load(
        preferredTsv(
          preferredRow({
            boss_eligible: token,
            minion_eligible: token,
          }),
        ),
      ).monsters[0];

      expect(monster?.bossEligible).toBe(expected);
      expect(monster?.minionEligible).toBe(expected);
    });

    it.each([
      ["yes", true],
      ["no", false],
    ])("parses procedural token %s", (token, expected) => {
      const monster = load(preferredTsv(preferredRow({ procedural: token }))).monsters[0];

      expect(monster?.procedural).toBe(expected);
    });
  });

  describe("legacy schema", () => {
    it("converts a legacy row into the normalized public type", () => {
      const monster = load(legacyTsv(legacyRow())).monsters[0];

      expect(monster).toEqual({
        id: "archive-keeper",
        name: "Archive Keeper",
        cr: "1/2",
        xp: 100,
        size: "Medium",
        type: "Construct",
        roles: ["leader", "controller", "soldier"],
        tags: ["clockwork", "source:homebrew"],
        requirements: [],
        families: ["archive_spirits", "constructs"],
        preferredEnvironments: [],
        bossEligible: true,
        minionEligible: true,
        procedural: true,
        source: "-",
        notes: "-",
      });
    });

    it("preserves multiple legacy rows in source order", () => {
      const catalog = load(
        legacyTsv(
          legacyRow({ id: "alpha", name: "Alpha" }),
          legacyRow({ id: "beta", name: "Beta" }),
        ),
      );

      expect(catalog.monsters.map((monster) => monster.id)).toEqual(["alpha", "beta"]);
    });

    it("maps every legacy column through the shared validation path", () => {
      const monster = load(
        legacyTsv(
          legacyRow({
            id: "tidal-hunter",
            name: "Tidal Hunter",
            cr: "2",
            xp: "450",
            size: "Large",
            type: "Monstrosity",
            roles: "hunter,boss-brute",
            tags: "aquatic,tracker",
            requirements: "terrain:water",
            families: "monstrosities",
          }),
        ),
      ).monsters[0];

      expect(monster).toMatchObject({
        id: "tidal-hunter",
        name: "Tidal Hunter",
        cr: "2",
        xp: 450,
        size: "Large",
        type: "Monstrosity",
        roles: ["brute", "skirmisher"],
        tags: ["aquatic", "tracker"],
        requirements: ["terrain:water"],
        families: ["monstrosities"],
      });
    });
  });

  describe("schemas and diagnostics", () => {
    it("accepts the exact preferred header", () => {
      expect(() => load(preferredTsv(preferredRow()))).not.toThrow();
    });

    it("accepts the exact legacy header", () => {
      expect(() => load(legacyTsv(legacyRow()))).not.toThrow();
    });

    it.each([
      ["reordered", [...preferredHeaders.slice(1), preferredHeaders[0]].join("\t")],
      ["missing", preferredHeaders.slice(0, -1).join("\t")],
      ["additional", [...preferredHeaders, "extra"].join("\t")],
      ["unknown", "key\tvalue"],
    ])("rejects an %s schema header", (_description, header) => {
      const parsed = parseTsv(`${header}\n${header}`, {
        source: "schema.tsv",
      });

      expect(() => loadMonsterCatalog(parsed, { source: "schema.tsv" })).toThrow(
        /schema\.tsv:1: unsupported monster schema.*10-column.*16-column/i,
      );
    });

    it("rejects a catalog without monster records", () => {
      expect(() => load(preferredHeaders.join("\t"))).toThrow(
        /monsters\.tsv: expected at least one monster record/i,
      );
    });

    it("preserves physical line numbers after blank lines", () => {
      const text = preferredTsv(
        preferredRow({ id: "alpha", name: "Alpha" }),
        "",
        preferredRow({ id: "beta", name: "" }),
      );

      expect(() => load(text, "spaced.tsv")).toThrow(/spaced\.tsv:4: name is required/i);
    });

    it("throws a public semantic error type", () => {
      let captured: unknown;

      try {
        load(preferredTsv(preferredRow({ cr: "1/3" })), "typed.tsv");
      } catch (error) {
        captured = error;
      }

      expect(captured).toBeInstanceOf(MonsterCatalogError);
      expect(captured).toMatchObject({
        source: "typed.tsv",
        lineNumber: 2,
      });
    });

    it("inherits source context from the generic parser", () => {
      const parsed = parseTsv(preferredTsv(preferredRow({ cr: "1/3" })), {
        source: "inherited.tsv",
      });

      expect(() => loadMonsterCatalog(parsed)).toThrow(/inherited\.tsv:2: challenge rating/i);
    });
  });

  describe("duplicates and order", () => {
    it("rejects duplicate IDs and identifies the original row", () => {
      expect(() =>
        load(
          preferredTsv(
            preferredRow({ id: "same", name: "First" }),
            preferredRow({ id: "same", name: "Second" }),
          ),
        ),
      ).toThrow(/monsters\.tsv:3: duplicate monster id "same".*first defined.*:2/i);
    });

    it("rejects case-insensitive duplicate names and identifies the original row", () => {
      expect(() =>
        load(
          preferredTsv(
            preferredRow({ id: "alpha", name: "Same Name" }),
            preferredRow({ id: "beta", name: "same name" }),
          ),
        ),
      ).toThrow(/monsters\.tsv:3: duplicate monster name "same name".*first defined.*:2/i);
    });

    it("rejects IDs outside deterministic lexical order", () => {
      expect(() =>
        load(
          preferredTsv(
            preferredRow({ id: "beta", name: "Beta" }),
            preferredRow({ id: "alpha", name: "Alpha" }),
          ),
        ),
      ).toThrow(/monsters\.tsv:3: monster ids must be sorted/i);
    });
  });

  describe("immutability", () => {
    it("does not mutate the parsed TSV input", () => {
      const parsed = parseTsv(preferredTsv(preferredRow()));
      const before = JSON.stringify(parsed);

      loadMonsterCatalog(parsed);

      expect(JSON.stringify(parsed)).toBe(before);
    });

    it("freezes the catalog, monsters, and nested lists", () => {
      const catalog = load(preferredTsv(preferredRow()));
      const monster = catalog.monsters[0];

      expect(Object.isFrozen(catalog)).toBe(true);
      expect(Object.isFrozen(catalog.monsters)).toBe(true);
      expect(Object.isFrozen(monster)).toBe(true);
      expect(Object.isFrozen(monster?.roles)).toBe(true);
      expect(Object.isFrozen(monster?.tags)).toBe(true);
      expect(Object.isFrozen(monster?.requirements)).toBe(true);
      expect(Object.isFrozen(monster?.families)).toBe(true);
      expect(Object.isFrozen(monster?.preferredEnvironments)).toBe(true);
    });

    it("creates independent nested list values for every monster", () => {
      const catalog = load(
        preferredTsv(
          preferredRow({ id: "alpha", name: "Alpha" }),
          preferredRow({ id: "beta", name: "Beta" }),
        ),
      );

      expect(catalog.monsters[0]?.roles).not.toBe(catalog.monsters[1]?.roles);
      expect(catalog.monsters[0]?.tags).not.toBe(catalog.monsters[1]?.tags);
    });
  });
});
