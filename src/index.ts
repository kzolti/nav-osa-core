/**
 * Shared TypeScript types, XML parser, and XSD schemas for Hungarian NAV Online Invoice System (OSA)
 */

// Export all types
export * from './types/commonTypes.js';
export * from './types/invoiceBaseTypes.js';
export * from './types/dataTypes.js';
export * from './types/invoiceApiTypes.js';

// Export XML parser and validator
export { xmlParser, XmlParserOptions, XmlValidationError } from './parser/xmlParser.js';
export { xmlParser as parseXml } from './parser/xmlParser.js';
export { validateXml, ValidationResult, XsdSchemaName } from './parser/xsdValidator.js';
export { buildInvoiceXml } from './parser/xmlBuilder.js';

// Export path helper for XSD files
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { XsdSchemaName } from './parser/xsdValidator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function getXsdPath(schemaName: XsdSchemaName): string {
    return resolve(__dirname, 'xsd', `${schemaName}.xsd`);
}
