/** Namespace lookup + name splitting helpers for the WASM builders. */
export function elementName(key: string): { name: string; prefix?: string } {
  const colon = key.indexOf(":");
  if (colon > 0) {
    return { name: key.slice(colon + 1), prefix: key.slice(0, colon) };
  }
  return { name: key };
}

export interface NsLookup {
  /** Namespace pointer for the prefix; 0 if not declared. */
  searchNs(prefix: string | null): number;
}

export function resolveNs(
  lookup: NsLookup,
  nsMap: Map<string, number>,
  prefix: string | null,
): number {
  const key = prefix ?? "";
  let ns = nsMap.get(key);
  if (ns === undefined) {
    ns = lookup.searchNs(prefix);
    nsMap.set(key, ns);
  }
  return ns;
}

export function requireNs(
  lookup: NsLookup,
  nsMap: Map<string, number>,
  prefix: string,
): number {
  const ns = resolveNs(lookup, nsMap, prefix);
  if (ns === 0) throw new Error(`Namespace \`${prefix}\` is not declared`);
  return ns;
}