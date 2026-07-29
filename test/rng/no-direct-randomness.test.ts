import { readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

function listTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listTypeScriptFiles(path) : extname(path) === ".ts" ? [path] : [];
  });
}

describe("randomness policy", () => {
  it("prohibits direct use of the platform's unseeded random function", () => {
    const prohibitedCall = ["Math", "random"].join(".");
    const projectRoot = resolve(import.meta.dirname, "../..");
    const files = [
      ...listTypeScriptFiles(join(projectRoot, "src")),
      ...listTypeScriptFiles(join(projectRoot, "test")),
    ];

    const offenders = files.filter((file) => readFileSync(file, "utf8").includes(prohibitedCall));

    expect(offenders).toEqual([]);
  });
});
