import type { XmlDocument, XsdValidator } from 'libxml2-wasm';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { XsdSchemaName, getXsdPath } from '../xsdPaths.js';

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
    const mod: Libxml2ModuleType = await new Function('return import("libxml2-wasm")')();
    try {
      const { xmlRegisterFsInputProviders } = await new Function('return import("libxml2-wasm/lib/nodejs.mjs")')();
      xmlRegisterFsInputProviders();
    } catch {
      // Fallback: FS provider nem elérhető
    }
    libxml2Module = mod;
    return mod;
  })();
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
    // Note: xsdDoc must remain alive in WASM memory while validator is in use.
    return libxml2.XsdValidator.fromDoc(xsdDoc);
  })();

  validatorPromiseCache.set(schema, promise);
  return promise;
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

/**
 * Belső warm-up helper: előállítja (és eltárolja) a sémák validátorait,
 * hogy az első validálásnál ne kelljen libxml2 betöltésre + XSD kompilálásra várni.
 * Nem része a publikus API-nak (nem exportált az index.ts-ből).
 */
export async function preloadValidators(schemas?: XsdSchemaName[]): Promise<void> {
  const toLoad = schemas ?? (Object.values(XsdSchemaName) as XsdSchemaName[]);
  await Promise.all(toLoad.map(getValidator));
}

/**
 * Validálja az XML-t, és sikeres validáció esetén visszaadja a már parse-olt
 * XmlDocument-et — így a hívó fél nem kell újra parse-oljon.
 * A visszaadott XmlDocument tulajdonjoga a hívóé: hívónak kell dispose()-olni!
 */
export async function validateXmlAndReturnDoc(
  xmlData: string,
  schema: XsdSchemaName,
  parseOption: number,
): Promise<{ doc: XmlDocType; errors: string[] }> {
  const validator = await getValidator(schema);
  const libxml2 = await getLibxml2();
  const xmlDoc = libxml2.XmlDocument.fromString(xmlData, { option: parseOption });
  try {
    validator.validate(xmlDoc);
    return { doc: xmlDoc, errors: [] };
  } catch (err: unknown) {
    xmlDoc.dispose();
    let errors: string[] = [];
    if (err instanceof libxml2.XmlValidateError && err.details) {
      errors = err.details.map((d: { message: string }) => d.message.trim());
    } else {
      errors = [err instanceof Error ? err.message : String(err)];
    }
    return { doc: null as unknown as XmlDocType, errors };
  }
}
