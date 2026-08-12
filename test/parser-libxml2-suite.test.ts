import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { xmlParserLibxml2 } from "../src/parser/parser.js";
import { XsdSchemaName } from "../src/index.js";
import { validateInvoiceData } from "./lib/type-validator.js";
import { SAMPLES_DIR, getXmlFiles } from "./lib/testFiles.js";

const SNAPSHOTS_DIR = join(import.meta.dirname, "snapshots");

async function parse(file: string) {
  const xml = readFileSync(join(SAMPLES_DIR, file), "utf8");
  return xmlParserLibxml2<Record<string, any>>(xml, XsdSchemaName.Data);
}

describe("xmlParserLibxml2 snapshot regression", () => {
  for (const xmlFile of getXmlFiles()) {
    it(`matches snapshot: ${xmlFile}`, async () => {
      const xml = readFileSync(join(SAMPLES_DIR, xmlFile), "utf8");
      const baseName = basename(xmlFile, ".xml");
      const snapshotPath = join(SNAPSHOTS_DIR, `${baseName}.json`);

      const result = await xmlParserLibxml2(xml, XsdSchemaName.Data);
      const expected = JSON.parse(readFileSync(snapshotPath, "utf8"));

      assert.deepEqual(result, expected);
    });
  }
});

describe("xmlParserLibxml2 type validation", () => {
  for (const xmlFile of getXmlFiles()) {
    it(`conforms to nav-osa-types: ${xmlFile}`, async () => {
      const result = await parse(xmlFile);
      const errors = validateInvoiceData(result);
      assert.equal(errors.length, 0, JSON.stringify(errors, null, 2));
    });
  }
});