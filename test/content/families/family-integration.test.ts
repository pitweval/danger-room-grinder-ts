import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  loadFamilyCatalog,
  loadFamilyCatalogFile,
  parseTsv,
  TsvParseError,
} from "../../../src/content/index.js";
import { preferredFamiliesTsv, preferredFamilyHeaders, preferredFamilyRow } from "./fixtures.js";

describe("family catalog integration", () => {
  let temporaryDirectory: string;

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "drg-families-"));
  });

  afterEach(async () => {
    await rm(temporaryDirectory, { force: true, recursive: true });
  });

  it("loads a UTF-8 family catalog through the thin Node adapter", async () => {
    const path = join(temporaryDirectory, "families.tsv");
    await writeFile(
      path,
      preferredFamiliesTsv(preferredFamilyRow({ name: "Créatures Féeriques" })),
      "utf8",
    );

    await expect(loadFamilyCatalogFile(path)).resolves.toMatchObject({
      families: [{ name: "Créatures Féeriques" }],
    });
  });

  it("keeps comments disabled for canonical family files", async () => {
    const path = join(temporaryDirectory, "comments.tsv");
    await writeFile(path, `# comment\n${preferredFamiliesTsv(preferredFamilyRow())}`, "utf8");

    await expect(loadFamilyCatalogFile(path)).rejects.toBeInstanceOf(TsvParseError);
  });

  it("preserves generic malformed-TSV errors", () => {
    expect(() =>
      parseTsv(`${preferredFamilyHeaders.join("\t")}\n${preferredFamilyRow()}\textra`, {
        source: "malformed.tsv",
      }),
    ).toThrow(/malformed\.tsv:2: expected 4 fields, found 5/i);
  });

  it.each(["loader.ts", "references.ts"])(
    "keeps pure module %s independent of Node filesystem APIs",
    async (filename) => {
      const path = resolve(import.meta.dirname, `../../../src/content/families/${filename}`);
      const { readFile } = await import("node:fs/promises");

      expect(await readFile(path, "utf8")).not.toContain("node:fs");
    },
  );

  it("does not introduce family selection or generation behavior", async () => {
    const path = resolve(import.meta.dirname, "../../../src/content/families");
    const { readdir, readFile } = await import("node:fs/promises");
    const files = (await readdir(path)).filter((file) => file.endsWith(".ts"));
    const source = (
      await Promise.all(files.map((file) => readFile(join(path, file), "utf8")))
    ).join("\n");

    expect(source).not.toMatch(/\b(selectFamily|generateEncounter|generateRoom)\b/);
  });

  it("leaves ordinary TSV parsing unchanged", () => {
    const parsed = parseTsv("id\tvalue\n1\tone\n2\ttwo");
    const before = JSON.stringify(parsed);

    loadFamilyCatalog(parseTsv(preferredFamiliesTsv(preferredFamilyRow())));

    expect(JSON.stringify(parsed)).toBe(before);
  });
});
