export { xmlParserLibxml2 as xmlParser, xmlParserLibxml2 as parseXml } from './parser/parser.js';
export { XmlValidationError } from './parser/parser.js';
export type { XmlParserOptions } from './parser/parser.js';
export { validateXml } from './parser/validator.js';
export type { ValidationResult } from './parser/validator.js';
export { validateAndExtractFields, extractFieldsFast } from './parser/extractor/xmlFieldExtractor.js';
export type {
  ValidateAndExtractFieldsResult,
  ValidateAndExtractFieldsOptions,
  ExtractedFieldValue,
} from './parser/extractor/xmlFieldExtractor.js';
export { XsdSchemaName, getXsdPath } from './xsdPaths.js';
export {
  buildInvoiceXml,
  buildApiRequestXml,
} from './parser/builder.js';
export { XmlBuildError } from './parser/shared/xmlParserCommon.js';
export { ApiRequestType } from './parser/builder.js';
