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
  "notification",
]);

/**
 * @internal
 * Fields converted to booleans by {@link convertTagValue}. Exported for the
 * XSD-consistency test (test/xsd-field-set-consistency.test.ts); keep in sync
 * with the `xs:boolean` elements of src/xsd/*.xsd.
 */
export const BOOLEAN_FIELDS: ReadonlySet<string> = new Set([
  "completenessIndicator",
  "modifyWithoutMaster",
  "individualExemption",
  "periodicalSettlement",
  "smallBusinessIndicator",
  "utilitySettlementIndicator",
  "selfBillingIndicator",
  "cashAccountingIndicator",
  "compressedContent",
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
  "returnOriginalRequest",
  "taxpayerValidity",
  "technicalAnnulment",
]);

/**
 * @internal
 * Fields that must stay strings even though they are (or look) numeric —
 * tax numbers and codes. Exported for the XSD-consistency test.
 */
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

/**
 * @internal
 * Fields converted to numbers by {@link convertTagValue} (integer-typed in
 * the XSDs). Exported for the XSD-consistency test.
 */
export const NUMBER_FIELDS: ReadonlySet<string> = new Set([
  "lineNumber",
  "lineNumberReference",
  "referenceToOtherLine",
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
