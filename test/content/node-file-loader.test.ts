import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadTsvFile, TsvFileError, TsvParseError } from "../../src/content/index.js";

describe("loadTsvFile", () => {
  let temporaryDirectory: string;

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "drg-tsv-loader-"));
  });

  afterEach(async () => {
    await rm(temporaryDirectory, { force: true, recursive: true });
  });

  it("reads UTF-8 text and returns parsed TSV data", async () => {
    const path = join(temporaryDirectory, "valid.tsv");
    await writeFile(path, "id\tname\n1\tCafé Guardian\n", "utf8");

    await expect(loadTsvFile(path)).resolves.toEqual({
      headers: ["id", "name"],
      rows: [
        {
          lineNumber: 2,
          values: { id: "1", name: "Café Guardian" },
        },
      ],
    });
  });

  it("reports a missing file with its path and underlying cause", async () => {
    const path = join(temporaryDirectory, "missing.tsv");
    let captured: unknown;

    try {
      await loadTsvFile(path);
    } catch (error) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(TsvFileError);
    expect(captured).toMatchObject({ path });
    expect((captured as Error).message).toContain(path);
    expect((captured as Error).cause).toBeInstanceOf(Error);
  });

  it("reports an invalid file path with useful context", async () => {
    let captured: unknown;

    try {
      await loadTsvFile(temporaryDirectory);
    } catch (error) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(TsvFileError);
    expect(captured).toMatchObject({ path: temporaryDirectory });
    expect((captured as Error).cause).toBeInstanceOf(Error);
  });

  it("uses the file path as parser-error context", async () => {
    const path = join(temporaryDirectory, "malformed.tsv");
    await writeFile(path, "id\tname\n1\n", "utf8");
    let captured: unknown;

    try {
      await loadTsvFile(path);
    } catch (error) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(TsvParseError);
    expect(captured).toMatchObject({ source: path, lineNumber: 2 });
    expect((captured as Error).message).toContain(`${path}:2`);
  });

  it("passes comment handling options through to the parser", async () => {
    const path = join(temporaryDirectory, "comments.tsv");
    await writeFile(path, "# catalog note\nid\tname\n1\tone\n", "utf8");

    await expect(loadTsvFile(path)).rejects.toBeInstanceOf(TsvParseError);
    await expect(loadTsvFile(path, { allowComments: true })).resolves.toEqual({
      headers: ["id", "name"],
      rows: [{ lineNumber: 3, values: { id: "1", name: "one" } }],
    });
  });
});
