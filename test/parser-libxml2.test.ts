import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { XsdSchemaName } from "../src/index.js";
import { xmlParser as xmlParserFxp } from "./lib/xmlParserFxp.js";
import { xmlParserLibxml2 } from "../src/parser/parser.js";
import { SAMPLES_DIR, getXmlFiles } from "./lib/testFiles.js";

describe("libxml2-wasm vs fast-xml-parser comparison", () => {
  for (const xmlFile of getXmlFiles()) {
    it(`output matches: ${xmlFile}`, async () => {
      const xml = readFileSync(join(SAMPLES_DIR, xmlFile), "utf8");
      const resultFxp = await xmlParserFxp(xml, XsdSchemaName.Data, { validate: false });
      const resultLibxml2 = await xmlParserLibxml2(xml, XsdSchemaName.Data, { validate: false });
      assert.deepEqual(resultLibxml2, resultFxp);
      assert.equal(JSON.stringify(resultLibxml2), JSON.stringify(resultFxp));
    });
  }
});