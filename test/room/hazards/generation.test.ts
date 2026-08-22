import { describe, expect, it, vi } from "vitest";

import type { OrdinaryRoomCatalog } from "../../../src/content/index.js";
import { RandomGenerator } from "../../../src/rng/index.js";
import { RoomGenerationError, selectRoomHazard } from "../../../src/room/index.js";

const CATALOG: Pick<OrdinaryRoomCatalog, "hazards" | "neighborhoodHazards"> = deepFreeze({
  hazards: [
    {
      name: "Falling Net",
      severity: "nuisance",
      trigger: "A wire releases it.",
      effect: "It restrains creatures.",
      counterplay: "Cut the net.",
    },
    {
      name: "Fire Jet",
      severity: "deadly",
      trigger: "A plate opens a valve.",
      effect: "Fire crosses the room.",
      counterplay: "Close the valve.",
    },
  ],
  neighborhoodHazards: [
    { neighborhoodId: "dungeon", hazardName: "Falling Net", weight: 2 },
    { neighborhoodId: "dungeon", hazardName: "Fire Jet", weight: 3 },
  ],
});

describe("selectRoomHazard", () => {
  it.each([
    ["shallow", 1, 11, "Falling Net"],
    ["shallow", 8, 11, "Falling Net"],
    ["shallow", 9, 11, "Fire Jet"],
    ["shallow", 11, 11, "Fire Jet"],
    ["middle", 1, 10, "Falling Net"],
    ["middle", 4, 10, "Falling Net"],
    ["middle", 5, 10, "Fire Jet"],
    ["middle", 10, 10, "Fire Jet"],
    ["deep", 1, 14, "Falling Net"],
    ["deep", 2, 14, "Falling Net"],
    ["deep", 3, 14, "Fire Jet"],
    ["deep", 14, 14, "Fire Jet"],
    ["extreme", 1, 20, "Falling Net"],
    ["extreme", 2, 20, "Falling Net"],
    ["extreme", 3, 20, "Fire Jet"],
    ["extreme", 20, 20, "Fire Jet"],
  ] as const)("maps %s roll %i of %i to %s", (depthBand, selectedRoll, totalWeight, expected) => {
    const rng = { integer: vi.fn(() => selectedRoll) };
    const result = selectRoomHazard({
      catalog: CATALOG,
      neighborhoodId: "dungeon",
      depthBand,
      rng,
    });
    expect(result).toEqual({
      hazard: CATALOG.hazards.find((hazard) => hazard.name === expected),
      roll: selectedRoll,
      totalWeight,
    });
    expect(rng.integer).toHaveBeenCalledOnce();
    expect(rng.integer).toHaveBeenCalledWith(1, totalWeight);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("is deterministic, preserves catalog order, and does not mutate the catalog", () => {
    const snapshot = structuredClone(CATALOG);
    const first = selectRoomHazard({
      catalog: CATALOG,
      neighborhoodId: "dungeon",
      depthBand: "shallow",
      rng: new RandomGenerator(1616),
    });
    const second = selectRoomHazard({
      catalog: CATALOG,
      neighborhoodId: "dungeon",
      depthBand: "shallow",
      rng: new RandomGenerator(1616),
    });
    expect(first).toEqual(second);
    expect(CATALOG).toEqual(snapshot);
  });

  it("rejects a neighborhood with no eligible hazard membership", () => {
    expect(() =>
      selectRoomHazard({
        catalog: CATALOG,
        neighborhoodId: "missing",
        depthBand: "shallow",
        rng: new RandomGenerator(1),
      }),
    ).toThrow(RoomGenerationError);
  });
});

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
