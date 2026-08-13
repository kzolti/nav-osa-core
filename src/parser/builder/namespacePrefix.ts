import { MAX_BUILD_DEPTH, XmlBuildError, assertPlain } from "../shared/xmlParserCommon.js";

type ObjMap = Record<string, unknown>;

function prefixValue(
  value: unknown,
  prefix: string,
  shouldPrefix: boolean,
  depth: number,
  path: string,
): unknown {
  if (depth > MAX_BUILD_DEPTH) {
    throw new XmlBuildError(
      `Circular reference or too-deep nesting in API request data (depth > ${MAX_BUILD_DEPTH})`,
    );
  }
  if (Array.isArray(value)) {
    return value.map((item, i) => {
      if (typeof item === "function") {
        throw new XmlBuildError(
          `Unsupported value of type 'function' at '${path}[${i}]': expected a plain object`,
        );
      }
      return item !== null && typeof item === "object"
        ? prefixValue(item, prefix, shouldPrefix, depth + 1, `${path}[${i}]`)
        : item;
    });
  }
  if (typeof value === "object" && value !== null) {
    assertPlain(value, path);
    return prefixObject(value, prefix, shouldPrefix, depth + 1, path);
  }
  if (typeof value === "function") {
    throw new XmlBuildError(
      `Unsupported value of type 'function' at '${path}': expected a plain object`,
    );
  }
  return value;
}

function prefixObject(
  source: ObjMap,
  prefix: string,
  shouldPrefix: boolean,
  depth: number,
  path: string,
): ObjMap {
  const out: ObjMap = {};
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = source[key];
      if (key.startsWith("@_") || key === "#text") {
        if (typeof value === "function") {
          throw new XmlBuildError(
            `Unsupported value of type 'function' at '${path}/${key}': expected a plain object`,
          );
        }
        if (typeof value === "object" && value !== null) {
          assertPlain(value, `${path}/${key}`);
        }
        out[key] = value;
        continue;
      }
      const alreadyPrefixed = key.includes(":");
      const targetKey = alreadyPrefixed || !shouldPrefix ? key : `${prefix}:${key}`;
      out[targetKey] = prefixValue(value, prefix, shouldPrefix, depth, `${path}/${key}`);
    }
  }
  return out;
}

/**
 * Guards a subtree without copying it: non-rootKey values of an API
 * request are passed through untouched (reference-identical), but every
 * nested value still gets the plain-object/function check.
 */
function assertSerializableTree(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      if (typeof item === "function") {
        throw new XmlBuildError(
          `Unsupported value of type 'function' at '${path}[${i}]': expected a plain object`,
        );
      }
      if (item !== null && typeof item === "object") {
        assertSerializableTree(item, `${path}[${i}]`);
      }
    }
    return;
  }
  if (typeof value === "function") {
    throw new XmlBuildError(
      `Unsupported value of type 'function' at '${path}': expected a plain object`,
    );
  }
  if (typeof value !== "object" || value === null) {
    return;
  }
  assertPlain(value, path);
  for (const key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      const child = (value as ObjMap)[key];
      if (typeof child === "function") {
        throw new XmlBuildError(
          `Unsupported value of type 'function' at '${path}/${key}': expected a plain object`,
        );
      }
      if (child !== null && typeof child === "object") {
        assertSerializableTree(child, `${path}/${key}`);
      }
    }
  }
}

export function addNamespacePrefix<T extends object>(
  obj: T,
  prefix: string,
  rootKeys?: string[],
  rootPath = "request",
): T {
  const result: ObjMap = {};
  const source = obj as ObjMap;
  assertPlain(source, rootPath);

  if (rootKeys !== undefined) {
    const rootKeySet = new Set(rootKeys);
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const value = source[key];
        const valuePath = `${rootPath}/${key}`;
        if (rootKeySet.has(key)) {
          result[`${prefix}:${key}`] = prefixValue(value, prefix, true, 0, valuePath);
        } else {
          // Non-rootKey subtrees (software etc.) stay reference-identical
          // but still go through the guard — values in the api namespace
          // must be checked just like the prefixed ones.
          assertSerializableTree(value, valuePath);
          result[key] = value;
        }
      }
    }
  } else {
    Object.assign(result, prefixObject(source, prefix, true, 0, rootPath));
  }

  return result as unknown as T;
}