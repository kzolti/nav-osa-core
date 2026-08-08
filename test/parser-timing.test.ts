import { describe, it } from "node:test";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { xmlParser } from "../src/index.js";

const SAMPLES_DIR = join(import.meta.dirname, "Peldaszamlak_v3.0");
const TIMING_FILE = join(import.meta.dirname, "snapshots", "timing.json");

function getXmlFiles(): string[] {
  return readdirSync(SAMPLES_DIR)
    .filter((f) => extname(f) === ".xml")
    .sort();
}

describe("xmlParser timing benchmark", () => {
  it("measures parse time for all samples", async () => {
    const xmlFiles = getXmlFiles();
    const results: { file: string; durationMs: number; valid: boolean }[] = [];

    for (const xmlFile of xmlFiles) {
      const xml = readFileSync(join(SAMPLES_DIR, xmlFile), "utf8");
      const start = performance.now();
      await xmlParser(xml);
      const end = performance.now();
      results.push({ file: xmlFile, durationMs: end - start, valid: true });
    }

    writeFileSync(TIMING_FILE, JSON.stringify(results, null, 2) + "\n");

    const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);
    const avgMs = totalMs / results.length;
    console.log(`\n  Total: ${totalMs.toFixed(2)}ms  Avg: ${avgMs.toFixed(2)}ms  Samples: ${results.length}`);
  });
});
