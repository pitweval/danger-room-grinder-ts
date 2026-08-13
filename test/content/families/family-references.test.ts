import { describe, expect, it } from "vitest";

import {
  loadFamilyCatalog,
  loadMonsterCatalog,
  MonsterFamilyReferenceError,
  parseTsv,
  validateMonsterFamilyReferences,
} from "../../../src/content/index.js";
import { preferredRow, preferredTsv } from "../monsters/fixtures.js";
import { preferredFamiliesTsv, preferredFamilyRow } from "./fixtures.js";

function families(...ids: readonly string[]) {
  return loadFamilyCatalog(
    parseTsv(
      preferredFamiliesTsv(...ids.map((id) => preferredFamilyRow({ id, name: `${id} family` }))),
      { source: "families.tsv" },
    ),
  );
}

function monsters(...records: readonly { id: string; name: string; families: string }[]) {
  return loadMonsterCatalog(
    parseTsv(preferredTsv(...records.map((record) => preferredRow(record))), {
      source: "monsters.tsv",
    }),
  );
}

describe("validateMonsterFamilyReferences", () => {
  it("accepts catalogs when every reference exists", () => {
    const familyCatalog = families("constructs", "undead");
    const monsterCatalog = monsters(
      { id: "alpha", name: "Alpha", families: "constructs" },
      { id: "beta", name: "Beta", families: "constructs,undead" },
    );

    expect(() => validateMonsterFamilyReferences(monsterCatalog, familyCatalog)).not.toThrow();
  });

  it("matches normalized family IDs", () => {
    const familyCatalog = loadFamilyCatalog(
      parseTsv(preferredFamiliesTsv(preferredFamilyRow({ id: "CONSTRUCTS", name: "Constructs" }))),
    );
    const monsterCatalog = monsters({
      id: "alpha",
      name: "Alpha",
      families: "CONSTRUCTS",
    });

    expect(() => validateMonsterFamilyReferences(monsterCatalog, familyCatalog)).not.toThrow();
  });

  it("reports one missing reference with monster and source context", () => {
    const familyCatalog = families("constructs");
    const monsterCatalog = monsters({
      id: "alpha",
      name: "Alpha Guardian",
      families: "missing",
    });

    expect(() => validateMonsterFamilyReferences(monsterCatalog, familyCatalog)).toThrow(
      /monsters\.tsv:2: monster "alpha" \(Alpha Guardian\) references unknown family "missing"/i,
    );
  });

  it("reports multiple missing references in monster and family-list order", () => {
    const familyCatalog = families("constructs");
    const monsterCatalog = monsters(
      {
        id: "alpha",
        name: "Alpha",
        families: "missing_a,missing_b",
      },
      { id: "beta", name: "Beta", families: "missing_c" },
    );
    let captured: unknown;

    try {
      validateMonsterFamilyReferences(monsterCatalog, familyCatalog);
    } catch (error) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(MonsterFamilyReferenceError);
    expect(captured).toMatchObject({
      missingReferences: [
        { monsterId: "alpha", monsterName: "Alpha", familyId: "missing_a" },
        { monsterId: "alpha", monsterName: "Alpha", familyId: "missing_b" },
        { monsterId: "beta", monsterName: "Beta", familyId: "missing_c" },
      ],
    });
    expect((captured as Error).message.indexOf("missing_a")).toBeLessThan(
      (captured as Error).message.indexOf("missing_b"),
    );
    expect((captured as Error).message.indexOf("missing_b")).toBeLessThan(
      (captured as Error).message.indexOf("missing_c"),
    );
  });

  it("does not require every family definition to have a monster", () => {
    const familyCatalog = families("constructs", "unused");
    const monsterCatalog = monsters({
      id: "alpha",
      name: "Alpha",
      families: "constructs",
    });

    expect(() => validateMonsterFamilyReferences(monsterCatalog, familyCatalog)).not.toThrow();
  });

  it("does not mutate either catalog", () => {
    const familyCatalog = families("constructs");
    const monsterCatalog = monsters({
      id: "alpha",
      name: "Alpha",
      families: "missing",
    });
    const familiesBefore = JSON.stringify(familyCatalog);
    const monstersBefore = JSON.stringify(monsterCatalog);

    expect(() => validateMonsterFamilyReferences(monsterCatalog, familyCatalog)).toThrow();

    expect(JSON.stringify(familyCatalog)).toBe(familiesBefore);
    expect(JSON.stringify(monsterCatalog)).toBe(monstersBefore);
  });
});
