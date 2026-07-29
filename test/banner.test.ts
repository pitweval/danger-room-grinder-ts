import { describe, expect, it } from "vitest";

import { applicationBanner } from "../src/cli/banner.js";

describe("application banner", () => {
  it("identifies the TypeScript development build", () => {
    expect(applicationBanner).toBe(
      ["Danger Room Grinder (TypeScript)", "Version: Development"].join("\n"),
    );
  });
});
