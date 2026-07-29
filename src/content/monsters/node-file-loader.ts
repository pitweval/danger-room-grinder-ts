import { loadTsvFile } from "../node-file-loader.js";
import { loadMonsterCatalog } from "./loader.js";
import type { MonsterCatalog } from "./types.js";

/**
 * Loads one canonical monster TSV file without enabling TSV comments.
 */
export async function loadMonsterCatalogFile(path: string): Promise<MonsterCatalog> {
  const parsedTsv = await loadTsvFile(path);
  return loadMonsterCatalog(parsedTsv, { source: path });
}
