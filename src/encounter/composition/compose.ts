import type { MonsterCatalog } from "../../content/monsters/types.js";
import { EncounterMonsterSelectionError } from "../monsters/errors.js";
import { selectEncounterMonster } from "../monsters/selection.js";
import { EncounterCompositionError } from "./errors.js";
import type {
  ComposedEncounter,
  EncounterCompositionOptions,
  EncounterFormationRoleSlot,
  EncounterMonsterEntry,
} from "./types.js";

/** Composes one ordinary multi-monster encounter with active Bash parity. */
export function composeEncounter(options: EncounterCompositionOptions): ComposedEncounter {
  validateContext(options);

  const quantities = new Map<string, number>();
  let xpRemaining = options.xpBudget;
  let creatureCount = 0;
  let leaderSelected = false;

  const attemptSlot = (roleSlot: EncounterFormationRoleSlot): boolean => {
    if (creatureCount >= options.formation.maxCreatures) return false;
    if (leaderSelected && roleSlot.length === 1 && roleSlot[0] === "leader") return false;

    const catalog = leaderSelected
      ? withoutLeaderMonsters(options.monsterCatalog)
      : options.monsterCatalog;

    try {
      const selectionOptions = {
        monsterCatalog: catalog,
        family: options.family,
        budget: xpRemaining,
        requiredRoles: roleSlot,
        ...(options.environment === undefined ? {} : { environment: options.environment }),
      };
      const { monster } = selectEncounterMonster(selectionOptions);

      quantities.set(monster.id, (quantities.get(monster.id) ?? 0) + 1);
      xpRemaining -= monster.xp;
      creatureCount += 1;
      if (monster.roles.includes("leader")) leaderSelected = true;
      return true;
    } catch (error) {
      if (
        error instanceof EncounterMonsterSelectionError &&
        error.code === "NO_ELIGIBLE_MONSTERS"
      ) {
        return false;
      }
      throw error;
    }
  };

  // Bash first attempts each requested role exactly once.
  for (const roleSlot of options.formation.roleSlots) {
    if (creatureCount >= options.formation.maxCreatures) break;
    attemptSlot(roleSlot);
  }

  // Then it cycles the same ordered roles until capped or a full cycle stalls.
  let slotIndex = 0;
  let stalledSlots = 0;
  while (
    creatureCount < options.formation.maxCreatures &&
    stalledSlots < options.formation.roleSlots.length
  ) {
    const roleSlot = options.formation.roleSlots[slotIndex] as EncounterFormationRoleSlot;
    if (attemptSlot(roleSlot)) stalledSlots = 0;
    else stalledSlots += 1;
    slotIndex = (slotIndex + 1) % options.formation.roleSlots.length;
  }

  if (creatureCount === 0) {
    throw new EncounterCompositionError(
      "NO_MONSTERS_SELECTED",
      `No monsters could be selected for formation "${options.formation.id}" and family "${options.family.id}".`,
      { familyId: options.family.id, formationId: options.formation.id },
    );
  }

  const entries: EncounterMonsterEntry[] = [];
  for (const monster of options.monsterCatalog.monsters) {
    const count = quantities.get(monster.id);
    if (count !== undefined) entries.push(Object.freeze({ monster, count }));
  }

  return Object.freeze({
    formation: options.formation,
    family: options.family,
    entries: Object.freeze(entries),
    xpBudget: options.xpBudget,
    xpSpent: options.xpBudget - xpRemaining,
    xpRemaining,
    creatureCount,
  });
}

function withoutLeaderMonsters(catalog: MonsterCatalog): MonsterCatalog {
  return Object.freeze({
    monsters: Object.freeze(
      catalog.monsters.filter((monster) => !monster.roles.includes("leader")),
    ),
  });
}

function validateContext(options: EncounterCompositionOptions): void {
  if (!Number.isSafeInteger(options.xpBudget) || options.xpBudget < 0) {
    throw new EncounterCompositionError(
      "INVALID_COMPOSITION_CONTEXT",
      `Invalid encounter composition XP budget "${String(options.xpBudget)}".`,
      { familyId: options.family.id, formationId: options.formation.id },
    );
  }
  if (!Number.isSafeInteger(options.formation.maxCreatures) || options.formation.maxCreatures < 1) {
    throw new EncounterCompositionError(
      "INVALID_COMPOSITION_CONTEXT",
      `Invalid maximum creature count "${String(options.formation.maxCreatures)}".`,
      { familyId: options.family.id, formationId: options.formation.id },
    );
  }
  if (options.formation.roleSlots.length === 0) {
    throw new EncounterCompositionError(
      "INVALID_COMPOSITION_CONTEXT",
      `Encounter formation "${options.formation.id}" has no role slots.`,
      { familyId: options.family.id, formationId: options.formation.id },
    );
  }
  if (options.formation.roleSlots.some((roleSlot) => roleSlot.length === 0)) {
    throw new EncounterCompositionError(
      "INVALID_COMPOSITION_CONTEXT",
      `Encounter formation "${options.formation.id}" contains an empty role slot.`,
      { familyId: options.family.id, formationId: options.formation.id },
    );
  }
}
