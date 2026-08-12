import { MAX_BUILD_DEPTH, XmlBuildError } from "../shared/xmlParserCommon.js";

type ObjMap = Record<string, unknown>;

function prefixValue(value: unknown, prefix: string, shouldPrefix: boolean, depth: number): unknown {
  if (depth > MAX_BUILD_DEPTH) {
    throw new XmlBuildError(
      `Circular reference or too-deep nesting in API request data (depth > ${MAX_BUILD_DEPTH})`,
    );
  }
  if (Array.isArray(value)) {
    return value.map((item) => prefixValue(item, prefix, shouldPrefix, depth + 1));
  }
  if (typeof value === 'object' && value !== null) {
    return prefixObject(value as ObjMap, prefix, shouldPrefix, depth + 1);
  }
  return value;
}

function prefixObject(
  source: ObjMap,
  prefix: string,
  shouldPrefix: boolean,
  depth = 0,
): ObjMap {
  const out: ObjMap = {};
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = source[key];
      if (key.startsWith("@_") || key === "#text") {
        out[key] = value;
        continue;
      }
      const alreadyPrefixed = key.includes(":");
      const targetKey = alreadyPrefixed || !shouldPrefix ? key : `${prefix}:${key}`;
      out[targetKey] = prefixValue(value, prefix, shouldPrefix, depth);
    }
  }
  return out;
}

export function addNamespacePrefix<T extends object>(
  obj: T,
  prefix: string,
  rootKeys?: string[]
): T {
  const result: ObjMap = {};
  const source = obj as ObjMap;

  if (rootKeys !== undefined) {
    const rootKeySet = new Set(rootKeys);
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const value = source[key];
        if (rootKeySet.has(key)) {
          const prefixedKey = `${prefix}:${key}`;
          result[prefixedKey] = prefixValue(value, prefix, true, 0);
        } else {
          result[key] = value;
        }
      }
    }
  } else {
    Object.assign(result, prefixObject(source, prefix, true));
  }

  return result as unknown as T;
}