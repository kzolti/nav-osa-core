import { XsdSchemaName } from "../../xsdPaths.js";
import { validateXmlAndReturnDoc } from "../validator.js";
import { convertTagValue, XmlValidationError } from "../shared/xmlParserCommon.js";
import { ELEMENT_NODE, PARSE_OPTION, xmlDocPtr } from "../parser/wasmConstants.js";
import {
  XmlTreeCommonStruct,
  xmlDocGetRootElement,
  xmlNodeGetContent,
} from "libxml2-wasm/lib/libxml2.mjs";

/**
 * Queue growth factor for the BFS traversal. OSA 3.0 documents stay far
 * below a few thousand elements, so a modest geometric growth keeps memory
 * waste down without reallocating on every child.
 */
const GROWTH_FACTOR = 1.5;

/**
 * BFS traversal directly on the WASM pointers: reads only the requested
 * fields from the DOM, completely skipping the full object build (string
 * copies between WASM and V8). The first hit is a string, repeated
 * fields become string[].
 */
export function extractFieldsFast(
  rootPtr: number,
  fieldNames: Set<string>
): Record<string, string | string[]> {
  const fields: Record<string, string | string[]> = {};
  let queue = new Int32Array(256);
  queue[0] = rootPtr;
  let head = 0;
  let tail = 1;

  try {
    while (head < tail) {
      const ptr = queue[head++];
      const name = XmlTreeCommonStruct.name_(ptr);

      if (fieldNames.has(name)) {
        const content = xmlNodeGetContent(ptr);
        if (fields[name] === undefined) {
          fields[name] = content;
        } else if (Array.isArray(fields[name])) {
          (fields[name] as string[]).push(content);
        } else {
          fields[name] = [fields[name] as string, content];
        }
      }

      for (let child = XmlTreeCommonStruct.children(ptr); child; child = XmlTreeCommonStruct.next(child)) {
        if (XmlTreeCommonStruct.type(child) === ELEMENT_NODE) {
          if (tail === queue.length) {
            const bigger = new Int32Array(Math.ceil(queue.length * GROWTH_FACTOR));
            bigger.set(queue);
            queue = bigger;
          }
          queue[tail++] = child;
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

export interface ValidateAndExtractFieldsOptions {
  /** false: returns an `errors` list instead of throwing on error. */
  errorOnInvalid?: boolean;
  /**
   * true: applies the same type conversion to the extracted values as the
   * full parse (`modificationIndex` → number, `modifyWithoutMaster` → boolean).
   * false (default): raw strings, no conversion.
   */
  convertValues?: boolean;
  /** XML size limit in bytes. Default: 10 MB. */
  maxXmlSize?: number;
}

/**
 * XSD validation + targeted field extraction in a single pass.
 *
 * After validation it does NOT build the full parse object —
 * {@link extractFieldsFast} walks the WASM pointers directly and copies
 * only the requested fields into JS strings. Throws
 * {@link XmlValidationError} on invalid documents; with `errorOnInvalid:
 * false` it returns the errors in the `errors` list instead.
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
  options?: ValidateAndExtractFieldsOptions
): Promise<ValidateAndExtractFieldsResult<T>> {
  const { doc, errors } = await validateXmlAndReturnDoc(
    xmlData, schemaName, PARSE_OPTION, options?.maxXmlSize,
  );

  if (errors.length > 0) {
    if (options?.errorOnInvalid !== false) {
      throw new XmlValidationError(`XSD validation failed against ${schemaName}`, errors);
    }
    return { fields: {} as T, errors };
  }

  if (!doc) {
    return { fields: {} as T, errors };
  }

  try {
    const root = xmlDocGetRootElement(xmlDocPtr(doc));
    if (!root) {
      return { fields: {} as T, errors };
    }
    const raw = extractFieldsFast(root, new Set(fieldNames));
    const fields = options?.convertValues ? convertFieldValues(raw) : raw;
    return { fields: fields as T, errors };
  } finally {
    doc.dispose();
  }
}

function convertFieldValues(
  raw: Record<string, string | string[]>
): Record<string, ExtractedFieldValue | ExtractedFieldValue[]> {
  const out: Record<string, ExtractedFieldValue | ExtractedFieldValue[]> = {};
  for (const [name, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      out[name] = value.map((v) => convertTagValue(name, v));
    } else {
      out[name] = convertTagValue(name, value);
    }
  }
  return out;
}