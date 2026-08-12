import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { xmlParserLibxml2 } from "../src/parser/parser.js";
import { buildInvoiceXmlLibxml2, buildApiRequestXmlLibxml2 } from "./lib/xmlBuilderLibxml2.js";
import { xmldiffCheck, isXmldiffAvailable } from "./lib/xmldiff.js";
import { xmlParser, buildInvoiceXml, buildApiRequestXml, XmlBuildError, XmlValidationError, XsdSchemaName, ApiRequestType } from "../src/index.js";
import { validateXml } from "../src/parser/validator.js";
import { SAMPLES_DIR, getXmlFiles } from "./lib/testFiles.js";

const hasXmldiff = isXmldiffAvailable();

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
      ApiRequestType.TokenExchangeRequest,
      tokenExchangeRequest,
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

  it("prefixes header and user automatically", async () => {
    const xml = await buildApiRequestXmlLibxml2(
      ApiRequestType.TokenExchangeRequest,
      tokenExchangeRequest,
    );
    assert.ok(xml.includes("<common:header>"));
    assert.ok(xml.includes("</common:header>"));
    assert.ok(xml.includes("<common:user>"));
    assert.ok(xml.includes("</common:user>"));
    assert.ok(xml.includes("<software>"));
    assert.ok(!xml.includes("common:software"));

    const validation = await validateXml(xml, XsdSchemaName.InvoiceApi);
    assert.ok(validation.valid, validation.errors.join("\n"));
  });

  it("throws XmlValidationError on invalid data", async () => {
    await assert.rejects(
      async () => {
        await buildApiRequestXmlLibxml2(ApiRequestType.TokenExchangeRequest, { bad: 'data' });
      },
      (err: unknown) => err instanceof XmlValidationError,
    );
  });

  it("throws XmlBuildError on unknown request type", async () => {
    await assert.rejects(
      async () => {
        await buildApiRequestXmlLibxml2('InvalidRoot' as ApiRequestType, {});
      },
      (err: unknown) => err instanceof XmlBuildError && /Unknown API request type/.test((err as Error).message),
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

describe("default builder selection", () => {
  it("default builder is the fast-xml-builder implementation", async () => {
    const { buildInvoiceXml, buildApiRequestXml } = await import("../src/index.js");
    const { buildInvoiceXml: fxpInvoice, buildApiRequestXml: fxpApiRequest } = await import("../src/parser/builder.js");
    assert.equal(buildInvoiceXml, fxpInvoice);
    assert.equal(buildApiRequestXml, fxpApiRequest);
  });
});

describe("production builder invalid input handling", () => {
  const validBase = {
    invoiceNumber: "2021/000123",
    completenessIndicator: false,
    invoiceIssueDate: "2020-01-01",
  };

  it("throws XmlBuildError on circular references instead of a stack overflow", async () => {
    const circular: Record<string, unknown> = { ...validBase };
    circular.lines = { line: {} };
    (circular.lines as Record<string, unknown>).line = circular;
    await assert.rejects(
      async () => {
        await buildInvoiceXml(circular as never);
      },
      (err: unknown) => err instanceof XmlBuildError && /Circular reference/.test((err as Error).message),
    );
  });

  it("throws XmlBuildError with the object path for non-plain objects (Date)", async () => {
    await assert.rejects(
      async () => {
        await buildInvoiceXml({ ...validBase, invoiceIssueDate: new Date() } as never);
      },
      (err: unknown) =>
        err instanceof XmlBuildError &&
        (err as Error).message.includes("'Date'") &&
        (err as Error).message.includes("invoiceIssueDate"),
    );
  });

  it("invalid XML element names are caught by the mandatory validation", async () => {
    await assert.rejects(
      async () => {
        await buildInvoiceXml({ ...validBase, "bad key": "x" } as never);
      },
      (err: unknown) => err instanceof XmlValidationError,
    );
  });

  it("skips undefined values and rejects null values via validation", async () => {
    const xml = readFileSync(join(SAMPLES_DIR, "Belfoldi termekertekesites.xml"), "utf8");
    const parsed = await xmlParserLibxml2<any>(xml, XsdSchemaName.Data);
    const withUndefined = { ...parsed.InvoiceData, optionalThing: undefined };
    const built = await buildInvoiceXml(withUndefined);
    assert.ok(built.includes("<invoiceNumber>2021/000123</invoiceNumber>"));
    assert.ok(!built.includes("optionalThing"));

    await assert.rejects(
      async () => {
        await buildInvoiceXml({ ...parsed.InvoiceData, alsoNull: null } as never);
      },
      (err: unknown) => err instanceof XmlValidationError,
    );
  });

  it("accepts null-prototype objects", async () => {
    const xml = readFileSync(join(SAMPLES_DIR, "Belfoldi termekertekesites.xml"), "utf8");
    const parsed = await xmlParserLibxml2<any>(xml, XsdSchemaName.Data);
    const np = Object.assign(Object.create(null), parsed.InvoiceData);
    const built = await buildInvoiceXml(np);
    assert.ok(built.includes("<invoiceNumber>2021/000123</invoiceNumber>"));
  });

  it("always validates: invalid built XML throws XmlValidationError", async () => {
    const incomplete = {
      invoiceNumber: "2021/000123",
      completenessIndicator: false,
      invoiceIssueDate: "2020-01-01",
      missingEverythingElse: "x",
    };
    await assert.rejects(
      async () => {
        await buildInvoiceXml(incomplete as never);
      },
      (err: unknown) => err instanceof XmlValidationError,
    );
  });
});