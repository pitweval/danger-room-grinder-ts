import { getTsvSource } from "../tsv-parser.js";
import type { ParsedTsv, TsvRow } from "../types.js";
import { FamilyCatalogError } from "./errors.js";
import { detectFamilySchema, type FamilySchema } from "./schemas.js";
import type { FamilyCatalog, FamilyDefinition, LoadFamilyCatalogOptions } from "./types.js";
import { normalizeFamilyId, parseFamilyType, validateFamilyText } from "./validation.js";

const DEFAULT_SOURCE = "family catalog";

/**
 * Loads exact four-column preferred or three-column legacy family TSV data.
 *
 * IDs are lowercased without trimming. Names, descriptions, and source order
 * are preserved. Legacy definitions receive `PRIMARY`. This module stores
 * metadata only; family selection and procedural weighting remain deferred.
 */
export function loadFamilyCatalog(
  parsedTsv: ParsedTsv,
  options: LoadFamilyCatalogOptions = {},
): FamilyCatalog {
  const source = options.source ?? getTsvSource(parsedTsv) ?? DEFAULT_SOURCE;
  const schema = detectFamilySchema(parsedTsv.headers);

  if (schema === undefined) {
    const actual = parsedTsv.headers.join("\\t");
    throw new FamilyCatalogError(
      `Unsupported family schema "${actual}"; expected the exact supported 3-column legacy or 4-column preferred header.`,
      source,
      1,
    );
  }

  const families: FamilyDefinition[] = [];
  const idLines = new Map<string, number>();
  const nameLines = new Map<string, number>();

  for (const row of parsedTsv.rows) {
    const family = parseFamily(row, schema, source);
    const originalIdLine = idLines.get(family.id);
    if (originalIdLine !== undefined) {
      throw new FamilyCatalogError(
        `Duplicate family ID "${family.id}"; first defined at ${source}:${originalIdLine}.`,
        source,
        row.lineNumber,
      );
    }

    const normalizedName = family.name.toLowerCase();
    const originalNameLine = nameLines.get(normalizedName);
    if (originalNameLine !== undefined) {
      throw new FamilyCatalogError(
        `Duplicate family name "${family.name}"; first defined at ${source}:${originalNameLine}.`,
        source,
        row.lineNumber,
      );
    }

    idLines.set(family.id, row.lineNumber);
    nameLines.set(normalizedName, row.lineNumber);
    families.push(family);
  }

  return Object.freeze({ families: Object.freeze(families) });
}

function parseFamily(row: TsvRow, schema: FamilySchema, source: string): FamilyDefinition {
  const value = (header: string): string => row.values[header] as string;
  const preferred = schema === "preferred";

  return Object.freeze({
    id: normalizeFamilyId(value("id"), source, row.lineNumber),
    name: validateFamilyText(value("name"), "name", source, row.lineNumber),
    familyType: preferred
      ? parseFamilyType(value("family_type"), source, row.lineNumber)
      : "PRIMARY",
    description: validateFamilyText(value("description"), "description", source, row.lineNumber),
  });
}
