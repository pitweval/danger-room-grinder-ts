import { getMonsterCatalogMetadata } from "../monsters/loader.js";
import type { MonsterCatalog, MonsterDefinition } from "../monsters/types.js";
import { MonsterFamilyReferenceError } from "./errors.js";
import type {
  FamilyCatalog,
  MissingMonsterFamilyReference,
  ValidateMonsterFamilyReferencesOptions,
} from "./types.js";

/**
 * Confirms that each normalized monster family reference has a definition.
 * Missing references retain monster and family-list order. Catalogs are not
 * modified, and unreferenced family definitions remain valid.
 */
export function validateMonsterFamilyReferences(
  monsterCatalog: MonsterCatalog,
  familyCatalog: FamilyCatalog,
  options: ValidateMonsterFamilyReferencesOptions = {},
): void {
  const knownFamilies = new Set(familyCatalog.families.map((family) => family.id));
  const metadata = getMonsterCatalogMetadata(monsterCatalog);
  const source = options.source ?? metadata?.source ?? "monster catalog";
  const missing: MissingMonsterFamilyReference[] = [];
  const messages: string[] = [];

  for (const monster of monsterCatalog.monsters) {
    for (const familyId of monster.families) {
      if (knownFamilies.has(familyId)) continue;

      const reference = Object.freeze({
        monsterId: monster.id,
        monsterName: monster.name,
        familyId,
      });
      missing.push(reference);
      messages.push(formatMissingReference(reference, monster, source, metadata?.lines));
    }
  }

  if (missing.length > 0) {
    throw new MonsterFamilyReferenceError(messages.join("\n"), missing);
  }
}

function formatMissingReference(
  reference: MissingMonsterFamilyReference,
  monster: MonsterDefinition,
  source: string,
  lines: ReadonlyMap<MonsterDefinition, number> | undefined,
): string {
  const line = lines?.get(monster);
  const location = line === undefined ? source : `${source}:${line}`;
  return `${location}: Monster "${reference.monsterId}" (${reference.monsterName}) references unknown family "${reference.familyId}".`;
}
