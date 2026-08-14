import { getLibxml2, validateXmlAndReturnDoc } from "./validator.js";
import { XsdSchemaName } from "../xsdPaths.js";
import { XmlDocument, ParseOption } from "libxml2-wasm";
import {
  XmlNodeStruct,
  XmlTreeCommonStruct,
  xmlDocGetRootElement,
  xmlNodeGetContent,
} from "libxml2-wasm/lib/libxml2.mjs";
import { ALWAYS_ARRAY, XmlValidationError, assertXmlSize, convertTagValue, MAX_BUILD_DEPTH } from "./shared/xmlParserCommon.js";
import { ELEMENT_NODE, TEXT_NODE, CDATA_NODE, PARSE_OPTION, xmlDocPtr } from "./parser/wasmConstants.js";
import type { XmlParserOptions } from "./shared/xmlParserCommon.js";

type XmlNode = Record<string, unknown>;

function convertPtr(ptr: number, depth = 0): unknown {
  if (depth > MAX_BUILD_DEPTH) {
    throw new XmlValidationError(
      `XML document too deeply nested (depth > ${MAX_BUILD_DEPTH})`,
      [`maximum supported nesting depth is ${MAX_BUILD_DEPTH}`],
    );
  }
  let text = "";
  let child: number | null = null;
  const childPtrs: number[] = [];
  for (let node = XmlTreeCommonStruct.children(ptr); node; node = XmlTreeCommonStruct.next(node)) {
    const type = XmlTreeCommonStruct.type(node);
    if (type === TEXT_NODE || type === CDATA_NODE) {
      text += xmlNodeGetContent(node);
    } else if (type === ELEMENT_NODE) {
      if (child === null) child = node;
      childPtrs.push(node);
    }
  }

  const props = XmlNodeStruct.properties(ptr);
  if (!child) {
    const trimmed = text.trim();
    if (trimmed === "" && !props) {
      return "";
    }
    if (!props) {
      return convertTagValue(XmlTreeCommonStruct.name_(ptr), trimmed) as unknown;
    }
    const obj: XmlNode = {};
    if (trimmed !== "") obj["#text"] = trimmed;
    for (let attr = props; attr; attr = XmlTreeCommonStruct.next(attr)) {
      obj[`@_${XmlTreeCommonStruct.name_(attr)}`] = xmlNodeGetContent(attr);
    }
    return obj;
  }

  const trimmed = text.trim();
  const obj: XmlNode = {};
  if (trimmed !== "") obj["#text"] = trimmed;
  for (const c of childPtrs) {
    const key = XmlTreeCommonStruct.name_(c);
    const value = convertPtr(c, depth + 1);
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
  for (let attr = props; attr; attr = XmlTreeCommonStruct.next(attr)) {
    obj[`@_${XmlTreeCommonStruct.name_(attr)}`] = xmlNodeGetContent(attr);
  }
  return obj;
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
  const parseOption =
    options?.processEntities === true
      ? PARSE_OPTION | ParseOption.XML_PARSE_NOENT
      : PARSE_OPTION;

  let xmlDoc: InstanceType<typeof XmlDocument> | null = null;

  if (options?.validate !== false) {
    const { doc, errors } = await validateXmlAndReturnDoc(xmlData, schemaName, parseOption, options?.maxXmlSize);
    if (errors.length > 0) {
      throw new XmlValidationError(`XSD validation failed against ${schemaName}`, errors);
    }
    if (!doc) {
      // Unreachable today: validateXmlAndReturnDoc only returns a null doc
      // together with a non-empty errors list. A null doc here signals that
      // the validator contract changed — fail loudly instead of silently
      // returning an empty object.
      throw new Error("internal error: XSD validation succeeded without producing an XmlDocument");
    }
    xmlDoc = doc;
  } else {
    // validateXmlAndReturnDoc calls assertXmlSize internally; on the
    // validate:false path the size limit must be enforced here, otherwise
    // the guard could be bypassed.
    assertXmlSize(xmlData, options?.maxXmlSize);
    await getLibxml2();
    try {
      xmlDoc = XmlDocument.fromString(xmlData, { option: parseOption });
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
    const root = xmlDocGetRootElement(xmlDocPtr(xmlDoc));
    if (!root) {
      throw new XmlValidationError(
        "XML document has no root element",
        ["the document does not contain a root element"],
      );
    }
    const result: XmlNode = {};
    result[XmlTreeCommonStruct.name_(root)] = convertPtr(root);
    return result as T;
  } finally {
    xmlDoc?.dispose();
  }
}
