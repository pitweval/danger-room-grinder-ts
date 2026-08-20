import { describe, expect, it, vi } from "vitest";

import type {
  EncounterBehaviorCatalog,
  FamilyCatalog,
  FamilyDefinition,
  MonsterDefinition,
} from "../../../src/content/index.js";
import {
  createParty,
  generateOrdinaryEncounter,
  renderOrdinaryEncounter,
} from "../../../src/encounter/index.js";
import { monster, monsterCatalog } from "../monsters/fixtures.js";

const FAMILY: FamilyDefinition = Object.freeze({
  id: "test_family",
  name: "Test Family",
  familyType: "PRIMARY",
  description: "Renderer fixture family.",
});

const FAMILIES: FamilyCatalog = Object.freeze({ families: Object.freeze([FAMILY]) });

const BEHAVIORS: EncounterBehaviorCatalog = Object.freeze({
  behaviors: Object.freeze([
    behavior(1, 5, "Working the position", "They tend to their objective.", 0),
    behavior(6, 10, "Keeping watch", "They watch the approaches.", 1),
    behavior(11, 15, "Distracted", "They are focused elsewhere.", -1),
    behavior(16, 20, "Resting", "They have paused their activity.", undefined),
  ]),
  dispositions: Object.freeze([
    disposition(1, 5, "neutral unless the party interferes."),
    disposition(6, 10, "aggressive toward intruders."),
    disposition(11, 15, "hostile but willing to parley."),
    disposition(16, 20, "immediately hostile and unwilling to negotiate."),
  ]),
});

describe("renderOrdinaryEncounter", () => {
  it("renders the complete single-creature Bash layout and suppresses zero alertness", () => {
    const priest = namedMonster("priest", "Priest", {
      cr: "2",
      xp: 450,
      roles: ["soldier"],
    });
    const { encounter, rng } = generated([10, 1, 9, 1, 1], priest);

    const expected = text(
      "DANGER ROOM GRINDER — ENCOUNTER",
      "================================",
      "Party:       6 characters, level 1",
      "Rolls:       Threat 10 | Family 1 | Composition 9 | Behavior 1 | Disposition 1",
      "Difficulty:  Moderate",
      "XP Budget:   450 XP",
      "Family:      Test Family",
      "Formation:   Front line",
      "Behavior:    Working the position — They tend to their objective.",
      "Disposition: neutral unless the party interferes.",
      "",
      "Encounter:",
      monsterLine(1, priest),
      "",
      "Total: 450 XP | Unspent: 0 XP | Creatures: 1",
    );

    const drawsBeforeRendering = rng.integer.mock.calls.length;
    expect(renderOrdinaryEncounter(encounter)).toBe(expected);
    expect(renderOrdinaryEncounter(encounter).endsWith("\n")).toBe(true);
    expect(renderOrdinaryEncounter(encounter).endsWith("\n\n")).toBe(false);
    expect(rng.integer).toHaveBeenCalledTimes(drawsBeforeRendering);
  });

  it("renders an aggregated multi-species roster in monster-catalog order", () => {
    const bugbear = namedMonster("bugbear", "Bugbear", {
      cr: "1",
      xp: 200,
      roles: ["soldier"],
    });
    const goblin = namedMonster("goblin", "Goblin", {
      cr: "1/4",
      xp: 50,
      roles: ["minion"],
    });
    const hobgoblin = namedMonster("hobgoblin", "Hobgoblin", {
      cr: "1/2",
      xp: 100,
      roles: ["soldier", "minion"],
    });
    const { encounter } = generated([10, 1, 9, 6, 6], bugbear, goblin, hobgoblin);

    expect(renderOrdinaryEncounter(encounter)).toBe(
      text(
        "DANGER ROOM GRINDER — ENCOUNTER",
        "================================",
        "Party:       6 characters, level 1",
        "Rolls:       Threat 10 | Family 1 | Composition 9 | Behavior 6 | Disposition 6",
        "Difficulty:  Moderate",
        "XP Budget:   450 XP",
        "Family:      Test Family",
        "Formation:   Front line",
        "Behavior:    Keeping watch — They watch the approaches.",
        "Alertness:   +1",
        "Disposition: aggressive toward intruders.",
        "",
        "Encounter:",
        monsterLine(1, bugbear),
        monsterLine(1, goblin),
        monsterLine(2, hobgoblin),
        "",
        "Total: 450 XP | Unspent: 0 XP | Creatures: 4",
      ),
    );
  });

  it("renders a large repeated roster, a partial budget, and negative alertness", () => {
    const kobold = namedMonster("kobold", "Kobold", {
      cr: "1/8",
      xp: 25,
      roles: ["minion"],
    });
    const { encounter } = generated([1, 1, 9, 11, 11], kobold);

    expect(renderOrdinaryEncounter(encounter)).toBe(
      text(
        "DANGER ROOM GRINDER — ENCOUNTER",
        "================================",
        "Party:       6 characters, level 1",
        "Rolls:       Threat 1 | Family 1 | Composition 9 | Behavior 11 | Disposition 11",
        "Difficulty:  Low",
        "XP Budget:   300 XP",
        "Family:      Test Family",
        "Formation:   Front line",
        "Behavior:    Distracted — They are focused elsewhere.",
        "Alertness:   -1",
        "Disposition: hostile but willing to parley.",
        "",
        "Encounter:",
        monsterLine(10, kobold),
        "",
        "Total: 250 XP | Unspent: 50 XP | Creatures: 10",
      ),
    );
  });

  it("keeps zero-XP creatures visible and suppresses an absent alertness modifier", () => {
    const vermin = namedMonster("vermin", "Harmless Vermin", {
      cr: "0",
      xp: 0,
      roles: ["minion"],
    });
    const { encounter } = generated([1, 1, 1, 16, 16], vermin, 1);

    expect(renderOrdinaryEncounter(encounter)).toBe(
      text(
        "DANGER ROOM GRINDER — ENCOUNTER",
        "================================",
        "Party:       1 characters, level 1",
        "Rolls:       Threat 1 | Family 1 | Composition 1 | Behavior 16 | Disposition 16",
        "Difficulty:  Low",
        "XP Budget:   50 XP",
        "Family:      Test Family",
        "Formation:   Swarm",
        "Behavior:    Resting — They have paused their activity.",
        "Disposition: immediately hostile and unwilling to negotiate.",
        "",
        "Encounter:",
        monsterLine(12, vermin),
        "",
        "Total: 0 XP | Unspent: 50 XP | Creatures: 12",
      ),
    );
  });

  it("does not mutate the structured encounter or expose internal diagnostics", () => {
    const guard = namedMonster("guard", "Guard", { xp: 50, roles: ["minion"] });
    const { encounter } = generated([1, 1, 1, 1, 1], guard, 1);
    const snapshot = structuredClone(encounter);

    const rendered = renderOrdinaryEncounter(encounter);

    expect(encounter).toEqual(snapshot);
    expect(rendered).not.toContain("familyAttempts");
    expect(rendered).not.toContain("formationExecution");
    expect(rendered).not.toContain("source");
    expect(rendered).not.toContain("notes");
    expect(rendered).not.toContain("Environment:");
  });

  it("marks selection rolls unavailable when explicit selectors consumed no RNG", () => {
    const guard = namedMonster("guard", "Guard", { xp: 50, roles: ["minion"] });
    let index = 0;
    const rolls = [1, 1, 1] as const;
    const encounter = generateOrdinaryEncounter({
      party: createParty(1, 1),
      monsterCatalog: monsterCatalog(guard),
      familyCatalog: FAMILIES,
      behaviorCatalog: BEHAVIORS,
      requestedFamily: FAMILY.id,
      requestedFormation: "swarm",
      rng: { integer: () => rolls[index++] as number },
    });

    expect(renderOrdinaryEncounter(encounter)).toContain(
      "Rolls:       Threat 1 | Family - | Composition - | Behavior 1 | Disposition 1\n",
    );
  });
});

function behavior(
  rollMinimum: number,
  rollMaximum: number,
  title: string,
  description: string,
  alertnessModifier: number | undefined,
) {
  return Object.freeze({
    selectorKind: "type" as const,
    selector: "Humanoid",
    rollMinimum,
    rollMaximum,
    key: title.toLowerCase().replaceAll(" ", "_"),
    title,
    description,
    requirements: Object.freeze([]),
    preferredEnvironments: Object.freeze([]),
    alertnessModifier,
  });
}

function disposition(rollMinimum: number, rollMaximum: number, description: string) {
  return Object.freeze({ rollMinimum, rollMaximum, description });
}

function namedMonster(
  id: string,
  name: string,
  overrides: Parameters<typeof monster>[1],
): MonsterDefinition {
  return Object.freeze({ ...monster(id, { ...overrides, families: [FAMILY.id] }), name });
}

function generated(rolls: readonly number[], ...values: readonly (MonsterDefinition | number)[]) {
  const mutableValues = [...values];
  const partySize = typeof mutableValues.at(-1) === "number" ? (mutableValues.pop() as number) : 6;
  const monsters = mutableValues as MonsterDefinition[];
  let index = 0;
  const rng = {
    integer: vi.fn((minimum: number, maximum: number): number => {
      const roll = rolls[index];
      if (roll === undefined) throw new Error(`Unexpected RNG draw ${index + 1}.`);
      expect(roll).toBeGreaterThanOrEqual(minimum);
      expect(roll).toBeLessThanOrEqual(maximum);
      index += 1;
      return roll;
    }),
  };
  return {
    encounter: generateOrdinaryEncounter({
      party: createParty(partySize, 1),
      monsterCatalog: monsterCatalog(...monsters),
      familyCatalog: FAMILIES,
      behaviorCatalog: BEHAVIORS,
      rng,
    }),
    rng,
  };
}

function monsterLine(count: number, value: MonsterDefinition): string {
  return `  ${String(count).padStart(2)} × ${value.name.padEnd(24)} CR ${value.cr.padEnd(5)} (${value.xp * count} XP)`;
}

function text(...lines: readonly string[]): string {
  return `${lines.join("\n")}\n`;
}
