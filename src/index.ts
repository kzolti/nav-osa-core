export { xmlParserLibxml2 as xmlParser, xmlParserLibxml2 as parseXml } from './parser/xmlParserLibxml2.js';
export { XmlValidationError } from './parser/xmlParserLibxml2.js';
export type { XmlParserOptions } from './parser/xmlParserLibxml2.js';
export { validateXml } from './parser/xsdValidator.js';
export type { ValidationResult } from './parser/xsdValidator.js';
export { XsdSchemaName, getXsdPath } from './xsdPaths.js';
export { buildInvoiceXml, buildApiRequestXml } from './parser/xmlBuilder.js';
export type { BuildApiRequestXmlOptions } from './parser/xmlBuilder.js';
