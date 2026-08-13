import type { XmlDocument, XsdValidator } from 'libxml2-wasm';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { XsdSchemaName, getXsdPath } from '../xsdPaths.js';
import { assertXmlSize } from './shared/xmlParserCommon.js';

type Libxml2ModuleType = typeof import('libxml2-wasm');
type XmlDocType = InstanceType<typeof XmlDocument>;
type XsdValidatorType = InstanceType<typeof XsdValidator>;

let libxml2Module: Libxml2ModuleType | null = null;
let libxml2Promise: Promise<Libxml2ModuleType> | null = null;
const validatorPromiseCache = new Map<XsdSchemaName, Promise<XsdValidatorType>>();

export async function getLibxml2(): Promise<Libxml2ModuleType> {
  if (libxml2Module) {
    return libxml2Module;
  }
  if (libxml2Promise) {
    return libxml2Promise;
  }
  libxml2Promise = (async () => {
    // new Function: bundlers (webpack/vite) would statically resolve the
    // "libxml2-wasm" import string, breaking the WASM module. The string is
    // a constant, independent of user input — no eval risk.
    const mod: Libxml2ModuleType = await new Function('return import("libxml2-wasm")')();
    try {
      // Same reason for importing the nodejs.mjs FS provider.
      const { xmlRegisterFsInputProviders } = await new Function('return import("libxml2-wasm/lib/nodejs.mjs")')();
      xmlRegisterFsInputProviders();
    } catch {
      // Fallback: FS provider unavailable
    }
    libxml2Module = mod;
    return mod;
  })();
  // A failed load must not be cached forever: reset the promise so the
  // next call retries (same pattern as validatorPromiseCache below).
  libxml2Promise.catch(() => {
    libxml2Promise = null;
  });
  return libxml2Promise;
}

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
  promise.catch(() => validatorPromiseCache.delete(schema));
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

export async function validateXml(
  xmlData: string,
  schema: XsdSchemaName,
  maxXmlSize?: number,
): Promise<ValidationResult> {
  // The default limit is the shared DEFAULT_MAX_XML_SIZE, so raising the
  // default automatically applies here too; callers can override it
  // per-call, matching the parser and the extractor.
  assertXmlSize(xmlData, maxXmlSize);
  const validator = await getValidator(schema);
  const libxml2 = await getLibxml2();
  let xmlDoc: XmlDocType | null = null;
  try {
    xmlDoc = libxml2.XmlDocument.fromString(xmlData, {
      option: libxml2.ParseOption.XML_PARSE_NOBLANKS | libxml2.ParseOption.XML_PARSE_NONET,
    });
    validator.validate(xmlDoc);
    return { valid: true, errors: [] };
  } catch (err: unknown) {
    return { valid: false, errors: extractErrors(err, libxml2) };
  } finally {
    xmlDoc?.dispose();
  }
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
  assertXmlSize(xmlData, maxXmlSize);
  const validator = await getValidator(schema);
  const libxml2 = await getLibxml2();
  let xmlDoc: XmlDocType | null = null;
  try {
    xmlDoc = libxml2.XmlDocument.fromString(xmlData, { option: parseOption });
    validator.validate(xmlDoc);
    return { doc: xmlDoc, errors: [] };
  } catch (err: unknown) {
    xmlDoc?.dispose();
    return { doc: null, errors: extractErrors(err, libxml2) };
  }
}
