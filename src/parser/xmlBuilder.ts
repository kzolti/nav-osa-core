import { XMLBuilder } from "fast-xml-parser";
import { InvoiceData } from "nav-osa-types";
import { XsdSchemaName } from "../xsdPaths.js";
import { validateXml } from "./xsdValidator.js";
import { XmlValidationError } from "./xmlParser.js";

const builder = new XMLBuilder({
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  ignoreAttributes: false,
  format: true,
  indentBy: "\t",
  suppressEmptyNode: false,
});

const baseElements = new Set([
  'taxpayerId', 'vatCode', 'countyCode',
  'simpleAddress', 'detailedAddress',
  'countryCode', 'region', 'postalCode', 'city',
  'streetName', 'publicPlaceCategory', 'number', 'building', 'staircase', 'floor', 'door', 'lotNumber',
  'additionalAddressDetail',
]);

function prefixBaseNamespace(xml: string): string {
  let result = xml;
  for (const elem of baseElements) {
    const openPattern = new RegExp(`<${elem}([\\s>/])`, 'g');
    result = result.replace(openPattern, `<base:${elem}$1`);
    const closePattern = new RegExp(`</${elem}>`, 'g');
    result = result.replace(closePattern, `</base:${elem}>`);
  }
  return result;
}

function addNamespaceDeclarations(xml: string): string {
  return xml.replace(
    /(<InvoiceData[^>]*xmlns="http:\/\/schemas.nav.gov.hu\/OSA\/3.0\/data")([^>]*>)/,
    '$1 xmlns:base="http://schemas.nav.gov.hu/OSA/3.0/base"$2',
  );
}

function stripMetaAttributes(obj: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('@_')) continue;
    if (Array.isArray(value)) {
      clean[key] = value.map(v => typeof v === 'object' && v !== null ? stripMetaAttributes(v as Record<string, unknown>) : v);
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = stripMetaAttributes(value as Record<string, unknown>);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export async function buildInvoiceXml(invoiceData: InvoiceData): Promise<string> {
  const xml = builder.build({
    InvoiceData: {
      "@_xmlns": "http://schemas.nav.gov.hu/OSA/3.0/data",
      ...stripMetaAttributes(invoiceData as unknown as Record<string, unknown>),
    },
  });

  const prefixedXml = addNamespaceDeclarations(prefixBaseNamespace(xml));

  const result = await validateXml(prefixedXml, XsdSchemaName.Data);
  if (!result.valid) {
    throw new XmlValidationError("InvoiceData XSD validation failed", result.errors);
  }

  return prefixedXml;
}

export function addNamespacePrefix<T extends object>(
  obj: T,
  prefix: string,
  rootKeys?: string[]
): T {
  type ObjMap = Record<string, unknown>;

  function prefixObject(
    source: ObjMap,
    shouldPrefix: boolean,
  ): ObjMap {
    const out: ObjMap = {};
    for (const [key, value] of Object.entries(source)) {
      if (key.startsWith("@_") || key === "#text") {
        out[key] = value;
        continue;
      }
      const alreadyPrefixed = key.includes(":");
      const targetKey = alreadyPrefixed || !shouldPrefix ? key : `${prefix}:${key}`;

      if (Array.isArray(value)) {
        out[targetKey] = value.map((item: unknown) => {
          if (typeof item === 'object' && item !== null) {
            return prefixObject(item as ObjMap, shouldPrefix);
          }
          return item;
        });
      } else if (typeof value === 'object' && value !== null) {
        out[targetKey] = prefixObject(value as ObjMap, shouldPrefix);
      } else {
        out[targetKey] = value;
      }
    }
    return out;
  }

  const entries = Object.entries(obj);
  const result: ObjMap = {};

  if (rootKeys !== undefined) {
    const rootKeySet = new Set(rootKeys);
    for (const [key, value] of entries) {
      if (rootKeySet.has(key)) {
        const prefixedKey = `${prefix}:${key}`;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          result[prefixedKey] = prefixObject(value as ObjMap, true);
        } else if (Array.isArray(value)) {
          result[prefixedKey] = value.map((item: unknown) => {
            if (typeof item === 'object' && item !== null) {
              return prefixObject(item as ObjMap, true);
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
  } else {
    Object.assign(result, prefixObject(obj as ObjMap, true));
  }

  return result as unknown as T;
}

export interface BuildApiRequestXmlOptions {
  namespacePrefix?: string;
  prefixRootKeys?: string[];
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

  const result = await validateXml(xml, schemaType);
  if (!result.valid) {
    throw new XmlValidationError(`XSD validation failed for ${requestType}`, result.errors);
  }

  return xml;
}
