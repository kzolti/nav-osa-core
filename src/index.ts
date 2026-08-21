export { xmlParserLibxml2 as xmlParser } from './parser/parser.js';
export { XmlValidationError, XmlBuildError } from './parser/shared/errors.js';
export type { XmlParserOptions } from './parser/shared/guards.js';
export { validateXml } from './parser/validator.js';
export type { ValidationResult, ValidateXmlOptions } from './parser/validator.js';
export { validateAndExtractFields, extractFields } from './parser/extractor/xmlFieldExtractor.js';
export type {
  ValidateAndExtractFieldsResult,
  ValidateAndExtractFieldsOptions,
  ExtractFieldsResult,
  ExtractFieldsOptions,
  ExtractedFieldValue,
  ErrorMode,
} from './parser/extractor/xmlFieldExtractor.js';
export { XsdSchemaName, getXsdPath } from './xsdPaths.js';
export {
  buildInvoiceXml,
  buildApiRequestXml,
} from './parser/builder.js';
export { ApiRequestType } from './parser/builder.js';
