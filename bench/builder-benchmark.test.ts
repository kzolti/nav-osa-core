import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { XsdSchemaName } from "../src/index.js";
import { xmlParserLibxml2 } from "../src/parser/parser.js";
import { buildInvoiceXmlLibxml2 } from "../test/lib/xmlBuilderLibxml2.js";
import { buildInvoiceXml as buildInvoiceXmlFxp } from "../src/parser/builder.js";
import { SAMPLES_DIR, getXmlFiles } from "../test/lib/testFiles.js";

describe("fast-xml-builder vs libxml2-wasm builder timing", () => {
  // NOTE: both builders always validate their output (they never return
  // XML a tax authority would reject), so both are measured with
  // validation enabled.
  it("benchmark buildInvoiceXml all samples", async () => {
    console.log("\n================ builder benchmark: fast-xml-builder vs libxml2-wasm (validated) ================");
    const xmlFiles = getXmlFiles();
    const iterations = 30;

    const parsedSamples: unknown[] = [];
    for (const xmlFile of xmlFiles) {
      const xml = readFileSync(join(SAMPLES_DIR, xmlFile), "utf8");
      parsedSamples.push(await xmlParserLibxml2(xml, XsdSchemaName.Data));
    }

    for (const parsed of parsedSamples) {
      await buildInvoiceXmlFxp(parsed.InvoiceData);
      await buildInvoiceXmlLibxml2(parsed.InvoiceData);
      await buildInvoiceXmlLibxml2(parsed.InvoiceData);
    }

    let fxpTotal = 0;
    let libxml2Total = 0;
    let fileIndex = 0;

    for (const parsed of parsedSamples) {
      const xmlFile = xmlFiles[fileIndex++];
      let fxpFile = 0;
      let libxml2File = 0;

      for (let i = 0; i < iterations; i++) {
        if (i === 0) {
          await buildInvoiceXmlFxp(parsed.InvoiceData);
          await buildInvoiceXmlLibxml2(parsed.InvoiceData);
          continue;
        }
        const t1 = performance.now();
        await buildInvoiceXmlFxp(parsed.InvoiceData);
        const e1 = performance.now() - t1;
        fxpTotal += e1;
        fxpFile += e1;

        const t2 = performance.now();
        await buildInvoiceXmlLibxml2(parsed.InvoiceData);
        const e2 = performance.now() - t2;
        libxml2Total += e2;
        libxml2File += e2;
      }

      const n = iterations - 1;
      console.log(
        `  ${xmlFile.padEnd(52)} fxp=${(fxpFile / n).toFixed(4)}ms  wrapper=${(libxml2File / n).toFixed(4)}ms`,
      );
    }

    const totalSamples = parsedSamples.length * (iterations - 1);
    console.log(`\n  totals (validated, avg of ${totalSamples} samples):`);
    console.log(`    fxp builder:    ${(fxpTotal / totalSamples).toFixed(4)}ms`);
    console.log(`    wrapper builder:${(libxml2Total / totalSamples).toFixed(4)}ms`);
    console.log(`    fxp is ${(libxml2Total / fxpTotal).toFixed(2)}x faster than the wrapper`);
  });
});