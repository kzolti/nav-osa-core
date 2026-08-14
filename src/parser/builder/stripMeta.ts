import { assertSerializable, assertPlain, type Node } from "../shared/xmlParserCommon.js";

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
  assertSerializable(obj, path, depth, "invoice data");
  const clean: Node = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith("@_")) continue;
    if (Array.isArray(value)) {
      clean[key] = value.map((v) => {
        if (v === null || typeof v !== "object") {
          assertPlain(v, `${path}/${key}`);
          return v;
        }
        return stripMeta(v as Node, depth + 1, `${path}/${key}`);
      });
    } else if (typeof value === "object" && value !== null) {
      clean[key] = stripMeta(value as Node, depth + 1, `${path}/${key}`);
    } else {
      assertPlain(value, `${path}/${key}`);
      clean[key] = value;
    }
  }
  return clean;
}