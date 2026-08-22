import type { OrdinaryRoomCatalog, TreasureCatalog } from "../../src/content/index.js";

export const ROOM_CATALOG: OrdinaryRoomCatalog = deepFreeze({
  neighborhoods: [
    {
      id: "subterranean-dungeon",
      name: "Subterranean Dungeon",
      environmentKeys: ["dungeon"],
      treasureFlavor: "practical stores and abandoned belongings",
    },
  ],
  subthemes: [
    {
      neighborhoodId: "subterranean-dungeon",
      id: "guards",
      name: "Guard Routes",
      description: "Old patrol routes cross here.",
      architecture: "Arrow slits watch the floor.",
      lighting: "Dim lamps burn.",
      sound: "Bootsteps echo.",
      smell: "Oil scents the air.",
    },
    {
      neighborhoodId: "subterranean-dungeon",
      id: "stores",
      name: "Forgotten Stores",
      description: "Crates crowd the walls.",
      architecture: "Shelves bow under dust.",
      lighting: "One lamp gutters.",
      sound: "Wood creaks.",
      smell: "Dust hangs in the air.",
    },
  ],
  subthemeEnvironments: [
    {
      neighborhoodId: "subterranean-dungeon",
      subthemeId: "guards",
      environmentNames: ["Guard Post", "Long Corridor"],
    },
    {
      neighborhoodId: "subterranean-dungeon",
      subthemeId: "stores",
      environmentNames: ["Guard Post"],
    },
  ],
  environments: [
    {
      name: "Guard Post",
      description: "a fortified guard post",
      engineEnvironment: "dungeon",
      frequency: "COMMON",
    },
    {
      name: "Long Corridor",
      description: "a long corridor",
      engineEnvironment: "dungeon",
      frequency: "COMMON",
    },
  ],
  features: [
    { name: "Brazier", description: "A brazier glows.", interaction: "It can be overturned." },
    { name: "Crates", description: "Crates fill an alcove.", interaction: "They provide cover." },
    { name: "Winch", description: "A winch strains.", interaction: "It moves a gate." },
  ],
  neighborhoodFeatures: [
    { neighborhoodId: "subterranean-dungeon", featureName: "Brazier", weight: 1 },
    { neighborhoodId: "subterranean-dungeon", featureName: "Crates", weight: 1 },
    { neighborhoodId: "subterranean-dungeon", featureName: "Winch", weight: 1 },
  ],
  hazards: [
    {
      name: "Falling Net",
      severity: "nuisance",
      trigger: "A trip wire releases a net.",
      effect: "The net restrains creatures beneath it.",
      counterplay: "Spot the wire or cut the net.",
    },
  ],
  neighborhoodHazards: [
    { neighborhoodId: "subterranean-dungeon", hazardName: "Falling Net", weight: 1 },
  ],
  arrivals: ["The passage narrows.", "Three steps rise."],
  doorways: ["An oak door waits.", "An iron door waits."],
  exits: [
    { name: "North", description: "A passage runs north." },
    { name: "East", description: "A passage runs east." },
    { name: "South", description: "A passage runs south." },
    { name: "West", description: "A passage runs west." },
  ],
  signatures: [
    {
      name: "Impossible Geometry",
      description: "a chamber with impossible geometry",
      engineEnvironment: "dungeon",
      features: [
        { name: "Turning Arch", description: "An arch turns.", interaction: "It rotates gravity." },
        {
          name: "Tesseract",
          description: "A frame folds space.",
          interaction: "It links corners.",
        },
      ],
      lighting: "White light outlines every edge.",
      sound: "Sounds arrive early.",
      smell: "Ozone sharpens the air.",
      story: "A blood trail crosses three surfaces.",
      neighborhoods: ["subterranean-dungeon"],
      frequency: "UNIQUE",
    },
  ],
  depthFamilies: ["shallow", "middle", "deep", "extreme"].map((depthBand) => ({
    depthBand,
    neighborhoodId: "*",
    value: "goblinoids",
    weight: 1,
  })),
  depthFormations: ["shallow", "middle", "deep", "extreme"].map((depthBand) => ({
    depthBand,
    neighborhoodId: "*",
    value: "swarm",
    weight: 1,
  })),
});

export const TREASURE_CATALOG: TreasureCatalog = deepFreeze({
  items: [
    {
      name: "Potion of Healing",
      category: "potion",
      rarity: "common",
      description: "A red restorative draught is sealed in a sturdy travel vial.",
    },
    {
      name: "Scroll of Knock",
      category: "scroll",
      rarity: "uncommon",
      description: "The vellum is folded like a key.",
    },
    {
      name: "Sun Blade",
      category: "weapon",
      rarity: "rare",
      description: "Only a decorated hilt remains.",
    },
    {
      name: "Carved Bone Statuette",
      category: "art",
      rarity: "mundane",
      description: "A palm-sized figure has a hollow base.",
    },
    {
      name: "Prisoner's Seal",
      category: "quest",
      rarity: "uncommon",
      description: "A signet proves that a captive was held here.",
    },
    {
      name: "Tiny Mechanical Crab",
      category: "curiosity",
      rarity: "curiosity",
      description: "A wind-up crab seeks salt water.",
    },
  ],
  hazardSalvage: [
    {
      hazardName: "Falling Net",
      description: "weighted netting, trip wire, and release hooks",
    },
  ],
});

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
