import type { RoomHazard, WeightedRoomHazard } from "../../content/rooms/types.js";
import { RoomGenerationError } from "../errors.js";
import type { DungeonDepthBand } from "../types.js";
import type { RoomHazardSelection, SelectRoomHazardOptions } from "./types.js";

/** Selects the active neighborhood hazard using Bash-compatible depth weighting. */
export function selectRoomHazard(options: SelectRoomHazardOptions): RoomHazardSelection {
  const candidates = options.catalog.neighborhoodHazards
    .filter((value) => value.neighborhoodId === options.neighborhoodId)
    .map((membership) => ({
      hazard: hazardByName(options, membership),
      weight: membership.weight,
    }))
    .map((candidate) => ({
      hazard: candidate.hazard,
      weight: candidate.weight * depthMultiplier(options.depthBand, candidate.hazard),
    }));
  const totalWeight = candidates.reduce((total, candidate) => total + candidate.weight, 0);
  if (totalWeight === 0)
    throw new RoomGenerationError(
      "MISSING_CONTENT",
      `No room hazards are available for neighborhood "${options.neighborhoodId}".`,
    );

  const selectedRoll = options.rng.integer(1, totalWeight);
  let runningWeight = 0;
  for (const candidate of candidates) {
    runningWeight += candidate.weight;
    if (runningWeight >= selectedRoll)
      return Object.freeze({
        hazard: candidate.hazard,
        roll: selectedRoll,
        totalWeight,
      });
  }
  throw new Error("Unreachable hazard selection boundary.");
}

function hazardByName(
  options: SelectRoomHazardOptions,
  membership: WeightedRoomHazard,
): RoomHazard {
  const hazard = options.catalog.hazards.find((value) => value.name === membership.hazardName);
  if (hazard === undefined)
    throw new RoomGenerationError(
      "MISSING_CONTENT",
      `Unknown room hazard "${membership.hazardName}".`,
    );
  return hazard;
}

function depthMultiplier(depthBand: DungeonDepthBand, hazard: RoomHazard): number {
  if (depthBand === "shallow" && hazard.severity === "nuisance") return 4;
  if (depthBand === "middle") return 2;
  if (depthBand === "deep" && hazard.severity === "deadly") return 4;
  if (depthBand === "extreme" && hazard.severity === "deadly") return 6;
  return 1;
}
