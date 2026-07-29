import type { ParsedTsv, TsvRow } from "../types.js";
import { getTsvSource } from "../tsv-parser.js";
import { MonsterCatalogError } from "./errors.js";
import {
  normalizeFamilies,
  normalizePreferredEnvironments,
  normalizeRoles,
  parseRequirements,
  parseTags,
} from "./normalization.js";
import { detectMonsterSchema, type MonsterSchema } from "./schemas.js";
import type { LoadMonsterCatalogOptions, MonsterCatalog, MonsterDefinition } from "./types.js";
import {
  parseEligibility,
  parseProcedural,
  parseXp,
  validateChallengeRating,
  validateCreatureType,
  validateMetadata,
  validateMonsterId,
  validateRequiredText,
  validateSize,
} from "./validation.js";

const DEFAULT_SOURCE = "monster catalog";

/**
 * Validates preferred 16-column or legacy 10-column monster TSV data.
 *
 * Legacy rows receive the established metadata defaults before both schemas
 * enter one normalization path. Records remain in source order; encounter
 * selection, family resolution, and every other gameplay behavior are
 * deliberately deferred.
 */
export function loadMonsterCatalog(
  parsedTsv: ParsedTsv,
  options: LoadMonsterCatalogOptions = {},
): MonsterCatalog {
  const source = options.source ?? getTsvSource(parsedTsv) ?? DEFAULT_SOURCE;
  const schema = detectMonsterSchema(parsedTsv.headers);

  if (schema === undefined) {
    const actual = parsedTsv.headers.join("\\t");
    throw new MonsterCatalogError(
      `Unsupported monster schema "${actual}"; expected the exact supported 10-column legacy or 16-column preferred header.`,
      source,
      1,
    );
  }

  if (parsedTsv.rows.length === 0) {
    throw new MonsterCatalogError("Expected at least one monster record.", source);
  }

  const monsters: MonsterDefinition[] = [];
  const idLines = new Map<string, number>();
  const nameLines = new Map<string, number>();
  let previousId: string | undefined;

  for (const row of parsedTsv.rows) {
    const monster = parseMonster(row, schema, source);
    const originalIdLine = idLines.get(monster.id);

    if (originalIdLine !== undefined) {
      throw new MonsterCatalogError(
        `Duplicate monster ID "${monster.id}"; first defined at ${source}:${originalIdLine}.`,
        source,
        row.lineNumber,
      );
    }

    if (previousId !== undefined && monster.id < previousId) {
      throw new MonsterCatalogError(
        "Monster IDs must be sorted in ascending lexical order.",
        source,
        row.lineNumber,
      );
    }

    const normalizedName = monster.name.toLowerCase();
    const originalNameLine = nameLines.get(normalizedName);

    if (originalNameLine !== undefined) {
      throw new MonsterCatalogError(
        `Duplicate monster name "${monster.name}"; first defined at ${source}:${originalNameLine}.`,
        source,
        row.lineNumber,
      );
    }

    idLines.set(monster.id, row.lineNumber);
    nameLines.set(normalizedName, row.lineNumber);
    previousId = monster.id;
    monsters.push(monster);
  }

  return Object.freeze({ monsters: Object.freeze(monsters) });
}

function parseMonster(row: TsvRow, schema: MonsterSchema, source: string): MonsterDefinition {
  const value = (header: string): string => row.values[header] as string;
  const preferred = schema === "preferred";
  const line = row.lineNumber;

  return Object.freeze({
    id: validateMonsterId(value("id"), source, line),
    name: validateRequiredText(value("name"), "Name", source, line),
    cr: validateChallengeRating(value("cr"), source, line),
    xp: parseXp(value("xp"), source, line),
    size: validateSize(value("size"), source, line),
    type: validateCreatureType(value("type"), source, line),
    roles: normalizeRoles(value("roles"), source, line),
    tags: parseTags(value("tags"), source, line),
    requirements: parseRequirements(value("requirements"), source, line),
    families: normalizeFamilies(value("families"), source, line),
    preferredEnvironments: preferred
      ? normalizePreferredEnvironments(value("preferred_environments"), source, line)
      : Object.freeze([]),
    bossEligible: preferred
      ? parseEligibility(value("boss_eligible"), "boss_eligible", source, line)
      : true,
    minionEligible: preferred
      ? parseEligibility(value("minion_eligible"), "minion_eligible", source, line)
      : true,
    procedural: preferred ? parseProcedural(value("procedural"), source, line) : true,
    source: preferred ? validateMetadata(value("source"), "Source", source, line) : "-",
    notes: preferred ? validateMetadata(value("notes"), "Notes", source, line) : "-",
  });
}
