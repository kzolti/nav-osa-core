import { validateXmlAndReturnDoc } from "./validator.js";
import { getLibxml2, getLibxml2Internals, getParseOption } from "./runtime/libxml2.js";
import { XsdSchemaName } from "../xsdPaths.js";
import type { XmlDocument } from "libxml2-wasm";
import { ALWAYS_ARRAY } from "./shared/fieldSets.js";
import { XmlValidationError } from "./shared/errors.js";
import { assertXmlSize, MAX_PARSE_DEPTH } from "./shared/guards.js";
import { convertTagValue } from "./shared/convert.js";
import { ELEMENT_NODE, TEXT_NODE, CDATA_NODE, xmlDocPtr } from "./parser/wasmConstants.js";
import type { XmlParserOptions } from "./shared/guards.js";

type XmlNode = Record<string, unknown>;

function appendChildValue(obj: XmlNode, key: string, value: unknown): void {
  const existing = obj[key];
  if (Array.isArray(existing)) {
    existing.push(value);
  } else if (existing !== undefined) {
    obj[key] = [existing, value];
  } else if (ALWAYS_ARRAY.has(key)) {
    obj[key] = [value];
  } else {
    obj[key] = value;
  }
}

/**
 * Parse XML with libxml2-wasm (C++ libxml2 in WebAssembly) using direct
 * WASM-memory node access, producing the same output shape as
 * fast-xml-parser's xmlParser (removeNSPrefix, @_ attributes, #text nodes,
 * always-array names and tag value conversion).
 */
export async function xmlParserLibxml2<T>(
  xmlData: string,
  schemaName: XsdSchemaName,
  options?: XmlParserOptions
): Promise<T> {
  const parseOption = await getParseOption(options?.processEntities === true);

  let xmlDoc: InstanceType<typeof XmlDocument> | null = null;

  if (options?.validate !== false) {
    const { doc, errors } = await validateXmlAndReturnDoc(xmlData, schemaName, parseOption, options?.maxXmlSize);
    if (errors.length > 0) {
      throw new XmlValidationError(`XSD validation failed against ${schemaName}`, errors);
    }
    if (!doc) {
      throw new Error("internal error: XSD validation succeeded without producing an XmlDocument");
    }
    xmlDoc = doc;
  } else {
    assertXmlSize(xmlData, options?.maxXmlSize);
    const libxml2 = await getLibxml2();
    try {
      xmlDoc = libxml2.XmlDocument.fromString(xmlData, { option: parseOption });
    } catch (err: unknown) {
      throw new XmlValidationError(
        "XML parse failed (document is not well-formed)",
        [err instanceof Error ? err.message : String(err)],
        { cause: err },
      );
    }
  }

  try {
    if (!xmlDoc) {
      throw new Error("internal error: no XmlDocument to parse");
    }
    const { XmlTreeCommonStruct, XmlNodeStruct, xmlDocGetRootElement, xmlNodeGetContent } =
      await getLibxml2Internals();

    function attachAttributes(target: XmlNode, props: number | null): void {
      for (let attr = props; attr; attr = XmlTreeCommonStruct.next(attr)) {
        target[`@_${XmlTreeCommonStruct.name_(attr)}`] = xmlNodeGetContent(attr);
      }
    }

    function convertPtr(ptr: number, depth = 0): unknown {
      if (depth > MAX_PARSE_DEPTH) {
        throw new XmlValidationError(
          `XML document too deeply nested (depth > ${MAX_PARSE_DEPTH})`,
          [`maximum supported nesting depth is ${MAX_PARSE_DEPTH}`],
        );
      }
      let text = "";
      const childPtrs: number[] = [];
      for (let node = XmlTreeCommonStruct.children(ptr); node; node = XmlTreeCommonStruct.next(node)) {
        const type = XmlTreeCommonStruct.type(node);
        if (type === TEXT_NODE || type === CDATA_NODE) {
          text += xmlNodeGetContent(node);
        } else if (type === ELEMENT_NODE) {
          childPtrs.push(node);
        }
      }
      const props = XmlNodeStruct.properties(ptr);
      const trimmed = text.trim();
      const hasElementChildren = childPtrs.length > 0;

      if (!hasElementChildren) {
        if (trimmed === "" && !props) return "";
        if (!props) return convertTagValue(XmlTreeCommonStruct.name_(ptr), trimmed) as unknown;
        const obj: XmlNode = {};
        if (trimmed !== "") obj["#text"] = convertTagValue(XmlTreeCommonStruct.name_(ptr), trimmed) as unknown;
        attachAttributes(obj, props);
        return obj;
      }

      const obj: XmlNode = {};
      if (trimmed !== "") obj["#text"] = convertTagValue(XmlTreeCommonStruct.name_(ptr), trimmed) as unknown;
      for (const childPtr of childPtrs) {
        const key = XmlTreeCommonStruct.name_(childPtr);
        const value = convertPtr(childPtr, depth + 1);
        appendChildValue(obj, key, value);
      }
      attachAttributes(obj, props);
      return obj;
    }

    const root = xmlDocGetRootElement(xmlDocPtr(xmlDoc));
    if (!root) {
      throw new XmlValidationError("XML document has no root element", [
        "the document does not contain a root element",
      ]);
    }
    const result: XmlNode = {};
    result[XmlTreeCommonStruct.name_(root)] = convertPtr(root);
    return result as T;
  } finally {
    xmlDoc?.dispose();
  }
}
