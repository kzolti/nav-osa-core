import { XsdSchemaName } from "../../xsdPaths.js";
import { XmlValidationError } from "../shared/xmlParserCommon.js";
import { validateXml } from "../validator.js";

export const DATA_NS = "http://schemas.nav.gov.hu/OSA/3.0/data";
export const BASE_NS = "http://schemas.nav.gov.hu/OSA/3.0/base";
export const API_NS = "http://schemas.nav.gov.hu/OSA/3.0/api";
export const COMMON_NS = "http://schemas.nav.gov.hu/NTCA/1.0/common";

export async function validateXmlString(
  xml: string,
  schema: XsdSchemaName,
  label: string,
): Promise<void> {
  const result = await validateXml(xml, schema);
  if (!result.valid) {
    throw new XmlValidationError(`${label} XSD validation failed`, result.errors);
  }
}