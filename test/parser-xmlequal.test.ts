import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { xmlParser, buildInvoiceXml, XsdSchemaName } from "../src/index.js";
import { xmldiffCheck, isXmldiffAvailable } from "./lib/xmldiff.js";
import { SAMPLES_DIR, getXmlFiles } from "./lib/testFiles.js";

const hasXmldiff = isXmldiffAvailable();

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
