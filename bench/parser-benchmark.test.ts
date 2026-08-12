import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { XsdSchemaName } from "../src/index.js";
import { xmlParser as xmlParserFxp } from "../test/lib/xmlParserFxp.js";
import { xmlParserLibxml2 } from "../src/parser/parser.js";
import { SAMPLES_DIR, getXmlFiles } from "../test/lib/testFiles.js";

describe("libxml2-wasm vs fast-xml-parser timing", () => {
  async function runBenchmark(validate: boolean, iterations: number) {
    const xmlFiles = getXmlFiles();

    console.log(`\n================ parser benchmark: fast-xml-parser vs libxml2-wasm (validate=${validate}) ================`);

    // Warmup: WASM module init + first parse of each parser (not measured)
    for (const xmlFile of xmlFiles) {
      const xml = readFileSync(join(SAMPLES_DIR, xmlFile), "utf8");
      await xmlParserFxp(xml, XsdSchemaName.Data, { validate });
      await xmlParserLibxml2(xml, XsdSchemaName.Data, { validate });
    }

    let fxpTotal = 0;
    let libxml2Total = 0;

    for (const xmlFile of xmlFiles) {
      const xml = readFileSync(join(SAMPLES_DIR, xmlFile), "utf8");

      let fxpFile = 0;
      let libxml2File = 0;

      for (let i = 0; i < iterations; i++) {
        const t1 = performance.now();
        await xmlParserFxp(xml, XsdSchemaName.Data, { validate });
        const elapsed1 = performance.now() - t1;
        fxpTotal += elapsed1;
        fxpFile += elapsed1;

        const t2 = performance.now();
        await xmlParserLibxml2(xml, XsdSchemaName.Data, { validate });
        const elapsed2 = performance.now() - t2;
        libxml2Total += elapsed2;
        libxml2File += elapsed2;
      }

      const n = iterations;
      console.log(
        `  ${xmlFile.padEnd(52)} fxp=${(fxpFile / n).toFixed(4)}ms  libxml2=${(libxml2File / n).toFixed(4)}ms`
      );
    }

    const totalSamples = xmlFiles.length * iterations;
    console.log(
      `\n  [validate=${validate}] fxp: avg=${(fxpTotal / totalSamples).toFixed(4)}ms  libxml2: avg=${(libxml2Total / totalSamples).toFixed(4)}ms`
    );
    console.log(`  [validate=${validate}] libxml2 is ${(fxpTotal / libxml2Total).toFixed(2)}x faster than fxp`);
  }

  it("benchmark all samples (validate=false)", async () => {
    await runBenchmark(false, 50);
  });

  it("benchmark all samples (validate=true)", async () => {
    await runBenchmark(true, 10);
  });
});
