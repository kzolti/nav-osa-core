import { MAX_BUILD_DEPTH, XmlBuildError, assertPlain, type Node } from "../shared/xmlParserCommon.js";

/** Elements that belong to the base namespace per the OSA XSD (ala-address, tax number etc.). */
const BASE_ELEMENTS = [
  "taxpayerId", "vatCode", "countyCode",
  "simpleAddress", "detailedAddress",
  "countryCode", "region", "postalCode", "city",
  "streetName", "publicPlaceCategory", "number", "building", "staircase", "floor", "door", "lotNumber",
  "additionalAddressDetail",
] as const;

export const baseElements: ReadonlySet<string> = new Set(BASE_ELEMENTS);

export type { Node } from "../shared/xmlParserCommon.js";

/**
 * Recursively removes the meta keys (@_ attributes) while keeping the
 * text content key (#text). The depth guard turns circular input into a
 * clear XmlBuildError instead of a stack overflow.
 */
export function stripMeta(obj: Node, depth = 0, path = "InvoiceData"): Node {
  if (depth > MAX_BUILD_DEPTH) {
    throw new XmlBuildError(`Circular reference or too-deep nesting in invoice data near '${path}' (depth > ${MAX_BUILD_DEPTH})`);
  }
  assertPlain(obj, path);
  const clean: Node = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith("@_")) continue;
    if (Array.isArray(value)) {
      clean[key] = value.map((v) => {
        if (typeof v === "function") {
          throw new XmlBuildError(`Unsupported value of type 'function' at '${path}/${key}': expected a plain object`);
        }
        if (v !== null && typeof v === "object") {
          const p = `${path}/${key}`;
          assertPlain(v, p);
          return stripMeta(v, depth + 1, p);
        }
        return v;
      });
    } else if (typeof value === "object" && value !== null) {
      const p = `${path}/${key}`;
      assertPlain(value, p);
      clean[key] = stripMeta(value, depth + 1, p);
    } else {
      if (typeof value === "function") {
        throw new XmlBuildError(`Unsupported value of type 'function' at '${path}/${key}': expected a plain object`);
      }
      clean[key] = value;
    }
  }
  return clean;
}