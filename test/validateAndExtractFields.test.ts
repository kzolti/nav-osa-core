import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  validateAndExtractFields,
  XmlValidationError,
  XsdSchemaName,
} from '../src/index.js';

const SAMPLES_DIR = join(import.meta.dirname, 'Peldaszamlak_v3.0');

const loadSample = (file: string): string =>
  readFileSync(join(SAMPLES_DIR, file), 'utf8');

void describe('validateAndExtractFields', () => {

  void it('extracts only the requested fields from a valid invoice', async () => {
    const xml = loadSample('Tobbszoros modositas 1.xml');
    const { fields, errors } = await validateAndExtractFields(
      xml,
      XsdSchemaName.Data,
      ['invoiceNumber', 'originalInvoiceNumber', 'modifyWithoutMaster', 'modificationIndex']
    );
    assert.deepEqual(errors, []);
    assert.equal(fields.invoiceNumber, 'ZZZ000009');
    assert.equal(fields.originalInvoiceNumber, 'ZZZ000001');
    assert.equal(fields.modifyWithoutMaster, 'false');
    assert.equal(fields.modificationIndex, '1');
  });

  void it('does not include fields that were not requested', async () => {
    const xml = loadSample('Tobbszoros modositas 1.xml');
    const { fields } = await validateAndExtractFields(xml, XsdSchemaName.Data, ['invoiceNumber']);
    assert.deepEqual(Object.keys(fields), ['invoiceNumber']);
  });

  void it('returns empty fields for a document without matches', async () => {
    const xml = loadSample('Belfoldi termekertekesites.xml');
    const { fields } = await validateAndExtractFields(
      xml,
      XsdSchemaName.Data,
      ['originalInvoiceNumber', 'modifyWithoutMaster', 'modificationIndex']
    );
    assert.deepEqual(fields, {});
  });

  void it('throws XmlValidationError on invalid XML by default', async () => {
    await assert.rejects(
      validateAndExtractFields('<root><bad/></root>', XsdSchemaName.Data, ['invoiceNumber']),
      (err: unknown) =>
        err instanceof XmlValidationError && err.errors.length > 0
    );
  });

  void it('returns errors instead of throwing with errorOnInvalid: false', async () => {
    const result = await validateAndExtractFields(
      '<root><bad/></root>',
      XsdSchemaName.Data,
      ['invoiceNumber'],
      { errorOnInvalid: false }
    );
    assert.ok(result.errors.length > 0);
    assert.deepEqual(result.fields, {});
  });

  void it('aggregates repeated fields into an array', async () => {
    const xml = loadSample('Belfoldi termekertekesites.xml');
    const { fields } = await validateAndExtractFields(
      xml,
      XsdSchemaName.Data,
      ['lineNumber']
    );
    assert.ok(Array.isArray(fields.lineNumber), 'lineNumber should be an array');
    assert.equal((fields.lineNumber as string[]).length, 4);
  });

  void it('converts values with convertValues: true', async () => {
    const xml = loadSample('Tobbszoros modositas 1.xml');
    const { fields } = await validateAndExtractFields(
      xml,
      XsdSchemaName.Data,
      ['invoiceNumber', 'modifyWithoutMaster', 'modificationIndex'],
      { convertValues: true }
    );
    // number and boolean conversion per convertTagValue
    assert.equal(fields.modificationIndex, 1);
    assert.equal(fields.modifyWithoutMaster, false);
    // Tags in STRING_FIELDS stay strings
    assert.equal(fields.invoiceNumber, 'ZZZ000009');
  });

  void it('returns raw strings by default', async () => {
    const xml = loadSample('Tobbszoros modositas 1.xml');
    const { fields } = await validateAndExtractFields(
      xml,
      XsdSchemaName.Data,
      ['modifyWithoutMaster', 'modificationIndex']
    );
    assert.equal(fields.modifyWithoutMaster, 'false');
    assert.equal(fields.modificationIndex, '1');
  });

});