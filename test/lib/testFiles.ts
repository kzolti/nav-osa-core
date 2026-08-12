import { readdirSync } from "node:fs";
import { join, extname } from "node:path";

export const SAMPLES_DIR = join(import.meta.dirname, "..", "Peldaszamlak_v3.0");

export function getXmlFiles(): string[] {
  return readdirSync(SAMPLES_DIR)
    .filter((f) => extname(f) === ".xml")
    .sort();
}