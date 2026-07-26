import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildApiRequestXml, XsdSchemaName, XmlValidationError } from '../src/index.js';

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

void describe('buildApiRequestXml', () => {

  void it('builds valid XML with namespacePrefix + prefixRootKeys', async () => {
    const xml = await buildApiRequestXml('TokenExchangeRequest', tokenExchangeRequest, XsdSchemaName.InvoiceApi, {
      namespacePrefix: 'common',
      prefixRootKeys: ['header', 'user'],
    });
    assert.ok(xml.includes('<TokenExchangeRequest'));
    assert.ok(xml.includes('<common:header>'));
    assert.ok(xml.includes('<common:requestId>'));
    assert.ok(xml.includes('<common:user>'));
    assert.ok(xml.includes('<software>'));
    assert.ok(!xml.includes('common:software'));
    assert.ok(xml.includes('xmlns="http://schemas.nav.gov.hu/OSA/3.0/api"'));
  });

  void it('produces well-formed XML with closing tags', async () => {
    const xml = await buildApiRequestXml('TokenExchangeRequest', tokenExchangeRequest, XsdSchemaName.InvoiceApi, {
      namespacePrefix: 'common',
      prefixRootKeys: ['header', 'user'],
    });
    assert.ok(xml.startsWith('<TokenExchangeRequest'));
    assert.ok(xml.includes('</TokenExchangeRequest>'));
    assert.ok(xml.includes('<common:header>'));
    assert.ok(xml.includes('</common:header>'));
    assert.ok(xml.includes('<common:user>'));
    assert.ok(xml.includes('</common:user>'));
    assert.ok(xml.includes('<software>'));
    assert.ok(xml.includes('</software>'));
  });

  void it('throws XmlValidationError on invalid data structure', async () => {
    await assert.rejects(
      async () => {
        await buildApiRequestXml('TokenExchangeRequest', { bad: 'data' }, XsdSchemaName.InvoiceApi);
      },
      (err: unknown) => {
        if (err instanceof XmlValidationError) {
          assert.ok(err.errors.length > 0);
          assert.equal(err.name, 'XmlValidationError');
          return true;
        }
        return false;
      },
    );
  });

  void it('throws XmlValidationError when required namespace prefix is missing', async () => {
    await assert.rejects(
      async () => {
        await buildApiRequestXml('TokenExchangeRequest', tokenExchangeRequest, XsdSchemaName.InvoiceApi, {
          namespacePrefix: 'common',
          prefixRootKeys: [],
        });
      },
      XmlValidationError,
    );
  });

  void it('throws XmlValidationError on completely wrong data', async () => {
    await assert.rejects(
      async () => {
        await buildApiRequestXml('InvalidRoot', {}, XsdSchemaName.InvoiceApi);
      },
      XmlValidationError,
    );
  });

});
