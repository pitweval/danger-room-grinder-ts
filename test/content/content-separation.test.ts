import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("TSV module boundaries", () => {
  it("keeps the text parser independent of Node filesystem APIs", async () => {
    const parserPath = resolve(import.meta.dirname, "../../src/content/tsv-parser.ts");
    const source = await readFile(parserPath, "utf8");

    expect(source).not.toContain("node:fs");
  });
});
