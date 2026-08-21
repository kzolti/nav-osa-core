import { XmlBuildError, XmlValidationError } from "./errors.js";

export type Node = Record<string, unknown>;

/**
 * Guards against circular references and runaway recursion when walking
 * input objects and DOM trees. This package only handles NAV OSA 3.0
 * documents: per the official XSDs these nest at most ~15 levels, so 50
 * is a generous ceiling that legitimate input never reaches, while it
 * keeps recursion bounded (and cheap) even for hostile input.
 */
export const MAX_BUILD_DEPTH = 50;
export const MAX_PARSE_DEPTH = 50;

const DEFAULT_MAX_XML_SIZE = 10 * 1024 * 1024;

export function assertXmlSize(xmlData: string, maxXmlSize?: number): void {
  const limit = maxXmlSize ?? DEFAULT_MAX_XML_SIZE;
  const size =
    typeof Buffer !== 'undefined' ? Buffer.byteLength(xmlData, 'utf8') : new TextEncoder().encode(xmlData).length;
  if (size > limit) {
    const msg = `XML payload too large: ${size} bytes (max: ${limit})`;
    throw new XmlValidationError(msg, [msg]);
  }
}

/**
 * Rejects values that cannot be serialized to XML content: functions and
 * non-plain objects (Date, Map, Set, class instances). Throwing here —
 * instead of at the writer — keeps the error unambiguous and close to the
 * caller's data. The guard is a single `typeof` comparison for scalars and
 * one prototype lookup for objects.
 */
export function assertPlain(value: unknown, path: string): asserts value is Node {
  if (typeof value === "function") {
    throw new XmlBuildError(
      `Unsupported value of type 'function' at '${path}': expected a plain object`,
    );
  }
  if (typeof value !== "object" || value === null) {
    return;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    const typeName = (value as { constructor?: { name?: string } }).constructor?.name ?? "object";
    throw new XmlBuildError(
      `Unsupported value of type '${typeName}' at '${path}': expected a plain object`,
    );
  }
}

/**
 * Single guard for recursive builder walks: combines the circular-reference
 * ceiling (MAX_BUILD_DEPTH) with the plain-object check that
 * {@link assertPlain} enforces, so each recursion level needs one call
 * instead of inlining both. Arrays are exempt here — callers iterate and
 * check their items individually, so a naive caller passing an array gets
 * only the array itself skipped (its nested objects stay unchecked). Use it
 * from a walker that recurses into array items, never on a bare array.
 * `context` only varies the error message ("invoice data" vs "API request
 * data").
 */
export function assertSerializable(
  value: unknown,
  path: string,
  depth: number,
  context = "API request data",
): asserts value is Node {
  if (depth > MAX_BUILD_DEPTH) {
    throw new XmlBuildError(
      `Circular reference or too-deep nesting in ${context} near '${path}' (depth > ${MAX_BUILD_DEPTH})`,
    );
  }
  if (Array.isArray(value)) {
    return;
  }
  assertPlain(value, path);
}

export interface XmlParserOptions {
  processEntities?: boolean;
  maxXmlSize?: number;
  validate?: boolean;
}
