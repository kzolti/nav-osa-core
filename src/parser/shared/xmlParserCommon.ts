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

export const BOOLEAN_FIELDS: ReadonlySet<string> = new Set([
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
]);

export const STRING_FIELDS: ReadonlySet<string> = new Set([
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

export const NUMBER_FIELDS: ReadonlySet<string> = new Set([
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
 * Guards against circular references when walking input objects:
 * real invoices nest ~15 levels, so anything beyond this means the
 * input is not a tree.
 */
export const MAX_BUILD_DEPTH = 500;

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

export const DEFAULT_MAX_XML_SIZE = 10 * 1024 * 1024;

export function assertXmlSize(xmlData: string, maxXmlSize?: number): void {
  const limit = maxXmlSize ?? DEFAULT_MAX_XML_SIZE;
  const size = Buffer.byteLength(xmlData, "utf8");
  if (size > limit) {
    throw new Error(`XML payload too large: ${size} bytes (max: ${limit})`);
  }
}
