import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";
import { xmlParser, buildInvoiceXml, XsdSchemaName } from "../src/index.js";
import { xmldiffCheck, isXmldiffAvailable } from "./lib/xmldiff.js";

const SAMPLES_DIR = join(import.meta.dirname, "Peldaszamlak_v3.0");
const hasXmldiff = isXmldiffAvailable();

function getXmlFiles(): string[] {
  return readdirSync(SAMPLES_DIR)
    .filter((f) => extname(f) === ".xml")
    .sort();
}

(hasXmldiff ? describe : describe.skip)("xml-equal (xmldiff)", () => {
  for (const xmlFile of getXmlFiles()) {
    it(`round-trip matches: ${xmlFile}`, async () => {
      const xml1 = readFileSync(join(SAMPLES_DIR, xmlFile), "utf8");
      const json1 = await xmlParser(xml1, XsdSchemaName.Data);
      const xml2 = await buildInvoiceXml(json1.InvoiceData);

      const { equal, output } = xmldiffCheck(xml1, xml2);
      assert.ok(equal, `XML mismatch:\n${output}`);
    });
  }
});
