import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { XMLParser, XMLBuilder } from "fast-xml-parser";
import { ALWAYS_ARRAY } from "../../src/parser/shared/xmlParserCommon.js";
import { stripMeta } from "../../src/parser/builder/stripMeta.js";

export function isXmldiffAvailable(): boolean {
  return spawnSync("xmldiff", ["--version"], { encoding: "utf8" }).status === 0;
}

const normalizer = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  ignoreDeclaration: true,
  removeNSPrefix: true,
  isArray: (name) => ALWAYS_ARRAY.has(name),
});

const builder = new XMLBuilder({
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  ignoreAttributes: false,
  format: true,
  indentBy: "\t",
  suppressEmptyNode: false,
});

function normalizeXml(xml: string): string {
  const parsed = normalizer.parse(xml);
  const rootKey = Object.keys(parsed)[0];
  const data = parsed[rootKey];
  const cleaned = stripMeta(data as Record<string, unknown>);
  return builder.build({ [rootKey]: cleaned });
}

export function xmldiffCheck(xml1: string, xml2: string): { equal: boolean; output: string } {
  const norm1 = normalizeXml(xml1);
  const norm2 = normalizeXml(xml2);

  const dir = mkdtempSync(join(tmpdir(), "xmldiff-"));
  const f1 = join(dir, "a.xml");
  const f2 = join(dir, "b.xml");
  writeFileSync(f1, norm1);
  writeFileSync(f2, norm2);

  const result = spawnSync("xmldiff", ["--check", "--ratio-mode", "accurate", f1, f2], { encoding: "utf8" });
  return { equal: result.status === 0, output: result.stdout + result.stderr };
}
