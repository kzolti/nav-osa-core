import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { XmlValidationError, XmlBuildError, buildApiRequestXml, ApiRequestType } from '../src/index.js';

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

});