import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { xmlParserLibxml2 } from "../src/parser/xmlParserLibxml2.js";
import { XsdSchemaName } from "../src/index.js";
import { validateInvoiceData } from "./lib/type-validator.js";

const SAMPLES_DIR = join(import.meta.dirname, "Peldaszamlak_v3.0");
const SNAPSHOTS_DIR = join(import.meta.dirname, "snapshots");

function getXmlFiles(): string[] {
  return readdirSync(SAMPLES_DIR)
    .filter((f) => extname(f) === ".xml")
    .sort();
}

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

describe("xmlParserLibxml2 behavior", () => {
  it("removes base: namespace prefix", async () => {
    const r = await parse("Belfoldi termekertekesites.xml");
    const tn = r.InvoiceData.invoiceMain.invoice.invoiceHead.supplierInfo.supplierTaxNumber;
    assert.ok("taxpayerId" in tn);
    assert.ok(!("base:taxpayerId" in tn));
    assert.equal(tn.taxpayerId, "99999999");
  });

  it("converts completenessIndicator to boolean", async () => {
    const r = await parse("Belfoldi termekertekesites.xml");
    assert.equal(typeof r.InvoiceData.completenessIndicator, "boolean");
    assert.equal(r.InvoiceData.completenessIndicator, false);
  });

  it("converts lineNumber to number", async () => {
    const r = await parse("Belfoldi termekertekesites.xml");
    const line = r.InvoiceData.invoiceMain.invoice.invoiceLines.line[0];
    assert.equal(typeof line.lineNumber, "number");
    assert.equal(line.lineNumber, 1);
  });

  it("converts modificationIndex to number", async () => {
    const r = await parse("Modositas es ervenytelenites 1.xml");
    const ref = r.InvoiceData.invoiceMain.invoice.invoiceReference;
    assert.equal(typeof ref.modificationIndex, "number");
    assert.equal(ref.modificationIndex, 1);
  });

  it("keeps taxpayerId as string", async () => {
    const r = await parse("Belfoldi termekertekesites.xml");
    const tn = r.InvoiceData.invoiceMain.invoice.invoiceHead.supplierInfo.supplierTaxNumber;
    assert.equal(typeof tn.taxpayerId, "string");
    assert.equal(tn.taxpayerId, "99999999");
  });

  it("keeps invoiceNumber as string", async () => {
    const r = await parse("Belfoldi termekertekesites.xml");
    assert.equal(typeof r.InvoiceData.invoiceNumber, "string");
    assert.equal(r.InvoiceData.invoiceNumber, "2021/000123");
  });

  it("keeps monetary amounts as strings", async () => {
    const r = await parse("Belfoldi termekertekesites.xml");
    const line = r.InvoiceData.invoiceMain.invoice.invoiceLines.line[0];
    assert.equal(typeof line.lineAmountsNormal.lineNetAmountData.lineNetAmount, "string");
    assert.equal(line.lineAmountsNormal.lineNetAmountData.lineNetAmount, "600000.00");
  });

  it("forces line to be an array", async () => {
    const r = await parse("Belfoldi termekertekesites.xml");
    assert.ok(Array.isArray(r.InvoiceData.invoiceMain.invoice.invoiceLines.line));
  });

  it("forces summaryByVatRate to be an array", async () => {
    const r = await parse("Belfoldi termekertekesites.xml");
    const summaries = r.InvoiceData.invoiceMain.invoice.invoiceSummary.summaryNormal.summaryByVatRate;
    assert.ok(Array.isArray(summaries));
    assert.equal(summaries.length, 2);
  });

  it("preserves Hungarian special characters", async () => {
    const r = await parse("Belfoldi termekertekesites.xml");
    const name = r.InvoiceData.invoiceMain.invoice.invoiceHead.supplierInfo.supplierName;
    assert.match(name, /[éáőöüóúűí]/);
  });

  it("preserves negative amounts as strings", async () => {
    const r = await parse("Modositas es ervenytelenites 1.xml");
    const line = r.InvoiceData.invoiceMain.invoice.invoiceLines.line[0];
    assert.equal(line.lineAmountsNormal.lineNetAmountData.lineNetAmount, "-2200000");
    assert.equal(typeof line.lineAmountsNormal.lineNetAmountData.lineNetAmount, "string");
  });

  it("parses aggregate invoice (Gyujtoszamla)", async () => {
    const r = await parse("Gyujtoszamla 1.xml");
    assert.equal(
      r.InvoiceData.invoiceMain.invoice.invoiceHead.invoiceDetail.invoiceCategory,
      "AGGREGATE"
    );
    assert.equal(
      typeof r.InvoiceData.invoiceMain.invoice.invoiceHead.invoiceDetail.periodicalSettlement,
      "boolean"
    );
  });

  it("parses modification invoice with invoiceReference", async () => {
    const r = await parse("Teves termek helyesbitese.xml");
    const ref = r.InvoiceData.invoiceMain.invoice.invoiceReference;
    assert.equal(ref.originalInvoiceNumber, "ZZZ000001");
    assert.equal(ref.modifyWithoutMaster, false);
    assert.equal(typeof ref.modificationIndex, "number");
  });

  it("parses batchInvoice correctly", async () => {
    const r = await parse("Tobb szamla modositasa egy okirattal.xml");
    const batch = r.InvoiceData.invoiceMain.batchInvoice;
    assert.ok(Array.isArray(batch));
    assert.equal(batch.length, 3);
    assert.equal(typeof batch[0].batchIndex, "number");
    assert.equal(batch[0].batchIndex, 1);
    assert.equal(typeof batch[1].batchIndex, "number");
    assert.equal(batch[2].batchIndex, 3);
  });

  it("parses single-line invoice correctly", async () => {
    const r = await parse("Tobb szamla modositasa egy okirattal alap 1.xml");
    assert.ok(Array.isArray(r.InvoiceData.invoiceMain.invoice.invoiceLines.line));
    assert.equal(r.InvoiceData.invoiceMain.invoice.invoiceLines.line.length, 1);
  });
});