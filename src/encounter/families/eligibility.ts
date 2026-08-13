import { validateMonsterFamilyReferences } from "../../content/families/references.js";
import type { FamilyCatalog, FamilyDefinition } from "../../content/families/types.js";
import type { MonsterCatalog } from "../../content/monsters/types.js";

/**
 * Returns defined families containing at least one procedural monster.
 *
 * Reference integrity is checked with the existing catalog validator. Family
 * source order is retained. All other monster legality belongs to later
 * selection stages and deliberately has no effect here.
 */
export function getEligibleEncounterFamilies(
  monsterCatalog: MonsterCatalog,
  familyCatalog: FamilyCatalog,
): readonly FamilyDefinition[] {
  validateMonsterFamilyReferences(monsterCatalog, familyCatalog);

  const proceduralMemberships = new Set<string>();
  for (const monster of monsterCatalog.monsters) {
    if (!monster.procedural) continue;
    for (const familyId of monster.families) proceduralMemberships.add(familyId);
  }

  return Object.freeze(
    familyCatalog.families.filter((family) => proceduralMemberships.has(family.id)),
  );
}
