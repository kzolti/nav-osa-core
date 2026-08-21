import { assertPlain, assertSerializable, type Node } from "./guards.js";

/**
 * Generic object-key transformer with depth guard and plain-value checks.
 * Handles arrays, nested objects and leaf scalars uniformly so callers
 * (prepareInvoiceData, addNamespacePrefix) don't duplicate the
 * recursion + validation boilerplate.
 *
 * `mapKey` receives the key and the object path of the node currently being
 * traversed, so a caller can decide the target key from its location (e.g.
 * only prefix the top-level branches listed in a `rootKeys` set).
 */
export function transformKeys(
  obj: Node,
  mapKey: (key: string, path: string) => string,
  filterKey?: (key: string) => boolean,
  depth = 0,
  path = "root",
  context = "API request data",
): Node {
  assertSerializable(obj, path, depth, context);
  const out: Node = {};
  for (const [key, value] of Object.entries(obj)) {
    if (filterKey?.(key)) continue;
    const newKey = mapKey(key, path);
    if (Array.isArray(value)) {
      out[newKey] = value.map((v, i) => {
        if (v === null || typeof v !== "object") {
          assertPlain(v, `${path}/${key}[${i}]`);
          return v;
        }
        return transformKeys(v as Node, mapKey, filterKey, depth + 1, `${path}/${key}[${i}]`, context);
      });
    } else if (value !== null && typeof value === "object") {
      out[newKey] = transformKeys(value as Node, mapKey, filterKey, depth + 1, `${path}/${key}`, context);
    } else {
      assertPlain(value, `${path}/${key}`);
      out[newKey] = value;
    }
  }
  return out;
}
