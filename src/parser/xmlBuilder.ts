import XMLBuilder from "fast-xml-builder";
import { InvoiceData } from "nav-osa-types";
import { XsdSchemaName } from "../xsdPaths.js";
import { validateXml } from "./xsdValidator.js";
import { XmlValidationError } from "./xmlParserCommon.js";

const builder = new XMLBuilder({
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  ignoreAttributes: false,
  format: true,
  indentBy: "\t",
  suppressEmptyNode: false,
});

const BASE_ELEMENTS_REGEX = new RegExp(
  `<(/?)(${[
    'taxpayerId', 'vatCode', 'countyCode',
    'simpleAddress', 'detailedAddress',
    'countryCode', 'region', 'postalCode', 'city',
    'streetName', 'publicPlaceCategory', 'number', 'building', 'staircase', 'floor', 'door', 'lotNumber',
    'additionalAddressDetail',
  ].join('|')})([\\s>/])`,
  'g',
);

const INVOICE_DATA_NS_REGEX = /(<InvoiceData[^>]*xmlns="http:\/\/schemas.nav.gov.hu\/OSA\/3.0\/data")([^>]*>)/;

function prefixBaseNamespace(xml: string): string {
  return xml.replace(BASE_ELEMENTS_REGEX, '<$1base:$2$3');
}

function addNamespaceDeclarations(xml: string): string {
  return xml.replace(
    INVOICE_DATA_NS_REGEX,
    '$1 xmlns:base="http://schemas.nav.gov.hu/OSA/3.0/base"$2',
  );
}

function stripMetaAttributes(obj: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (key.startsWith('@_')) continue;
      const value = obj[key];
      if (Array.isArray(value)) {
        clean[key] = value.map(v => typeof v === 'object' && v !== null ? stripMetaAttributes(v as Record<string, unknown>) : v);
      } else if (typeof value === 'object' && value !== null) {
        clean[key] = stripMetaAttributes(value as Record<string, unknown>);
      } else {
        clean[key] = value;
      }
    }
  }
  return clean;
}

export interface BuildInvoiceXmlOptions {
  /** Disable XSD validation after building XML. Default: true (enabled). */
  validate?: boolean;
}

export async function buildInvoiceXml(invoiceData: InvoiceData, options?: BuildInvoiceXmlOptions): Promise<string> {
  const xml = builder.build({
    InvoiceData: {
      "@_xmlns": "http://schemas.nav.gov.hu/OSA/3.0/data",
      ...stripMetaAttributes(invoiceData as unknown as Record<string, unknown>),
    },
  });

  const prefixedXml = addNamespaceDeclarations(prefixBaseNamespace(xml));

  if (options?.validate !== false) {
    const result = await validateXml(prefixedXml, XsdSchemaName.Data);
    if (!result.valid) {
      throw new XmlValidationError("InvoiceData XSD validation failed", result.errors);
    }
  }

  return prefixedXml;
}

type ObjMap = Record<string, unknown>;

function prefixObject(
  source: ObjMap,
  prefix: string,
  shouldPrefix: boolean,
): ObjMap {
  const out: ObjMap = {};
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = source[key];
      if (key.startsWith("@_") || key === "#text") {
        out[key] = value;
        continue;
      }
      const alreadyPrefixed = key.includes(":");
      const targetKey = alreadyPrefixed || !shouldPrefix ? key : `${prefix}:${key}`;

      if (Array.isArray(value)) {
        out[targetKey] = value.map((item: unknown) => {
          if (typeof item === 'object' && item !== null) {
            return prefixObject(item as ObjMap, prefix, shouldPrefix);
          }
          return item;
        });
      } else if (typeof value === 'object' && value !== null) {
        out[targetKey] = prefixObject(value as ObjMap, prefix, shouldPrefix);
      } else {
        out[targetKey] = value;
      }
    }
  }
  return out;
}

export function addNamespacePrefix<T extends object>(
  obj: T,
  prefix: string,
  rootKeys?: string[]
): T {
  const result: ObjMap = {};

  if (rootKeys !== undefined) {
    const rootKeySet = new Set(rootKeys);
    for (const key in obj as ObjMap) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = (obj as ObjMap)[key];
        if (rootKeySet.has(key)) {
          const prefixedKey = `${prefix}:${key}`;
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            result[prefixedKey] = prefixObject(value as ObjMap, prefix, true);
          } else if (Array.isArray(value)) {
            result[prefixedKey] = value.map((item: unknown) => {
              if (typeof item === 'object' && item !== null) {
                return prefixObject(item as ObjMap, prefix, true);
              }
              return item;
            });
          } else {
            result[prefixedKey] = value;
          }
        } else {
          result[key] = value;
        }
      }
    }
  } else {
    Object.assign(result, prefixObject(obj as ObjMap, prefix, true));
  }

  return result as unknown as T;
}

export interface BuildApiRequestXmlOptions {
  namespacePrefix?: string;
  prefixRootKeys?: string[];
  /** Disable XSD validation after building XML. Default: true (enabled). */
  validate?: boolean;
}

export async function buildApiRequestXml<T extends object>(
  requestType: string,
  data: T,
  schemaType: XsdSchemaName = XsdSchemaName.InvoiceApi,
  options?: BuildApiRequestXmlOptions
): Promise<string> {
  let dataToBuild: T = data;

  if (options?.namespacePrefix) {
    dataToBuild = addNamespacePrefix(
      data,
      options.namespacePrefix,
      options.prefixRootKeys,
    );
  }

  const xml = builder.build({
    [requestType]: dataToBuild,
  });

  if (options?.validate !== false) {
    const result = await validateXml(xml, schemaType);
    if (!result.valid) {
      throw new XmlValidationError(`XSD validation failed for ${requestType}`, result.errors);
    }
  }

  return xml;
}
