import { XMLParser } from "fast-xml-parser";
import { validateXml, ValidationResult } from "../../src/parser/validator.js";
import { XsdSchemaName } from "../../src/xsdPaths.js";
import { ALWAYS_ARRAY, XmlValidationError, assertXmlSize, convertTagValue } from "../../src/parser/shared/xmlParserCommon.js";
import type { XmlParserOptions } from "../../src/parser/shared/xmlParserCommon.js";

function tagValueProcessor(tagName: string, tagValue: unknown): unknown {
  if (typeof tagValue !== "string") return tagValue;
  return convertTagValue(tagName, tagValue);
}

const defaultParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  ignoreDeclaration: true,
  removeNSPrefix: true,
  processEntities: true,
  isArray: (name) => ALWAYS_ARRAY.has(name),
  tagValueProcessor,
});

const noEntitiesParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  ignoreDeclaration: true,
  removeNSPrefix: true,
  processEntities: false,
  isArray: (name) => ALWAYS_ARRAY.has(name),
  tagValueProcessor,
});

export async function xmlParser<T>(
  xmlData: string,
  schemaName: XsdSchemaName,
  options?: XmlParserOptions
): Promise<T> {
  assertXmlSize(xmlData, options?.maxXmlSize);

  if (options?.validate !== false) {
    const result: ValidationResult = await validateXml(xmlData, schemaName);
    if (!result.valid) {
      throw new XmlValidationError(`XSD validation failed against ${schemaName}`, result.errors);
    }
  }

  const parser = options?.processEntities === true ? defaultParser : noEntitiesParser;
  const result = parser.parse(xmlData);
  return result as T;
}

export type { XmlParserOptions };
export { XmlValidationError };
