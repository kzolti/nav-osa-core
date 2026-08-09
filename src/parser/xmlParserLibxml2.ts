import { getLibxml2, validateXmlAndReturnDoc } from "./xsdValidator.js";
import { XsdSchemaName } from "../xsdPaths.js";
import { XmlDocument, ParseOption } from "libxml2-wasm";
import {
  XmlNodeStruct,
  XmlTreeCommonStruct,
  xmlDocGetRootElement,
  xmlNodeGetContent,
} from "libxml2-wasm/lib/libxml2.mjs";
import { ALWAYS_ARRAY, XmlValidationError, assertXmlSize, convertTagValue } from "./xmlParserCommon.js";
import type { XmlParserOptions } from "./xmlParserCommon.js";

export { XmlValidationError } from "./xmlParserCommon.js";
export type { XmlParserOptions } from "./xmlParserCommon.js";

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const CDATA_NODE = 4;

type XmlNode = Record<string, unknown>;

function convertPtr(ptr: number): unknown {
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
    const value = convertPtr(c);
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
  assertXmlSize(xmlData, options?.maxXmlSize);

  const parseOption =
    ParseOption.XML_PARSE_NOBLANKS |
    ParseOption.XML_PARSE_NONET |
    ParseOption.XML_PARSE_HUGE |
    (options?.processEntities === false ? 0 : ParseOption.XML_PARSE_NOENT);

  let xmlDoc: InstanceType<typeof XmlDocument> | null = null;

  if (options?.validate !== false) {
    // Validáció és parse egyetlen menetben: a visszakapott doc-ot újra felhasználjuk,
    // így nem kell kétszer XmlDocument.fromString()-et hívni ugyanarra az XML-re.
    const { doc, errors } = await validateXmlAndReturnDoc(xmlData, schemaName, parseOption);
    if (errors.length > 0) {
      throw new XmlValidationError(`XSD validation failed against ${schemaName}`, errors);
    }
    xmlDoc = doc;
  } else {
    await getLibxml2();
    xmlDoc = XmlDocument.fromString(xmlData, { option: parseOption });
  }

  try {
    const root = xmlDocGetRootElement((xmlDoc as unknown as { _ptr: number })._ptr);
    if (!root) {
      return {} as T;
    }
    const result: XmlNode = {};
    result[XmlTreeCommonStruct.name_(root)] = convertPtr(root);
    return result as T;
  } finally {
    xmlDoc.dispose();
  }
}
