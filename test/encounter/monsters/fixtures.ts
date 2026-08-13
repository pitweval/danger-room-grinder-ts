import type {
  FamilyDefinition,
  MonsterCatalog,
  MonsterDefinition,
  MonsterRole,
} from "../../../src/content/index.js";

export const TEST_FAMILY: FamilyDefinition = Object.freeze({
  id: "test_family",
  name: "Test Family",
  familyType: "PRIMARY",
  description: "A family used by deterministic selection tests.",
});

interface MonsterOverrides {
  readonly xp?: number;
  readonly cr?: string;
  readonly size?: string;
  readonly roles?: readonly MonsterRole[];
  readonly tags?: readonly string[];
  readonly requirements?: readonly string[];
  readonly families?: readonly string[];
  readonly preferredEnvironments?: readonly string[];
  readonly bossEligible?: boolean;
  readonly minionEligible?: boolean;
  readonly procedural?: boolean;
}

export function monster(id: string, overrides: MonsterOverrides = {}): MonsterDefinition {
  return Object.freeze({
    id,
    name: id.replaceAll("-", " "),
    cr: overrides.cr ?? "1/2",
    xp: overrides.xp ?? 100,
    size: overrides.size ?? "Medium",
    type: "Humanoid",
    roles: Object.freeze([...(overrides.roles ?? ["soldier"])]),
    tags: Object.freeze([...(overrides.tags ?? ["test-family"])]),
    requirements: Object.freeze([...(overrides.requirements ?? [])]),
    families: Object.freeze([...(overrides.families ?? [TEST_FAMILY.id])]),
    preferredEnvironments: Object.freeze([...(overrides.preferredEnvironments ?? [])]),
    bossEligible: overrides.bossEligible ?? true,
    minionEligible: overrides.minionEligible ?? true,
    procedural: overrides.procedural ?? true,
    source: "test",
    notes: "-",
  });
}

export function monsterCatalog(...monsters: readonly MonsterDefinition[]): MonsterCatalog {
  return Object.freeze({ monsters: Object.freeze([...monsters]) });
}
