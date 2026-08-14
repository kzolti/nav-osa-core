import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ALWAYS_ARRAY,
  BOOLEAN_FIELDS,
  NUMBER_FIELDS,
  STRING_FIELDS,
} from '../src/parser/shared/xmlParserCommon.js';

const XSD_FILES = [
  'src/xsd/invoiceBase.xsd',
  'src/xsd/invoiceApi.xsd',
  'src/xsd/data.xsd',
  'src/xsd/common.xsd',
];

const INT_BASES = new Set([
  'xs:int',
  'xs:integer',
  'xs:long',
  'xs:nonNegativeInteger',
  'xs:positiveInteger',
  'xs:unsignedInt',
  'xs:unsignedLong',
  'xs:short',
  'xs:byte',
  'xs:negativeInteger',
  'xs:nonPositiveInteger',
  'xs:unsignedShort',
  'xs:unsignedByte',
]);
const DEC_BASES = new Set(['xs:decimal', 'xs:float', 'xs:double']);

/** name → restriction base of every named simple type in the XSDs. */
const simpleTypes: Record<string, string> = {};
/** element name → resolved base ('bool' | 'int' | 'dec' | 'str' | 'unknown'). */
const elementBases = new Map<string, string>();
/** element name → the file it is declared in. */
const elementFiles = new Map<string, string>();
/** every element name declared in the XSDs. */
const allElements = new Set<string>();
/** element names with maxOccurs="unbounded" in any XSD. */
const unboundedElements = new Set<string>();
/** element names with maxOccurs >= 2 or "unbounded" in any XSD. */
const arrayQualifiedElements = new Set<string>();

// Phase 1: load all named simple types, element names, and element→file map
// before resolving any element type (types in one file may reference types
// declared in another, later file).
for (const file of XSD_FILES) {
  const content = readFileSync(file, 'utf8');
  const typeRe = /<xs:simpleType name="([^"]+)"[\s\S]*?<xs:restriction base="([^"]+)"[\s\S]*?<\/xs:simpleType>/g;
  let m: RegExpExecArray | null;
  while ((m = typeRe.exec(content)) !== null) {
    simpleTypes[m[1]] = m[2];
  }
  // Whole-tag regex so maxOccurs is captured regardless of attribute order;
  // `<xs:element ref="...">` references (no name) are skipped.
  const tagRe = /<xs:element\s([^>]*)>/g;
  while ((m = tagRe.exec(content)) !== null) {
    const attrs = m[1];
    const name = /name="([^"]+)"/.exec(attrs)?.[1];
    if (!name) continue;
    allElements.add(name);
    if (!elementFiles.has(name)) elementFiles.set(name, file);
    const maxOccurs = /maxOccurs="([^"]+)"/.exec(attrs)?.[1] ?? '1';
    if (maxOccurs === 'unbounded') {
      unboundedElements.add(name);
      arrayQualifiedElements.add(name);
    } else if (/^\d+$/.test(maxOccurs) && Number(maxOccurs) >= 2) {
      arrayQualifiedElements.add(name);
    }
  }
}

// Phase 2: resolve every typed element to a terminal base.
for (const file of XSD_FILES) {
  const content = readFileSync(file, 'utf8');
  const typedRe = /<xs:element name="([^"]+)"\s+type="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = typedRe.exec(content)) !== null) {
    elementBases.set(m[1], resolveBase(m[2]));
  }
}

/** Resolves a type reference to a terminal XSD base: 'bool' | 'int' | 'dec' | 'str'. */
function resolveBase(type: string, stack: string[] = []): string {
  if (INT_BASES.has(type)) return 'int';
  if (DEC_BASES.has(type)) return 'dec';
  if (type === 'xs:boolean') return 'bool';
  if (type.startsWith('xs:')) return 'str';
  const local = type.replace(/^(base|common|data):/, '');
  const base = simpleTypes[local];
  if (!base || stack.includes(local)) return 'unknown';
  return resolveBase(base, [...stack, local]);
}

const booleanElements = [...elementBases.entries()]
  .filter(([, base]) => base === 'bool')
  .map(([name]) => name);
const intElements = [...elementBases.entries()]
  .filter(([, base]) => base === 'int')
  .map(([name]) => name);
const dataIntElements = [...elementBases.entries()]
  .filter(([name, base]) => base === 'int' && elementFiles.get(name) === 'src/xsd/data.xsd')
  .map(([name]) => name);
const numericElements = new Set(
  [...elementBases.entries()].filter(([, base]) => base === 'int' || base === 'dec').map(([name]) => name),
);

void describe('BOOLEAN_FIELDS vs XSD', () => {
  void it('covers every xs:boolean element declared in the XSDs', () => {
    const missing = booleanElements.filter((name) => !BOOLEAN_FIELDS.has(name)).sort();
    assert.deepEqual(
      missing,
      [],
      `xs:boolean elements missing from BOOLEAN_FIELDS: ${missing.join(', ')}`,
    );
  });

  void it('only contains names that are xs:boolean elements in the XSDs', () => {
    const stale = [...BOOLEAN_FIELDS].filter((name) => !booleanElements.includes(name)).sort();
    assert.deepEqual(stale, [], `BOOLEAN_FIELDS entries that are not xs:boolean elements: ${stale.join(', ')}`);
  });
});

void describe('NUMBER_FIELDS vs XSD', () => {
  void it('covers every integer-typed element of data.xsd', () => {
    const missing = dataIntElements.filter((name) => !NUMBER_FIELDS.has(name)).sort();
    assert.deepEqual(
      missing,
      [],
      `data.xsd integer elements missing from NUMBER_FIELDS: ${missing.join(', ')}`,
    );
  });

  void it('only contains names that resolve to an integer or decimal base', () => {
    const stale = [...NUMBER_FIELDS].filter((name) => !numericElements.has(name)).sort();
    assert.deepEqual(
      stale,
      [],
      `NUMBER_FIELDS entries that are not integer/decimal elements in the XSDs: ${stale.join(', ')}`,
    );
  });
});

void describe('STRING_FIELDS vs XSD', () => {
  void it('only contains element names declared in the XSDs', () => {
    const stale = [...STRING_FIELDS].filter((name) => !allElements.has(name)).sort();
    assert.deepEqual(
      stale,
      [],
      `STRING_FIELDS entries that are not elements in the XSDs: ${stale.join(', ')}`,
    );
  });

  void it('does not overlap with BOOLEAN_FIELDS or NUMBER_FIELDS', () => {
    const overlap = [...STRING_FIELDS].filter(
      (name) => BOOLEAN_FIELDS.has(name) || NUMBER_FIELDS.has(name),
    ).sort();
    assert.deepEqual(
      overlap,
      [],
      `STRING_FIELDS entries also present in BOOLEAN_FIELDS/NUMBER_FIELDS: ${overlap.join(', ')}`,
    );
  });
});

/**
 * ALWAYS_ARRAY guarantees an array output shape even when an element occurs
 * once. Entries that are not maxOccurs>=2 anywhere in the XSDs are deliberate
 * overrides (fixed array shape regardless of cardinality) and must be listed
 * here with a reason.
 */
const ALWAYS_ARRAY_OVERRIDES: ReadonlySet<string> = new Set([
  'invoiceDigestResult', // single query result wrapper, fixed array for consistent access
]);

void describe('ALWAYS_ARRAY vs XSD', () => {
  void it('covers every maxOccurs="unbounded" element declared in the XSDs', () => {
    const missing = [...unboundedElements].filter((name) => !ALWAYS_ARRAY.has(name)).sort();
    assert.deepEqual(
      missing,
      [],
      `maxOccurs="unbounded" elements missing from ALWAYS_ARRAY: ${missing.join(', ')}`,
    );
  });

  void it('only contains elements that repeat in the XSDs or are documented overrides', () => {
    const unjustified = [...ALWAYS_ARRAY]
      .filter((name) => !arrayQualifiedElements.has(name) && !ALWAYS_ARRAY_OVERRIDES.has(name))
      .sort();
    assert.deepEqual(
      unjustified,
      [],
      `ALWAYS_ARRAY entries with no maxOccurs>=2 declaration and no documented override: ${unjustified.join(', ')}`,
    );
  });
});
