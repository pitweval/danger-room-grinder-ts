import type { RecurringVisitorPresentResult, SporkInventory } from "./types.js";

/** Renders the exact active recurring-visitor overlay for completed room context. */
export function renderRecurringVisitor(
  result: RecurringVisitorPresentResult,
  hasEncounter: boolean,
  hasHazard: boolean,
): string {
  return `${recurringVisitorLinesForRoom(result, hasEncounter, hasHazard).join("\n")}\n`;
}

/** @internal Lines used by the ordinary-room renderer without reparsing text. */
export function recurringVisitorLines(result: RecurringVisitorPresentResult): readonly string[] {
  const { visitor, scene, sporkInventory } = result.appearance;
  const lines = [
    "SPECIAL VISITOR",
    "===============",
    `Visitor: ${visitor.name}`,
    `Scene: ${scene.setup}`,
  ];
  lines.push(scene.description, `Dialogue: “${scene.dialogue}”`, `Outcome: ${scene.outcome}`);
  if (scene.reward !== undefined) lines.push(`Reward: ${scene.reward}`);
  if (scene.hook !== undefined) lines.push(`Hook: ${scene.hook}`);
  lines.push("");

  if (visitor.id === "spork") {
    if (scene.key.startsWith("lost-found-")) lines.push(...lostAndFoundLines());
    if (sporkInventory !== undefined) lines.push(...sporkShopLines(sporkInventory));
    if (result.appearance.authoredSporkItems.length > 0)
      lines.push(...authoredSporkItemLines(result.appearance.authoredSporkItems));
  }
  return lines;
}

function authoredSporkItemLines(
  items: RecurringVisitorPresentResult["appearance"]["authoredSporkItems"],
): readonly string[] {
  const lines = [
    "AUTHORED SPORK ITEMS",
    "====================",
    "These items are optional DM-controlled content and are not part of Spork’s ordinary generated stock.",
    "",
  ];
  const availability = {
    dm_choice: "DM choice",
    gift: "Gift",
    sale: "Sale",
    special: "Special circumstances",
  } as const;
  const repeatability = {
    yes: "May appear more than once",
    no: "Intended as a one-time item",
    dm: "DM decides",
  } as const;
  for (const item of items) {
    lines.push(
      `${item.name} — ${item.rarity}`,
      `  Description: ${item.description}`,
      `  Presentation: ${item.presentation}`,
      `  Availability: ${availability[item.availability]}`,
      `  Repeatability: ${repeatability[item.repeatable]}`,
      "",
    );
  }
  return lines;
}

/** Adds the Stranger timing line using the completed room's actual context. */
export function recurringVisitorLinesForRoom(
  result: RecurringVisitorPresentResult,
  hasEncounter: boolean,
  hasHazard: boolean,
): readonly string[] {
  const lines = [...recurringVisitorLines(result)];
  if (result.appearance.visitor.id !== "stranger") return lines;
  const timing = hasEncounter
    ? "Timing: The Stranger appears only after the encounter is resolved."
    : hasHazard
      ? "Timing: The Stranger appears only after the immediate hazard or trap is resolved."
      : "Timing: The Stranger is already present when the party enters.";
  const existing = lines.findIndex((value) => value.startsWith("Timing: The Stranger"));
  if (existing >= 0) lines[existing] = timing;
  else lines.splice(4, 0, timing);
  return lines;
}

function lostAndFoundLines(): readonly string[] {
  return [
    "SPORK'S LOST & FOUND",
    "====================",
    "Spork has collected equipment taken from recent prisoners.",
    "Ask each player what mundane equipment their character began with.",
    "Spork almost certainly has it somewhere in his collection.",
    "This may include ordinary weapons, armor, shields, spellcasting focuses, component pouches, adventuring packs, tools, rope, lanterns, and bedrolls.",
    "It does not include treasure, magic items, or plot-specific equipment.",
    "Spork will trade for curiosities, junk, odd trinkets, monster parts, shiny rocks, broken utensils, amusing stories, promises, or favors.",
    "If the party behaves reasonably, the DM may have Spork simply hand their equipment back.",
    "",
  ];
}

function sporkShopLines(inventory: SporkInventory): readonly string[] {
  const appraisal =
    inventory.appraisal === "overvalued"
      ? "Appraisal: Spork has innocently overvalued one item in this stock."
      : inventory.appraisal === "undervalued"
        ? "Appraisal: Spork has innocently undervalued one item in this stock."
        : "Appraisal: Spork is honest, enthusiastic, and not necessarily expert.";
  const lines = [
    "SPORK'S TRAVELING SHOP",
    "=======================",
    "Spork buys, sells, barters, and trades.",
    "The DM determines final prices and barter terms.",
    appraisal,
    "",
    "Inventory:",
  ];
  for (const item of inventory.items) {
    lines.push(
      item.stockType === "companion"
        ? `  • ${item.name} — unusual companion`
        : `  • ${item.name} — ${item.rarity}`,
      `    Spork's story: ${item.story}`,
    );
  }
  lines.push("");
  return lines;
}
