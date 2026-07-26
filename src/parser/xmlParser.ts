import { XMLParser } from "fast-xml-parser";
import { validateXml, ValidationResult, XsdSchemaName } from "./xsdValidator.js";

export interface XmlParserOptions {
  /** Disable entity processing for trusted XML to reduce overhead. Default: true (secure). */
  processEntities?: boolean;
  /** Maximum XML payload size in bytes. Default: 10 MB (10 * 1024 * 1024). */
  maxXmlSize?: number;
  /** Disable XSD validation. Default: true (enabled). */
  validate?: boolean;
  /** Custom XSD path. If omitted, auto-detected from root element. */
  xsdPath?: string;
}

export class XmlValidationError extends Error {
  public readonly errors: string[];
  constructor(message: string, errors: string[]) {
    super(message);
    this.name = "XmlValidationError";
    this.errors = errors;
  }
}

function detectRootElement(xmlData: string): string | null {
  const match = xmlData.match(/<([\w_]+)[\s>]/);
  return match ? match[1] : null;
}

function resolveSchemaName(rootElement: string | null): XsdSchemaName {
  if (rootElement === "InvoiceData") return XsdSchemaName.Data;
  if (
    rootElement &&
    [
      "QueryInvoiceDigest",
      "QueryInvoiceData",
      "QueryInvoiceChainDigest",
      "QueryInvoiceCheck",
      "QueryTransactionList",
      "QueryTransactionStatus",
      "TokenExchange",
      "QueryTaxpayer",
      "ManageInvoice",
      "ManageAnnulment",
      "GeneralError",
    ].some((prefix) => rootElement.startsWith(prefix))
  ) {
    return XsdSchemaName.InvoiceApi;
  }
  throw new Error(
    `Cannot auto-detect XSD schema for root element "${rootElement}". Please provide xsdPath explicitly.`
  );
}

export async function xmlParser<T>(xmlData: string, options?: XmlParserOptions): Promise<T> {
  const maxXmlSize = options?.maxXmlSize ?? 10 * 1024 * 1024;
  if (xmlData.length > maxXmlSize) {
    throw new Error(`XML payload too large: ${xmlData.length} bytes (max: ${maxXmlSize})`);
  }

  if (options?.validate !== false) {
    const rootElement = detectRootElement(xmlData);
    const schemaOrPath = options?.xsdPath ?? resolveSchemaName(rootElement);
    const result: ValidationResult = await validateXml(xmlData, schemaOrPath);
    if (!result.valid) {
      throw new XmlValidationError(`XSD validation failed against ${schemaOrPath}`, result.errors);
    }
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    parseTagValue: false, // nem alakít át number-ra vagy más json-type-ra
    parseAttributeValue: false,
    trimValues: true,
    ignoreDeclaration: true,
    removeNSPrefix: true,
    processEntities: options?.processEntities ?? true,
    isArray: (name) => {
      // Explicit tömbként kezelt elemek
      const alwaysArray = [
        // InvoiceData arrays
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
        // API Response arrays
        "invoiceDigest",
        "invoiceDigestResult",
        "processingResult",
        "technicalValidationMessages",
        "businessValidationMessages",
        "taxpayerAddressItem",
        // Transaction list & chain arrays
        "transaction",
        "invoiceChainElement",
        "newCreatedLines"
      ];
      return alwaysArray.includes(name);
    },
    tagValueProcessor: (tagName, tagValue, jPath, hasAttributes, isLeafNode) => {
      const booleanFields = [
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
        "advanceIndicator"
      ];
      const stringFields = [
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
        "countyCode"
      ];

      if (booleanFields.includes(tagName)) {
        return tagValue === 'true';
      }
      if (stringFields.includes(tagName)) {
        return String(tagValue);
      }
      return tagValue;
    }
  });

  const result = parser.parse(xmlData);
  return result as T;
}