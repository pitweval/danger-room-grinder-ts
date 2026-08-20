import type { OrdinaryEncounterResult } from "../generation/types.js";

const DIFFICULTY_LABELS = Object.freeze({
  low: "Low",
  moderate: "Moderate",
  high: "High",
});

/** Renders an ordinary encounter using the active Bash engine's plain-text layout. */
export function renderOrdinaryEncounter(encounter: OrdinaryEncounterResult): string {
  const familyRoll = encounter.selectionRolls.family ?? "-";
  const formationRoll = encounter.selectionRolls.formation ?? "-";
  const lines = [
    "DANGER ROOM GRINDER — ENCOUNTER",
    "================================",
    `Party:       ${encounter.party.characterCount} characters, level ${encounter.party.characterLevel}`,
    `Rolls:       Threat ${encounter.threat.roll} | Family ${familyRoll} | Composition ${formationRoll} | Behavior ${encounter.behaviorState.rolls.behavior} | Disposition ${encounter.behaviorState.rolls.disposition}`,
    `Difficulty:  ${DIFFICULTY_LABELS[encounter.difficulty]}`,
    `XP Budget:   ${encounter.xpBudget} XP`,
    `Family:      ${encounter.family.name}`,
    `Formation:   ${encounter.formation.name}`,
    `Behavior:    ${encounter.behaviorState.behavior.title} — ${encounter.behaviorState.behavior.description}`,
  ];

  const alertnessModifier = encounter.behaviorState.alertnessModifier;
  if (alertnessModifier !== undefined && alertnessModifier !== 0) {
    lines.push(`Alertness:   ${alertnessModifier > 0 ? "+" : ""}${alertnessModifier}`);
  }

  lines.push(`Disposition: ${encounter.behaviorState.disposition.description}`, "", "Encounter:");
  for (const entry of encounter.entries) {
    lines.push(
      `  ${String(entry.count).padStart(2)} × ${entry.monster.name.padEnd(24)} CR ${entry.monster.cr.padEnd(5)} (${entry.monster.xp * entry.count} XP)`,
    );
  }
  lines.push(
    "",
    `Total: ${encounter.xpSpent} XP | Unspent: ${encounter.xpRemaining} XP | Creatures: ${encounter.creatureCount}`,
  );

  return `${lines.join("\n")}\n`;
}
