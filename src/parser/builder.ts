import XMLBuilder from "fast-xml-builder";
import { InvoiceData } from "nav-osa-types";
import { XsdSchemaName } from "../xsdPaths.js";
import { DATA_NS, BASE_NS, API_NS, COMMON_NS, validateXmlString } from "./builder/xmlBuilderCommon.js";
import { stripMeta, baseElements, type Node } from "./builder/stripMeta.js";
import { addNamespacePrefix } from "./builder/namespacePrefix.js";
import { XmlBuildError } from "./shared/xmlParserCommon.js";

const builder = new XMLBuilder({
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  ignoreAttributes: false,
  format: true,
  indentBy: "\t",
  suppressEmptyNode: false,
});

/**
 * Renames the base-namespace element keys to "base:<name>" so the builder
 * writes the QName directly — no regex post-processing is needed. The
 * base elements form closed subtrees in the OSA XSD, therefore the
 * recursive rename is equivalent to prefixing every matching element name
 * at any depth.
 */
function prefixBaseKeys(obj: Node): Node {
  const out: Node = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = baseElements.has(key) ? `base:${key}` : key;
    if (Array.isArray(value)) {
      out[newKey] = value.map((v) =>
        v !== null && typeof v === "object" ? prefixBaseKeys(v as Node) : v,
      );
    } else if (value !== null && typeof value === "object") {
      out[newKey] = prefixBaseKeys(value as Node);
    } else {
      out[newKey] = value;
    }
  }
  return out;
}

export async function buildInvoiceXml(invoiceData: InvoiceData): Promise<string> {
  const xml = builder.build({
    InvoiceData: {
      "@_xmlns": DATA_NS,
      "@_xmlns:base": BASE_NS,
      ...prefixBaseKeys(stripMeta(invoiceData as unknown as Node)),
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

function isApiRequestType(value: unknown): value is ApiRequestType {
  return typeof value === "string" && value in ApiRequestType;
}

export async function buildApiRequestXml<T extends object>(
  requestType: ApiRequestType,
  data: T,
): Promise<string> {
  if (!isApiRequestType(requestType)) {
    throw new XmlBuildError(`Unknown API request type: '${String(requestType)}'`);
  }

  // The namespace declarations are fixed by the OSA API, the caller must
  // not supply them; the spread keeps ours authoritative.
  const dataToBuild = {
    ...data,
    "@_xmlns": API_NS,
    "@_xmlns:common": COMMON_NS,
  } as T;

  // header and user are the only common-namespace subtrees of every API
  // request, the rest of the elements live in the api namespace.
  const prefixed = addNamespacePrefix(dataToBuild, "common", ["header", "user"]);

  const xml = builder.build({
    [requestType]: prefixed,
  });

  // The builder always validates before returning: it never hands out
  // XML that a tax authority would reject.
  await validateXmlString(xml, XsdSchemaName.InvoiceApi, requestType);
  return xml;
}