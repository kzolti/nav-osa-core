import { MAX_BUILD_DEPTH, XmlBuildError } from "../shared/xmlParserCommon.js";

export type Node = Record<string, unknown>;

/** Elements that belong to the base namespace per the OSA XSD (ala-address, tax number etc.). */
export const BASE_ELEMENTS = [
  "taxpayerId", "vatCode", "countyCode",
  "simpleAddress", "detailedAddress",
  "countryCode", "region", "postalCode", "city",
  "streetName", "publicPlaceCategory", "number", "building", "staircase", "floor", "door", "lotNumber",
  "additionalAddressDetail",
] as const;

export const baseElements: ReadonlySet<string> = new Set(BASE_ELEMENTS);

/**
 * Recursively removes the meta keys (@_ attributes) while keeping the
 * text content key (#text). The depth guard turns circular input into a
 * clear XmlBuildError instead of a stack overflow.
 */
export function stripMeta(obj: Node, depth = 0, path = "InvoiceData"): Node {
  if (depth > MAX_BUILD_DEPTH) {
    throw new XmlBuildError(`Circular reference or too-deep nesting in invoice data near '${path}' (depth > ${MAX_BUILD_DEPTH})`);
  }
  const clean: Node = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith("@_")) continue;
    if (Array.isArray(value)) {
      clean[key] = value.map((v) =>
        v !== null && typeof v === "object" ? stripMeta(assertPlain(v, `${path}/${key}`), depth + 1, `${path}/${key}`) : v,
      );
    } else if (typeof value === "object" && value !== null) {
      clean[key] = stripMeta(assertPlain(value, `${path}/${key}`), depth + 1, `${path}/${key}`);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * A Date, Map, Set or class instance cannot be serialized to element
 * content — rejecting it here (instead of at the writer) makes the error
 * unambiguous and close to where the caller's data comes from.
 */
function assertPlain(value: object, path: string): Node {
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    const typeName = (value as { constructor?: { name?: string } }).constructor?.name ?? "object";
    throw new XmlBuildError(`Unsupported value of type '${typeName}' at '${path}': expected a plain object`);
  }
  return value as Node;
}