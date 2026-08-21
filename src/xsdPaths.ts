import { resolve } from 'node:path';

export enum XsdSchemaName {
  Common = 'common',
  Data = 'data',
  InvoiceApi = 'invoiceApi',
  InvoiceBase = 'invoiceBase',
}

export function getXsdPath(schemaName: XsdSchemaName): string {
  return resolve(import.meta.dirname!, 'xsd', `${schemaName}.xsd`);
}
