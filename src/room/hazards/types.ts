import type { OrdinaryRoomCatalog, RoomHazard } from "../../content/rooms/types.js";
import type { RandomGenerator } from "../../rng/index.js";
import type { DungeonDepthBand } from "../types.js";

export interface SelectRoomHazardOptions {
  readonly catalog: Pick<OrdinaryRoomCatalog, "hazards" | "neighborhoodHazards">;
  readonly neighborhoodId: string;
  readonly depthBand: DungeonDepthBand;
  readonly rng: Pick<RandomGenerator, "integer">;
}

export interface RoomHazardSelection {
  readonly hazard: RoomHazard;
  readonly roll: number;
  readonly totalWeight: number;
}
