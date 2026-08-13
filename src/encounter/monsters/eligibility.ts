import type { MonsterDefinition, MonsterRole } from "../../content/monsters/types.js";
import { EncounterMonsterSelectionError } from "./errors.js";
import type { MonsterSelectionOptions } from "./types.js";

const WATER_ENVIRONMENTS = new Set(["aquatic", "underwater", "water"]);
const ENCLOSED_ENVIRONMENTS = new Set([
  "crypt",
  "dungeon",
  "forge",
  "laboratory",
  "library",
  "temple",
]);

/** Returns all monsters passing the active Bash single-selection gates. */
export function getEligibleEncounterMonsters(
  options: MonsterSelectionOptions,
): readonly MonsterDefinition[] {
  assertValidBudget(options);
  const suppliedEnvironment = options.environment ?? "dungeon";
  if (suppliedEnvironment.length === 0) {
    throw new EncounterMonsterSelectionError(
      "INVALID_ENVIRONMENT",
      "Invalid encounter monster environment; expected a non-empty value.",
      options.family.id,
      options.budget,
    );
  }
  const environment = suppliedEnvironment.toLowerCase();

  const candidates = options.monsterCatalog.monsters.filter((monster) => {
    if (!monster.families.includes(options.family.id)) return false;
    if (!monster.procedural) return false;
    if (!requirementsMet(monster, environment)) return false;
    if (options.bossEncounter === true && !monster.bossEligible) return false;
    if (!rolesMatch(monster, options.requiredRoles)) return false;
    if (monster.xp > options.budget) return false;

    // Free creatures cannot spend down the budget, so Bash excludes only
    // environmentally unsuitable zero-XP additions at this stage.
    if (monster.xp === 0 && environmentSuitability(monster, environment) < 0) return false;

    return true;
  });

  return Object.freeze(candidates);
}

/** @internal Shared by selection so eligibility and tie-breaking cannot drift. */
export function environmentSuitability(monster: MonsterDefinition, environment: string): number {
  const normalizedEnvironment = environment.toLowerCase();
  const wet = WATER_ENVIRONMENTS.has(normalizedEnvironment);
  const enclosed = ENCLOSED_ENVIRONMENTS.has(normalizedEnvironment);
  const swimmer = monster.tags.includes("movement:swim");
  let score = 0;

  if (swimmer) score += wet ? 3 : -1;

  if (
    wet &&
    (monster.requirements.includes("environment:underwater") ||
      monster.requirements.includes("terrain:water"))
  ) {
    score += 4;
  }

  if (monster.tags.includes("dinosaur")) {
    if (normalizedEnvironment === "forest" || normalizedEnvironment === "open") {
      score += 2;
    } else if (wet && swimmer) {
      score += 2;
    } else if (normalizedEnvironment === "cave" || normalizedEnvironment === "underdark") {
      score -= 1;
    } else {
      score -= 3;
    }
  }

  if (enclosed && (monster.size === "Huge" || monster.size === "Gargantuan")) score -= 2;
  return score;
}

function requirementsMet(monster: MonsterDefinition, environment: string): boolean {
  for (const requirement of monster.requirements) {
    if (requirement === "environment:underwater" && environment !== "underwater") return false;
    if (requirement === "terrain:water" && !WATER_ENVIRONMENTS.has(environment)) return false;
  }

  return true;
}

function rolesMatch(
  monster: MonsterDefinition,
  requested: readonly MonsterRole[] | undefined,
): boolean {
  if (requested === undefined || requested.length === 0) return true;

  return requested.some((role) => {
    if (role === "minion" && !monster.minionEligible) return false;
    return monster.roles.includes(role);
  });
}

function assertValidBudget(options: MonsterSelectionOptions): void {
  if (!Number.isSafeInteger(options.budget) || options.budget < 0) {
    throw new EncounterMonsterSelectionError(
      "INVALID_BUDGET",
      `Invalid encounter monster budget "${String(options.budget)}"; expected a non-negative safe integer.`,
      options.family.id,
      options.budget,
    );
  }
}
