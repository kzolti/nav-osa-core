/**
 * Interface definitions for the Hungarian Online Invoice System (Magyar Online Számla Rendszer)
 * Based on the XML schema version 3.0 from 2020/11/23
 */

import { AddressType, SimpleAddressType, TaxNumberType, InvoiceCategoryType, InvoiceAppearanceType, PaymentMethodType } from "./invoiceBaseTypes.js"
import { CurrencyType, TaxpayerIdType, VatCodeType, CountyCodeType } from "./commonTypes.js"

interface InvoiceData {
  invoiceNumber: string;
  invoiceIssueDate: string;
  completenessIndicator: boolean;
  invoiceMain: InvoiceMain;
}

interface InvoiceMain {
  invoice?: Invoice;
  batchInvoice?: BatchInvoice[];
}

interface BatchInvoice {
  batchIndex: number;
  invoice: Invoice;
}

interface Invoice {
  invoiceReference?: InvoiceReference;
  invoiceHead: InvoiceHead;
  invoiceLines?: Lines;
  productFeeSummary?: ProductFeeSummary[];
  invoiceSummary: Summary;
}

interface InvoiceReference {
  originalInvoiceNumber: string;
  modifyWithoutMaster: boolean;
  modificationIndex: number;
}

interface InvoiceHead {
  supplierInfo: SupplierInfo;
  customerInfo?: CustomerInfo;
  fiscalRepresentativeInfo?: FiscalRepresentative;
  invoiceDetail: InvoiceDetail;
}

interface SupplierInfo {
  supplierTaxNumber: TaxNumberType;
  groupMemberTaxNumber?: TaxNumberType;
  communityVatNumber?: string;
  supplierName: string;
  supplierAddress: Address;
  supplierBankAccountNumber?: string;
  individualExemption?: boolean;
  exciseLicenceNum?: string;
}

interface CustomerInfo {
  customerVatStatus: CustomerVatStatusType;
  customerVatData?: CustomerVatData;
  customerName?: string;
  customerAddress?: Address;
  customerBankAccountNumber?: string;
}

type CustomerVatStatusType = 'DOMESTIC' | 'OTHER' | 'PRIVATE_PERSON';

type LineNatureIndicatorType = 'PRODUCT' | 'SERVICE' | 'OTHER';

type LineOperationType = 'CREATE' | 'MODIFY';

type ProductFeeMeasuringUnitType = 'DARAB' | 'KG';

type ProductFeeOperationType = 'REFUND' | 'DEPOSIT';

interface CustomerVatData {
  customerTaxNumber?: CustomerTaxNumber;
  communityVatNumber?: string;
  thirdStateTaxId?: string;
}

interface CustomerTaxNumber {
  taxpayerId: TaxpayerIdType;
  vatCode?: VatCodeType;
  countyCode?: CountyCodeType;
  groupMemberTaxNumber?: TaxNumberType;
}

interface FiscalRepresentative {
  fiscalRepresentativeTaxNumber: TaxNumberType;
  fiscalRepresentativeName: string;
  fiscalRepresentativeAddress: Address;
  fiscalRepresentativeBankAccountNumber?: string;
}

type Address = AddressType;
interface InvoiceDetail {
  invoiceCategory: InvoiceCategoryType;
  invoiceDeliveryDate: string;
  invoiceDeliveryPeriodStart?: string;
  invoiceDeliveryPeriodEnd?: string;
  invoiceAccountingDeliveryDate?: string;
  periodicalSettlement?: boolean;
  smallBusinessIndicator?: boolean;
  currencyCode: CurrencyType;
  exchangeRate: string;
  utilitySettlementIndicator?: boolean;
  selfBillingIndicator?: boolean;
  paymentMethod?: PaymentMethodType;
  paymentDate?: string;
  cashAccountingIndicator?: boolean;
  invoiceAppearance: InvoiceAppearanceType;
  conventionalInvoiceInfo?: ConventionalInvoiceInfo;
  additionalInvoiceData?: AdditionalData[];
}

interface ConventionalInvoiceInfo {
  orderNumbers?: OrderNumbers;
  deliveryNotes?: DeliveryNotes;
  shippingDates?: ShippingDates;
  contractNumbers?: ContractNumbers;
  supplierCompanyCodes?: SupplierCompanyCodes;
  customerCompanyCodes?: CustomerCompanyCodes;
  dealerCodes?: DealerCodes;
  costCenters?: CostCenters;
  projectNumbers?: ProjectNumbers;
  generalLedgerAccountNumbers?: GeneralLedgerAccountNumbers;
  glnNumbersSupplier?: GlnNumbers;
  glnNumbersCustomer?: GlnNumbers;
  materialNumbers?: MaterialNumbers;
  itemNumbers?: ItemNumbers;
  ekaerIds?: EkaerIds;
}

interface OrderNumbers {
  orderNumber: string[];
}

interface DeliveryNotes {
  deliveryNote: string[];
}

interface ShippingDates {
  shippingDate: string[];
}

interface ContractNumbers {
  contractNumber: string[];
}

interface SupplierCompanyCodes {
  supplierCompanyCode: string[];
}

interface CustomerCompanyCodes {
  customerCompanyCode: string[];
}

interface DealerCodes {
  dealerCode: string[];
}

interface CostCenters {
  costCenter: string[];
}

interface ProjectNumbers {
  projectNumber: string[];
}

interface GeneralLedgerAccountNumbers {
  generalLedgerAccountNumber: string[];
}

interface GlnNumbers {
  glnNumber: string[];
}

interface MaterialNumbers {
  materialNumber: string[];
}

interface ItemNumbers {
  itemNumber: string[];
}

interface EkaerIds {
  ekaerId: string[];
}

export interface AdditionalData {
  dataName: string;
  dataDescription: string;
  dataValue: string;
}

interface Lines {
  mergedItemIndicator: boolean;
  line: Line[];
}

interface Line {
  lineNumber: number;
  lineModificationReference?: LineModificationReference;
  referencesToOtherLines?: ReferencesToOtherLines;
  advanceData?: AdvanceData;
  productCodes?: ProductCodes;
  lineExpressionIndicator: boolean;
  lineNatureIndicator?: LineNatureIndicatorType;
  lineDescription?: string;
  quantity?: string;
  unitOfMeasure?: UnitOfMeasureType;
  unitOfMeasureOwn?: string;
  unitPrice?: string;
  unitPriceHUF?: string;
  lineDiscountData?: DiscountData;
  lineAmountsNormal?: LineAmountsNormal;
  lineAmountsSimplified?: LineAmountsSimplified;
  intermediatedService?: boolean;
  aggregateInvoiceLineData?: AggregateInvoiceLineData;
  newTransportMean?: NewTransportMean;
  depositIndicator?: boolean;
  obligatedForProductFee?: boolean;
  GPCExcise?: string;
  dieselOilPurchase?: DieselOilPurchase;
  netaDeclaration?: boolean;
  productFeeClause?: ProductFeeClause;
  lineProductFeeContent?: ProductFeeData[];
  conventionalLineInfo?: ConventionalInvoiceInfo;
  additionalLineData?: AdditionalData[];
}

type UnitOfMeasureType = 'PIECE' | 'KILOGRAM' | 'TON' | 'KWH' | 'DAY' | 'HOUR' | 'MINUTE' | 'MONTH' | 'LITER' | 'KILOMETER' | 'CUBIC_METER' | 'METER' | 'LINEAR_METER' | 'CARTON' | 'PACK' | 'OWN';

interface LineModificationReference {
  lineNumberReference: number;
  lineOperation: LineOperationType;
}

interface ReferencesToOtherLines {
  referenceToOtherLine: number[];
}

interface AdvanceData {
  advanceIndicator: boolean;
  advancePaymentData?: AdvancePaymentData;
}

interface AdvancePaymentData {
  advanceOriginalInvoice: string;
  advancePaymentDate: string;
  advanceExchangeRate: string;
}

interface ProductCodes {
  productCode: ProductCode[];
}

interface ProductCode {
  productCodeCategory: ProductCodeCategoryType;
  productCodeValue?: string;
  productCodeOwnValue?: string;
}

type ProductCodeCategoryType = 'VTSZ' | 'SZJ' | 'KN' | 'AHK' | 'CSK' | 'KT' | 'EJ' | 'TESZOR' | 'OWN' | 'OTHER';

interface DiscountData {
  discountDescription?: string;
  discountValue?: string;
  discountRate?: string;
}

interface LineAmountsNormal {
  lineNetAmountData: LineNetAmountData;
  lineVatRate: VatRate;
  lineVatData?: LineVatData;
  lineGrossAmountData?: LineGrossAmountData;
}

interface LineNetAmountData {
  lineNetAmount: string;
  lineNetAmountHUF: string;
}

interface VatRate {
  vatPercentage?: string;
  vatContent?: string;
  vatExemption?: DetailedReason;
  vatOutOfScope?: DetailedReason;
  vatDomesticReverseCharge?: boolean;
  marginSchemeIndicator?: MarginSchemeType;
  vatAmountMismatch?: VatAmountMismatch;
  noVatCharge?: boolean;
}

type MarginSchemeType = 'TRAVEL_AGENCY' | 'SECOND_HAND' | 'ARTWORK' | 'ANTIQUES';

interface DetailedReason {
  case: string;
  reason: string;
}

interface VatAmountMismatch {
  vatRate: string;
  case: string;
}

interface LineVatData {
  lineVatAmount: string;
  lineVatAmountHUF: string;
}

interface LineGrossAmountData {
  lineGrossAmountNormal: string;
  lineGrossAmountNormalHUF: string;
}

interface LineAmountsSimplified {
  lineVatRate: VatRate;
  lineGrossAmountSimplified: string;
  lineGrossAmountSimplifiedHUF: string;
}

interface AggregateInvoiceLineData {
  lineExchangeRate?: string;
  lineDeliveryDate: string;
}

interface NewTransportMean {
  brand?: string;
  serialNum?: string;
  engineNum?: string;
  firstEntryIntoService?: string;
  vehicle?: Vehicle;
  vessel?: Vessel;
  aircraft?: Aircraft;
}

interface Vehicle {
  engineCapacity: number;
  enginePower: number;
  kms: number;
}

interface Vessel {
  length: number;
  activityReferred: boolean;
  sailedHours: number;
}

interface Aircraft {
  takeOffWeight: number;
  airCargo: boolean;
  operationHours: number;
}

interface DieselOilPurchase {
  purchaseLocation: SimpleAddress;
  purchaseDate: string;
  vehicleRegistrationNumber: string;
  dieselOilQuantity?: string;
}

type SimpleAddress = SimpleAddressType;

interface ProductFeeClause {
  productFeeTakeoverData?: ProductFeeTakeoverData;
  customerDeclaration?: CustomerDeclaration;
}

interface ProductFeeTakeoverData {
  takeoverReason: TakeoverType;
  takeoverAmount?: string;
}

type TakeoverType = '01' | '02_aa' | '02_ab' | '02_b' | '02_c' | '02_d' | '02_ea' | '02_eb' | '02_fa' | '02_fb' | '02_ga' | '02_gb';

interface CustomerDeclaration {
  productStream: ProductStreamType;
  productFeeWeight?: string;
}

type ProductStreamType = 'BATTERY' | 'PACKAGING' | 'OTHER_PETROL' | 'ELECTRONIC' | 'TIRE' | 'COMMERCIAL' | 'PLASTIC' | 'OTHER_CHEMICAL' | 'PAPER';

interface ProductFeeData {
  productFeeCode: ProductCode;
  productFeeQuantity: string;
  productFeeMeasuringUnit: ProductFeeMeasuringUnitType;
  productFeeRate: string;
  productFeeAmount: string;
}

interface Summary {
  summaryNormal?: SummaryNormal;
  summarySimplified?: SummarySimplified[];
  summaryGrossData?: SummaryGrossData;
}

interface SummaryNormal {
  summaryByVatRate: SummaryByVatRate[];
  invoiceNetAmount: string;
  invoiceNetAmountHUF: string;
  invoiceVatAmount: string;
  invoiceVatAmountHUF: string;
}

interface SummaryByVatRate {
  vatRate: VatRate;
  vatRateNetData: VatRateNetData;
  vatRateVatData: VatRateVatData;
  vatRateGrossData?: VatRateGrossData;
}

interface VatRateNetData {
  vatRateNetAmount: string;
  vatRateNetAmountHUF: string;
}

interface VatRateVatData {
  vatRateVatAmount: string;
  vatRateVatAmountHUF: string;
}

interface VatRateGrossData {
  vatRateGrossAmount: string;
  vatRateGrossAmountHUF: string;
}

interface SummarySimplified {
  vatRate: VatRate;
  vatContentGrossAmount: string;
  vatContentGrossAmountHUF: string;
}

interface SummaryGrossData {
  invoiceGrossAmount: string;
  invoiceGrossAmountHUF: string;
}

interface ProductFeeSummary {
  productFeeOperation: ProductFeeOperationType;
  productFeeData: ProductFeeData[];
  productChargeSum: string;
  paymentEvidenceDocumentData?: PaymentEvidenceDocumentData;
}

interface PaymentEvidenceDocumentData {
  evidenceDocumentNo: string;
  evidenceDocumentDate: string;
  obligatedName: string;
  obligatedAddress: Address;
  obligatedTaxNumber: TaxNumberType;
}

export {
  InvoiceData,
  InvoiceMain,
  BatchInvoice,
  Invoice,
  InvoiceReference,
  InvoiceHead,
  SupplierInfo,
  CustomerInfo,
  CustomerVatStatusType,
  CustomerVatData,
  CustomerTaxNumber,
  FiscalRepresentative,
  Address,
  InvoiceDetail,
  ConventionalInvoiceInfo,
  OrderNumbers,
  DeliveryNotes,
  ShippingDates,
  ContractNumbers,
  SupplierCompanyCodes,
  CustomerCompanyCodes,
  DealerCodes,
  CostCenters,
  ProjectNumbers,
  GeneralLedgerAccountNumbers,
  GlnNumbers,
  MaterialNumbers,
  ItemNumbers,
  EkaerIds,
  Lines,
  Line,
  UnitOfMeasureType,
  LineNatureIndicatorType,
  LineOperationType,
  LineModificationReference,
  ReferencesToOtherLines,
  AdvanceData,
  AdvancePaymentData,
  ProductCodes,
  ProductCode,
  ProductCodeCategoryType,
  DiscountData,
  LineAmountsNormal,
  LineNetAmountData,
  VatRate,
  MarginSchemeType,
  DetailedReason,
  VatAmountMismatch,
  LineVatData,
  LineGrossAmountData,
  LineAmountsSimplified,
  AggregateInvoiceLineData,
  NewTransportMean,
  Vehicle,
  Vessel,
  Aircraft,
  DieselOilPurchase,
  SimpleAddress,
  ProductFeeClause,
  ProductFeeTakeoverData,
  TakeoverType,
  CustomerDeclaration,
  ProductStreamType,
  ProductFeeData,
  ProductFeeMeasuringUnitType,
  ProductFeeOperationType,
  Summary,
  SummaryNormal,
  SummaryByVatRate,
  VatRateNetData,
  VatRateVatData,
  VatRateGrossData,
  SummarySimplified,
  SummaryGrossData,
  ProductFeeSummary,
  PaymentEvidenceDocumentData
};