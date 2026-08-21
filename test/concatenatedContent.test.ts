import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractFields } from '../src/parser/extractor/xmlFieldExtractor.js';
import { xmlParser } from '../src/index.js';
import { XsdSchemaName } from '../src/xsdPaths.js';

void describe('xmlNodeGetContent direct text (bugfix)', () => {
  void it('extractFields parent returns ONLY direct text, not concatenated descendants', async () => {
    const xml = `<root><parent>abc<child>def</child>ghi</parent></root>`;
    const { fields } = await extractFields(xml, ['parent'], { errorMode: 'return' });
    // FIXED: extractFieldsFast now collects only TEXT_NODE/CDATA_NODE children.
    // xmlNodeGetContent(parent) would be "abcdefghi" (bug), correct is "abcghi".
    // OSA leafokra (invoiceNumber stb.) mindegy, mert nincs nested element.
    assert.equal(fields.parent, 'abcghi');
    assert.notEqual(fields.parent, 'abcdefghi');
  });

  void it('leaf field still returns direct text correctly', async () => {
    const xml = `<root><invoiceNumber>ZZZ000009</invoiceNumber></root>`;
    const { fields } = await extractFields(xml, ['invoiceNumber']);
    assert.equal(fields.invoiceNumber, 'ZZZ000009');
  });

  void it('xmlParser convertPtr keeps mixed content as #text + child (not concatenated)', async () => {
    // convertPtr collects TEXT_NODE separately, so parent with mixed content
    // keeps #text = "abcghi" trimmed? Actually text is "abc"+"ghi" trimmed -> "abcghi" plus child element
    // This shows the difference between parser and extractor.
    const xml = `<InvoiceData><parent>abc<child>def</child>ghi</parent></InvoiceData>`;
    const res = await xmlParser<any>(xml, XsdSchemaName.Data, { validate: false });
    // parser: parent has #text and child
    const parent = res.InvoiceData.parent;
    assert.ok(typeof parent === 'object');
    assert.equal(parent['#text'], 'abcghi'); // concatenated direct text nodes only, child excluded
    assert.equal(parent.child, 'def');
  });

  void it('documents that extractor is leaf-only contract: use only leaf element names', async () => {
    const xml = `<root><parent><a>1</a><b>2</b></parent></root>`;
    const { fields: leaf } = await extractFields(xml, ['a', 'b']);
    assert.deepEqual(leaf, { a: '1', b: '2' });
    const { fields: parent } = await extractFields(xml, ['parent']);
    // parent has no direct text, only child elements -> direct text is "" (fixed), buggy would be "12"
    assert.equal(parent.parent, '');
    assert.notEqual(parent.parent, '12');
  });
});
