import { XmlDocument, XmlElement } from "libxml2-wasm";
import { getLibxml2, validateXml } from "../../src/parser/validator.js";
import { XsdSchemaName } from "../../src/xsdPaths.js";
import { XmlValidationError } from "../../src/parser/shared/xmlParserCommon.js";
import { addNamespacePrefix } from "../../src/parser/builder/namespacePrefix.js";
import { stripMeta, type Node } from "../../src/parser/builder/stripMeta.js";
import { xmlDocPtr } from "../../src/parser/parser/wasmConstants.js";
import {
  xmlAddChild,
  xmlDocGetRootElement,
  xmlNewDocNode,
  xmlNodeSetContent,
  xmlSearchNs,
  xmlSetNsProp,
} from "libxml2-wasm/lib/libxml2.mjs";
import {
  DATA_NS,
  BASE_NS,
  API_NS,
  COMMON_NS,
  validateXmlString,
} from "../../src/parser/builder/xmlBuilderCommon.js";
import { ApiRequestType } from "../../src/parser/builder.js";
import { XmlBuildError } from "../../src/parser/shared/xmlParserCommon.js";

function isApiRequestType(value: unknown): value is ApiRequestType {
  return typeof value === "string" && value in ApiRequestType;
}
import { elementName, resolveNs, requireNs, type NsLookup } from "./wasmNsUtils.js";
import { baseElements } from "../../src/parser/builder/stripMeta.js";

function makeLookup(docPtr: number, rootPtr: number): NsLookup {
  return {
    searchNs(prefix) {
      return xmlSearchNs(docPtr, rootPtr, prefix) ?? 0;
    },
  };
}

function appendChild(
  docPtr: number,
  lookup: NsLookup,
  elPtr: number,
  name: string,
  prefix: string | undefined,
  value: unknown,
  useBasePrefix: boolean,
  nsMap: Map<string, number>,
): void {
  const target = useBasePrefix && baseElements.has(name) ? "base" : prefix;
  const ns = resolveNs(lookup, nsMap, target ?? null);
  if (Array.isArray(value)) {
    for (const item of value) {
      const childPtr = xmlNewDocNode(docPtr, ns, name);
      xmlAddChild(elPtr, childPtr);
      writeValue(docPtr, lookup, childPtr, item, useBasePrefix, nsMap);
    }
  } else if (value !== null && value !== undefined && typeof value === "object") {
    const childPtr = xmlNewDocNode(docPtr, ns, name);
    xmlAddChild(elPtr, childPtr);
    writeValue(docPtr, lookup, childPtr, value, useBasePrefix, nsMap);
  } else {
    const content = value === null || value === undefined ? "" : String(value);
    const childPtr = xmlNewDocNode(docPtr, ns, name);
    xmlAddChild(elPtr, childPtr);
    xmlNodeSetContent(childPtr, content);
  }
}

/**
 * Node building directly on the WASM pointers, without the libxml2-wasm
 * JS wrapper layer: the wrapper re-resolves the namespace (xmlSearchNs)
 * and creates a new JS object on every addElement/setAttr/addText call.
 * Here namespaces are resolved once (lazy cache) and nodes are created
 * with the xmlNewDocNode/xmlAddChild pair.
 */
function writeValue(
  docPtr: number,
  lookup: NsLookup,
  elPtr: number,
  value: unknown,
  useBasePrefix: boolean,
  nsMap: Map<string, number>,
): void {
  if (Array.isArray(value)) {
    for (const item of value) writeValue(docPtr, lookup, elPtr, item, useBasePrefix, nsMap);
    return;
  }
  if (value === null || value === undefined) {
    return;
  }
  if (typeof value === "object") {
    const obj = value as Node;
    // Two passes: attributes and #text first (the node is still
    // child-element-free, so xmlNodeSetContent deletes nothing), then the
    // child elements — otherwise #text would overwrite them.
    const childKeys: string[] = [];
    for (const key in obj) {
      const val = obj[key as keyof Node];
      if (key.startsWith("@_")) {
        if (key === "@_xmlns" || key.startsWith("@_xmlns:")) continue;
        const { name: attrName, prefix } = elementName(key.slice(2));
        const ns = prefix ? requireNs(lookup, nsMap, prefix) : 0;
        xmlSetNsProp(elPtr, ns, attrName, String(val));
        continue;
      }
      if (key === "#text") {
        xmlNodeSetContent(elPtr, String(val));
        continue;
      }
      childKeys.push(key);
    }
    for (const key of childKeys) {
      const { name, prefix } = elementName(key);
      appendChild(docPtr, lookup, elPtr, name, prefix, obj[key as keyof Node], useBasePrefix, nsMap);
    }
    return;
  }
  xmlNodeSetContent(elPtr, String(value));
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

function buildRoot(data: Node, requestType: string, dataNs?: string): XmlDocument {
  const doc = XmlDocument.create();
  const root = dataNs
    ? doc.createRoot(requestType, dataNs, undefined)
    : doc.createRoot(requestType);
  if (dataNs) {
    root.addNsDeclaration(BASE_NS, "base");
  }
  return doc;
}

function serialize(doc: XmlDocument, data: Node): string {
  const docPtr = xmlDocPtr(doc);
  const rootPtr = xmlDocGetRootElement(docPtr)!;
  const lookup = makeLookup(docPtr, rootPtr);
  const nsMap = new Map<string, number>();
  writeValue(docPtr, lookup, rootPtr, data, false, nsMap);
  return doc.toString({ format: true, indentString: "\t", noDeclaration: true });
}

export async function buildInvoiceXmlLibxml2(invoiceData: unknown): Promise<string> {
  await getLibxml2();

  const cleaned = stripMeta(invoiceData as Node);
  const doc = buildRoot(cleaned, "InvoiceData", DATA_NS);

  const docPtr = xmlDocPtr(doc);
  const rootPtr = xmlDocGetRootElement(docPtr)!;
  // The data namespace is the default, the base: prefix belongs to the
  // base namespace. Resolve once, then cache from writeValue.
  const lookup = makeLookup(docPtr, rootPtr);
  const nsMap = new Map<string, number>();
  resolveNs(lookup, nsMap, null);
  resolveNs(lookup, nsMap, "base");
  writeValue(docPtr, lookup, rootPtr, cleaned, true, nsMap);

  const xml = doc.toString({ format: true, indentString: "\t", noDeclaration: true });
  await validateXmlString(xml, XsdSchemaName.Data, "InvoiceData");
  return xml;
}

export async function buildApiRequestXmlLibxml2<T extends object>(
  requestType: ApiRequestType,
  data: T,
): Promise<string> {
  await getLibxml2();

  if (!isApiRequestType(requestType)) {
    throw new XmlBuildError(`Unknown API request type: '${String(requestType)}'`);
  }

  const obj = {
    ...data,
    "@_xmlns": API_NS,
    "@_xmlns:common": COMMON_NS,
  } as Record<string, unknown>;

  const doc = XmlDocument.create();
  const root = doc.createRoot(requestType);

  setNamespaceDeclarations(root, obj);

  const prefixed = addNamespacePrefix(obj, "common", ["header", "user"]) as Record<string, unknown>;
  const xml = serialize(doc, prefixed);

  await validateXmlString(xml, XsdSchemaName.InvoiceApi, requestType);
  return xml;
}