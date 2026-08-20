import type { FamilyDefinition } from "../../content/families/types.js";
import { calculateEncounterXpBudget } from "../budget.js";
import { composeEncounter, EncounterCompositionError } from "../composition/index.js";
import { selectEncounterFormation } from "../composition/selection.js";
import {
  buildEncounterFamilySelectionPool,
  nextDistinctEncounterFamily,
} from "../families/pool.js";
import { selectEncounterFamily } from "../families/selection.js";
import { rollEncounterThreat } from "../threat.js";
import { OrdinaryEncounterGenerationError } from "./errors.js";
import { assertValidParty } from "../party.js";
import { generateEncounterBehavior, rollEncounterBehaviorState } from "../behavior/index.js";
import type { OrdinaryEncounterGenerationOptions, OrdinaryEncounterResult } from "./types.js";

/** Generates one complete structured ordinary encounter. */
export function generateOrdinaryEncounter(
  options: OrdinaryEncounterGenerationOptions,
): OrdinaryEncounterResult {
  // Bash validates the complete request before consuming encounter rolls.
  assertValidParty(options.party);
  const threat = rollEncounterThreat(options.rng);

  let familyRoll: number | undefined;
  const familyRng = {
    integer: (minimum: number, maximum: number): number => {
      const roll = options.rng.integer(minimum, maximum);
      familyRoll = roll;
      return roll;
    },
  };
  let family = selectEncounterFamily({
    monsterCatalog: options.monsterCatalog,
    familyCatalog: options.familyCatalog,
    rng: familyRng,
    ...(options.familyWeights === undefined ? {} : { familyWeights: options.familyWeights }),
    ...(options.requestedFamily === undefined ? {} : { requestedFamily: options.requestedFamily }),
  }).family;
  const formationSelection = selectEncounterFormation({
    rng: options.rng,
    ...(options.requestedFormation === undefined
      ? {}
      : { requestedFormation: options.requestedFormation }),
  });
  const formation = formationSelection.formation;
  // Bash draws both values with the other encounter details before roster
  // composition, then resolves behavior only after the final family succeeds.
  const behaviorRolls = rollEncounterBehaviorState(options.rng);
  // Selection precedes budgeting in the active Bash call path. Budgeting is
  // still performed exactly once and remains fixed across every family retry.
  const xpBudget = calculateEncounterXpBudget(options.party, threat.difficulty);

  const familyAttempts: string[] = [];
  const failedFamilyAttempts: string[] = [];
  const requestedFamily =
    options.requestedFamily !== undefined && options.requestedFamily.length > 0;
  const pool = requestedFamily
    ? undefined
    : buildEncounterFamilySelectionPool({
        monsterCatalog: options.monsterCatalog,
        familyCatalog: options.familyCatalog,
        ...(options.familyWeights === undefined ? {} : { familyWeights: options.familyWeights }),
      });
  let fallbackAttempts = 0;
  let lastFailure: unknown;

  while (true) {
    familyAttempts.push(family.id);
    try {
      const composed = composeEncounter({
        monsterCatalog: options.monsterCatalog,
        family,
        formation,
        xpBudget,
        ...(options.environment === undefined ? {} : { environment: options.environment }),
      });
      return freezeResult(
        options,
        threat,
        xpBudget,
        family,
        composed,
        familyAttempts,
        failedFamilyAttempts,
        familyRoll,
        formationSelection.roll,
        generateEncounterBehavior({
          catalog: options.behaviorCatalog,
          rolls: behaviorRolls,
          environment: options.environment ?? "dungeon",
          entries: composed.entries,
        }),
      );
    } catch (error) {
      if (!(error instanceof EncounterCompositionError) || error.code !== "NO_MONSTERS_SELECTED") {
        throw error;
      }
      lastFailure = error;
      failedFamilyAttempts.push(family.id);
    }

    if (requestedFamily) {
      throw new OrdinaryEncounterGenerationError(
        "REQUESTED_FAMILY_UNUSABLE",
        `Requested family "${family.id}" could not compose an encounter using formation "${formation.id}".`,
        familyAttempts,
        lastFailure,
      );
    }

    const weightedPool = pool as NonNullable<typeof pool>;
    if (familyRoll === undefined || fallbackAttempts >= weightedPool.totalWeight - 1) {
      throw exhaustedError(familyAttempts, formation.id, lastFailure);
    }
    const next = nextDistinctEncounterFamily(weightedPool, familyRoll, family.id);
    if (next === undefined) throw exhaustedError(familyAttempts, formation.id, lastFailure);

    family = next.family;
    familyRoll = next.roll;
    fallbackAttempts += 1;
  }
}

function freezeResult(
  options: OrdinaryEncounterGenerationOptions,
  threat: ReturnType<typeof rollEncounterThreat>,
  xpBudget: number,
  family: FamilyDefinition,
  composed: ReturnType<typeof composeEncounter>,
  familyAttempts: readonly string[],
  failedFamilyAttempts: readonly string[],
  familyRoll: number | undefined,
  formationRoll: number | undefined,
  behaviorState: ReturnType<typeof generateEncounterBehavior>,
): OrdinaryEncounterResult {
  return Object.freeze({
    party: Object.freeze({ ...options.party }),
    environment: options.environment ?? "dungeon",
    threat,
    difficulty: threat.difficulty,
    xpBudget,
    family,
    formation: composed.formation,
    entries: composed.entries,
    xpSpent: composed.xpSpent,
    xpRemaining: composed.xpRemaining,
    creatureCount: composed.creatureCount,
    formationExecution: composed.formationExecution,
    familyAttempts: Object.freeze([...familyAttempts]),
    failedFamilyAttempts: Object.freeze([...failedFamilyAttempts]),
    behaviorState,
    selectionRolls: Object.freeze({ family: familyRoll, formation: formationRoll }),
  });
}

function exhaustedError(
  familyAttempts: readonly string[],
  formationId: string,
  cause: unknown,
): OrdinaryEncounterGenerationError {
  return new OrdinaryEncounterGenerationError(
    "FAMILY_FALLBACK_EXHAUSTED",
    `Encounter family fallback exhausted for formation "${formationId}".`,
    familyAttempts,
    cause,
  );
}
