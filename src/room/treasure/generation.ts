import type { TreasureItemDefinition, TreasureRarity } from "../../content/treasure/types.js";
import { TreasureGenerationError } from "./errors.js";
import type {
  GenerateRoomTreasureOptions,
  RoomTreasure,
  RoomTreasureHistory,
  RoomTreasureRoll,
} from "./types.js";

const MODULUS = 2_147_483_647;
const HELPFUL_CATEGORIES = new Set(["potion", "scroll", "weapon", "armor", "wondrous"]);
const NARRATIVE_CATEGORIES = new Set(["art", "curiosity", "quest"]);

/**
 * Generates active Bash-compatible treasure without consuming the room RNG.
 *
 * Reward indices 39 and 40 belong to Gary-clue frequency and selection. They
 * remain deliberately unresolvable here so the future clue slice can occupy
 * its established place without changing this treasure contract.
 */
export function generateRoomTreasure(options: GenerateRoomTreasureOptions): RoomTreasure {
  validate(options);
  const rewardSeed = deriveRoomSeed(options.roomSeed, options.roomNumber + 10_000);
  const helpfulCandidates = helpfulItems(options);
  const narrativeCandidates = narrativeItems(options);
  const helpfulSelection = selectHelpful(options, helpfulCandidates, rewardSeed);
  const narrativeSelection = selectNarrative(options, narrativeCandidates, rewardSeed);
  const featureRoll = semanticRoll(rewardSeed, 37, 2);
  const feature = options.features[featureRoll.value - 1] as Pick<
    (typeof options.features)[number],
    "name"
  >;
  const valuablesRoll = semanticRoll(rewardSeed, 38, 100);
  const locationRoll = semanticRoll(rewardSeed, 47, 6);
  const contextRoll = semanticRoll(rewardSeed, 48, 4);
  const salvage = selectSalvage(options, rewardSeed);

  return deepFreeze({
    helpful: { ...helpfulSelection.value },
    narrative: { ...narrativeSelection.value },
    valuables: valuables(options, valuablesRoll.value),
    featureName: feature.name,
    location: treasureLocation(feature.name, locationRoll.value),
    context: treasureContext(options.neighborhoodTreasureFlavor, contextRoll.value),
    salvage: options.retainHazard ? salvage.value : undefined,
    rewardSeed,
    rolls: {
      helpful: helpfulSelection.roll,
      narrative: narrativeSelection.roll,
      feature: featureRoll,
      valuables: valuablesRoll,
      location: locationRoll,
      context: contextRoll,
      salvage: salvage.roll,
    },
  });
}

/** Exact integer seed mixer used by active Bash generator_room_seed. */
export function deriveRoomSeed(seed: number, room: number): number {
  if (!Number.isSafeInteger(seed) || seed < 0 || !Number.isSafeInteger(room) || room < 0)
    throw new TreasureGenerationError(
      "INVALID_OPTIONS",
      `Seed and room values must be nonnegative safe integers; received ${seed} and ${room}.`,
    );
  const x = seed % 1_000_003;
  const y = room % 1_000_033;
  return (x * x * 31 + y * y * 193 + x * y * 97 + x * 48_271 + y * 69_621 + 612) % MODULUS;
}

/** Exact one-based semantic die roll used by active Bash seed_roll. */
export function semanticTreasureRoll(seed: number, index: number, sides: number): number {
  if (
    !Number.isSafeInteger(seed) ||
    seed < 0 ||
    !Number.isSafeInteger(index) ||
    index < 0 ||
    !Number.isSafeInteger(sides) ||
    sides < 1
  )
    throw new TreasureGenerationError("INVALID_OPTIONS", "Invalid semantic treasure roll input.");
  return (((seed + index * 1_103_515_245 + 12_345) % MODULUS) % sides) + 1;
}

export function treasureItemMetadata(item: TreasureItemDefinition): string {
  return item.category === item.rarity ? item.category : `${item.category}, ${item.rarity}`;
}

function selectHelpful(
  options: GenerateRoomTreasureOptions,
  candidates: readonly TreasureItemDefinition[],
  rewardSeed: number,
) {
  const recent = options.history?.recentHelpfulNames ?? [];
  const available = excludeRecent(candidates, recent);
  const usable = available.length === 0 ? candidates : available;
  const target = Math.min(depthTarget(options.depthBand), rarityCap(options.partyLevel));
  const weighted = usable.map((value) => ({
    value,
    weight: rarityRank(value.rarity) === target ? 4 : 1,
  }));
  const total = weighted.reduce((sum, value) => sum + value.weight, 0);
  const roll = historyRoll(options.history, options.roomNumber, 136, total, rewardSeed, 35);
  return { value: weightedSelection(weighted, roll.value), roll };
}

function selectNarrative(
  options: GenerateRoomTreasureOptions,
  candidates: readonly TreasureItemDefinition[],
  rewardSeed: number,
) {
  const recent = options.history?.recentNarrativeNames ?? [];
  const available = excludeRecent(candidates, recent);
  const usable = available.length === 0 ? candidates : available;
  const roll = historyRoll(options.history, options.roomNumber, 137, usable.length, rewardSeed, 36);
  return { value: usable[roll.value - 1] as TreasureItemDefinition, roll };
}

function selectSalvage(options: GenerateRoomTreasureOptions, rewardSeed: number) {
  const definition = options.catalog.hazardSalvage.find(
    (value) => value.hazardName === options.selectedHazard.name,
  );
  if (definition === undefined)
    throw new TreasureGenerationError(
      "MISSING_HAZARD_SALVAGE",
      `No salvage is defined for hazard "${options.selectedHazard.name}".`,
    );
  const variants = Array.from({ length: 6 }, (_, index) => ({
    variation: index + 1,
    text: salvageText(options.selectedHazard.name, definition.description, index + 1),
  }));
  const available = variants.filter(
    (value) => !(options.history?.recentSalvageVariations ?? []).includes(value.variation),
  );
  const usable = available.length === 0 ? variants : available;
  const roll = historyRoll(options.history, options.roomNumber, 139, usable.length, rewardSeed, 49);
  const selected = usable[roll.value - 1] as (typeof usable)[number];
  return {
    value: Object.freeze({
      hazardName: options.selectedHazard.name,
      materials: definition.description,
      text: selected.text,
      variation: selected.variation,
    }),
    roll,
  };
}

function helpfulItems(options: GenerateRoomTreasureOptions): readonly TreasureItemDefinition[] {
  const cap = rarityCap(options.partyLevel);
  const values = options.catalog.items.filter(
    (value) =>
      HELPFUL_CATEGORIES.has(value.category) &&
      rarityRank(value.rarity) > 0 &&
      rarityRank(value.rarity) <= cap,
  );
  if (values.length === 0)
    throw new TreasureGenerationError(
      "MISSING_HELPFUL_LOOT",
      `No helpful treasure is legal for party level ${options.partyLevel}.`,
    );
  return values;
}

function narrativeItems(options: GenerateRoomTreasureOptions): readonly TreasureItemDefinition[] {
  const cap = rarityCap(options.partyLevel);
  const values = options.catalog.items.filter(
    (value) => NARRATIVE_CATEGORIES.has(value.category) && rarityRank(value.rarity) <= cap,
  );
  if (values.length === 0)
    throw new TreasureGenerationError(
      "MISSING_NARRATIVE_LOOT",
      `No narrative treasure is legal for party level ${options.partyLevel}.`,
    );
  return values;
}

function historyRoll(
  history: RoomTreasureHistory | undefined,
  roomNumber: number,
  historyIndex: number,
  sides: number,
  rewardSeed: number,
  rewardIndex: number,
): RoomTreasureRoll {
  if (history === undefined) return semanticRoll(rewardSeed, rewardIndex, sides);
  return semanticRoll(deriveRoomSeed(history.campaignSeed, roomNumber), historyIndex, sides);
}

function semanticRoll(seed: number, index: number, sides: number): RoomTreasureRoll {
  return Object.freeze({ index, value: semanticTreasureRoll(seed, index, sides), sides });
}

function weightedSelection<T>(
  values: readonly { readonly value: T; readonly weight: number }[],
  selected: number,
): T {
  let total = 0;
  for (const value of values) {
    total += value.weight;
    if (total >= selected) return value.value;
  }
  throw new Error("Unreachable treasure selection boundary.");
}

function excludeRecent(
  candidates: readonly TreasureItemDefinition[],
  names: readonly string[],
): readonly TreasureItemDefinition[] {
  const blocked = new Set(names);
  return candidates.filter((value) => !blocked.has(value.name));
}

function rarityCap(level: number): number {
  if (level <= 4) return 2;
  if (level <= 10) return 3;
  if (level <= 16) return 4;
  return 5;
}

function depthTarget(depth: GenerateRoomTreasureOptions["depthBand"]): number {
  if (depth === "shallow") return 1;
  if (depth === "middle") return 2;
  if (depth === "deep") return 3;
  return 5;
}

function rarityRank(rarity: TreasureRarity): number {
  if (rarity === "common") return 1;
  if (rarity === "uncommon") return 2;
  if (rarity === "rare") return 3;
  if (rarity === "very-rare") return 4;
  if (rarity === "legendary") return 5;
  return 0;
}

function valuables(options: GenerateRoomTreasureOptions, valueRoll: number) {
  const depthFactor = { shallow: 1, middle: 2, deep: 3, extreme: 4 }[options.depthBand];
  const difficultyFactor = { low: 1, moderate: 2, high: 3 }[options.difficulty];
  const base = (options.partyLevel * 4 + depthFactor * 3) * difficultyFactor;
  const gpValue = base + Math.floor((base * valueRoll) / 100);
  let description: string;
  if (valueRoll % 3 === 0)
    description = `${gpValue} gp in mixed coin and one small polished gemstone`;
  else if (valueRoll % 3 === 1) description = `${gpValue} gp in mixed coin and compact trade goods`;
  else description = `${gpValue} gp in mixed local and foreign coin`;
  return Object.freeze({ gpValue, description });
}

function treasureLocation(feature: string, variation: number): string {
  return [
    `Stashed in a floor recess beside the ${feature}.`,
    `Hidden in a wall niche facing the ${feature}.`,
    `Secured in a shallow niche beside the ${feature}.`,
    `Mixed among debris at the ${feature}.`,
    `Wedged out of sight near the ${feature}.`,
    `Concealed beside the ${feature}.`,
  ][variation - 1] as string;
}

function treasureContext(flavor: string, variation: number): string {
  return [
    `The cache consists of ${flavor}.`,
    `Together, the finds resemble ${flavor}.`,
    `The objects were gathered from ${flavor}.`,
    `The assortment suits ${flavor}.`,
  ][variation - 1] as string;
}

function salvageText(hazard: string, materials: string, variation: number): string {
  return [
    `Disabling the ${hazard} leaves ${materials}.`,
    `The ${hazard} can be stripped for ${materials}.`,
    `Useful parts from the ${hazard} include ${materials}.`,
    `Careful recovery from the ${hazard} yields ${materials}.`,
    `Once made safe, the ${hazard} provides ${materials}.`,
    `A patient search of the ${hazard} recovers ${materials}.`,
  ][variation - 1] as string;
}

function validate(options: GenerateRoomTreasureOptions): void {
  if (!Number.isSafeInteger(options.roomNumber) || options.roomNumber < 1)
    invalid(`Room number must be a positive integer; received ${options.roomNumber}.`);
  if (!Number.isSafeInteger(options.partyLevel) || options.partyLevel < 1)
    invalid(`Party level must be a positive integer; received ${options.partyLevel}.`);
  if (options.features.length !== 2)
    invalid(
      `Treasure placement requires exactly two room features; received ${options.features.length}.`,
    );
  if (options.features.some((value) => value.name.length === 0))
    invalid("Treasure placement feature names must not be empty.");
  if (options.neighborhoodTreasureFlavor.length === 0)
    invalid("Neighborhood treasure flavor must not be empty.");
  if (options.history !== undefined) {
    validateRecent("helpful", options.history.recentHelpfulNames);
    validateRecent("narrative", options.history.recentNarrativeNames);
    if (options.history.recentSalvageVariations.length > 5)
      invalid(`Recent salvage history cannot exceed five entries.`);
    if (
      options.history.recentSalvageVariations.some(
        (value) => !Number.isSafeInteger(value) || value < 1 || value > 6,
      )
    )
      invalid(`Recent salvage history must contain variations from 1 through 6.`);
    if (!Number.isSafeInteger(options.history.campaignSeed) || options.history.campaignSeed < 0)
      invalid(`Campaign seed must be a nonnegative safe integer.`);
  }
}

function validateRecent(label: string, values: readonly string[]): void {
  if (values.length > 5) invalid(`Recent ${label} history cannot exceed five entries.`);
  if (values.some((value) => value.length === 0))
    invalid(`Recent ${label} history contains an empty entry.`);
}

function invalid(message: string): never {
  throw new TreasureGenerationError("INVALID_OPTIONS", message);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
