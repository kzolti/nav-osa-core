import XMLBuilder from "fast-xml-builder";
import { InvoiceData } from "nav-osa-types";
import { XsdSchemaName } from "../xsdPaths.js";
import { DATA_NS, BASE_NS, API_NS, COMMON_NS, validateXmlString } from "./builder/xmlBuilderCommon.js";
import { baseElements } from "./builder/baseElements.js";
import { addNamespacePrefix } from "./builder/namespacePrefix.js";
import { XmlBuildError } from "./shared/errors.js";
import { assertPlain } from "./shared/guards.js";
import type { Node } from "./shared/guards.js";
import { transformKeys } from "./shared/objectTraversal.js";

let builder: InstanceType<typeof XMLBuilder> | null = null;

/** Lazy XMLBuilder factory: the singleton is created on first use, not at import time. */
function getBuilder(): InstanceType<typeof XMLBuilder> {
  if (!builder) {
    builder = new XMLBuilder({
      attributeNamePrefix: "@_",
      textNodeName: "#text",
      ignoreAttributes: false,
      format: true,
      indentBy: "\t",
      suppressEmptyNode: false,
    });
  }
  return builder;
}

/**
 * Single-pass preparation: strips @_ meta keys and prefixes base-namespace
 * keys in one traversal (avoids a separate filter + prefix double pass).
 * Saves one full object allocation/copy per invoice (≈50-200 nodes).
 */
function prepareInvoiceData(obj: Node): Node {
  return transformKeys(
    obj,
    (key) => (baseElements.has(key) ? `base:${key}` : key),
    (key) => key.startsWith("@_"),
    0,
    "InvoiceData",
    "invoice data",
  );
}

export async function buildInvoiceXml(invoiceData: InvoiceData): Promise<string> {
  const xml = getBuilder().build({
    InvoiceData: {
      "@_xmlns": DATA_NS,
      "@_xmlns:base": BASE_NS,
      ...prepareInvoiceData(invoiceData as unknown as Node),
    },
  });

  // The builder always validates before returning: it never hands out
  // XML that a tax authority would reject.
  await validateXmlString(xml, XsdSchemaName.Data, "InvoiceData");
  return xml;
}

/**
 * Root elements of the OSA API requests. Every member extends
 * BasicOnlineInvoiceRequestType in the invoiceApi XSD, therefore the
 * header/user subtrees are the only ones in the common namespace.
 */
export enum ApiRequestType {
  TokenExchangeRequest = "TokenExchangeRequest",
  ManageAnnulmentRequest = "ManageAnnulmentRequest",
  ManageInvoiceRequest = "ManageInvoiceRequest",
  QueryInvoiceChainDigestRequest = "QueryInvoiceChainDigestRequest",
  QueryInvoiceCheckRequest = "QueryInvoiceCheckRequest",
  QueryInvoiceDataRequest = "QueryInvoiceDataRequest",
  QueryInvoiceDigestRequest = "QueryInvoiceDigestRequest",
  QueryTaxpayerRequest = "QueryTaxpayerRequest",
  QueryTransactionListRequest = "QueryTransactionListRequest",
  QueryTransactionStatusRequest = "QueryTransactionStatusRequest",
}

/**
 * Value-based membership check: `value in ApiRequestType` would also match
 * inherited object properties ("toString", "constructor", ...), letting
 * arbitrary strings through the guard. Checking the enum's values keeps
 * the guard correct even if enum keys and values ever diverge.
 */
export function isApiRequestType(value: unknown): value is ApiRequestType {
  return typeof value === "string" && (Object.values(ApiRequestType) as string[]).includes(value);
}

export async function buildApiRequestXml<T extends object>(
  requestType: ApiRequestType,
  data: T,
): Promise<string> {
  if (!isApiRequestType(requestType)) {
    throw new XmlBuildError(`Unknown API request type: '${String(requestType)}'`);
  }

  assertPlain(data, String(requestType));

  // The namespace declarations are fixed by the OSA API, the caller must
  // not supply them; the spread keeps ours authoritative.
  const dataToBuild = {
    ...data,
    "@_xmlns": API_NS,
    "@_xmlns:common": COMMON_NS,
  } as T;

  // header and user are the only common-namespace subtrees of every API
  // request, the rest of the elements live in the api namespace.
  const prefixed = addNamespacePrefix(dataToBuild, "common", ["header", "user"], String(requestType));

  const xml = getBuilder().build({
    [requestType]: prefixed,
  });

  // The builder always validates before returning: it never hands out
  // XML that a tax authority would reject.
  await validateXmlString(xml, XsdSchemaName.InvoiceApi, requestType);
  return xml;
}