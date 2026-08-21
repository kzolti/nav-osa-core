import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { xmlParser, buildInvoiceXml, XsdSchemaName } from "../src/index.js";
import { xmldiffCheck, isXmldiffAvailable } from "./lib/xmldiff.js";
import { SAMPLES_DIR, getXmlFiles } from "./lib/testFiles.js";
import { extractFields } from "../src/parser/extractor/xmlFieldExtractor.js";

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

describe("convertTagValue inconsistency (bővített - várhatóan bukik)", () => {
  it("BOOLEAN invalid 'yes' should not silently become false", async () => {
    const xml = `<InvoiceData><completenessIndicator>yes</completenessIndicator></InvoiceData>`;
    const parsed: any = await xmlParser(xml, XsdSchemaName.Data, { validate: false });
    // fix után string "yes" marad, most false → bukik
    assert.strictEqual(parsed.InvoiceData.completenessIndicator, "yes");
  });

  it("NUMBER with attribute should still be number", async () => {
    const xml = `<InvoiceData><lineNumber extra="x">5</lineNumber></InvoiceData>`;
    const parsed: any = await xmlParser(xml, XsdSchemaName.Data, { validate: false });
    const val = parsed.InvoiceData.lineNumber;
    const num = typeof val === "object" && val !== null ? (val as any)["#text"] : val;
    // parser most #text-et stringként hagyja ha van props, fix után number
    assert.strictEqual(typeof num, "number");
    assert.strictEqual(num, 5);
  });

  it("extractor vs parser boolean trim consistency", async () => {
    const xmlRoot = `<root><completenessIndicator> true </completenessIndicator></root>`;
    const { fields } = await extractFields<any>(xmlRoot, ["completenessIndicator"], { convertValues: true });
    const parsed: any = await xmlParser(
      `<InvoiceData><completenessIndicator> true </completenessIndicator></InvoiceData>`,
      XsdSchemaName.Data,
      { validate: false },
    );
    // extractor most nem trim-el, " true " → false, parser trim → true → eltérés
    assert.strictEqual(fields.completenessIndicator, true);
    assert.strictEqual(parsed.InvoiceData.completenessIndicator, true);
    assert.strictEqual(fields.completenessIndicator, parsed.InvoiceData.completenessIndicator);
  });
});
