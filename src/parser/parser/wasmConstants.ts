import { ParseOption, XmlDocument } from "libxml2-wasm";

export const ELEMENT_NODE = 1;
export const TEXT_NODE = 3;
export const CDATA_NODE = 4;

/** Internal WASM pointer of the libxml2-wasm XmlDocument (no public getter). */
export function xmlDocPtr(doc: InstanceType<typeof XmlDocument>): number {
  const ptr = (doc as unknown as { _ptr: number })._ptr;
  if (typeof ptr !== "number" || ptr === 0) {
    throw new Error("Invalid XmlDocument: _ptr is missing or null");
  }
  return ptr;
}

/**
 * Default parse options: maximum safety — entity resolution (NOENT) and
 * internal limit relaxation (HUGE) are excluded; only an explicit
 * `processEntities: true` enables XML_PARSE_NOENT.
 */
export const PARSE_OPTION =
  ParseOption.XML_PARSE_NOBLANKS | ParseOption.XML_PARSE_NONET;