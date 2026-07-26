import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export enum XsdSchemaName {
  Common = 'common',
  Data = 'data',
  InvoiceApi = 'invoiceApi',
  InvoiceBase = 'invoiceBase',
}

export function getXsdPath(schemaName: XsdSchemaName): string {
  return resolve(__dirname, 'xsd', `${schemaName}.xsd`);
}
