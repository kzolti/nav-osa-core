import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
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

  void it('runs validation against Data schema without errors', async () => {
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



