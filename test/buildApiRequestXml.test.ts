import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildApiRequestXml, ApiRequestType, XmlBuildError, XmlValidationError } from '../src/index.js';

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

void describe('buildApiRequestXml', () => {

  void it('prefixes common-namespace subtrees automatically', async () => {
    const xml = await buildApiRequestXml(ApiRequestType.TokenExchangeRequest, tokenExchangeRequest);
    assert.ok(xml.includes('<TokenExchangeRequest'));
    assert.ok(xml.includes('<common:header>'));
    assert.ok(xml.includes('<common:requestId>'));
    assert.ok(xml.includes('<common:user>'));
    assert.ok(xml.includes('<software>'));
    assert.ok(!xml.includes('common:software'));
    assert.ok(xml.includes('xmlns="http://schemas.nav.gov.hu/OSA/3.0/api"'));
    assert.ok(xml.includes('xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common"'));
  });

  void it('injects the API namespace declarations', async () => {
    const xml = await buildApiRequestXml(ApiRequestType.TokenExchangeRequest, tokenExchangeRequest);
    assert.ok(xml.startsWith('<TokenExchangeRequest'));
    assert.ok(xml.indexOf('xmlns="http://schemas.nav.gov.hu/OSA/3.0/api"') !== -1);
    assert.ok(xml.indexOf('xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common"') !== -1);
  });

  void it('produces well-formed XML with closing tags', async () => {
    const xml = await buildApiRequestXml(ApiRequestType.TokenExchangeRequest, tokenExchangeRequest);
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
        await buildApiRequestXml(ApiRequestType.TokenExchangeRequest, { bad: 'data' });
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

  void it('throws XmlBuildError on unknown request type', async () => {
    await assert.rejects(
      async () => {
        await buildApiRequestXml('InvalidRoot' as ApiRequestType, {});
      },
      (err: unknown) => {
        assert.ok(err instanceof XmlBuildError);
        assert.match((err as Error).message, /Unknown API request type: 'InvalidRoot'/);
        return true;
      },
    );
  });

  void it('builds every API request type', async () => {
    const base = {
      header: tokenExchangeRequest.header,
      user: tokenExchangeRequest.user,
      software: tokenExchangeRequest.software,
    };
    const requests: { type: ApiRequestType; data: object }[] = [
      { type: ApiRequestType.TokenExchangeRequest, data: {} },
      {
        type: ApiRequestType.ManageAnnulmentRequest,
        data: {
          exchangeToken: 'token',
          annulmentOperations: {
            annulmentOperation: [{ index: 1, annulmentOperation: 'ANNUL', invoiceAnnulment: 'YWJj' }],
          },
        },
      },
      {
        type: ApiRequestType.ManageInvoiceRequest,
        data: {
          exchangeToken: 'token',
          invoiceOperations: {
            compressedContent: false,
            invoiceOperation: [{ index: 1, invoiceOperation: 'CREATE', invoiceData: 'YWJj' }],
          },
        },
      },
      {
        type: ApiRequestType.QueryInvoiceChainDigestRequest,
        data: {
          page: 1,
          invoiceChainQuery: { invoiceNumber: 'ABC123', invoiceDirection: 'INBOUND' },
        },
      },
      {
        type: ApiRequestType.QueryInvoiceCheckRequest,
        data: {
          invoiceNumberQuery: { invoiceNumber: 'ABC123', invoiceDirection: 'OUTBOUND' },
        },
      },
      {
        type: ApiRequestType.QueryInvoiceDataRequest,
        data: {
          invoiceNumberQuery: { invoiceNumber: 'ABC123', invoiceDirection: 'OUTBOUND' },
        },
      },
      {
        type: ApiRequestType.QueryInvoiceDigestRequest,
        data: {
          page: 1,
          invoiceDirection: 'OUTBOUND',
          invoiceQueryParams: {
            mandatoryQueryParams: {
              invoiceIssueDate: { dateFrom: '2025-01-01', dateTo: '2025-01-31' },
            },
          },
        },
      },
      {
        type: ApiRequestType.QueryTaxpayerRequest,
        data: { taxNumber: '12345678' },
      },
      {
        type: ApiRequestType.QueryTransactionListRequest,
        data: {
          page: 1,
          insDate: { dateTimeFrom: '2025-01-01T00:00:00.000Z', dateTimeTo: '2025-01-31T00:00:00.000Z' },
        },
      },
      {
        type: ApiRequestType.QueryTransactionStatusRequest,
        data: { transactionId: 'tid123' },
      },
    ];
    for (const { type, data } of requests) {
      const xml = await buildApiRequestXml(type, { ...base, ...data });
      assert.ok(xml.startsWith(`<${type}`), `root of ${type}`);
      assert.ok(xml.includes(`</${type}>`), `closing tag of ${type}`);
    }
  });

});