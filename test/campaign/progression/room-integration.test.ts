import { describe, expect, it } from "vitest";

import {
  applyCompletedRoomToProgression,
  createCampaignProgression,
} from "../../../src/campaign/index.js";
import type { FamilyCatalog } from "../../../src/content/index.js";
import { createParty } from "../../../src/encounter/index.js";
import { RandomGenerator } from "../../../src/rng/index.js";
import {
  garyCluePhaseFor,
  generateOrdinaryRoom,
  renderOrdinaryRoom,
} from "../../../src/room/index.js";
import { TEST_BEHAVIOR_CATALOG } from "../../encounter/behavior/fixtures.js";
import { monster, monsterCatalog } from "../../encounter/monsters/fixtures.js";
import {
  GARY_CLUE_CATALOG,
  ROOM_CATALOG,
  TREASURE_CATALOG,
  VISITOR_CATALOG,
} from "../../room/fixtures.js";

const FAMILIES: FamilyCatalog = Object.freeze({
  families: Object.freeze([
    { id: "goblinoids", name: "Goblinoids", familyType: "PRIMARY", description: "Goblinoids." },
  ]),
});
const MONSTERS = monsterCatalog(
  monster("goblin", { xp: 50, roles: ["minion"], families: ["goblinoids"] }),
);

describe("campaign progression room integration boundary", () => {
  it("uses the pre-room level for encounter and treasure, then the new level for the next room", () => {
    let state = createCampaignProgression();
    let levelUp;
    let triggeringRoom;
    let triggeringRoomNumber = 0;

    for (let roomNumber = 1; roomNumber <= 10; roomNumber += 1) {
      const room = generateCampaignRoom(roomNumber, state.currentLevel, levelUp);
      expect(room.encounter?.party.characterLevel).toBe(state.currentLevel);
      const transition = applyCompletedRoomToProgression(state, room);
      state = transition.state;
      levelUp = transition.levelUp;
      if (levelUp !== undefined) {
        triggeringRoom = room;
        triggeringRoomNumber = roomNumber;
        break;
      }
    }

    expect(triggeringRoom).toBeDefined();
    expect(triggeringRoom?.encounter?.party.characterLevel).toBe(1);
    expect(state.currentLevel).toBe(2);

    const nextRoom = generateCampaignRoom(triggeringRoomNumber + 1, state.currentLevel, levelUp);
    const sameNextRoomAtOldLevel = generateCampaignRoom(triggeringRoomNumber + 1, 1, undefined);
    expect(nextRoom.encounter?.party.characterLevel).toBe(2);
    expect(nextRoom.levelUp?.toLevel).toBe(2);
    expect(nextRoom.treasure.valuables.gpValue).toBeGreaterThan(
      sameNextRoomAtOldLevel.treasure.valuables.gpValue,
    );
    expect(renderOrdinaryRoom(nextRoom)).toContain("LEVEL UP\n========\n");
  });

  it("keeps completion numbering compatible with clue and visitor histories", () => {
    const state = applyCompletedRoomToProgression(createCampaignProgression(), {
      roomNumber: 7,
      encounter: undefined,
    }).state;
    const nextRoomNumber = state.lastCompletedRoomNumber + 1;
    const room = generateOrdinaryRoom({
      ...campaignRoomOptions(nextRoomNumber, state.currentLevel),
      garyClueHistory: { campaignSeed: 21, recentSelections: [] },
      visitorHistory: { campaignSeed: 21, appearances: [] },
    });
    expect(nextRoomNumber).toBe(8);
    expect(room.roomNumber).toBe(8);
    expect(garyCluePhaseFor(21, room.roomNumber)).toBe(5);
    expect(room.recurringVisitor.reason).not.toBe("standalone");
  });
});

function generateCampaignRoom(
  roomNumber: number,
  level: number,
  levelUp: ReturnType<typeof applyCompletedRoomToProgression>["levelUp"],
) {
  return generateOrdinaryRoom({
    ...campaignRoomOptions(roomNumber, level),
    ...(levelUp === undefined ? {} : { levelUp }),
  });
}

function campaignRoomOptions(roomNumber: number, level: number) {
  return {
    roomNumber,
    party: createParty(6, level),
    roomCatalog: ROOM_CATALOG,
    monsterCatalog: MONSTERS,
    familyCatalog: FAMILIES,
    behaviorCatalog: TEST_BEHAVIOR_CATALOG,
    rng: new RandomGenerator(21_000 + roomNumber),
    roomSeed: 21_000 + roomNumber,
    treasureCatalog: TREASURE_CATALOG,
    garyClueCatalog: GARY_CLUE_CATALOG,
    visitorCatalog: VISITOR_CATALOG,
    requestedDifficulty: "high" as const,
    requestedFamily: "goblinoids",
    requestedFormation: "swarm",
  };
}
