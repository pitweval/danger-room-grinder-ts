import type { MonsterRole } from "../../content/monsters/types.js";
import type { EncounterFormation } from "./types.js";

function slot(...roles: MonsterRole[]): readonly MonsterRole[] {
  return Object.freeze(roles);
}

function formation(
  id: string,
  name: string,
  roleSlots: EncounterFormation["roleSlots"],
  maxCreatures: number,
  rollMinimum: number,
  rollMaximum: number,
): EncounterFormation {
  return Object.freeze({
    id,
    name,
    roleSlots: Object.freeze(roleSlots),
    maxCreatures,
    rollMinimum,
    rollMaximum,
  });
}

const ORDINARY_FORMATIONS = Object.freeze([
  formation("swarm", "Swarm", [slot("minion")], 12, 1, 4),
  formation("skirmishers", "Skirmishers", [slot("skirmisher"), slot("minion")], 10, 5, 8),
  formation("front_line", "Front line", [slot("soldier"), slot("minion")], 10, 9, 12),
  formation("brute_support", "Brute with support", [slot("brute"), slot("minion")], 8, 13, 16),
  formation(
    "leader_guards",
    "Leader with guards",
    [slot("leader"), slot("soldier"), slot("minion")],
    8,
    17,
    19,
  ),
  formation(
    "mixed_force",
    "Mixed force",
    [slot("leader"), slot("brute"), slot("skirmisher"), slot("soldier"), slot("minion")],
    8,
    20,
    20,
  ),
]);

/** Returns the active ordinary Bash formation table in source order. */
export function getEligibleEncounterFormations(): readonly EncounterFormation[] {
  return ORDINARY_FORMATIONS;
}
