import type { XmlDocument, XsdValidator } from 'libxml2-wasm';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { XsdSchemaName, getXsdPath } from '../xsdPaths.js';
import { assertXmlSize } from './shared/guards.js';
import { getLibxml2, getParseOption } from './runtime/libxml2.js';
import type { Libxml2ModuleType } from './runtime/libxml2.js';

export { getLibxml2 } from './runtime/libxml2.js';

type XmlDocType = InstanceType<typeof XmlDocument>;
type XsdValidatorType = InstanceType<typeof XsdValidator>;

const validatorPromiseCache = new Map<XsdSchemaName, Promise<XsdValidatorType>>();

async function getValidator(schema: XsdSchemaName): Promise<XsdValidatorType> {
  let promise = validatorPromiseCache.get(schema);
  if (promise) {
    return promise;
  }

  promise = (async () => {
    const libxml2 = await getLibxml2();
    const xsdPath = getXsdPath(schema);
    const xsdContent = readFileSync(xsdPath, 'utf8');
    const absoluteXsdPath = resolve(xsdPath).replace(/\\/g, '/');
    const xsdUrl = absoluteXsdPath.startsWith('/') ? `file://${absoluteXsdPath}` : `file:///${absoluteXsdPath}`;

    const xsdDoc: XmlDocType = libxml2.XmlDocument.fromString(xsdContent, {
      url: xsdUrl,
      option: libxml2.ParseOption.XML_PARSE_NOBLANKS
        | libxml2.ParseOption.XML_PARSE_NONET
        | libxml2.ParseOption.XML_PARSE_HUGE,
    });
    try {
      // Note: xsdDoc must remain alive in WASM memory while validator is in use.
      return libxml2.XsdValidator.fromDoc(xsdDoc);
    } catch (err: unknown) {
      xsdDoc.dispose();
      throw err;
    }
  })();
  validatorPromiseCache.set(schema, promise);
  void promise.catch(() => validatorPromiseCache.delete(schema));
  return promise;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function extractErrors(err: unknown, libxml2: Libxml2ModuleType): string[] {
  if (err instanceof libxml2.XmlValidateError && err.details) {
    return err.details.map((d: { message: string }) => d.message.trim());
  }
  return [err instanceof Error ? err.message : String(err)];
}

async function parseAndValidate(
  xmlData: string,
  schema: XsdSchemaName,
  parseOption: number,
  maxXmlSize?: number,
): Promise<{ doc: XmlDocType | null; errors: string[]; libxml2: Libxml2ModuleType }> {
  assertXmlSize(xmlData, maxXmlSize);
  const validator = await getValidator(schema);
  const libxml2 = await getLibxml2();
  let xmlDoc: XmlDocType | null = null;
  try {
    xmlDoc = libxml2.XmlDocument.fromString(xmlData, { option: parseOption });
    validator.validate(xmlDoc);
    return { doc: xmlDoc, errors: [], libxml2 };
  } catch (err: unknown) {
    xmlDoc?.dispose();
    return { doc: null, errors: extractErrors(err, libxml2), libxml2 };
  }
}

export interface ValidateXmlOptions {
  /** XML size limit in bytes. Default: 10 MB. */
  maxXmlSize?: number;
}

export async function validateXml(
  xmlData: string,
  schema: XsdSchemaName,
  options?: ValidateXmlOptions,
): Promise<ValidationResult> {
  const { doc, errors } = await parseAndValidate(xmlData, schema, await getParseOption(), options?.maxXmlSize);
  doc?.dispose();
  return errors.length === 0 ? { valid: true, errors: [] } : { valid: false, errors };
}

/**
 * Validates the XML and, on success, returns the already-parsed
 * XmlDocument — so the caller does not need to parse twice.
 * Ownership of the returned XmlDocument is the caller's: it must be
 * disposed by the caller!
 */
export async function validateXmlAndReturnDoc(
  xmlData: string,
  schema: XsdSchemaName,
  parseOption: number,
  maxXmlSize?: number,
): Promise<{ doc: XmlDocType | null; errors: string[] }> {
  const { doc, errors } = await parseAndValidate(xmlData, schema, parseOption, maxXmlSize);
  return { doc, errors };
}
