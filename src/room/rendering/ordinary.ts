import type { OrdinaryEncounterResult } from "../../encounter/generation/types.js";
import type { OrdinaryRoom } from "../types.js";
import { RoomRenderingError } from "./errors.js";

/** Renders every production-visible ordinary-room field currently represented by the room model. */
export function renderOrdinaryRoom(room: OrdinaryRoom): string {
  if (room.kind === "long-corridor") {
    throw new RoomRenderingError(
      "UNSUPPORTED_LONG_CORRIDOR",
      "Long Corridor rendering requires the dedicated corridor geometry model.",
    );
  }

  const lines = [
    "=========================================",
    room.title,
    "=========================================",
    "",
    "READ ALOUD",
    "==========",
    "",
    room.arrival,
    "",
    room.doorway,
    "",
    "When you open it...",
    "",
    `You enter ${room.environment.description}.`,
    "",
  ];

  if (room.subtheme !== undefined && room.subtheme.description.length > 0) {
    lines.push(room.subtheme.description, "");
  }
  for (const category of room.atmosphere.order) {
    lines.push(room.atmosphere[category], "");
  }
  lines.push(room.architecture, "");
  for (const feature of room.features) lines.push(feature.description, "");

  lines.push("DM NOTES", "========", "", "Interactive Objects", "-------------------");
  for (const feature of room.features) lines.push(`  • ${feature.name}: ${feature.interaction}`);
  lines.push(
    "",
    `Environment: ${room.environment.name}`,
    `Neighborhood: ${room.neighborhood.name}`,
  );
  if (room.kind === "signature") lines.push("Room Type: Signature Room");
  else if (room.subtheme !== undefined) lines.push(`Subtheme: ${room.subtheme.name}`);
  lines.push(
    `Dungeon Depth: ${capitalize(room.depthBand)} (room ${room.roomNumber})`,
    `Room Difficulty: ${capitalize(room.difficulty)}`,
    "",
  );

  if (room.encounter !== undefined) lines.push(...renderRoomEncounter(room.encounter), "");
  lines.push("EXITS", "=====", "");
  for (const exit of room.exits) {
    lines.push(exit.name, "-".repeat(exit.name.length), exit.description, "");
  }

  return `${lines.join("\n")}\n`;
}

function renderRoomEncounter(encounter: OrdinaryEncounterResult): readonly string[] {
  const lines = [
    "ENCOUNTER",
    "=========",
    `Monster Group: ${encounter.family.name}`,
    `XP Budget: ${encounter.xpBudget} XP`,
    `${encounter.family.name} — ${encounter.formation.name}`,
    `Behavior: ${encounter.behaviorState.behavior.title} — ${encounter.behaviorState.behavior.description}`,
  ];
  const alertness = encounter.behaviorState.alertnessModifier;
  if (alertness !== undefined && alertness !== 0) {
    lines.push(`Alertness: ${alertness > 0 ? "+" : ""}${alertness}`);
  }
  lines.push(`Disposition: ${encounter.behaviorState.disposition.description}`);
  for (const entry of encounter.entries) {
    lines.push(
      `  • ${entry.count} × ${entry.monster.name} (CR ${entry.monster.cr}, ${entry.monster.xp * entry.count} XP)`,
    );
  }
  lines.push(`Total: ${encounter.xpSpent} XP`);
  return lines;
}

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
