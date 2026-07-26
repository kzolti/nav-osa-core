import type { XmlDocument, XsdValidator } from 'libxml2-wasm';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { getXsdPath } from '../index.js';

type Libxml2Module = typeof import('libxml2-wasm');
let libxml2_wasm_module: Libxml2Module | null = null;

async function getLibxml2() {
    if (!libxml2_wasm_module) {
        libxml2_wasm_module = await new Function('return import("libxml2-wasm")')();
        try {
            const { xmlRegisterFsInputProviders } = await new Function('return import("libxml2-wasm/lib/nodejs.mjs")')();
            xmlRegisterFsInputProviders();
        } catch (e) {
            // Fallback
        }
    }
    return libxml2_wasm_module;
}

export enum XsdSchemaName {
  Common = 'common',
  Data = 'data',
  InvoiceApi = 'invoiceApi',
  InvoiceBase = 'invoiceBase',
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

const knownSchemas = new Set<string>(Object.values(XsdSchemaName));

async function validateXmlWithPath(xmlData: string, xsdPath: string): Promise<ValidationResult> {
    const libxml2 = await getLibxml2();
    if (!libxml2) return { valid: false, errors: ['libxml2-wasm not available'] };
    let xmlDoc: InstanceType<typeof XmlDocument> | null = null;
    let xsdDoc: InstanceType<typeof XmlDocument> | null = null;
    let validator: InstanceType<typeof XsdValidator> | null = null;

    try {
        const xsdContent = readFileSync(xsdPath, 'utf8');
        const absoluteXsdPath = resolve(xsdPath).replace(/\\/g, '/');
        const xsdUrl = absoluteXsdPath.startsWith('/') ? `file://${absoluteXsdPath}` : `file:///${absoluteXsdPath}`;

        xsdDoc = libxml2.XmlDocument.fromString(xsdContent, { url: xsdUrl });
        validator = libxml2.XsdValidator.fromDoc(xsdDoc);
        xmlDoc = libxml2.XmlDocument.fromString(xmlData);
        if (validator && xmlDoc) {
            validator.validate(xmlDoc);
        }
        return { valid: true, errors: [] };
    } catch (err: unknown) {
        let errors: string[] = [];
        if (err instanceof libxml2.XmlValidateError && err.details) {
            errors = err.details.map((d: { message: string }) => d.message.trim());
        } else {
            errors = [err instanceof Error ? err.message : String(err)];
        }
        return { valid: false, errors };
    } finally {
        xmlDoc?.dispose();
        validator?.dispose();
        xsdDoc?.dispose();
    }
}

export async function validateXml(xmlData: string, schema: XsdSchemaName): Promise<ValidationResult>;
export async function validateXml(xmlData: string, xsdPath: string): Promise<ValidationResult>;
export async function validateXml(xmlData: string, schemaOrPath: string): Promise<ValidationResult> {
    const schemaValue = Object.values(XsdSchemaName).find(v => v === schemaOrPath);
    const xsdPath = schemaValue !== undefined ? getXsdPath(schemaValue) : schemaOrPath;
    return validateXmlWithPath(xmlData, xsdPath);
}
