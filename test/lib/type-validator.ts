import type { InvoiceData } from "nav-osa-types";

type FieldType = "string" | "number" | "boolean" | "array" | "object";

interface FieldSchema {
  type: FieldType;
  required?: boolean;
  enumValues?: string[];
  items?: FieldSchema;
  properties?: Record<string, FieldSchema>;
}

function field(type: FieldType, required = true, extra?: Partial<FieldSchema>): FieldSchema {
  return { type, required, ...extra };
}

const taxNumberSchema: FieldSchema = {
  type: "object",
  properties: {
    taxpayerId: field("string"),
    vatCode: field("string", false),
    countyCode: field("string", false),
  },
};

const detailedAddressSchema: FieldSchema = {
  type: "object",
  properties: {
    countryCode: field("string"),
    postalCode: field("string"),
    city: field("string"),
    streetName: field("string"),
    publicPlaceCategory: field("string"),
    region: field("string", false),
    number: field("string", false),
    building: field("string", false),
    staircase: field("string", false),
    floor: field("string", false),
    door: field("string", false),
    lotNumber: field("string", false),
  },
};

const lineNetAmountDataSchema: FieldSchema = {
  type: "object",
  properties: {
    lineNetAmount: field("string"),
    lineNetAmountHUF: field("string"),
  },
};

const lineVatRateSchema: FieldSchema = {
  type: "object",
  properties: {
    vatPercentage: field("string", false),
  },
};

const lineVatDataSchema: FieldSchema = {
  type: "object",
  properties: {
    lineVatAmount: field("string"),
    lineVatAmountHUF: field("string"),
  },
};

const lineGrossAmountDataSchema: FieldSchema = {
  type: "object",
  properties: {
    lineGrossAmountNormal: field("string"),
    lineGrossAmountNormalHUF: field("string"),
  },
};

const lineAmountsNormalSchema: FieldSchema = {
  type: "object",
  properties: {
    lineNetAmountData: lineNetAmountDataSchema,
    lineVatRate: lineVatRateSchema,
    lineVatData: { ...lineVatDataSchema, required: false },
    lineGrossAmountData: { ...lineGrossAmountDataSchema, required: false },
  },
};

const productCodeSchema: FieldSchema = {
  type: "object",
  properties: {
    productCodeCategory: field("string", true, { enumValues: ["VTSZ", "SZJ", "KN", "AHK", "CSK", "KT", "EJ", "TESZOR", "OWN", "OTHER"] }),
    productCodeValue: field("string", false),
  },
};

const lineSchema: FieldSchema = {
  type: "object",
  properties: {
    lineNumber: field("number"),
    lineExpressionIndicator: field("boolean"),
    lineNatureIndicator: field("string", false, { enumValues: ["PRODUCT", "SERVICE", "OTHER"] }),
    lineDescription: field("string", false),
    quantity: field("string", false),
    unitOfMeasure: field("string", false),
    unitPrice: field("string", false),
    unitPriceHUF: field("string", false),
    lineAmountsNormal: { ...lineAmountsNormalSchema, required: false },
    productCodes: {
      type: "object",
      required: false,
      properties: {
        productCode: { type: "array", items: productCodeSchema },
      },
    },
  },
};

const linesSchema: FieldSchema = {
  type: "object",
  properties: {
    mergedItemIndicator: field("boolean"),
    line: { type: "array", items: lineSchema },
  },
};

const vatRateNetDataSchema: FieldSchema = {
  type: "object",
  properties: {
    vatRateNetAmount: field("string"),
    vatRateNetAmountHUF: field("string"),
  },
};

const vatRateVatDataSchema: FieldSchema = {
  type: "object",
  properties: {
    vatRateVatAmount: field("string"),
    vatRateVatAmountHUF: field("string"),
  },
};

const summaryByVatRateSchema: FieldSchema = {
  type: "object",
  properties: {
    vatRate: lineVatRateSchema,
    vatRateNetData: vatRateNetDataSchema,
    vatRateVatData: vatRateVatDataSchema,
    vatRateGrossData: {
      type: "object",
      required: false,
      properties: {
        vatRateGrossAmount: field("string"),
        vatRateGrossAmountHUF: field("string"),
      },
    },
  },
};

const summaryNormalSchema: FieldSchema = {
  type: "object",
  properties: {
    summaryByVatRate: { type: "array", items: summaryByVatRateSchema },
    invoiceNetAmount: field("string"),
    invoiceNetAmountHUF: field("string"),
    invoiceVatAmount: field("string"),
    invoiceVatAmountHUF: field("string"),
  },
};

const summaryGrossDataSchema: FieldSchema = {
  type: "object",
  properties: {
    invoiceGrossAmount: field("string"),
    invoiceGrossAmountHUF: field("string"),
  },
};

const invoiceSummarySchema: FieldSchema = {
  type: "object",
  properties: {
    summaryNormal: { ...summaryNormalSchema, required: false },
    summaryGrossData: { ...summaryGrossDataSchema, required: false },
  },
};

const supplierInfoSchema: FieldSchema = {
  type: "object",
  properties: {
    supplierTaxNumber: taxNumberSchema,
    supplierName: field("string"),
    supplierAddress: {
      type: "object",
      properties: {
        detailedAddress: { ...detailedAddressSchema, required: false },
      },
    },
    supplierBankAccountNumber: field("string", false),
  },
};

const customerInfoSchema: FieldSchema = {
  type: "object",
  required: false,
  properties: {
    customerVatStatus: field("string", true, { enumValues: ["DOMESTIC", "OTHER", "PRIVATE_PERSON"] }),
    customerName: field("string", false),
    customerAddress: {
      type: "object",
      required: false,
      properties: {
        detailedAddress: { ...detailedAddressSchema, required: false },
      },
    },
  },
};

const invoiceDetailSchema: FieldSchema = {
  type: "object",
  properties: {
    invoiceCategory: field("string", true, { enumValues: ["NORMAL", "SIMPLIFIED", "AGGREGATE"] }),
    invoiceDeliveryDate: field("string"),
    currencyCode: field("string"),
    exchangeRate: field("string"),
    invoiceAppearance: field("string", true, { enumValues: ["PAPER", "ELECTRONIC", "EDI", "UNKNOWN"] }),
    paymentDate: field("string", false),
    paymentMethod: field("string", false, { enumValues: ["TRANSFER", "CASH", "CARD", "VOUCHER", "OTHER"] }),
    utilitySettlementIndicator: field("boolean", false),
    periodicalSettlement: field("boolean", false),
  },
};

const invoiceHeadSchema: FieldSchema = {
  type: "object",
  properties: {
    supplierInfo: supplierInfoSchema,
    customerInfo: customerInfoSchema,
    invoiceDetail: invoiceDetailSchema,
  },
};

const invoiceReferenceSchema: FieldSchema = {
  type: "object",
  required: false,
  properties: {
    originalInvoiceNumber: field("string"),
    modifyWithoutMaster: field("boolean"),
    modificationIndex: field("number"),
  },
};

const invoiceSchema: FieldSchema = {
  type: "object",
  properties: {
    invoiceReference: invoiceReferenceSchema,
    invoiceHead: invoiceHeadSchema,
    invoiceLines: { ...linesSchema, required: false },
    invoiceSummary: invoiceSummarySchema,
  },
};

const invoiceMainSchema: FieldSchema = {
  type: "object",
  properties: {
    invoice: { ...invoiceSchema, required: false },
  },
};

const invoiceDataSchema: FieldSchema = {
  type: "object",
  properties: {
    invoiceNumber: field("string"),
    invoiceIssueDate: field("string"),
    completenessIndicator: field("boolean"),
    invoiceMain: invoiceMainSchema,
  },
};

export interface ValidationError {
  path: string;
  message: string;
}

export function validateInvoiceData(parsed: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!parsed || typeof parsed !== "object") {
    return [{ path: "<root>", message: "root is not an object" }];
  }
  const root = parsed as Record<string, unknown>;
  if (!root.InvoiceData || typeof root.InvoiceData !== "object") {
    errors.push({ path: "<root>", message: "missing InvoiceData root element" });
    return errors;
  }
  validateField(root.InvoiceData, invoiceDataSchema, "InvoiceData", errors);
  return errors;
}

function validateField(value: unknown, schema: FieldSchema, path: string, errors: ValidationError[]): void {
  if (value === undefined || value === null) {
    if (schema.required !== false) {
      errors.push({ path, message: `required field is missing` });
    }
    return;
  }

  switch (schema.type) {
    case "string":
      if (typeof value !== "string") {
        errors.push({ path, message: `expected string, got ${typeof value}` });
      }
      break;
    case "number":
      if (typeof value !== "number") {
        errors.push({ path, message: `expected number, got ${typeof value}` });
      }
      break;
    case "boolean":
      if (typeof value !== "boolean") {
        errors.push({ path, message: `expected boolean, got ${typeof value}` });
      }
      break;
    case "array":
      if (!Array.isArray(value)) {
        errors.push({ path, message: `expected array, got ${typeof value}` });
      } else if (schema.items) {
        for (let i = 0; i < value.length; i++) {
          validateField(value[i], schema.items, `${path}[${i}]`, errors);
        }
      }
      break;
    case "object":
      if (typeof value !== "object" || Array.isArray(value)) {
        errors.push({ path, message: `expected object, got ${Array.isArray(value) ? "array" : typeof value}` });
      } else if (schema.properties) {
        const obj = value as Record<string, unknown>;
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          validateField(obj[key], propSchema, `${path}.${key}`, errors);
        }
      }
      break;
  }

  if (schema.type === "string" && schema.enumValues && typeof value === "string") {
    if (!schema.enumValues.includes(value)) {
      errors.push({ path, message: `enum mismatch: got "${value}", expected one of [${schema.enumValues.join(", ")}]` });
    }
  }
}
