import type { MissingMonsterFamilyReference } from "./types.js";

/** A family-schema or family-record validation failure. */
export class FamilyCatalogError extends Error {
  public readonly source: string;
  public readonly lineNumber: number | undefined;

  public constructor(message: string, source: string, lineNumber?: number) {
    const location = lineNumber === undefined ? source : `${source}:${lineNumber}`;
    super(`${location}: ${message}`);

    this.name = "FamilyCatalogError";
    this.source = source;
    this.lineNumber = lineNumber;
  }
}

/** One or more monster records reference undefined family IDs. */
export class MonsterFamilyReferenceError extends Error {
  public readonly missingReferences: readonly MissingMonsterFamilyReference[];

  public constructor(message: string, missingReferences: readonly MissingMonsterFamilyReference[]) {
    super(message);
    this.name = "MonsterFamilyReferenceError";
    this.missingReferences = Object.freeze([...missingReferences]);
  }
}
