import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { xmlParser, XsdSchemaName } from "../src/index.js";
import { validateInvoiceData } from "./lib/type-validator.js";

const SAMPLES_DIR = join(import.meta.dirname, "Peldaszamlak_v3.0");
const SNAPSHOTS_DIR = join(import.meta.dirname, "snapshots");

function getXmlFiles(): string[] {
  return readdirSync(SAMPLES_DIR)
    .filter((f) => extname(f) === ".xml")
    .sort();
}

describe("xmlParser snapshot regression", () => {
  for (const xmlFile of getXmlFiles()) {
    it(`matches snapshot: ${xmlFile}`, async () => {
      const xmlPath = join(SAMPLES_DIR, xmlFile);
      const xml = readFileSync(xmlPath, "utf8");
      const baseName = basename(xmlFile, ".xml");
      const snapshotPath = join(SNAPSHOTS_DIR, `${baseName}.json`);

      const result = await xmlParser(xml, XsdSchemaName.Data);
      const expected = JSON.parse(readFileSync(snapshotPath, "utf8"));

      assert.deepEqual(result, expected);
    });
  }
});

describe("xmlParser type validation", () => {
  for (const xmlFile of getXmlFiles()) {
    it(`conforms to nav-osa-types: ${xmlFile}`, async () => {
      const xmlPath = join(SAMPLES_DIR, xmlFile);
      const xml = readFileSync(xmlPath, "utf8");
      const result = await xmlParser(xml, XsdSchemaName.Data);

      const errors = validateInvoiceData(result);
      assert.equal(errors.length, 0, JSON.stringify(errors, null, 2));
    });
  }
});
