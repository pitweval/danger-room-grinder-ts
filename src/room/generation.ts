import type { FamilyDefinition } from "../content/families/types.js";
import type { DepthRoomChoice, RoomEnvironment, RoomFeature } from "../content/rooms/types.js";
import { calculateEncounterXpBudget } from "../encounter/budget.js";
import {
  composeEncounter,
  EncounterCompositionError,
  getEligibleEncounterFormations,
} from "../encounter/composition/index.js";
import { generateOrdinaryEncounter } from "../encounter/generation/index.js";
import { RoomGenerationError } from "./errors.js";
import { selectRoomHazard } from "./hazards/index.js";
import { suggestedSkillDcsForDifficulty } from "./skills/index.js";
import { generateRoomTreasure } from "./treasure/index.js";
import type {
  DungeonDepthBand,
  GenerateOrdinaryRoomOptions,
  OrdinaryRoom,
  OrdinaryRoomRolls,
  RoomAtmosphere,
} from "./types.js";

/** Generates the active non-boss room shell before embedding its encounter. */
export function generateOrdinaryRoom(options: GenerateOrdinaryRoomOptions): OrdinaryRoom {
  validateOptions(options);
  const catalog = options.roomCatalog;
  const neighborhoodId = options.neighborhood ?? "subterranean-dungeon";
  const neighborhood = catalog.neighborhoods.find((value) => value.id === neighborhoodId);
  if (neighborhood === undefined) missing(`Unknown room neighborhood "${neighborhoodId}".`);
  const depthBand = depthBandFor(options.roomNumber);

  const difficultyRoll =
    options.requestedDifficulty === undefined ? roll(options, 1, 20) : undefined;
  const difficulty =
    options.requestedDifficulty ?? depthDifficulty(depthBand, difficultyRoll as number);
  const familySelection =
    options.requestedFamily === undefined
      ? weightedDepthChoice(options, catalog.depthFamilies, depthBand, neighborhoodId, true)
      : { value: options.requestedFamily, roll: undefined };
  const formationSelection =
    options.requestedFormation === undefined
      ? weightedDepthChoice(options, catalog.depthFormations, depthBand, neighborhoodId, false)
      : { value: options.requestedFormation, roll: undefined };

  const arrivalSelection = pick(options, catalog.arrivals);
  const doorwaySelection = pick(options, catalog.doorways);
  const signatureFrequency = roll(options, 1, 50);
  const signatureCandidates = catalog.signatures.filter((value) =>
    value.neighborhoods.includes(neighborhoodId),
  );
  const signatureSelection =
    signatureFrequency === 1 && signatureCandidates.length > 0
      ? pick(options, signatureCandidates)
      : undefined;

  let kind: OrdinaryRoom["kind"];
  let environment: RoomEnvironment;
  let subtheme: OrdinaryRoom["subtheme"];
  let architecture: string;
  let atmosphereValues: Omit<RoomAtmosphere, "order">;
  let features: readonly RoomFeature[];
  let subthemeRoll: number | undefined;
  let environmentPreferenceRoll: number | undefined;
  let environmentRoll: number | undefined;
  let firstFeatureRoll: number | undefined;
  let secondFeatureRoll: number | undefined;

  if (signatureSelection !== undefined) {
    const signature = signatureSelection.value;
    kind = "signature";
    environment = Object.freeze({
      name: signature.name,
      description: signature.description,
      engineEnvironment: signature.engineEnvironment,
      frequency: signature.frequency,
    });
    subtheme = undefined;
    architecture = signature.story;
    atmosphereValues = {
      lighting: signature.lighting,
      sound: signature.sound,
      smell: signature.smell,
    };
    features = signature.features;
  } else {
    const subthemeSelection = pick(
      options,
      catalog.subthemes.filter((value) => value.neighborhoodId === neighborhoodId),
    );
    const selectedSubtheme = subthemeSelection.value;
    subtheme = selectedSubtheme;
    subthemeRoll = subthemeSelection.roll;
    const compatibleNames =
      catalog.subthemeEnvironments.find(
        (value) =>
          value.neighborhoodId === neighborhoodId && value.subthemeId === selectedSubtheme.id,
      )?.environmentNames ?? [];
    const allEnvironments = catalog.environments.filter((value) =>
      neighborhood.environmentKeys.includes(value.engineEnvironment),
    );
    let candidates = allEnvironments;
    if (compatibleNames.length > 0) {
      environmentPreferenceRoll = roll(options, 1, 10);
      if (environmentPreferenceRoll !== 10)
        candidates = catalog.environments.filter((value) => compatibleNames.includes(value.name));
    }
    const selectedEnvironment = pick(options, candidates);
    environment = selectedEnvironment.value;
    environmentRoll = selectedEnvironment.roll;
    kind = environment.name === "Long Corridor" ? "long-corridor" : "ordinary";
    architecture = subtheme.architecture;
    atmosphereValues = {
      lighting: subtheme.lighting,
      sound: subtheme.sound,
      smell: subtheme.smell,
    };
    const weightedFeatures = catalog.neighborhoodFeatures.filter(
      (value) => value.neighborhoodId === neighborhoodId,
    );
    const first = weightedFeature(options, weightedFeatures);
    const second = weightedFeature(
      options,
      weightedFeatures.filter((value) => value.featureName !== first.value),
    );
    firstFeatureRoll = first.roll;
    secondFeatureRoll = second.roll;
    features = Object.freeze([
      featureByName(options, first.value),
      featureByName(options, second.value),
    ]);
  }

  const atmosphereOrderRoll = roll(options, 1, 6);
  const atmosphere = Object.freeze({
    ...atmosphereValues,
    order: atmosphereOrder(atmosphereOrderRoll),
  });
  // Bash selects a hazard record for every room; presence only controls whether it is retained.
  const hazardSelection = selectRoomHazard({
    catalog,
    neighborhoodId,
    depthBand,
    rng: options.rng,
  });
  const hazard = options.includeHazard === false ? undefined : hazardSelection.hazard;

  const treasure = generateRoomTreasure({
    catalog: options.treasureCatalog,
    roomSeed: options.roomSeed,
    roomNumber: options.roomNumber,
    partyLevel: options.party.characterLevel,
    depthBand,
    difficulty,
    features,
    neighborhoodTreasureFlavor: neighborhood.treasureFlavor,
    selectedHazard: hazardSelection.hazard,
    retainHazard: hazard !== undefined,
    ...(options.treasureHistory === undefined ? {} : { history: options.treasureHistory }),
  });

  const encounter =
    options.includeEncounter === false
      ? undefined
      : generateRoomEncounter(
          options,
          difficulty,
          difficultyRoll,
          environment.engineEnvironment,
          familySelection.value,
          formationSelection.value,
        );
  const suggestedSkillDcs = suggestedSkillDcsForDifficulty(difficulty);
  const exitCount = options.exitCount ?? 3;
  const exitStartRoll = roll(options, 1, catalog.exits.length);
  const exits = Object.freeze(
    Array.from(
      { length: exitCount },
      (_, index) =>
        catalog.exits[(exitStartRoll - 1 + index * 7) % catalog.exits.length] as NonNullable<
          (typeof catalog.exits)[number]
        >,
    ),
  );

  const rolls: OrdinaryRoomRolls = Object.freeze({
    difficulty: difficultyRoll,
    family: familySelection.roll,
    formation: formationSelection.roll,
    arrival: arrivalSelection.roll,
    doorway: doorwaySelection.roll,
    signatureFrequency,
    signatureSelection: signatureSelection?.roll,
    subtheme: subthemeRoll,
    environmentPreference: environmentPreferenceRoll,
    environment: environmentRoll,
    firstFeature: firstFeatureRoll,
    secondFeature: secondFeatureRoll,
    atmosphereOrder: atmosphereOrderRoll,
    hazard: hazardSelection.roll,
    exits: exitStartRoll,
  });
  return Object.freeze({
    roomNumber: options.roomNumber,
    title: `Dungeon Room ${options.roomNumber}`,
    depthBand,
    difficulty,
    neighborhood: Object.freeze({ id: neighborhood.id, name: neighborhood.name }),
    kind,
    arrival: arrivalSelection.value,
    doorway: doorwaySelection.value,
    environment,
    subtheme,
    architecture,
    atmosphere,
    features,
    exits,
    hasHazard: hazard !== undefined,
    hazard,
    treasure,
    encounterPreference: Object.freeze({
      family: familySelection.value,
      formation: formationSelection.value,
    }),
    encounter,
    suggestedSkillDcs,
    rolls,
  });
}

export function depthBandFor(roomNumber: number): DungeonDepthBand {
  if (roomNumber <= 10) return "shallow";
  if (roomNumber <= 50) return "middle";
  if (roomNumber <= 200) return "deep";
  return "extreme";
}

export function depthDifficulty(band: DungeonDepthBand, value: number) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 20)
    throw new RoomGenerationError(
      "INVALID_OPTIONS",
      `Difficulty roll must be between 1 and 20; received ${value}.`,
    );
  if (band === "shallow") return value <= 10 ? "low" : value <= 18 ? "moderate" : "high";
  if (band === "middle") return value <= 4 ? "low" : value <= 13 ? "moderate" : "high";
  if (band === "deep") return value === 1 ? "low" : value <= 8 ? "moderate" : "high";
  return "high";
}

function generateRoomEncounter(
  options: GenerateOrdinaryRoomOptions,
  difficulty: OrdinaryRoom["difficulty"],
  difficultyRoll: number | undefined,
  environment: string,
  familyId: string,
  formationId: string,
) {
  const forcedFamily = options.requestedFamily !== undefined;
  let requestedFamily: string | undefined = familyId;
  if (!forcedFamily && !canCompose(options, familyId, formationId, environment, difficulty))
    requestedFamily = undefined;
  const replayRng =
    difficultyRoll === undefined
      ? options.rng
      : {
          used: false,
          integer(minimum: number, maximum: number) {
            if (!this.used) {
              this.used = true;
              return difficultyRoll;
            }
            return options.rng.integer(minimum, maximum);
          },
        };
  try {
    return generateOrdinaryEncounter({
      party: options.party,
      monsterCatalog: options.monsterCatalog,
      familyCatalog: options.familyCatalog,
      behaviorCatalog: options.behaviorCatalog,
      rng: replayRng,
      environment,
      requestedDifficulty: difficulty,
      requestedFormation: formationId,
      ...(requestedFamily === undefined ? {} : { requestedFamily }),
    });
  } catch (error) {
    if (forcedFamily)
      throw new RoomGenerationError(
        "FORCED_FAMILY_UNUSABLE",
        `Forced family "${familyId}" cannot compose this room encounter.`,
        { cause: error },
      );
    throw error;
  }
}

function canCompose(
  options: GenerateOrdinaryRoomOptions,
  familyId: string,
  formationId: string,
  environment: string,
  difficulty: OrdinaryRoom["difficulty"],
): boolean {
  const family = findFamily(options, familyId);
  const formation = getEligibleEncounterFormations().find((value) => value.id === formationId);
  if (family === undefined || formation === undefined) return false;
  try {
    composeEncounter({
      monsterCatalog: options.monsterCatalog,
      family,
      formation,
      xpBudget: calculateEncounterXpBudget(options.party, difficulty),
      environment,
    });
    return true;
  } catch (error) {
    if (error instanceof EncounterCompositionError && error.code === "NO_MONSTERS_SELECTED")
      return false;
    throw error;
  }
}

function weightedDepthChoice(
  options: GenerateOrdinaryRoomOptions,
  values: readonly DepthRoomChoice[],
  band: DungeonDepthBand,
  neighborhood: string,
  families: boolean,
) {
  const candidates = values
    .filter(
      (value) =>
        value.depthBand === band &&
        (value.neighborhoodId === "*" || value.neighborhoodId === neighborhood),
    )
    .map((value) => ({
      value: value.value,
      weight:
        families && findFamily(options, value.value)?.familyType === "INTERMITTENT"
          ? Math.max(1, Math.ceil(value.weight / 4))
          : value.weight,
    }));
  return weighted(options, candidates);
}

function findFamily(
  options: GenerateOrdinaryRoomOptions,
  idOrName: string,
): FamilyDefinition | undefined {
  const wanted = idOrName
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "_")
    .replaceAll(/^_+|_+$/g, "");
  return options.familyCatalog.families.find(
    (value) => value.id === wanted || value.name.toLowerCase() === idOrName.toLowerCase(),
  );
}

function weightedFeature(
  options: GenerateOrdinaryRoomOptions,
  values: readonly { readonly featureName: string; readonly weight: number }[],
) {
  const selected = weighted(
    options,
    values.map((value) => ({ value: value.featureName, weight: value.weight })),
  );
  return selected;
}

function weighted<T>(
  options: GenerateOrdinaryRoomOptions,
  values: readonly { readonly value: T; readonly weight: number }[],
) {
  const total = values.reduce((sum, value) => sum + value.weight, 0);
  if (total <= 0) missing("No weighted room content is available for the requested context.");
  const selectedRoll = roll(options, 1, total);
  let running = 0;
  for (const value of values) {
    running += value.weight;
    if (running >= selectedRoll) return { value: value.value, roll: selectedRoll };
  }
  throw new Error("Unreachable weighted selection boundary.");
}

function pick<T>(options: GenerateOrdinaryRoomOptions, values: readonly T[]) {
  if (values.length === 0) missing("No room content is available for the requested context.");
  const selectedRoll = roll(options, 1, values.length);
  return { value: values[selectedRoll - 1] as T, roll: selectedRoll };
}

function featureByName(options: GenerateOrdinaryRoomOptions, name: string): RoomFeature {
  const value = options.roomCatalog.features.find((feature) => feature.name === name);
  if (value === undefined) missing(`Unknown room feature "${name}".`);
  return value;
}

function atmosphereOrder(value: number): RoomAtmosphere["order"] {
  const orders = [
    ["lighting", "sound", "smell"],
    ["lighting", "smell", "sound"],
    ["sound", "lighting", "smell"],
    ["sound", "smell", "lighting"],
    ["smell", "lighting", "sound"],
    ["smell", "sound", "lighting"],
  ] as const;
  return Object.freeze([...(orders[value - 1] as NonNullable<(typeof orders)[number]>)]);
}

function validateOptions(options: GenerateOrdinaryRoomOptions): void {
  if (!Number.isSafeInteger(options.roomNumber) || options.roomNumber < 1)
    throw new RoomGenerationError(
      "INVALID_OPTIONS",
      `Room number must be a positive integer; received ${options.roomNumber}.`,
    );
  const exits = options.exitCount ?? 3;
  if (!Number.isSafeInteger(exits) || exits < 1 || exits > options.roomCatalog.exits.length)
    throw new RoomGenerationError(
      "INVALID_OPTIONS",
      `Exit count must be between 1 and ${options.roomCatalog.exits.length}; received ${exits}.`,
    );
}

function roll(options: GenerateOrdinaryRoomOptions, minimum: number, maximum: number): number {
  return options.rng.integer(minimum, maximum);
}
function missing(message: string): never {
  throw new RoomGenerationError("MISSING_CONTENT", message);
}
