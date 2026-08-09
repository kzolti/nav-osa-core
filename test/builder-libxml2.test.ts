import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";
import { xmlParserLibxml2 } from "../src/parser/xmlParserLibxml2.js";
import { buildInvoiceXmlLibxml2, buildApiRequestXmlLibxml2 } from "../src/parser/xmlBuilderLibxml2.js";
import { xmldiffCheck, isXmldiffAvailable } from "./lib/xmldiff.js";
import { xmlParser, XmlValidationError, XsdSchemaName } from "../src/index.js";
import { validateXml } from "../src/parser/xsdValidator.js";

const SAMPLES_DIR = join(import.meta.dirname, "Peldaszamlak_v3.0");
const hasXmldiff = isXmldiffAvailable();

function getXmlFiles(): string[] {
  return readdirSync(SAMPLES_DIR)
    .filter((f) => extname(f) === ".xml")
    .sort();
}

describe("libxml2-wasm XML builder", () => {
  for (const xmlFile of getXmlFiles()) {
    it(`builds valid InvoiceData XML: ${xmlFile}`, async () => {
      const xml = readFileSync(join(SAMPLES_DIR, xmlFile), "utf8");
const parsed = await xmlParserLibxml2<any>(xml, XsdSchemaName.Data);
      const built = await buildInvoiceXmlLibxml2(parsed.InvoiceData);

      assert.ok(built.startsWith("<InvoiceData"));
      assert.ok(built.includes("</InvoiceData>"));
      assert.ok(built.includes('xmlns="http://schemas.nav.gov.hu/OSA/3.0/data"'));
      assert.ok(built.includes('xmlns:base="http://schemas.nav.gov.hu/OSA/3.0/base"'));
      assert.ok(built.includes("<base:taxpayerId>"));
      assert.ok(built.includes("</base:taxpayerId>"));

      const validation = await validateXml(built, XsdSchemaName.Data);
      assert.ok(validation.valid, validation.errors.join("\n"));
    });
  }

  it("round-trip: libxml2 parse -> libxml2 build -> fxp+libxml2 parse identical", async () => {
    const xml = readFileSync(join(SAMPLES_DIR, "Belfoldi termekertekesites.xml"), "utf8");
    const parsed = await xmlParserLibxml2<any>(xml, XsdSchemaName.Data);
    const built = await buildInvoiceXmlLibxml2(parsed.InvoiceData);

const reFxp = await xmlParser<any>(built, XsdSchemaName.Data, { validate: false });
const reLib = await xmlParserLibxml2<any>(built, XsdSchemaName.Data, { validate: false });
    assert.deepEqual(reLib, reFxp);
    assert.equal(reLib.InvoiceData.invoiceNumber, "2021/000123");
    assert.equal(reLib.InvoiceData.completenessIndicator, false);
  });
});

describe("libxml2-wasm API builder", () => {
  const tokenExchangeRequest = {
    '@_xmlns': 'http://schemas.nav.gov.hu/OSA/3.0/api',
    '@_xmlns:common': 'http://schemas.nav.gov.hu/NTCA/1.0/common',
    header: {
      requestId: 'RID'.padEnd(30, 'x'),
      timestamp: '2025-01-01T00:00:00.000Z',
      requestVersion: '3.0',
      headerVersion: '1.0',
    },
    user: {
      login: 'testuser',
      passwordHash: {
        '@_cryptoType': 'SHA-512',
        '#text': 'A'.repeat(128),
      },
      taxNumber: '12345678',
      requestSignature: {
        '@_cryptoType': 'SHA3-512',
        '#text': 'B'.repeat(128),
      },
    },
    software: {
      softwareId: '123456789012345678',
      softwareName: 'TestApp',
      softwareOperation: 'LOCAL_SOFTWARE',
      softwareMainVersion: '1.0',
      softwareDevName: 'Dev',
      softwareDevContact: 'dev@test.com',
    },
  };

  it("builds valid TokenExchangeRequest with namespaces", async () => {
    const xml = await buildApiRequestXmlLibxml2(
      'TokenExchangeRequest',
      tokenExchangeRequest,
      XsdSchemaName.InvoiceApi,
      { namespacePrefix: 'common', prefixRootKeys: ['header', 'user'] },
    );
    assert.ok(xml.startsWith("<TokenExchangeRequest"));
    assert.ok(xml.includes('xmlns="http://schemas.nav.gov.hu/OSA/3.0/api"'));
    assert.ok(xml.includes('xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common"'));
    assert.ok(xml.includes("<common:user>"));
    assert.ok(xml.includes("</common:user>"));
    assert.ok(xml.includes("cryptoType="));

    const validation = await validateXml(xml, XsdSchemaName.InvoiceApi);
    assert.ok(validation.valid, validation.errors.join("\n"));
  });

  it("builds with namespacePrefix + prefixRootKeys", async () => {
    const xml = await buildApiRequestXmlLibxml2(
      'TokenExchangeRequest',
      tokenExchangeRequest,
      XsdSchemaName.InvoiceApi,
      { namespacePrefix: 'common', prefixRootKeys: ['header', 'user'] },
    );
    assert.ok(xml.includes("<common:header>"));
    assert.ok(xml.includes("</common:header>"));
    assert.ok(xml.includes("<common:user>"));
    assert.ok(xml.includes("</common:user>"));
    assert.ok(xml.includes("<software>"));

    const validation = await validateXml(xml, XsdSchemaName.InvoiceApi);
    assert.ok(validation.valid, validation.errors.join("\n"));
  });

  it("throws XmlValidationError on invalid data", async () => {
    await assert.rejects(
      async () => {
        await buildApiRequestXmlLibxml2('TokenExchangeRequest', { bad: 'data' }, XsdSchemaName.InvoiceApi);
      },
      (err: unknown) => err instanceof XmlValidationError,
    );
  });
});

if (hasXmldiff) {
  describe("libxml2 builder round-trip vs original XML (xmldiff)", () => {
    for (const xmlFile of getXmlFiles()) {
      it(`round-trip matches: ${xmlFile}`, async () => {
        const xml1 = readFileSync(join(SAMPLES_DIR, xmlFile), "utf8");
        const json1 = await xmlParserLibxml2(xml1, XsdSchemaName.Data);
        const xml2 = await buildInvoiceXmlLibxml2(json1.InvoiceData);

        const { equal, output } = xmldiffCheck(xml1, xml2);
        assert.ok(equal, `XML mismatch:\n${output}`);
      });
    }
  });
}

describe("libxml2-wasm XML builder vs fxp timing", () => {
  it("benchmark buildInvoiceXml all samples", async () => {
    const xmlFiles = getXmlFiles();
    const iterations = 30;
    const { buildInvoiceXml } = await import("../src/index.js");

    const parsedSamples: unknown[] = [];
    for (const xmlFile of xmlFiles) {
      const xml = readFileSync(join(SAMPLES_DIR, xmlFile), "utf8");
      parsedSamples.push(await xmlParserLibxml2(xml, XsdSchemaName.Data));
    }

    for (const parsed of parsedSamples) {
      await buildInvoiceXml(parsed.InvoiceData);
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
          await buildInvoiceXml(parsed.InvoiceData);
          await buildInvoiceXmlLibxml2(parsed.InvoiceData);
          continue;
        }
        const t1 = performance.now();
        await buildInvoiceXml(parsed.InvoiceData);
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
      console.log(`  ${xmlFile.padEnd(52)} fxp=${(fxpFile / n).toFixed(4)}ms  libxml2=${(libxml2File / n).toFixed(4)}ms`);
    }

    const totalSamples = parsedSamples.length * (iterations - 1);
    console.log(`\n  fxp builder:    total=${fxpTotal.toFixed(2)}ms  avg=${(fxpTotal / totalSamples).toFixed(4)}ms`);
    console.log(`  libxml2-wasm:   total=${libxml2Total.toFixed(2)}ms  avg=${(libxml2Total / totalSamples).toFixed(4)}ms`);
    console.log(`  speedup:        ${(fxpTotal / libxml2Total).toFixed(2)}x`);
  });
});