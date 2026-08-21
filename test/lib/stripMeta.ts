import type { Node } from "../../src/parser/shared/guards.js";
import { transformKeys } from "../../src/parser/shared/objectTraversal.js";

/**
 * Test-only helper: recursively removes the meta keys (@_ attributes) while
 * keeping the text content key (#text). Mirrors the filter used in
 * src/parser/builder.ts:prepareInvoiceData but without base-prefixing.
 * Lives in test/lib to keep src/ free of test-only code.
 */
export function stripMeta(obj: Node, depth = 0, path = "InvoiceData"): Node {
  return transformKeys(
    obj,
    (k) => k,
    (k) => k.startsWith("@_"),
    depth,
    path,
    "invoice data",
  );
}

export type { Node };
