import { BOOLEAN_FIELDS, NUMBER_FIELDS, STRING_FIELDS } from "./fieldSets.js";

export function convertTagValue(tagName: string, tagValue: string): string | number | boolean {
  const v = tagValue.trim();
  if (BOOLEAN_FIELDS.has(tagName)) {
    if (v === "true" || v === "1") return true;
    if (v === "false" || v === "0") return false;
    return tagValue;
  }
  if (STRING_FIELDS.has(tagName)) {
    return tagValue;
  }
  if (NUMBER_FIELDS.has(tagName)) {
    if (v === "") return tagValue;
    const num = Number(v);
    if (!Number.isNaN(num)) return num;
  }
  return tagValue;
}
