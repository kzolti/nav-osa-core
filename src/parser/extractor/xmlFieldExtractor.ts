import { XsdSchemaName } from "../../xsdPaths.js";
import { validateXmlAndReturnDoc } from "../validator.js";
import { getLibxml2, getLibxml2Internals, getParseOption } from "../runtime/libxml2.js";
import { assertXmlSize } from "../shared/guards.js";
import { convertTagValue } from "../shared/convert.js";
import { XmlValidationError } from "../shared/errors.js";
import { ELEMENT_NODE, TEXT_NODE, CDATA_NODE, xmlDocPtr } from "../parser/wasmConstants.js";
import type { XmlDocument } from "libxml2-wasm";

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function accumulateField(
  fields: Record<string, string | string[]>,
  name: string,
  content: string,
): void {
  const existing = fields[name];
  if (existing === undefined) {
    fields[name] = content;
  } else if (Array.isArray(existing)) {
    existing.push(content);
  } else {
    fields[name] = [existing, content];
  }
}

function convertFieldValues(
  raw: Record<string, string | string[]>,
): Record<string, ExtractedFieldValue | ExtractedFieldValue[]> {
  const out: Record<string, ExtractedFieldValue | ExtractedFieldValue[]> = {};
  for (const [name, value] of Object.entries(raw)) {
    out[name] = Array.isArray(value)
      ? value.map((v) => convertTagValue(name, v))
      : convertTagValue(name, value);
  }
  return out;
}

async function extractFromDoc<T>(
  doc: InstanceType<typeof XmlDocument>,
  fieldNames: readonly string[],
  convertValues?: boolean,
): Promise<T> {
  const { xmlDocGetRootElement } = await getLibxml2Internals();
  const root = xmlDocGetRootElement(xmlDocPtr(doc));
  if (!root) return {} as T;
  const raw = await extractFieldsFast(root, new Set(fieldNames));
  const fields = convertValues ? convertFieldValues(raw) : raw;
  return fields as T;
}

export type ErrorMode = 'throw' | 'return';

function handleSizeError<T>(
  err: unknown,
  errorMode: ErrorMode,
): { fields: T; errors: string[] } {
  if (errorMode === 'return') return { fields: {} as T, errors: [toErrorMessage(err)] };
  throw err;
}

// ---------------------------------------------------------------------------
// Internal: WASM pointer traversal (not part of public API)
// ---------------------------------------------------------------------------

/**
 * BFS traversal directly on the WASM pointers: reads only the requested
 * fields from the DOM, completely skipping the full object build (string
 * copies between WASM and V8). The first hit is a string, repeated
 * fields become string[].
 * Centralized through `getLibxml2Internals()` so bundlers never create
 * a second WASM instance (previous static `from "libxml2-wasm/lib/libxml2.mjs"`
 * could be duplicated by the bundler, yielding pointer garbage).
 */
async function extractFieldsFast(
  rootPtr: number,
  fieldNames: Set<string>,
): Promise<Record<string, string | string[]>> {
  const { XmlTreeCommonStruct, xmlNodeGetContent } = await getLibxml2Internals();
  const fields: Record<string, string | string[]> = {};
  const queue: number[] = [rootPtr];
  let head = 0;

  try {
    while (head < queue.length) {
      const ptr = queue[head++];
      const name = XmlTreeCommonStruct.name_(ptr);

      if (fieldNames.has(name)) {
        let directText = "";
        for (let c = XmlTreeCommonStruct.children(ptr); c; c = XmlTreeCommonStruct.next(c)) {
          const t = XmlTreeCommonStruct.type(c);
          if (t === TEXT_NODE || t === CDATA_NODE) directText += xmlNodeGetContent(c);
        }
        directText = directText.trim();
        accumulateField(fields, name, directText);
      }

      for (let child = XmlTreeCommonStruct.children(ptr); child; child = XmlTreeCommonStruct.next(child)) {
        if (XmlTreeCommonStruct.type(child) === ELEMENT_NODE) {
          queue.push(child);
        }
      }
    }
  } catch (err: unknown) {
    // The pointers come from a validated, still-alive XmlDocument, so a
    // failure here indicates a libxml2-wasm issue or memory corruption —
    // never swallow it into an empty result (silent data loss). Rethrow
    // with context so the caller can distinguish it from validation errors.
    throw new Error(
      "libxml2-wasm pointer traversal failed during field extraction",
      { cause: err },
    );
  }

  return fields;
}

export type ExtractedFieldValue = string | number | boolean;

export interface ValidateAndExtractFieldsResult<T = Record<string, string | string[]>> {
/** The requested fields on successful validation (name → content). */
  fields: T;
  /** Empty if there are no errors; otherwise the list of validation errors. */
  errors: string[];
}

export interface ExtractFieldsOptions {
  /**
   * true: applies the same type conversion to the extracted values as the
   * full parse (`modificationIndex` → number, `modifyWithoutMaster` → boolean).
   * false (default): raw strings, no conversion.
   */
  convertValues?: boolean;
  /** XML size limit in bytes. Default: 10 MB. */
  maxXmlSize?: number;
  /** 'throw' (default): throws on invalid XML, 'return': returns `{fields, errors}` */
  errorMode?: ErrorMode;
}

/** @deprecated alias kept for backward compatibility; both extractors share {@link ExtractFieldsOptions}. */
export type ValidateAndExtractFieldsOptions = ExtractFieldsOptions;

export interface ExtractFieldsResult<T = Record<string, string | string[]>> {
  fields: T;
  errors: string[];
}

/**
 * XSD validation + targeted field extraction in a single pass.
 *
 * After validation it does NOT build the full parse object —
 * {@link extractFieldsFast} walks the WASM pointers directly and copies
 * only the requested fields into JS strings. Throws
 * {@link XmlValidationError} on invalid documents; with `errorMode: 'return'`
 * it returns the errors in the `errors` list instead.
 *
 * @example
 * const { fields } = await validateAndExtractFields(xml, XsdSchemaName.Data, [
 *   "invoiceNumber", "originalInvoiceNumber", "modifyWithoutMaster",
 * ]);
 */
export async function validateAndExtractFields<T = Record<string, string | string[]>>(
  xmlData: string,
  schemaName: XsdSchemaName,
  fieldNames: readonly string[],
  options?: ValidateAndExtractFieldsOptions,
): Promise<ValidateAndExtractFieldsResult<T>> {
  const errorMode = options?.errorMode ?? 'throw';
  let doc: InstanceType<typeof XmlDocument> | null = null;
  let errors: string[] = [];
  try {
    const res = await validateXmlAndReturnDoc(xmlData, schemaName, await getParseOption(), options?.maxXmlSize);
    doc = res.doc;
    errors = res.errors;
  } catch (err: unknown) {
    return handleSizeError<T>(err, errorMode);
  }

  if (errors.length > 0) {
    if (errorMode === 'throw') {
      throw new XmlValidationError(`XSD validation failed against ${schemaName}`, errors);
    }
    return { fields: {} as T, errors };
  }

  if (!doc) {
    throw new Error("internal error: XSD validation succeeded without producing an XmlDocument");
  }

  try {
    const fields = await extractFromDoc<T>(doc, fieldNames, options?.convertValues);
    return { fields, errors };
  } finally {
    doc.dispose();
  }
}

/**
 * Well-formedness + targeted field extraction in a single pass — **no XSD validation**.
 *
 * Drop-in replacement for the regexp-based `extractInvoiceNumbers` /
 * `extractEnvelopePayloads` helpers: namespace-agnostic, handles entities,
 * CDATA, comments and whitespace via `libxml2-wasm`. On ill-formed XML it
 * throws {@link XmlValidationError} by default; with `errorMode: 'return'`
 * it returns `{fields:{}, errors}` instead (handy for the recovery fallback).
 *
 * Compared to {@link validateAndExtractFields}, this skips `XsdValidator.validate()`
 * → ~30-40% faster (`0.20-0.45ms` vs `0.32-0.67ms` on the `Peldaszamlak_v3.0` bench),
 * while {@link extractFieldsFast} is only the inner BFS traversal (`0.04-0.11ms`) and
 * requires a caller-held `XmlDocument` pointer.
 */
export async function extractFields<T = Record<string, string | string[]>>(
  xmlData: string,
  fieldNames: readonly string[],
  options?: ExtractFieldsOptions,
): Promise<ExtractFieldsResult<T>> {
  const errorMode = options?.errorMode ?? 'throw';
  try {
    assertXmlSize(xmlData, options?.maxXmlSize);
  } catch (err: unknown) {
    return handleSizeError<T>(err, errorMode);
  }

  const libxml2 = await getLibxml2();
  let doc: InstanceType<typeof XmlDocument> | null = null;
  try {
    doc = libxml2.XmlDocument.fromString(xmlData, { option: await getParseOption() });
  } catch (err: unknown) {
    if (errorMode === 'return') return { fields: {} as T, errors: [toErrorMessage(err)] };
    throw new XmlValidationError("XML parse failed (document is not well-formed)", [toErrorMessage(err)], { cause: err });
  }

  try {
    const fields = await extractFromDoc<T>(doc, fieldNames, options?.convertValues);
    return { fields, errors: [] };
  } finally {
    doc.dispose();
  }
}
