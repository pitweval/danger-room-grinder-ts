import { describe, expect, it, vi } from "vitest";

import type { FamilyCatalog, MonsterDefinition } from "../../../src/content/index.js";
import { createParty } from "../../../src/encounter/index.js";
import {
  generateOrdinaryRoom,
  renderOrdinaryRoom,
  RoomRenderingError,
  suggestedSkillDcsForDifficulty,
} from "../../../src/room/index.js";
import { TEST_BEHAVIOR_CATALOG } from "../../encounter/behavior/fixtures.js";
import { monster, monsterCatalog } from "../../encounter/monsters/fixtures.js";
import { ROOM_CATALOG } from "../fixtures.js";

const FAMILIES: FamilyCatalog = Object.freeze({
  families: Object.freeze([
    { id: "goblinoids", name: "Goblinoids", familyType: "PRIMARY", description: "Goblinoids." },
  ]),
});

describe("renderOrdinaryRoom", () => {
  it("renders the complete supported ordinary-room layout with its shortened encounter", () => {
    const { room, rng } = generated(
      [10, 1, 1, 2, 1, 2, 2, 1, 1, 1, 1, 4, 1, 11, 6, 3],
      monster("goblin", { xp: 50, roles: ["minion"], families: ["goblinoids"] }),
    );
    const draws = rng.integer.mock.calls.length;
    const expected = text(
      "=========================================",
      "Dungeon Room 1",
      "=========================================",
      "",
      "READ ALOUD",
      "==========",
      "",
      "Three steps rise.",
      "",
      "An oak door waits.",
      "",
      "When you open it...",
      "",
      "You enter a fortified guard post.",
      "",
      "Crates crowd the walls.",
      "",
      "Wood creaks.",
      "",
      "Dust hangs in the air.",
      "",
      "One lamp gutters.",
      "",
      "Shelves bow under dust.",
      "",
      "A brazier glows.",
      "",
      "Crates fill an alcove.",
      "",
      "DM NOTES",
      "========",
      "",
      "Interactive Objects",
      "-------------------",
      "  • Brazier: It can be overturned.",
      "  • Crates: They provide cover.",
      "",
      "Environment: Guard Post",
      "Neighborhood: Subterranean Dungeon",
      "Subtheme: Forgotten Stores",
      "Dungeon Depth: Shallow (room 1)",
      "Room Difficulty: Low",
      "",
      "OPTIONAL HAZARD",
      "===============",
      "Falling Net (nuisance)",
      "Trigger: A trip wire releases a net.",
      "Effect: The net restrains creatures beneath it.",
      "Counterplay: Spot the wire or cut the net.",
      "",
      "ENCOUNTER",
      "=========",
      "Monster Group: Goblinoids",
      "XP Budget: 300 XP",
      "Goblinoids — Swarm",
      "Behavior: Keeping watch — They watch the approaches.",
      "Alertness: +1",
      "Disposition: Aggressive",
      "  • 6 × goblin (CR 1/2, 300 XP)",
      "Total: 300 XP",
      "",
      "SUGGESTED SKILL DCs",
      "===================",
      "",
      "Easy:                 5",
      "Moderate:            10",
      "Hard:                15",
      "Very Hard:           20",
      "Nearly Impossible:   25",
      "",
      "EXITS",
      "=====",
      "",
      "South",
      "-----",
      "A passage runs south.",
      "",
      "East",
      "----",
      "A passage runs east.",
      "",
      "North",
      "-----",
      "A passage runs north.",
      "",
    );

    expect(renderOrdinaryRoom(room)).toBe(expected);
    expect(rng.integer).toHaveBeenCalledTimes(draws);
    expect(renderOrdinaryRoom(room).endsWith("\n\n")).toBe(true);
  });

  it("renders a signature room without subtheme or encounter placeholders", () => {
    const { room } = generated([10, 1, 1, 1, 1, 1, 1, 6, 1, 1], undefined, false);
    expect(renderOrdinaryRoom(room)).toBe(
      text(
        "=========================================",
        "Dungeon Room 1",
        "=========================================",
        "",
        "READ ALOUD",
        "==========",
        "",
        "The passage narrows.",
        "",
        "An oak door waits.",
        "",
        "When you open it...",
        "",
        "You enter a chamber with impossible geometry.",
        "",
        "Ozone sharpens the air.",
        "",
        "Sounds arrive early.",
        "",
        "White light outlines every edge.",
        "",
        "A blood trail crosses three surfaces.",
        "",
        "An arch turns.",
        "",
        "A frame folds space.",
        "",
        "DM NOTES",
        "========",
        "",
        "Interactive Objects",
        "-------------------",
        "  • Turning Arch: It rotates gravity.",
        "  • Tesseract: It links corners.",
        "",
        "Environment: Impossible Geometry",
        "Neighborhood: Subterranean Dungeon",
        "Room Type: Signature Room",
        "Dungeon Depth: Shallow (room 1)",
        "Room Difficulty: Low",
        "",
        "OPTIONAL HAZARD",
        "===============",
        "Falling Net (nuisance)",
        "Trigger: A trip wire releases a net.",
        "Effect: The net restrains creatures beneath it.",
        "Counterplay: Spot the wire or cut the net.",
        "",
        "SUGGESTED SKILL DCs",
        "===================",
        "",
        "Easy:                 5",
        "Moderate:            10",
        "Hard:                15",
        "Very Hard:           20",
        "Nearly Impossible:   25",
        "",
        "EXITS",
        "=====",
        "",
        "North",
        "-----",
        "A passage runs north.",
        "",
        "West",
        "----",
        "A passage runs west.",
        "",
        "South",
        "-----",
        "A passage runs south.",
        "",
      ),
    );
  });

  it("preserves all six stored atmosphere orders", () => {
    const { room } = generated([10, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1], undefined, false);
    const orders = [
      ["lighting", "sound", "smell"],
      ["lighting", "smell", "sound"],
      ["sound", "lighting", "smell"],
      ["sound", "smell", "lighting"],
      ["smell", "lighting", "sound"],
      ["smell", "sound", "lighting"],
    ] as const;
    for (const order of orders) {
      const candidate = Object.freeze({
        ...room,
        atmosphere: Object.freeze({ ...room.atmosphere, order: Object.freeze([...order]) }),
      });
      const output = renderOrdinaryRoom(candidate);
      const positions = order.map((key) => output.indexOf(candidate.atmosphere[key]));
      expect(positions).toEqual([...positions].sort((left, right) => left - right));
    }
  });

  it("omits the complete hazard section when hazard presence is disabled", () => {
    const { room } = generated(
      [10, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1],
      undefined,
      false,
      ROOM_CATALOG,
      false,
    );
    expect(room.hazard).toBeUndefined();
    expect(renderOrdinaryRoom(room)).not.toContain("OPTIONAL HAZARD");
  });

  it("renders the exact moderate and high blocks for encounter-free signature state", () => {
    const { room } = generated([10, 1, 1, 1, 1, 1, 1, 6, 1, 1], undefined, false);
    const moderate = Object.freeze({
      ...room,
      difficulty: "moderate" as const,
      suggestedSkillDcs: suggestedSkillDcsForDifficulty("moderate"),
    });
    expect(skillDcBlock(renderOrdinaryRoom(moderate))).toBe(
      text(
        "SUGGESTED SKILL DCs",
        "===================",
        "",
        "Easy:                10",
        "Moderate:            15",
        "Hard:                20",
        "Very Hard:           25",
        "Nearly Impossible:   30*",
        "",
        "* In DRG, a natural 20 always succeeds, even against a DC 30.",
        "",
      ),
    );
    const high = Object.freeze({
      ...room,
      difficulty: "high" as const,
      suggestedSkillDcs: suggestedSkillDcsForDifficulty("high"),
    });
    expect(skillDcBlock(renderOrdinaryRoom(high))).toBe(
      text(
        "SUGGESTED SKILL DCs",
        "===================",
        "",
        "Easy:        15",
        "Moderate:    20",
        "Hard:        25",
        "Very Hard:   30*",
        "",
        "* In DRG, a natural 20 always succeeds, even against a DC 30.",
        "",
      ),
    );
  });

  it("renders single and partial-budget encounters while suppressing zero alertness", () => {
    const priest = namedMonster("priest", "Priest", {
      cr: "2",
      xp: 300,
      roles: ["minion"],
      families: ["goblinoids"],
    });
    const single = generated([10, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], priest).room;
    const singleBlock = encounterBlock(renderOrdinaryRoom(single));
    expect(singleBlock).toBe(
      text(
        "ENCOUNTER",
        "=========",
        "Monster Group: Goblinoids",
        "XP Budget: 300 XP",
        "Goblinoids — Swarm",
        "Behavior: Working — They tend to their objective.",
        "Disposition: Neutral",
        "  • 1 × Priest (CR 2, 300 XP)",
        "Total: 300 XP",
        "",
      ),
    );

    const frontLineCatalog = Object.freeze({
      ...ROOM_CATALOG,
      depthFormations: Object.freeze([
        { depthBand: "shallow", neighborhoodId: "*", value: "front_line", weight: 1 },
      ]),
    });
    const kobold = namedMonster("kobold", "Kobold", {
      cr: "1/8",
      xp: 25,
      roles: ["minion"],
      families: ["goblinoids"],
    });
    const partial = generated(
      [10, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      kobold,
      true,
      frontLineCatalog,
    ).room;
    expect(encounterBlock(renderOrdinaryRoom(partial))).toContain(
      "  • 10 × Kobold (CR 1/8, 250 XP)\nTotal: 250 XP\n",
    );
  });

  it("does not mutate the room and rejects unsupported Long Corridors", () => {
    const { room } = generated([10, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1], undefined, false);
    const snapshot = structuredClone(room);
    renderOrdinaryRoom(room);
    expect(room).toEqual(snapshot);
    const corridor = Object.freeze({ ...room, kind: "long-corridor" as const });
    expect(() => renderOrdinaryRoom(corridor)).toThrow(RoomRenderingError);
    expect(() => renderOrdinaryRoom(corridor)).toThrow(/dedicated corridor geometry/);
  });
});

function generated(
  rolls: readonly number[],
  selectedMonster?: MonsterDefinition,
  includeEncounter = true,
  roomCatalog = ROOM_CATALOG,
  includeHazard = true,
) {
  let index = 0;
  const rng = {
    integer: vi.fn((minimum: number, maximum: number) => {
      const value = rolls[index++];
      if (value === undefined) throw new Error(`Unexpected RNG draw ${index}.`);
      if (value < minimum || value > maximum)
        throw new Error(`Fixture roll ${value} is outside ${minimum}-${maximum}.`);
      return value;
    }),
  };
  return {
    room: generateOrdinaryRoom({
      roomNumber: 1,
      party: createParty(6, 1),
      roomCatalog,
      monsterCatalog: monsterCatalog(
        selectedMonster ??
          monster("goblin", { xp: 50, roles: ["minion"], families: ["goblinoids"] }),
      ),
      familyCatalog: FAMILIES,
      behaviorCatalog: TEST_BEHAVIOR_CATALOG,
      rng,
      includeEncounter,
      includeHazard,
    }),
    rng,
  };
}

function namedMonster(
  id: string,
  name: string,
  overrides: Parameters<typeof monster>[1],
): MonsterDefinition {
  return Object.freeze({ ...monster(id, overrides), name });
}

function encounterBlock(output: string): string {
  return `${output.split("ENCOUNTER\n")[1]?.split("SUGGESTED SKILL DCs\n")[0] === undefined ? "" : `ENCOUNTER\n${output.split("ENCOUNTER\n")[1]?.split("SUGGESTED SKILL DCs\n")[0]}`}`;
}

function skillDcBlock(output: string): string {
  const block = output.split("SUGGESTED SKILL DCs\n")[1]?.split("EXITS\n")[0];
  return block === undefined ? "" : `SUGGESTED SKILL DCs\n${block}`;
}

function text(...lines: readonly string[]): string {
  return `${lines.join("\n")}\n`;
}
