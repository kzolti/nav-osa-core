import type { XmlDocument, XsdValidator } from 'libxml2-wasm';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { XsdSchemaName, getXsdPath } from '../xsdPaths.js';

type Libxml2ModuleType = typeof import('libxml2-wasm');
type XmlDocType = InstanceType<typeof XmlDocument>;
type XsdValidatorType = InstanceType<typeof XsdValidator>;

let libxml2Module: Libxml2ModuleType | null = null;
const validatorCache = new Map<XsdSchemaName, XsdValidatorType>();

async function getLibxml2(): Promise<Libxml2ModuleType> {
  if (libxml2Module) {
    return libxml2Module;
  }
  const mod: Libxml2ModuleType = await new Function('return import("libxml2-wasm")')();
  try {
    const { xmlRegisterFsInputProviders } = await new Function('return import("libxml2-wasm/lib/nodejs.mjs")')();
    xmlRegisterFsInputProviders();
  } catch {
    // Fallback: FS provider nem elérhető
  }
  libxml2Module = mod;
  return mod;
}

async function getValidator(schema: XsdSchemaName): Promise<XsdValidatorType> {
  const cached = validatorCache.get(schema);
  if (cached) {
    return cached;
  }

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
  const validator: XsdValidatorType = libxml2.XsdValidator.fromDoc(xsdDoc);
  validatorCache.set(schema, validator);
  return validator;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export async function validateXml(xmlData: string, schema: XsdSchemaName): Promise<ValidationResult> {
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
    let errors: string[] = [];
    if (err instanceof libxml2.XmlValidateError && err.details) {
      errors = err.details.map((d: { message: string }) => d.message.trim());
    } else {
      errors = [err instanceof Error ? err.message : String(err)];
    }
    return { valid: false, errors };
  } finally {
    xmlDoc?.dispose();
  }
}
