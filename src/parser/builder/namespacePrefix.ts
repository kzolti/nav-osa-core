import { transformKeys } from "../shared/objectTraversal.js";
import type { Node } from "../shared/guards.js";

/** Keys that are never namespaced: attribute markers, text content, and keys that already carry a prefix. */
function isNamespaceFree(key: string): boolean {
  return key.startsWith("@_") || key === "#text" || key.includes(":");
}

/** Extracts the top-level key a path belongs to, ignoring array indices. */
function topLevelKey(rootPath: string, path: string): string {
  const relative = path === rootPath ? "" : path.slice(rootPath.length + 1);
  return relative.split("/")[0].replace(/\[\d+\]/g, "");
}

/**
 * Prefixes object keys with a namespace in a single `transformKeys` pass.
 *
 * Without `rootKeys` every key is prefixed (except attribute/text/already-
 * prefixed keys). With `rootKeys`, only the listed top-level branches — and
 * all of their descendants — are prefixed; the remaining top-level keys pass
 * through unchanged (but still validated).
 */
export function addNamespacePrefix<T extends object>(
  obj: T,
  prefix: string,
  rootKeys?: string[],
  rootPath = "request",
): T {
  const source = obj as unknown as Node;
  const rootKeySet = rootKeys === undefined ? undefined : new Set(rootKeys);

  const mapKey = (key: string, path: string): string => {
    if (isNamespaceFree(key)) return key;
    if (rootKeySet === undefined) return `${prefix}:${key}`;
    const top = topLevelKey(rootPath, path);
    const inPrefixedBranch = top === "" ? rootKeySet.has(key) : rootKeySet.has(top);
    return inPrefixedBranch ? `${prefix}:${key}` : key;
  };

  return transformKeys(source, mapKey, undefined, 1, rootPath) as unknown as T;
}
