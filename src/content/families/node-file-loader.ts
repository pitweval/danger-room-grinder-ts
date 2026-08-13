import { loadTsvFile } from "../node-file-loader.js";
import { loadFamilyCatalog } from "./loader.js";
import type { FamilyCatalog, LoadFamilyCatalogOptions } from "./types.js";

/** Loads one canonical family TSV file without enabling comments. */
export async function loadFamilyCatalogFile(
  path: string,
  options: LoadFamilyCatalogOptions = {},
): Promise<FamilyCatalog> {
  const parsedTsv = await loadTsvFile(path);
  return loadFamilyCatalog(parsedTsv, { ...options, source: path });
}
