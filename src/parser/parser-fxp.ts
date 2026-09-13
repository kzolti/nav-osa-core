import { XMLParser } from 'fast-xml-parser';
import { ALWAYS_ARRAY } from './shared/fieldSets.js';
import { convertTagValue } from './shared/convert.js';
import { assertXmlSize } from './shared/guards.js';
import { XmlValidationError } from './shared/errors.js';
import type { XmlParserOptions } from './shared/guards.js';
import type { XsdSchemaName } from '../xsdSchemaName.js';

function tagValueProcessor(tagName: string, tagValue: unknown): unknown {
  if (typeof tagValue !== 'string') return tagValue;
  return convertTagValue(tagName, tagValue);
}

const defaultParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  ignoreDeclaration: true,
  removeNSPrefix: true,
  processEntities: true,
  isArray: (name: string) => ALWAYS_ARRAY.has(name),
  tagValueProcessor,
});

const noEntitiesParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  ignoreDeclaration: true,
  removeNSPrefix: true,
  processEntities: false,
  isArray: (name: string) => ALWAYS_ARRAY.has(name),
  tagValueProcessor,
});

/**
 * Browser-safe XML parser using fast-xml-parser (no XSD validation, no WASM,
 * no `node:*` imports — safe to bundle for browsers).
 *
 * Produces the same output shape as {@link xmlParserLibxml2}:
 * - Namespace prefixes stripped (`removeNSPrefix: true`)
 * - Attributes prefixed with `@_`
 * - Text nodes as `#text`
 * - Fields listed in ALWAYS_ARRAY are always arrays
 * - Boolean/number/string conversion via convertTagValue (per-tag, at parse
 *   time — no post-walk, so no extra recursion depth on hostile input)
 *
 * The `schemaName` parameter is accepted for API compatibility but ignored
 * (no XSD validation is performed). `processEntities: true` opts into
 * entity expansion, mirroring the libxml2 parser's opt-in flag.
 */
export async function xmlParserFxp<T>(
  xmlData: string,
  _schemaName?: XsdSchemaName,
  options?: XmlParserOptions,
): Promise<T> {
  assertXmlSize(xmlData, options?.maxXmlSize);

  const parser = options?.processEntities === true ? defaultParser : noEntitiesParser;
  try {
    return parser.parse(xmlData) as T;
  } catch (err) {
    throw new XmlValidationError(
      'XML parse failed (document is not well-formed)',
      [err instanceof Error ? err.message : String(err)],
      { cause: err },
    );
  }
}
