import type { BehaviorDefinition, BehaviorRequirement } from "../../content/behaviors/types.js";
import { EncounterBehaviorError } from "./errors.js";
import type {
  EncounterBehaviorRolls,
  EncounterBehaviorState,
  GenerateEncounterBehaviorOptions,
} from "./types.js";

/** Rolls behavior first and disposition second, matching Bash selector order. */
export function rollEncounterBehaviorState(rng: {
  integer(minimum: number, maximum: number): number;
}): EncounterBehaviorRolls {
  return Object.freeze({
    behavior: rng.integer(1, 20),
    disposition: rng.integer(1, 20),
  });
}

/** Resolves pre-rolled ordinary behavior after the final roster is known. */
export function generateEncounterBehavior(
  options: GenerateEncounterBehaviorOptions,
): EncounterBehaviorState {
  validateContext(options);
  const environment = options.environment.toLowerCase();
  const monsterTypes = new Set(options.entries.map(({ monster }) => monster.type.toLowerCase()));
  const monsterTags = new Set(
    options.entries.flatMap(({ monster }) => monster.tags.map((tag) => tag.toLowerCase())),
  );
  const eligible = options.catalog.behaviors.filter(
    (behavior) =>
      options.rolls.behavior >= behavior.rollMinimum &&
      options.rolls.behavior <= behavior.rollMaximum &&
      selectorMatches(behavior, monsterTypes, monsterTags) &&
      behavior.requirements.every((requirement) =>
        requirementMatches(requirement, environment, monsterTypes, monsterTags),
      ),
  );
  const behavior = [...eligible].sort(
    (left, right) =>
      behaviorScore(right, environment) - behaviorScore(left, environment) ||
      compareKeys(left.key, right.key),
  )[0];
  if (behavior === undefined) {
    throw new EncounterBehaviorError(
      "NO_MATCHING_BEHAVIOR",
      `No authored encounter behavior matches roll ${options.rolls.behavior}.`,
    );
  }
  const disposition = options.catalog.dispositions.find(
    (candidate) =>
      options.rolls.disposition >= candidate.rollMinimum &&
      options.rolls.disposition <= candidate.rollMaximum,
  );
  if (disposition === undefined) {
    throw new EncounterBehaviorError(
      "NO_MATCHING_DISPOSITION",
      `No authored encounter disposition matches roll ${options.rolls.disposition}.`,
    );
  }
  return Object.freeze({
    behavior,
    disposition,
    alertnessModifier: behavior.alertnessModifier,
    activity: `${behavior.title}: ${behavior.description}`,
    rolls: options.rolls,
  });
}

function compareKeys(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function selectorMatches(
  behavior: BehaviorDefinition,
  monsterTypes: ReadonlySet<string>,
  monsterTags: ReadonlySet<string>,
): boolean {
  if (behavior.selectorKind === "fallback") return true;
  if (behavior.selectorKind === "type") return monsterTypes.has(behavior.selector.toLowerCase());
  return monsterTags.has(behavior.selector.toLowerCase());
}

function requirementMatches(
  requirement: BehaviorRequirement,
  environment: string,
  monsterTypes: ReadonlySet<string>,
  monsterTags: ReadonlySet<string>,
): boolean {
  const value = requirement.value.toLowerCase();
  if (requirement.kind === "environment") return environment === value;
  if (requirement.kind === "type") return monsterTypes.has(value);
  return monsterTags.has(value);
}

function behaviorScore(behavior: BehaviorDefinition, environment: string): number {
  const specificity =
    behavior.selectorKind === "tag" ? 300 : behavior.selectorKind === "type" ? 200 : 100;
  const preferred = behavior.preferredEnvironments.some(
    (candidate) => candidate.toLowerCase() === environment,
  )
    ? 10
    : 0;
  return specificity + preferred;
}

function validateContext(options: GenerateEncounterBehaviorOptions): void {
  if (options.environment.length === 0 || options.entries.length === 0) {
    throw new EncounterBehaviorError(
      "INVALID_BEHAVIOR_CONTEXT",
      "Encounter behavior requires a nonempty environment and final monster roster.",
    );
  }
  for (const [name, roll] of Object.entries(options.rolls)) {
    if (!Number.isInteger(roll) || roll < 1 || roll > 20) {
      throw new EncounterBehaviorError(
        "INVALID_BEHAVIOR_CONTEXT",
        `Invalid ${name} d20 roll "${String(roll)}".`,
      );
    }
  }
}
