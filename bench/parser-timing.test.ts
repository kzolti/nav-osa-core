import { describe, it } from "node:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { xmlParser, XsdSchemaName } from "../src/index.js";
import { SAMPLES_DIR, getXmlFiles } from "../test/lib/testFiles.js";

const TIMING_FILE = join(import.meta.dirname, "..", "test", "snapshots", "timing.json");

describe("xmlParser timing benchmark", () => {
  it("measures parse time for all samples", async () => {
    console.log("\n================ xmlParser timing (validated, via src/index) ================");
    const xmlFiles = getXmlFiles();
    const results: { file: string; durationMs: number; valid: boolean }[] = [];

    for (const xmlFile of xmlFiles) {
      const xml = readFileSync(join(SAMPLES_DIR, xmlFile), "utf8");
      const start = performance.now();
      await xmlParser(xml, XsdSchemaName.Data);
      const end = performance.now();
      results.push({ file: xmlFile, durationMs: end - start, valid: true });
    }

    writeFileSync(TIMING_FILE, JSON.stringify(results, null, 2) + "\n");

    const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);
    const avgMs = totalMs / results.length;
    console.log(`\n  Total: ${totalMs.toFixed(2)}ms  Avg: ${avgMs.toFixed(2)}ms  Samples: ${results.length}`);
  });
});
