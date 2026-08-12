import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import { xmlParser, XsdSchemaName } from "../src/index.js";
import { validateInvoiceData, ValidationError } from "./lib/type-validator.js";
import { SAMPLES_DIR, getXmlFiles } from "./lib/testFiles.js";

const SNAPSHOTS_DIR = join(import.meta.dirname, "..", "test", "snapshots");
const TIMING_FILE = join(import.meta.dirname, "..", "test", "snapshots", "timing.json");

interface TimingEntry {
  file: string;
  durationMs: number;
  valid: boolean;
  errors: ValidationError[];
}

async function main() {
  const xmlFiles = getXmlFiles();
  console.log(`Found ${xmlFiles.length} XML samples\n`);

  mkdirSync(SNAPSHOTS_DIR, { recursive: true });

  const timings: TimingEntry[] = [];
  let pass = 0;
  let fail = 0;

  for (const xmlFile of xmlFiles) {
    const xmlPath = join(SAMPLES_DIR, xmlFile);
    const xml = readFileSync(xmlPath, "utf8");
    const baseName = basename(xmlFile, ".xml");
    const snapshotPath = join(SNAPSHOTS_DIR, `${baseName}.json`);

    const start = performance.now();
    let parsed: unknown;
    let parseError: Error | null = null;
    try {
      parsed = await xmlParser(xml, XsdSchemaName.Data);
    } catch (e) {
      parseError = e as Error;
    }
    const end = performance.now();
    const durationMs = end - start;

    if (parseError) {
      console.log(`✗ ${xmlFile}`);
      console.log(`  PARSE ERROR: ${parseError.message}`);
      timings.push({ file: xmlFile, durationMs, valid: false, errors: [{ path: "<parse>", message: parseError.message }] });
      fail++;
      continue;
    }

    const errors = validateInvoiceData(parsed);
    const valid = errors.length === 0;

    if (valid) {
      console.log(`✓ ${xmlFile} (${durationMs.toFixed(2)}ms)`);
      pass++;
    } else {
      console.log(`✗ ${xmlFile} (${durationMs.toFixed(2)}ms)`);
      for (const err of errors) {
        console.log(`  TYPE ERROR: ${err.path} — ${err.message}`);
      }
      fail++;
    }

    writeFileSync(snapshotPath, JSON.stringify(parsed, null, 2) + "\n");
    timings.push({ file: xmlFile, durationMs, valid, errors });
  }

  writeFileSync(TIMING_FILE, JSON.stringify(timings, null, 2) + "\n");

  const totalMs = timings.reduce((sum, t) => sum + t.durationMs, 0);
  const avgMs = totalMs / timings.length;

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Pass: ${pass}  Fail: ${fail}  Total: ${xmlFiles.length}`);
  console.log(`Total parse time: ${totalMs.toFixed(2)}ms  Avg: ${avgMs.toFixed(2)}ms`);
  console.log(`\nSnapshots saved to: test/snapshots/`);
  console.log(`Timing saved to: test/snapshots/timing.json`);

  if (fail > 0) {
    process.exit(1);
  }
}

main();
