type Libxml2ModuleType = typeof import("libxml2-wasm");
type Libxml2InternalsType = typeof import("libxml2-wasm/lib/libxml2.mjs");

/** Non-literal import specifiers: bundlers cannot statically resolve them,
 * Node always resolves them relative to this module. */
const LIBXML2_SPEC = "libxml2-wasm";
const LIBXML2_MJS_SPEC = "libxml2-wasm/lib/libxml2.mjs";

let libxml2Module: Libxml2ModuleType | null = null;
let libxml2Promise: Promise<Libxml2ModuleType> | null = null;
let libxml2Internals: Libxml2InternalsType | null = null;
let libxml2InternalsPromise: Promise<Libxml2InternalsType> | null = null;

export async function getLibxml2(): Promise<Libxml2ModuleType> {
  if (libxml2Module) {
    return libxml2Module;
  }
  if (libxml2Promise) {
    return libxml2Promise;
  }
  libxml2Promise = (async () => {
    // Direct import() with a NON-literal specifier: a direct import always
    // resolves relative to THIS module — the same copy the static imports in
    // xmlFieldExtractor use, so the XSD validator and the field extraction
    // share one WASM instance (mixing instances makes every xmlNode* read
    // return garbage). The non-literal specifier still prevents bundlers
    // (webpack/vite) from statically resolving the specifier.
    const mod: Libxml2ModuleType = await import(LIBXML2_SPEC);
    try {
      // Whitelist FS provider: only the 4 shipped XSDs may be loaded via
      // file://. The generic xmlRegisterFsInputProviders() would allow any
      // file (XXE via SYSTEM "file:///etc/passwd" when processEntities:true),
      // NONET only blocks http. We replace it with a strict allowlist.
      const { xmlRegisterInputProvider } = await import(LIBXML2_MJS_SPEC);
      const fs = await import("node:fs");
      const path = await import("node:path");
      const { getXsdPath, XsdSchemaName } = await import("../../xsdPaths.js");
      const allowed = new Set(
        Object.values(XsdSchemaName).map((n) => path.resolve(getXsdPath(n as typeof XsdSchemaName[keyof typeof XsdSchemaName]))),
      );
      const toFilePath = (filename: string): string | null => {
        try {
          const url = new URL(filename);
          if (url.protocol !== "file:") return null;
          let p = decodeURIComponent(url.pathname);
          if (process.platform === "win32" && p.startsWith("/") && /^[a-zA-Z]:/.test(p.slice(1))) p = p.slice(1);
          return path.resolve(p);
        } catch {
          // Bare relative like "common.xsd" or non-URL → blocked.
          // The 4 shipped XSDs are always requested as file:// absolute URLs
          // (src/parser/validator.ts -> file://.../data.xsd imports common.xsd as file://.../common.xsd),
          // so no relative fallback is needed. External file refs (XXE) are blocked,
          // only the 4 XSDs in the enum are allowed (src/xsdPaths.ts XsdSchemaName).
          return null;
        }
      };
      const provider = {
        match(filename: string): boolean {
          const p = toFilePath(filename);
          return p !== null && allowed.has(p) && fs.existsSync(p);
        },
        open(filename: string): number | undefined {
          const p = toFilePath(filename);
          if (p === null || !allowed.has(p)) return undefined;
          try {
            return fs.openSync(p, "r");
          } catch {
            return undefined;
          }
        },
        read(fd: number, buf: Uint8Array): number {
          try {
            return fs.readSync(fd, buf, 0, buf.byteLength, null);
          } catch {
            return -1;
          }
        },
        close(fd: number): boolean {
          try {
            fs.closeSync(fd);
          } catch {}
          return true;
        },
      };
      xmlRegisterInputProvider(provider);
    } catch {
      // Fallback: provider unavailable
    }
    libxml2Module = mod;
    return mod;
  })();
  // A failed load must not be cached forever: reset the promise so the
  // next call retries (same pattern as getValidator's promise cache).
  void libxml2Promise.catch(() => {
    libxml2Promise = null;
  });
  return libxml2Promise;
}

/**
 * Default parse options for untrusted XML: XML_PARSE_NOBLANKS +
 * XML_PARSE_NONET. Entity resolution (XML_PARSE_NOENT) is only enabled on
 * explicit opt-in (`withEntities`) and the internal-limit relaxation
 * (XML_PARSE_HUGE) is never applied to user documents. Values come from
 * `libxml2.ParseOption`, so a libxml2-wasm bump cannot silently change them.
 */
export async function getParseOption(withEntities = false): Promise<number> {
  const { ParseOption } = await getLibxml2();
  const base = ParseOption.XML_PARSE_NOBLANKS | ParseOption.XML_PARSE_NONET;
  return withEntities ? base | ParseOption.XML_PARSE_NOENT : base;
}

export async function getLibxml2Internals(): Promise<Libxml2InternalsType> {
  if (libxml2Internals) return libxml2Internals;
  if (libxml2InternalsPromise) return libxml2InternalsPromise;
  libxml2InternalsPromise = (async () => {
    await getLibxml2();
    const internals: Libxml2InternalsType = await import(LIBXML2_MJS_SPEC);
    libxml2Internals = internals;
    return internals;
  })();
  void libxml2InternalsPromise.catch(() => {
    libxml2InternalsPromise = null;
  });
  return libxml2InternalsPromise;
}

export type { Libxml2ModuleType, Libxml2InternalsType };
