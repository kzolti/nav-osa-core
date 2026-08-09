export const ALWAYS_ARRAY = new Set([
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

export const BOOLEAN_FIELDS = new Set([
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

export const STRING_FIELDS = new Set([
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

export const NUMBER_FIELDS = new Set([
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
    return String(tagValue);
  }
  if (NUMBER_FIELDS.has(tagName)) {
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
  constructor(message: string, errors: string[]) {
    super(message);
    this.name = "XmlValidationError";
    this.errors = errors;
  }
}

export const DEFAULT_MAX_XML_SIZE = 10 * 1024 * 1024;

export function assertXmlSize(xmlData: string, maxXmlSize?: number): void {
  const limit = maxXmlSize ?? DEFAULT_MAX_XML_SIZE;
  if (xmlData.length > limit) {
    throw new Error(`XML payload too large: ${xmlData.length} bytes (max: ${limit})`);
  }
}
