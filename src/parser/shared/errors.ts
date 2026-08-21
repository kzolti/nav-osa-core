export class XmlValidationError extends Error {
  public readonly errors: string[];
  constructor(message: string, errors: string[], options?: { cause?: unknown }) {
    super(message, options);
    this.name = "XmlValidationError";
    this.errors = errors;
  }
}

/**
 * Thrown when input data cannot be represented as XML: circular
 * references, non-JSON values (Date, Map, class instances, functions),
 * or object attribute values. The message always contains the object
 * path of the offending value where available.
 */
export class XmlBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "XmlBuildError";
  }
}
