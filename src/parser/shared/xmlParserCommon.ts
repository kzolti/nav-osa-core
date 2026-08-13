export const ALWAYS_ARRAY: ReadonlySet<string> = new Set([
  "ekaerId",
  "orderNumber",
  "additionalLineData",
  "line",
  "productFeeData",
  "deliveryNote",
  "shippingDate",
  "contractNumber",
  "batchInvoice",
  "productFeeSummary",
  "additionalInvoiceData",
  "productCode",
  "referenceToOtherLine",
  "summaryByVatRate",
  "summarySimplified",
  "supplierCompanyCode",
  "customerCompanyCode",
  "dealerCode",
  "costCenter",
  "projectNumber",
  "generalLedgerAccountNumber",
  "glnNumber",
  "materialNumber",
  "itemNumber",
  "lineProductFeeContent",
  "invoiceDigest",
  "invoiceDigestResult",
  "processingResult",
  "technicalValidationMessages",
  "businessValidationMessages",
  "taxpayerAddressItem",
  "transaction",
  "invoiceChainElement",
  "newCreatedLines",
]);

const BOOLEAN_FIELDS: ReadonlySet<string> = new Set([
  "completenessIndicator",
  "modifyWithoutMaster",
  "individualExemption",
  "periodicalSettlement",
  "smallBusinessIndicator",
  "utilitySettlementIndicator",
  "selfBillingIndicator",
  "cashAccountingIndicator",
  "compressedContentIndicator",
  "mergedItemIndicator",
  "lineExpressionIndicator",
  "intermediatedService",
  "depositIndicator",
  "obligatedForProductFee",
  "netaDeclaration",
  "vatDomesticReverseCharge",
  "noVatCharge",
  "activityReferred",
  "airCargo",
  "advanceIndicator",
  "invoiceCheckResult",
]);

const STRING_FIELDS: ReadonlySet<string> = new Set([
  "supplierTaxNumber",
  "customerTaxNumber",
  "supplierGroupMemberTaxNumber",
  "customerGroupMemberTaxNumber",
  "taxNumber",
  "vatGroupMembership",
  "groupMemberTaxNumber",
  "invoiceNumber",
  "taxpayerId",
  "vatCode",
  "countyCode",
]);

const NUMBER_FIELDS: ReadonlySet<string> = new Set([
  "lineNumber",
  "lineNumberReference",
  "modificationIndex",
  "batchIndex",
  "engineCapacity",
  "enginePower",
  "kms",
  "length",
  "sailedHours",
  "takeOffWeight",
  "operationHours",
]);

export function convertTagValue(tagName: string, tagValue: string): string | number | boolean {
  if (BOOLEAN_FIELDS.has(tagName)) {
    return tagValue === "true";
  }
  if (STRING_FIELDS.has(tagName)) {
    return tagValue;
  }
  if (NUMBER_FIELDS.has(tagName)) {
    if (tagValue === "") return tagValue;
    const num = Number(tagValue);
    if (!Number.isNaN(num)) return num;
  }
  return tagValue;
}

export interface XmlParserOptions {
  processEntities?: boolean;
  maxXmlSize?: number;
  validate?: boolean;
}

export class XmlValidationError extends Error {
  public readonly errors: string[];
  constructor(message: string, errors: string[], options?: { cause?: unknown }) {
    super(message, options);
    this.name = "XmlValidationError";
    this.errors = errors;
  }
}

/**
 * Guards against circular references and runaway recursion when walking
 * input objects and DOM trees. This package only handles NAV OSA 3.0
 * documents: per the official XSDs these nest at most ~15 levels, so 50
 * is a generous ceiling that legitimate input never reaches, while it
 * keeps recursion bounded (and cheap) even for hostile input.
 */
export const MAX_BUILD_DEPTH = 50;

/**
 * Thrown when input data cannot be represented as XML: circular
 * references, non-JSON values (Date, Map, class instances, functions),
 * or object attribute values. The message always contains the object
 * path of the offending value where available.
 */
export class XmlBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "XmlBuildError";
  }
}

export type Node = Record<string, unknown>;

/**
 * Rejects values that cannot be serialized to XML content: functions and
 * non-plain objects (Date, Map, Set, class instances). Throwing here —
 * instead of at the writer — keeps the error unambiguous and close to the
 * caller's data. The guard is a single `typeof` comparison for scalars and
 * one prototype lookup for objects.
 */
export function assertPlain(value: unknown, path: string): asserts value is Node {
  if (typeof value === "function") {
    throw new XmlBuildError(
      `Unsupported value of type 'function' at '${path}': expected a plain object`,
    );
  }
  if (typeof value !== "object" || value === null) {
    return;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    const typeName = (value as { constructor?: { name?: string } }).constructor?.name ?? "object";
    throw new XmlBuildError(
      `Unsupported value of type '${typeName}' at '${path}': expected a plain object`,
    );
  }
}

const DEFAULT_MAX_XML_SIZE = 10 * 1024 * 1024;

export function assertXmlSize(xmlData: string, maxXmlSize?: number): void {
  const limit = maxXmlSize ?? DEFAULT_MAX_XML_SIZE;
  const size = Buffer.byteLength(xmlData, "utf8");
  if (size > limit) {
    throw new Error(`XML payload too large: ${size} bytes (max: ${limit})`);
  }
}
