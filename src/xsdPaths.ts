// Node.js-only: resolves XSD files from the filesystem (`node:path`,
// `import.meta.dirname`). Never import this from browser-safe modules —
// use `xsdSchemaName.js` (pure enum) instead. Browser entry (`browser.ts`)
// must not pull this file in (directly or transitively).
import { resolve } from 'node:path';
import { XsdSchemaName } from './xsdSchemaName.js';

export { XsdSchemaName };

export function getXsdPath(schemaName: XsdSchemaName): string {
  return resolve(import.meta.dirname!, 'xsd', `${schemaName}.xsd`);
}

