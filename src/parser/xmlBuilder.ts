import { XMLBuilder } from "fast-xml-parser";
import { InvoiceData } from "../types/dataTypes.js";
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

function stripMetaAttributes(obj: Record<string, any>): Record<string, any> {
    const clean: Record<string, any> = {}
    for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith('@_')) continue
        if (Array.isArray(value)) clean[key] = value.map(v => typeof v === 'object' && v !== null ? stripMetaAttributes(v) : v)
        else if (typeof value === 'object' && value !== null) clean[key] = stripMetaAttributes(value)
        else clean[key] = value
    }
    return clean
}

export async function buildInvoiceXml(invoiceData: InvoiceData): Promise<string> {
    const xml = builder.build({
        InvoiceData: {
            "@_xmlns": "http://schemas.nav.gov.hu/OSA/3.0/data",
            ...stripMetaAttributes(invoiceData as any),
        },
    });

    const prefixedXml = addNamespaceDeclarations(prefixBaseNamespace(xml));

    const result = await validateXml(prefixedXml, "data");
    if (!result.valid) {
        throw new XmlValidationError("InvoiceData XSD validation failed", result.errors);
    }

    return prefixedXml;
}
