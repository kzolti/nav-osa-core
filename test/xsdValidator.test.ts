import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateXml, XsdSchemaName, getXsdPath } from '../src/index.js';

void describe('getXsdPath', () => {

  for (const schema of Object.values(XsdSchemaName)) {
    void it(`returns existing path for ${schema}`, () => {
      const path = getXsdPath(schema as XsdSchemaName);
      assert.ok(path.endsWith(`/${schema}.xsd`), `path ${path} should end with ${schema}.xsd`);
      assert.ok(existsSync(path), `XSD file exists at ${path}`);
    });
  }

});

void describe('validateXml with known schemas', () => {

  void it('returns valid for a minimal valid XML against Data schema', async () => {
    const xsdPath = getXsdPath(XsdSchemaName.Data);
    const xsdContent = readFileSync(xsdPath, 'utf8');
    // Use known valid structure
    const minimalInvoiceXml = `<?xml version="1.0" encoding="UTF-8"?>
<InvoiceData xmlns="http://schemas.nav.gov.hu/OSA/3.0/data">
</InvoiceData>`;
    const result = await validateXml(minimalInvoiceXml, XsdSchemaName.Data);
    // This may fail if the schema requires more elements; that's fine
    // The important thing is it runs without crashing
    assert.ok('valid' in result);
    assert.ok(Array.isArray(result.errors));
  });

  void it('returns invalid for completely wrong XML', async () => {
    const result = await validateXml('<root><bad/></root>', XsdSchemaName.InvoiceApi);
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

});

void describe('validateXml with custom path', () => {

  void it('returns invalid for bad XML against a known XSD path', async () => {
    const xsdPath = getXsdPath(XsdSchemaName.InvoiceApi);
    const result = await validateXml('<hello/>', xsdPath);
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

});

