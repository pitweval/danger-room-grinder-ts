import { describe, expect, it } from "vitest";

import {
  applyCompletedRoomToProgression,
  createCampaignProgression,
  levelForCampaignXp,
} from "../../../src/campaign/index.js";

describe("active Bash progression parity fixtures", () => {
  it.each([
    [1, 1_799, 6, 1],
    [1, 1_800, 6, 2],
    [1, 5_399, 6, 2],
    [1, 5_400, 6, 3],
    [1, 40_000, 6, 5],
    [3, 0, 4, 3],
    [3, 7_199, 4, 3],
    [3, 7_200, 4, 4],
  ])("matches progression_effective_level(%i, %i, %i) = %i", (startingLevel, xp, size, level) => {
    expect(levelForCampaignXp({ startingLevel, accumulatedXp: xp, partySize: size })).toBe(level);
  });

  it("matches Bash room completion for actual, empty, and duplicate awards", () => {
    const initial = createCampaignProgression();
    const first = applyCompletedRoomToProgression(initial, {
      roomNumber: 1,
      encounter: { xpSpent: 450 },
    });
    const second = applyCompletedRoomToProgression(first.state, {
      roomNumber: 2,
      encounter: undefined,
    });
    const third = applyCompletedRoomToProgression(second.state, {
      roomNumber: 3,
      encounter: { xpSpent: 1_350 },
    });
    const duplicate = applyCompletedRoomToProgression(third.state, {
      roomNumber: 3,
      encounter: { xpSpent: 1_350 },
    });
    expect(first.state).toMatchObject({ accumulatedXp: 450, lastCompletedRoomNumber: 1 });
    expect(second.state).toMatchObject({ accumulatedXp: 450, lastCompletedRoomNumber: 2 });
    expect(third.state).toMatchObject({ accumulatedXp: 1_800, currentLevel: 2 });
    expect(duplicate.state).toBe(third.state);
  });
});
