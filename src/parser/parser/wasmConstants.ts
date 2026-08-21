import type { XmlDocument } from "libxml2-wasm";

// libxml2 xmlElementType values for node-type dispatch during WASM
// traversal. These are stable C enum values (XML_ELEMENT_NODE = 1,
// XML_TEXT_NODE = 3, XML_CDATA_SECTION_NODE = 4); libxml2-wasm only exposes
// them as `XmlNodeStruct.Type`, which is not worth an async module load for
// three well-known constants.
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
