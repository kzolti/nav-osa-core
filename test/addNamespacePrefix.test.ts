import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addNamespacePrefix } from '../src/parser/builder/namespacePrefix.js';

void describe('addNamespacePrefix', () => {

  void it('prefixes nested object keys', () => {
    const input = { header: { requestId: 'abc' }, user: { login: 'test' } };
    const result = addNamespacePrefix(input, 'common');
    assert.equal(Object.keys(result).length, 2);
    assert.ok('common:header' in result);
    assert.ok('common:user' in result);
    assert.equal((result as Record<string, Record<string, string>>)['common:header']['common:requestId'], 'abc');
    assert.equal((result as Record<string, Record<string, string>>)['common:user']['common:login'], 'test');
  });

  void it('prefixes array items', () => {
    const input = { items: [{ id: '1' }, { id: '2' }] };
    const result = addNamespacePrefix(input, 'ns');
    assert.ok('ns:items' in result);
    assert.equal((result as Record<string, Array<Record<string, string>>>)['ns:items'][0]['ns:id'], '1');
    assert.equal((result as Record<string, Array<Record<string, string>>>)['ns:items'][1]['ns:id'], '2');
  });

  void it('skips @_ and #text keys', () => {
    const input = { '@_xmlns': 'http://example.com', '#text': 'val', child: { x: 'y' } };
    const result = addNamespacePrefix(input, 'p');
    assert.ok('p:child' in result);
    assert.equal((result as Record<string, string>)['@_xmlns'], 'http://example.com');
    assert.equal((result as Record<string, string>)['#text'], 'val');
  });

  void it('skips already prefixed keys but prefixes their children', () => {
    const input = { 'common:header': { value: 'x' } };
    const result = addNamespacePrefix(input, 'common');
    assert.ok('common:header' in result);
    assert.equal((result as Record<string, Record<string, string>>)['common:header']['common:value'], 'x');
  });

  void it('with rootKeys only prefixes specified top-level keys and their children', () => {
    const input = {
      header: { requestId: 'r1' },
      user: { login: 'u1' },
      software: { name: 'sw' },
    };
    const result = addNamespacePrefix(input, 'common', ['header', 'user']);
    assert.ok('common:header' in result);
    assert.equal((result as Record<string, Record<string, string>>)['common:header']['common:requestId'], 'r1');
    assert.ok('common:user' in result);
    assert.equal((result as Record<string, Record<string, string>>)['common:user']['common:login'], 'u1');
    assert.ok('software' in result);
    assert.deepEqual((result as Record<string, Record<string, unknown>>).software, input.software as Record<string, unknown>);
  });

  void it('does not mutate the original object', () => {
    const input = { header: { requestId: 'abc' } };
    const originalKeys = Object.keys(input);
    const originalHeaderKeys = Object.keys(input.header);
    addNamespacePrefix(input, 'common');
    assert.deepEqual(Object.keys(input), originalKeys);
    assert.deepEqual(Object.keys(input.header), originalHeaderKeys);
  });

  void it('handles non-object top-level values in rootKeys', () => {
    const input = { simple: 'value', other: 42 };
    const result = addNamespacePrefix(input, 'p', ['simple']);
    assert.ok('p:simple' in result);
    assert.equal((result as Record<string, string>)['p:simple'], 'value');
    assert.ok('other' in result);
    assert.equal((result as Record<string, number>).other, 42);
  });

  void it('handles rootKeys with array values at top level', () => {
    const input = { items: [{ id: '1' }], other: 'x' };
    const result = addNamespacePrefix(input, 'p', ['items']);
    assert.ok('p:items' in result);
    assert.equal((result as Record<string, Array<Record<string, string>>>)['p:items'][0]['p:id'], '1');
    assert.equal((result as Record<string, string>).other, 'x');
  });

  void it('handles empty object', () => {
    const result = addNamespacePrefix({}, 'p');
    assert.deepEqual(result, {});
  });

  void it('handles rootKeys with no matches (all keys pass through)', () => {
    const input = { a: 1, b: 2 };
    const result = addNamespacePrefix(input, 'p', ['nonexistent']);
    assert.deepEqual(result, { a: 1, b: 2 });
  });

  void it('handles object with null values', () => {
    const input = { a: null, b: { c: 'd' } };
    const result = addNamespacePrefix(input, 'p');
    assert.strictEqual((result as Record<string, unknown>)['p:a'], null);
    assert.deepEqual((result as Record<string, Record<string, string>>)['p:b'], { 'p:c': 'd' });
  });

});
