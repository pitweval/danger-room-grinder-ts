import { describe, expect, it } from "vitest";

import {
  applyCompletedRoomToProgression,
  CAMPAIGN_XP_THRESHOLDS,
  campaignXpThresholdForLevel,
  CampaignProgressionError,
  createCampaignProgression,
  levelForCampaignXp,
} from "../../../src/campaign/index.js";

describe("campaign XP thresholds and level calculation", () => {
  it("ports the exact active Bash cumulative table", () => {
    expect(CAMPAIGN_XP_THRESHOLDS).toEqual([
      0, 300, 900, 2_700, 6_500, 14_000, 23_000, 34_000, 48_000, 64_000, 85_000, 100_000, 120_000,
      140_000, 165_000, 195_000, 225_000, 265_000, 305_000, 355_000,
    ]);
    expect(Object.isFrozen(CAMPAIGN_XP_THRESHOLDS)).toBe(true);
  });

  it.each(CAMPAIGN_XP_THRESHOLDS.map((threshold, index) => [index + 1, threshold]))(
    "returns the level-%i threshold %i",
    (level, threshold) => expect(campaignXpThresholdForLevel(level)).toBe(threshold),
  );

  it.each(CAMPAIGN_XP_THRESHOLDS.slice(1).map((threshold, index) => [index + 2, threshold]))(
    "uses exact boundary behavior around level %i",
    (level, threshold) => {
      expect(
        levelForCampaignXp({ startingLevel: 1, accumulatedXp: threshold - 1, partySize: 1 }),
      ).toBe(level - 1);
      expect(levelForCampaignXp({ startingLevel: 1, accumulatedXp: threshold, partySize: 1 })).toBe(
        level,
      );
      expect(
        levelForCampaignXp({ startingLevel: 1, accumulatedXp: threshold + 1, partySize: 1 }),
      ).toBe(level);
    },
  );

  it("scales thresholds by party size from the configured starting-level baseline", () => {
    expect(levelForCampaignXp({ startingLevel: 1, accumulatedXp: 1_799, partySize: 6 })).toBe(1);
    expect(levelForCampaignXp({ startingLevel: 1, accumulatedXp: 1_800, partySize: 6 })).toBe(2);
    expect(levelForCampaignXp({ startingLevel: 3, accumulatedXp: 7_199, partySize: 4 })).toBe(3);
    expect(levelForCampaignXp({ startingLevel: 3, accumulatedXp: 7_200, partySize: 4 })).toBe(4);
  });

  it("caps level at 20 while continuing to accept and retain accumulated XP", () => {
    expect(levelForCampaignXp({ startingLevel: 1, accumulatedXp: 10_000_000, partySize: 10 })).toBe(
      20,
    );
    const state = createCampaignProgression({
      startingLevel: 20,
      partySize: 6,
      accumulatedXp: 1_000_000,
    });
    expect(state).toMatchObject({ currentLevel: 20, accumulatedXp: 1_000_000 });
  });
});

describe("campaign progression initialization", () => {
  it("creates the active Bash new-campaign defaults", () => {
    expect(createCampaignProgression()).toEqual({
      startingLevel: 1,
      partySize: 6,
      accumulatedXp: 0,
      currentLevel: 1,
      lastCompletedRoomNumber: 0,
    });
  });

  it("supports a configured higher-level campaign and consistent reconstruction", () => {
    expect(
      createCampaignProgression({
        startingLevel: 3,
        partySize: 4,
        accumulatedXp: 7_200,
        currentLevel: 4,
        lastCompletedRoomNumber: 8,
      }),
    ).toEqual({
      startingLevel: 3,
      partySize: 4,
      accumulatedXp: 7_200,
      currentLevel: 4,
      lastCompletedRoomNumber: 8,
    });
  });

  it.each([
    [{ startingLevel: 0 }, "startingLevel"],
    [{ startingLevel: 21 }, "startingLevel"],
    [{ partySize: 0 }, "partySize"],
    [{ partySize: 11 }, "partySize"],
    [{ accumulatedXp: -1 }, "accumulatedXp"],
    [{ accumulatedXp: 1.5 }, "accumulatedXp"],
    [{ lastCompletedRoomNumber: -1 }, "lastCompletedRoomNumber"],
    [{ startingLevel: 1, partySize: 6, accumulatedXp: 1_800, currentLevel: 1 }, "currentLevel"],
  ] as const)("rejects invalid or inconsistent state %#", (options, field) => {
    expect(() => createCampaignProgression(options)).toThrow(CampaignProgressionError);
    try {
      createCampaignProgression(options);
    } catch (error) {
      expect(error).toMatchObject({ field });
    }
  });
});

describe("completed-room progression", () => {
  it("awards actual encounter XP rather than any external budget", () => {
    const transition = applyCompletedRoomToProgression(
      createCampaignProgression(),
      completedRoom(1, 250),
    );
    expect(transition).toMatchObject({
      applied: true,
      xpBefore: 0,
      xpAwarded: 250,
      xpAfter: 250,
      levelBefore: 1,
      levelAfter: 1,
    });
    expect(transition.state.accumulatedXp).toBe(250);
  });

  it("awards full-spend, zero-XP, and encounter-free rooms exactly", () => {
    const full = applyCompletedRoomToProgression(
      createCampaignProgression(),
      completedRoom(1, 300),
    );
    const zero = applyCompletedRoomToProgression(full.state, completedRoom(2, 0));
    const empty = applyCompletedRoomToProgression(zero.state, completedRoom(3));
    expect([full.xpAwarded, zero.xpAwarded, empty.xpAwarded]).toEqual([300, 0, 0]);
    expect(empty.state).toMatchObject({ accumulatedXp: 300, lastCompletedRoomNumber: 3 });
  });

  it("crosses one exact party threshold and records every level in a multi-level jump", () => {
    const exact = applyCompletedRoomToProgression(
      createCampaignProgression(),
      completedRoom(1, 1_800),
    );
    expect(exact.levelUp).toEqual({ fromLevel: 1, toLevel: 2, gainedLevels: [2] });

    const multiple = applyCompletedRoomToProgression(
      createCampaignProgression(),
      completedRoom(1, 40_000),
    );
    expect(multiple.levelUp).toEqual({
      fromLevel: 1,
      toLevel: 5,
      gainedLevels: [2, 3, 4, 5],
    });
  });

  it("advances to the supplied completed room and silently ignores repeated or older rooms", () => {
    const first = applyCompletedRoomToProgression(
      createCampaignProgression(),
      completedRoom(4, 100),
    );
    const repeated = applyCompletedRoomToProgression(first.state, completedRoom(4, 999));
    const older = applyCompletedRoomToProgression(first.state, completedRoom(3, 999));
    expect(first.state.lastCompletedRoomNumber).toBe(4);
    expect(repeated).toMatchObject({ applied: false, xpAwarded: 0, xpAfter: 100 });
    expect(older).toMatchObject({ applied: false, xpAwarded: 0, xpAfter: 100 });
    expect(repeated.state).toBe(first.state);
  });

  it("does not produce further notices at level 20 but keeps accumulating XP", () => {
    const state = createCampaignProgression({ startingLevel: 20, accumulatedXp: 50 });
    const transition = applyCompletedRoomToProgression(state, completedRoom(1, 500));
    expect(transition).toMatchObject({ xpAfter: 550, levelAfter: 20, levelUp: undefined });
  });

  it("is pure, does not mutate inputs, and deeply freezes transition metadata", () => {
    const state = createCampaignProgression();
    const room = completedRoom(1, 40_000);
    const stateSnapshot = structuredClone(state);
    const roomSnapshot = structuredClone(room);
    const transition = applyCompletedRoomToProgression(state, room);
    expect(state).toEqual(stateSnapshot);
    expect(room).toEqual(roomSnapshot);
    expect(Object.isFrozen(transition)).toBe(true);
    expect(Object.isFrozen(transition.state)).toBe(true);
    expect(Object.isFrozen(transition.levelUp)).toBe(true);
    expect(Object.isFrozen(transition.levelUp?.gainedLevels)).toBe(true);
  });

  it("rejects malformed room XP and unsafe accumulation", () => {
    expect(() =>
      applyCompletedRoomToProgression(createCampaignProgression(), completedRoom(-1, 0)),
    ).toThrow(CampaignProgressionError);
    expect(() =>
      applyCompletedRoomToProgression(createCampaignProgression(), completedRoom(1, -1)),
    ).toThrow(CampaignProgressionError);
    const nearLimit = createCampaignProgression({ accumulatedXp: Number.MAX_SAFE_INTEGER });
    expect(() => applyCompletedRoomToProgression(nearLimit, completedRoom(1, 1))).toThrow(
      CampaignProgressionError,
    );
  });
});

function completedRoom(roomNumber: number, xpSpent?: number) {
  return Object.freeze({
    roomNumber,
    encounter: xpSpent === undefined ? undefined : Object.freeze({ xpSpent }),
  });
}
