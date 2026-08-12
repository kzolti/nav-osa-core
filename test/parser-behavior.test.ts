import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { xmlParser } from "../src/index.js";
import { XsdSchemaName } from "../src/index.js";

const SAMPLES_DIR = join(import.meta.dirname, "Peldaszamlak_v3.0");

async function parse(file: string) {
  const xml = readFileSync(join(SAMPLES_DIR, file), "utf8");
  return xmlParser(xml, XsdSchemaName.Data);
}

describe("xmlParser behavior", () => {
  it("enforces maxXmlSize even with validate: false", async () => {
    const big = `<InvoiceData>${"<x/>".repeat(100000)}</InvoiceData>`;
    await assert.rejects(
      () => xmlParser(big, XsdSchemaName.Data, { validate: false, maxXmlSize: 1024 }),
      /XML payload too large/i,
    );
  });
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

  it("does not expand entity references by default (processEntities off)", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE InvoiceData [<!ENTITY zzz "100">]>
<InvoiceData><supplierInfo><supplierName>&zzz;</supplierName></supplierInfo></InvoiceData>`;
    const r = await xmlParser(xml, XsdSchemaName.Data, { validate: false });
    assert.notEqual(r.InvoiceData.supplierInfo.supplierName, "100");
  });

  it("expands entity references with processEntities: true", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE InvoiceData [<!ENTITY zzz "100">]>
<InvoiceData><supplierInfo><supplierName>&zzz;</supplierName></supplierInfo></InvoiceData>`;
    const r = await xmlParser(xml, XsdSchemaName.Data, { validate: false, processEntities: true });
    assert.equal(r.InvoiceData.supplierInfo.supplierName, "100");
  });
});
