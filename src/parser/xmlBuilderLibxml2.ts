import { XmlDocument, XmlElement } from "libxml2-wasm";
import { getLibxml2, validateXml } from "./xsdValidator.js";
import { XsdSchemaName } from "../xsdPaths.js";
import { XmlValidationError } from "./xmlParserCommon.js";
import { addNamespacePrefix } from "./xmlBuilder.js";

const DATA_NS = "http://schemas.nav.gov.hu/OSA/3.0/data";
const BASE_NS = "http://schemas.nav.gov.hu/OSA/3.0/base";

type Node = Record<string, unknown>;

const baseElements = new Set([
  "taxpayerId", "vatCode", "countyCode",
  "simpleAddress", "detailedAddress",
  "countryCode", "region", "postalCode", "city",
  "streetName", "publicPlaceCategory", "number", "building", "staircase", "floor", "door", "lotNumber",
  "additionalAddressDetail",
]);

function elementName(key: string): { name: string; prefix?: string } {
  const colon = key.indexOf(":");
  if (colon > 0) {
    return { name: key.slice(colon + 1), prefix: key.slice(0, colon) };
  }
  return { name: key };
}

function addValue(parent: XmlElement, key: string, value: unknown, useBasePrefix: boolean): void {
  const { name, prefix } = elementName(key);
  if (Array.isArray(value)) {
    for (const item of value) {
      addChild(parent, name, prefix, item, useBasePrefix);
    }
    return;
  }
  addChild(parent, name, prefix, value, useBasePrefix);
}

function baseElementName(name: string, useBasePrefix: boolean): { name: string; prefix?: string } {
  if (useBasePrefix && baseElements.has(name)) {
    return { name, prefix: "base" };
  }
  return { name };
}

function addChild(
  parent: XmlElement,
  name: string,
  prefix: string | undefined,
  value: unknown,
  useBasePrefix: boolean,
): void {
  const target = baseElementName(name, useBasePrefix);
  const el = target.prefix || prefix
    ? parent.addElement(target.name, target.prefix ?? prefix)
    : parent.addElement(target.name);
  writeValue(el, value, useBasePrefix);
}

function writeValue(el: XmlElement, value: unknown, useBasePrefix: boolean): void {
  if (Array.isArray(value)) {
    for (const item of value) writeValue(el, item, useBasePrefix);
    return;
  }
  if (value === null || value === undefined) {
    el.addText("");
    return;
  }
  if (typeof value === "object") {
    const obj = value as Node;
    for (const [key, val] of Object.entries(obj)) {
      if (!key.startsWith("@_") || key === "#text" || key === "@_xmlns" || key.startsWith("@_xmlns:")) continue;
      const { name: attrName, prefix } = elementName(key.slice(2));
      if (prefix) {
        el.setAttr(attrName, String(val), prefix);
      } else {
        el.setAttr(attrName, String(val));
      }
    }
    if (obj["#text"] !== undefined) {
      el.addText(String(obj["#text"]));
    }
    for (const [key, val] of Object.entries(obj)) {
      if (key.startsWith("@_") || key === "#text") continue;
      addValue(el, key, val, useBasePrefix);
    }
    return;
  }
  el.addText(String(value));
}

function writeAttributes(el: XmlElement, obj: Node): void {
  for (const [key, val] of Object.entries(obj)) {
    if (key === "@_xmlns" || key.startsWith("@_xmlns:")) continue;
    if (!key.startsWith("@_")) continue;
    const { name, prefix } = elementName(key.slice(2));
    if (prefix) {
      el.setAttr(name, String(val), prefix);
    } else {
      el.setAttr(name, String(val));
    }
  }
}

function setNamespaceDeclarations(el: XmlElement, obj: Node): void {
  for (const [key, val] of Object.entries(obj)) {
    if (key === "@_xmlns") {
      el.addNsDeclaration(String(val));
    } else if (key.startsWith("@_xmlns:")) {
      el.addNsDeclaration(String(val), key.slice(8));
    }
  }
}

function stripMeta(obj: Node): Node {
  const clean: Node = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith("@_") || key === "#text") {
      if (key === "#text") clean[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      clean[key] = value.map((v) =>
        typeof v === "object" && v !== null ? stripMeta(v as Node) : v
      );
    } else if (typeof value === "object" && value !== null) {
      clean[key] = stripMeta(value as Node);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

async function validateXmlString(xml: string, schema: XsdSchemaName, label: string): Promise<void> {
  const result = await validateXml(xml, schema);
  if (!result.valid) {
    throw new XmlValidationError(`${label} XSD validation failed`, result.errors);
  }
}

export async function buildInvoiceXmlLibxml2(invoiceData: unknown): Promise<string> {
  await getLibxml2();
  const doc = XmlDocument.create();
  const root = doc.createRoot("InvoiceData", DATA_NS, undefined);
  root.addNsDeclaration(BASE_NS, "base");

  const cleaned = stripMeta(invoiceData as Node);
  writeValue(root, cleaned, true);

  const xml = doc.toString({ format: true, indentString: "\t", noDeclaration: true });
  await validateXmlString(xml, XsdSchemaName.Data, "InvoiceData");
  return xml;
}

export interface BuildApiRequestXmlLibxml2Options {
  namespacePrefix?: string;
  prefixRootKeys?: string[];
}

export async function buildApiRequestXmlLibxml2<T extends object>(
  requestType: string,
  data: T,
  schemaType: XsdSchemaName = XsdSchemaName.InvoiceApi,
  options?: BuildApiRequestXmlLibxml2Options,
): Promise<string> {
  await getLibxml2();

  let dataToBuild: T = data;
  if (options?.namespacePrefix) {
    dataToBuild = addNamespacePrefix(data, options.namespacePrefix, options.prefixRootKeys);
  }

  const obj = dataToBuild as Record<string, unknown>;
  const doc = XmlDocument.create();
  const root = doc.createRoot(requestType);

  setNamespaceDeclarations(root, obj);
  writeAttributes(root, obj);
  writeValue(root, obj, false);

  const xml = doc.toString({ format: true, indentString: "\t", noDeclaration: true });
  await validateXmlString(xml, schemaType, requestType);
  return xml;
}