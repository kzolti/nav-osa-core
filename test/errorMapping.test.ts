import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { XmlValidationError, XmlBuildError, buildApiRequestXml, buildInvoiceXml, ApiRequestType } from '../src/index.js';
import { isApiRequestType } from '../src/parser/builder.js';

void describe('XmlValidationError', () => {

  void it('is thrown by buildApiRequestXml on invalid data', async () => {
    await assert.rejects(
      async () => {
        await buildApiRequestXml(ApiRequestType.TokenExchangeRequest, { bad: 'data' });
      },
      (err: unknown) => {
        if (err instanceof XmlValidationError) {
          assert.ok(err.message.length > 0);
          assert.ok(Array.isArray(err.errors));
          assert.ok(err.errors.length > 0);
          assert.equal(err.name, 'XmlValidationError');
          return true;
        }
        return false;
      },
    );
  });

  void it('contains validation error details', async () => {
    try {
      await buildApiRequestXml(ApiRequestType.TokenExchangeRequest, {});
      assert.fail('should have thrown');
    } catch (err: unknown) {
      if (err instanceof XmlValidationError) {
        // At least one error message about missing required elements
        assert.ok(err.errors.some((e: string) => e.length > 0));
      } else {
        throw err;
      }
    }
  });

});

void describe('XmlBuildError', () => {

  void it('is thrown by buildApiRequestXml on unknown request type', async () => {
    await assert.rejects(
      async () => {
        await buildApiRequestXml('InvalidRoot' as ApiRequestType, {});
      },
      (err: unknown) => {
        assert.ok(err instanceof XmlBuildError);
        assert.equal(err.name, 'XmlBuildError');
        assert.match(err.message, /Unknown API request type/);
        return true;
      },
    );
  });

  void it('rejects inherited object property names, not only enum keys', async () => {
    for (const bogus of ['toString', 'constructor', 'valueOf', 'hasOwnProperty']) {
      await assert.rejects(
        async () => {
          await buildApiRequestXml(bogus as ApiRequestType, {});
        },
        (err: unknown) => {
          assert.ok(err instanceof XmlBuildError, `'${bogus}' should throw XmlBuildError`);
          assert.match((err as Error).message, /Unknown API request type/);
          return true;
        },
        `'${bogus}' must be rejected before any XML is built`,
      );
    }
  });

  void it('accepts every real ApiRequestType member', async () => {
    for (const member of Object.values(ApiRequestType)) {
      assert.ok(isApiRequestType(member), `${member} must pass the guard`);
    }
  });

  void it('rejects prototype-chain property names', async () => {
    for (const bogus of ['toString', 'constructor', 'valueOf', 'hasOwnProperty']) {
      assert.equal(isApiRequestType(bogus), false, `${bogus} must fail the guard`);
    }
  });

  void it('rejects non-plain values in API request data with the object path', async () => {
    const cases: Array<[string, unknown, RegExp]> = [
      ['Date in header', { header: { timestamp: new Date() } }, /'Date' at 'TokenExchangeRequest\/header\/timestamp'/],
      ['Map in software (unprefixed subtree)', { software: { extra: new Map() } }, /'Map' at 'TokenExchangeRequest\/software\/extra'/],
      ['class instance in user', { user: { login: new (class Foo {})() } }, /'Foo' at 'TokenExchangeRequest\/user\/login'/],
      ['function in header', { header: { requestId: () => 1 } }, /'function' at 'TokenExchangeRequest\/header\/requestId'/],
    ];
    for (const [label, data, expected] of cases) {
      await assert.rejects(
        () => buildApiRequestXml(ApiRequestType.TokenExchangeRequest, data as never),
        (err: unknown) => {
          assert.ok(err instanceof XmlBuildError, `${label}: expected XmlBuildError, got ${err}`);
          assert.match((err as Error).message, expected);
          return true;
        },
        label,
      );
    }
  });

  void it('rejects a non-plain root data object', async () => {
    await assert.rejects(
      () => buildApiRequestXml(ApiRequestType.TokenExchangeRequest, new Map() as never),
      (err: unknown) => err instanceof XmlBuildError,
    );
  });

  void it('rejects functions in invoice data with the object path', async () => {
    await assert.rejects(
      () => buildInvoiceXml({ invoiceNumber: () => 1 } as never),
      (err: unknown) =>
        err instanceof XmlBuildError &&
        /'function' at 'InvoiceData\/invoiceNumber'/.test((err as Error).message),
    );
  });

});