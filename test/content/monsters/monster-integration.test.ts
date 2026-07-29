import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  loadMonsterCatalog,
  loadMonsterCatalogFile,
  parseTsv,
  TsvParseError,
} from "../../../src/content/index.js";
import { preferredHeaders, preferredRow, preferredTsv } from "./fixtures.js";

describe("monster catalog integration", () => {
  let temporaryDirectory: string;

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "drg-monsters-"));
  });

  afterEach(async () => {
    await rm(temporaryDirectory, { force: true, recursive: true });
  });

  it("loads a monster catalog from a UTF-8 file", async () => {
    const path = join(temporaryDirectory, "monsters.tsv");
    await writeFile(path, preferredTsv(preferredRow({ name: "Cait Sìth" })), "utf8");

    const catalog = await loadMonsterCatalogFile(path);

    expect(catalog.monsters[0]?.name).toBe("Cait Sìth");
  });

  it("keeps comments disabled for canonical monster files", async () => {
    const path = join(temporaryDirectory, "comments.tsv");
    await writeFile(path, `# comment\n${preferredTsv(preferredRow())}`, "utf8");

    await expect(loadMonsterCatalogFile(path)).rejects.toBeInstanceOf(TsvParseError);
  });

  it("preserves generic malformed-TSV errors", () => {
    expect(() =>
      parseTsv(`${preferredHeaders.join("\t")}\n${preferredRow()}\textra`, {
        source: "malformed.tsv",
      }),
    ).toThrow(/malformed\.tsv:2: expected 16 fields, found 17/i);
  });

  it("keeps the schema loader independent of Node filesystem APIs", async () => {
    const loaderPath = resolve(import.meta.dirname, "../../../src/content/monsters/loader.ts");
    const source = await import("node:fs/promises").then(({ readFile }) =>
      readFile(loaderPath, "utf8"),
    );

    expect(source).not.toContain("node:fs");
  });

  it("does not introduce encounter or room generation behavior", async () => {
    const modulePath = resolve(import.meta.dirname, "../../../src/content/monsters");
    const { readdir, readFile } = await import("node:fs/promises");
    const files = (await readdir(modulePath))
      .filter((file) => file.endsWith(".ts"))
      .filter((file) => file !== "node-file-loader.ts");
    const source = (
      await Promise.all(files.map((file) => readFile(join(modulePath, file), "utf8")))
    ).join("\n");

    expect(source).not.toMatch(/\b(generateEncounter|generateRoom)\b/);
  });

  it("leaves generic parsing behavior unchanged", () => {
    const parsed = parseTsv("id\tvalue\n1\tone\n2\ttwo");
    const before = JSON.stringify(parsed);

    loadMonsterCatalog(
      parseTsv(preferredTsv(preferredRow()), {
        source: "monsters.tsv",
      }),
      { source: "monsters.tsv" },
    );

    expect(JSON.stringify(parsed)).toBe(before);
  });
});
