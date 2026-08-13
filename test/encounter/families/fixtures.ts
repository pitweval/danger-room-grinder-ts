import type {
  FamilyCatalog,
  FamilyDefinition,
  FamilyType,
  MonsterCatalog,
  MonsterDefinition,
} from "../../../src/content/index.js";

export function family(
  id: string,
  familyType: FamilyType = "PRIMARY",
  name = id.replaceAll("_", " "),
): FamilyDefinition {
  return Object.freeze({
    id,
    name,
    familyType,
    description: `${name} family.`,
  });
}

export function familyCatalog(...families: readonly FamilyDefinition[]): FamilyCatalog {
  return Object.freeze({ families: Object.freeze([...families]) });
}

export function monster(
  id: string,
  families: readonly string[],
  procedural = true,
): MonsterDefinition {
  return Object.freeze({
    id,
    name: id.replaceAll("-", " "),
    cr: "1",
    xp: 200,
    size: "Medium",
    type: "Humanoid",
    roles: Object.freeze(["soldier"]),
    tags: Object.freeze([]),
    requirements: Object.freeze([]),
    families: Object.freeze([...families]),
    preferredEnvironments: Object.freeze([]),
    bossEligible: true,
    minionEligible: true,
    procedural,
    source: "test",
    notes: "-",
  });
}

export function monsterCatalog(...monsters: readonly MonsterDefinition[]): MonsterCatalog {
  return Object.freeze({ monsters: Object.freeze([...monsters]) });
}
