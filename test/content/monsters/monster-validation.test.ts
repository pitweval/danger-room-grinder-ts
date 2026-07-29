import { describe, expect, it } from "vitest";

import { loadMonsterCatalog, parseTsv } from "../../../src/content/index.js";
import { legacyRow, legacyTsv, preferredRow, preferredTsv } from "./fixtures.js";

function loadPreferred(overrides: Parameters<typeof preferredRow>[0]) {
  return () =>
    loadMonsterCatalog(
      parseTsv(preferredTsv(preferredRow(overrides)), {
        source: "validation.tsv",
      }),
      { source: "validation.tsv" },
    );
}

describe("monster validation", () => {
  describe("required scalar fields", () => {
    it.each([
      ["id", { id: "" }, /id.*lowercase.*kebab/i],
      ["name", { name: "" }, /name is required/i],
      ["cr", { cr: "" }, /challenge rating.*invalid value ""/i],
      ["xp", { xp: "" }, /xp.*non-negative safe integer.*""/i],
      ["size", { size: "" }, /size.*invalid value ""/i],
      ["type", { type: "" }, /creature type.*invalid value ""/i],
    ])("rejects an invalid or empty %s", (_field, overrides, message) => {
      expect(loadPreferred(overrides)).toThrow(message);
    });

    it.each(["1/3", "00", "31", "-1", "1.0"])("rejects unsupported challenge rating %s", (cr) => {
      expect(loadPreferred({ cr })).toThrow(
        new RegExp(`challenge rating.*${cr.replace("/", "\\/")}`, "i"),
      );
    });

    it.each(["1.5", "-1", "ten", "9007199254740992"])("rejects invalid XP %s", (xp) => {
      expect(loadPreferred({ xp })).toThrow(/xp.*non-negative safe integer/i);
    });

    it("preserves zero XP", () => {
      expect(
        loadMonsterCatalog(parseTsv(preferredTsv(preferredRow({ cr: "0", xp: "0" })))).monsters[0]
          ?.xp,
      ).toBe(0);
    });

    it.each(["Colossal", "tiny", "Tiny or Colossal"])("rejects unsupported size %s", (size) => {
      expect(loadPreferred({ size })).toThrow(/size.*invalid value/i);
    });

    it.each(["Robot", "construct", "Lich"])("rejects unsupported creature type %s", (type) => {
      expect(loadPreferred({ type })).toThrow(/creature type.*invalid value/i);
    });
  });

  describe("roles", () => {
    it.each(["leader", "brute", "controller", "soldier", "skirmisher", "minion"])(
      "accepts canonical role %s",
      (role) => {
        expect(loadPreferred({ roles: role })).not.toThrow();
      },
    );

    it.each([
      ["artillery", "controller"],
      ["cavalry", "skirmisher"],
      ["scout", "skirmisher"],
      ["hunter", "skirmisher"],
      ["bruiser", "brute"],
      ["support", "controller"],
      ["engineer", "controller"],
      ["divine-caster", "controller"],
      ["merchant", "controller"],
      ["hermit", "skirmisher"],
      ["boss-controller", "controller"],
      ["boss-leader", "leader"],
      ["boss-brute", "brute"],
      ["final-boss", "leader"],
    ])("normalizes alias %s to %s", (alias, expected) => {
      const monster = loadMonsterCatalog(parseTsv(preferredTsv(preferredRow({ roles: alias }))))
        .monsters[0];

      expect(monster?.roles).toEqual([expected]);
    });

    it("normalizes case, spaces, underscores, aliases, duplicates, and canonical order", () => {
      const monster = loadMonsterCatalog(
        parseTsv(
          preferredTsv(
            preferredRow({
              roles: " MINION, boss_brute,Artillery,boss leader,soldier,controller ",
            }),
          ),
        ),
      ).monsters[0];

      expect(monster?.roles).toEqual(["leader", "brute", "controller", "soldier", "minion"]);
    });

    it.each(["", "striker", "leader,striker"])(
      "rejects empty or unsupported role list %s",
      (roles) => {
        expect(loadPreferred({ roles })).toThrow(/roles.*unknown or empty/i);
      },
    );

    it("applies role aliases to legacy rows", () => {
      const monster = loadMonsterCatalog(
        parseTsv(legacyTsv(legacyRow({ roles: "boss-brute,hunter" }))),
      ).monsters[0];

      expect(monster?.roles).toEqual(["brute", "skirmisher"]);
    });
  });

  describe("lists and metadata", () => {
    it.each([
      ["tags", { tags: "beta,alpha" }, /tags.*sorted/i],
      ["tags", { tags: "alpha,alpha" }, /tags.*duplicate/i],
      ["tags", { tags: "alpha, beta" }, /tags.*invalid/i],
      [
        "requirements",
        { requirements: "terrain:water,environment:underwater" },
        /requirements.*sorted/i,
      ],
      ["requirements", { requirements: "environment:lava" }, /requirements.*invalid/i],
      ["families", { families: "constructs,archive_spirits" }, /families.*sorted/i],
      ["families", { families: "constructs,constructs" }, /families.*duplicate/i],
      ["families", { families: "" }, /families.*empty/i],
      [
        "preferred environments",
        { preferred_environments: "forge,forge" },
        /preferred environment.*duplicate/i,
      ],
      [
        "preferred environments",
        { preferred_environments: "forge,!!!" },
        /preferred environment.*invalid/i,
      ],
    ])("rejects invalid %s", (_field, overrides, message) => {
      expect(loadPreferred(overrides)).toThrow(message);
    });

    it("normalizes family case and whitespace while preserving sorted order", () => {
      const monster = loadMonsterCatalog(
        parseTsv(preferredTsv(preferredRow({ families: " Archive_Spirits , CONSTRUCTS " }))),
      ).monsters[0];

      expect(monster?.families).toEqual(["archive_spirits", "constructs"]);
    });

    it.each([
      ["boss_eligible", { boss_eligible: "maybe" }],
      ["boss_eligible", { boss_eligible: "" }],
      ["minion_eligible", { minion_eligible: "true" }],
      ["minion_eligible", { minion_eligible: "" }],
      ["procedural", { procedural: "auto" }],
      ["procedural", { procedural: "" }],
    ])("rejects invalid Boolean field %s", (field, overrides) => {
      expect(loadPreferred(overrides)).toThrow(new RegExp(`${field}.*invalid value`, "i"));
    });

    it.each([
      ["source", { source: "" }],
      ["notes", { notes: "" }],
    ])("rejects empty %s metadata", (field, overrides) => {
      expect(loadPreferred(overrides)).toThrow(new RegExp(`${field}.*text or -`, "i"));
    });
  });
});
