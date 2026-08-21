import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { xmlParser, XsdSchemaName, XmlValidationError } from '../src/index.js';
import { validateXml } from '../src/parser/validator.js';
import { validateAndExtractFields, extractFields } from '../src/parser/extractor/xmlFieldExtractor.js';

const big = `<InvoiceData>${'<x/>'.repeat(100000)}</InvoiceData>`;

void describe('maxXmlSize throws XmlValidationError', () => {
  void it('validateXml rejects with XmlValidationError', async () => {
    await assert.rejects(
      () => validateXml(big, XsdSchemaName.Data, { maxXmlSize: 1024 }),
      (err: unknown) => {
        assert.ok(err instanceof XmlValidationError);
        assert.equal(err.name, 'XmlValidationError');
        assert.match((err as Error).message, /XML payload too large/i);
        assert.ok((err as XmlValidationError).errors[0].includes('max: 1024'));
        return true;
      },
    );
  });

  void it('xmlParser rejects with XmlValidationError even with validate:false', async () => {
    await assert.rejects(
      () => xmlParser(big, XsdSchemaName.Data, { validate: false, maxXmlSize: 1024 }),
      (err: unknown) => {
        assert.ok(err instanceof XmlValidationError);
        assert.equal(err.name, 'XmlValidationError');
        return true;
      },
    );
  });

  void it('extractFields throws XmlValidationError by default', async () => {
    await assert.rejects(
      () => extractFields(big, ['x'], { maxXmlSize: 1024 }),
      (err: unknown) => err instanceof XmlValidationError,
    );
  });

  void it('extractFields returns errors with errorMode: return', async () => {
    const res = await extractFields(big, ['x'], { maxXmlSize: 1024, errorMode: 'return' });
    assert.deepEqual(res.fields, {});
    assert.ok(res.errors.length === 1);
    assert.match(res.errors[0], /XML payload too large/i);
  });

  void it('validateAndExtractFields throws XmlValidationError by default', async () => {
    await assert.rejects(
      () => validateAndExtractFields(big, XsdSchemaName.Data, ['x'], { maxXmlSize: 1024 }),
      (err: unknown) => err instanceof XmlValidationError,
    );
  });

  void it('validateAndExtractFields returns errors with errorMode: return', async () => {
    const res = await validateAndExtractFields(big, XsdSchemaName.Data, ['x'], { maxXmlSize: 1024, errorMode: 'return' });
    assert.deepEqual(res.fields, {});
    assert.ok(res.errors.length === 1);
    assert.match(res.errors[0], /XML payload too large/i);
  });
});
