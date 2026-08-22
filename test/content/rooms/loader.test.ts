import { describe, expect, it } from "vitest";

import {
  loadOrdinaryRoomCatalog,
  OrdinaryRoomCatalogError,
  parseTsv,
} from "../../../src/content/index.js";

describe("loadOrdinaryRoomCatalog", () => {
  it("loads and deeply freezes the active ordinary-room catalog", () => {
    const catalog = loadOrdinaryRoomCatalog(validInput());
    expect(catalog.neighborhoods[0]).toEqual({
      id: "dungeon",
      name: "Dungeon",
      environmentKeys: ["dungeon"],
      treasureFlavor: "guard stores",
    });
    expect(catalog.signatures[0]?.features.map((value) => value.name)).toEqual(["Dial", "Arch"]);
    expect(catalog.hazards[0]).toEqual({
      name: "Falling Net",
      severity: "nuisance",
      trigger: "A wire releases it.",
      effect: "It restrains creatures.",
      counterplay: "Cut the net.",
    });
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog.signatures[0]?.features)).toBe(true);
  });

  it("rejects unsupported schemas with the originating source", () => {
    const input = validInput();
    expect(() =>
      loadOrdinaryRoomCatalog({ ...input, arrivals: table("wrong", "value", "arrivals.tsv") }),
    ).toThrow("arrivals.tsv:1: Unsupported schema");
  });

  it("rejects invalid frequencies and weights with source-aware rows", () => {
    const input = validInput();
    expect(() =>
      loadOrdinaryRoomCatalog({
        ...input,
        environments: table(
          "name\tdescription\tengine_environment\tfrequency",
          "Hall\tA hall\tdungeon\tRARE",
          "environments.tsv",
        ),
      }),
    ).toThrow("environments.tsv:2: Unknown room frequency");
    expect(() =>
      loadOrdinaryRoomCatalog({
        ...input,
        neighborhoodFeatures: table(
          "neighborhood_id\tfeature_name\tweight",
          "dungeon\tBrazier\t0",
          "weights.tsv",
        ),
      }),
    ).toThrow('weights.tsv:2: Field "weight"');
    expect(() =>
      loadOrdinaryRoomCatalog({
        ...input,
        hazards: table(
          "name\tseverity\ttrigger\teffect\tcounterplay",
          "Falling Net\textreme\tA wire.\tIt falls.\tCut it.",
          "hazards.tsv",
        ),
      }),
    ).toThrow('hazards.tsv:2: Unknown hazard severity "extreme"');
  });

  it("rejects dangling subtheme, environment, and feature references", () => {
    const input = validInput();
    expect(() =>
      loadOrdinaryRoomCatalog({
        ...input,
        neighborhoodFeatures: table(
          "neighborhood_id\tfeature_name\tweight",
          "dungeon\tMissing\t1",
          "weights.tsv",
        ),
      }),
    ).toThrow(OrdinaryRoomCatalogError);
    expect(() =>
      loadOrdinaryRoomCatalog({
        ...input,
        neighborhoodHazards: table(
          "neighborhood_id\thazard_name\tweight",
          "dungeon\tMissing\t1",
          "hazard-weights.tsv",
        ),
      }),
    ).toThrow('hazard-weights.tsv:2: Unknown hazard reference "Missing"');
  });

  it("rejects duplicate authored identities", () => {
    const input = validInput();
    const duplicate = table(
      "name\tdescription\tinteraction",
      "Brazier\tA brazier.\tIt tips.\nBRAZIER\tAnother.\tIt also tips.",
      "features.tsv",
    );
    expect(() => loadOrdinaryRoomCatalog({ ...input, features: duplicate })).toThrow(
      'Duplicate feature name "brazier"',
    );
  });
});

function validInput() {
  return {
    neighborhoods: table(
      "id\tname\tenvironment_keys\ttreasure_flavor",
      "dungeon\tDungeon\tdungeon\tguard stores",
      "neighborhoods.tsv",
    ),
    subthemes: table(
      "neighborhood_id\tid\tname\tdescription\tarchitecture\tlighting\tsound\tsmell",
      "dungeon\tguards\tGuards\tPatrols passed here.\tStone arches.\tDim.\tQuiet.\tDusty.",
      "subthemes.tsv",
    ),
    subthemeEnvironments: table(
      "neighborhood_id\tsubtheme_id\tenvironment_names",
      "dungeon\tguards\tHall",
      "compat.tsv",
    ),
    environments: table(
      "name\tdescription\tengine_environment\tfrequency",
      "Hall\tA hall\tdungeon\tCOMMON",
      "environments.tsv",
    ),
    features: table(
      "name\tdescription\tinteraction",
      "Brazier\tA brazier.\tIt tips.",
      "features.tsv",
    ),
    neighborhoodFeatures: table(
      "neighborhood_id\tfeature_name\tweight",
      "dungeon\tBrazier\t1",
      "weights.tsv",
    ),
    hazards: table(
      "name\tseverity\ttrigger\teffect\tcounterplay",
      "Falling Net\tnuisance\tA wire releases it.\tIt restrains creatures.\tCut the net.",
      "hazards.tsv",
    ),
    neighborhoodHazards: table(
      "neighborhood_id\thazard_name\tweight",
      "dungeon\tFalling Net\t1",
      "hazard-weights.tsv",
    ),
    arrivals: table("text", "The passage narrows.", "arrivals.tsv"),
    doorways: table("text", "A door waits.", "doorways.tsv"),
    exits: table("name\tdescription", "Passage\tIt continues.", "exits.tsv"),
    signatures: table(
      "name\tdescription\tengine_environment\tfeature_one\tfeature_one_description\tfeature_one_interaction\tfeature_two\tfeature_two_description\tfeature_two_interaction\tlighting\tsound\tsmell\tstory\tneighborhoods\tfrequency",
      "Geometry\tImpossible walls.\tdungeon\tDial\tA dial.\tIt turns.\tArch\tAn arch.\tIt rotates.\tWhite.\tEarly echoes.\tOzone.\tA trail crosses walls.\tdungeon\tUNIQUE",
      "signatures.tsv",
    ),
    depthFamilies: table(
      "depth_band\tneighborhood_id\tvalue\tweight",
      "shallow\t*\tgoblinoids\t1",
      "depth-families.tsv",
    ),
    depthFormations: table(
      "depth_band\tneighborhood_id\tvalue\tweight",
      "shallow\t*\tswarm\t1",
      "depth-formations.tsv",
    ),
  } as const;
}

function table(header: string, row: string, source: string) {
  return parseTsv(`${header}\n${row}`, { source });
}
