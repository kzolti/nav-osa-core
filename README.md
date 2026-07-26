# nav-osa-core

Shared TypeScript types, XML parser, XSD validator, and XML builder for the Hungarian NAV Online Invoice System (OSA) version 3.0.

## Contents

- TypeScript interfaces generated from the official NAV XSD schemas: `common`, `invoiceBase`, `data`, and `invoiceApi`
- Generic XML parser built on `fast-xml-parser` configured for NAV XML documents
- XML builders: `buildInvoiceXml` for invoice data, `buildApiRequestXml` for API request XML
- XSD validation with built-in lazy validator cache (libxml2-wasm)

## Installation

```bash
npm install nav-osa-core
```

## Usage

### Types

```typescript
import { InvoiceData, TaxNumberType, MonetaryType } from 'nav-osa-core';
```

### Parse XML

By default, `parseXml` validates the XML against the built-in NAV XSD schema before parsing. The schema is auto-detected from the root element:

```typescript
import { parseXml, InvoiceData } from 'nav-osa-core';

const result = await parseXml<{ InvoiceData: InvoiceData }>(xmlString);
```

You can provide a custom XSD path or disable validation entirely:

```typescript
const result = await parseXml(xmlString, { xsdPath: '/path/to/custom.xsd' });
const result = await parseXml(xmlString, { validate: false });
```

If validation fails, a detailed `XmlValidationError` is thrown:

```typescript
import { XmlValidationError } from 'nav-osa-core';

try {
  const result = await parseXml(xmlString);
} catch (err) {
  if (err instanceof XmlValidationError) {
    console.log('Validation failed:', err.errors);
  }
}
```

### Validate XML

```typescript
import { validateXml, ValidationResult, XsdSchemaName } from 'nav-osa-core';

const result: ValidationResult = await validateXml(xmlString, XsdSchemaName.Data);
if (!result.valid) {
  console.log('Errors:', result.errors);
}
```

Validators are cached by schema name after the first call. For a custom XSD path, pass a file path string instead (no cache):

```typescript
const result = await validateXml(xmlString, '/path/to/custom.xsd');
```

### Build invoice XML from JSON

Converts an `InvoiceData` object to XML and validates it against the built-in `data.xsd` schema:

```typescript
import { buildInvoiceXml, InvoiceData } from 'nav-osa-core';

const invoice: InvoiceData = {
  invoiceNumber: 'ABC-2025-001',
  invoiceIssueDate: '2025-01-15',
  completenessIndicator: false,
  invoiceMain: {
    invoice: {
      invoiceHead: {
        supplierInfo: { /* ... */ },
        invoiceDetail: { /* ... */ },
      },
      invoiceSummary: { /* ... */ },
    },
  },
};

const xml = await buildInvoiceXml(invoice);
```

If validation fails, a detailed `XmlValidationError` is thrown:

```typescript
import { XmlValidationError } from 'nav-osa-core';

try {
  const xml = await buildInvoiceXml(invoice);
} catch (err) {
  if (err instanceof XmlValidationError) {
    console.log('XSD validation errors:', err.errors);
  }
}
```

### Build API request XML

Build and validate API request XML (TokenExchangeRequest, QueryInvoiceDigestRequest, etc.) with optional namespace prefixing:

```typescript
import { buildApiRequestXml, XsdSchemaName } from 'nav-osa-core';

const xml = await buildApiRequestXml('TokenExchangeRequest', {
  '@_xmlns': 'http://schemas.nav.gov.hu/OSA/3.0/api',
  '@_xmlns:common': 'http://schemas.nav.gov.hu/NTCA/1.0/common',
  header: {
    requestId: 'RID...',
    timestamp: '2025-01-01T00:00:00.000Z',
    requestVersion: '3.0',
    headerVersion: '1.0',
  },
  user: {
    login: 'user',
    passwordHash: {
      '@_cryptoType': 'SHA-512',
      '#text': 'hash...',
    },
    taxNumber: '12345678',
    requestSignature: {
      '@_cryptoType': 'SHA3-512',
      '#text': 'sig...',
    },
  },
  software: {
    softwareId: '123456789012345678',
    softwareName: 'TestApp',
    softwareOperation: 'LOCAL_SOFTWARE',
    softwareMainVersion: '1.0',
    softwareDevName: 'Dev',
    softwareDevContact: 'dev@test.com',
  },
}, XsdSchemaName.InvoiceApi, {
  namespacePrefix: 'common',
  prefixRootKeys: ['header', 'user'],
});
```

The `namespacePrefix` option controls which top-level keys receive a namespace prefix. With `prefixRootKeys: ['header', 'user']`, the output becomes:

```xml
<TokenExchangeRequest xmlns="..." xmlns:common="...">
  <common:header>
    <common:requestId>RID...</common:requestId>
    ...
  </common:header>
  <common:user>...</common:user>
  <software>...</software>
</TokenExchangeRequest>
```

## XSD schemas

The module ships the official NAV XSD files:

- `common.xsd` — NTCA Common types
- `invoiceBase.xsd` — Base invoice types
- `data.xsd` — Invoice data types
- `invoiceApi.xsd` — API request/response types

## Security options

The parser processes XML entities by default (`processEntities: true`) to protect against entity expansion attacks. For trusted XML (self-generated documents with no external input), you can disable this to reduce overhead:

```typescript
const result = parseXml<InvoiceData>(xmlString, { processEntities: false });
```

**Warning:** Only disable entity processing when parsing XML you fully control. Never use this for external or untrusted input.

### Payload size limit

The parser rejects XML payloads larger than 10 MB by default. You can override this:

```typescript
const result = parseXml<InvoiceData>(xmlString, { maxXmlSize: 50 * 1024 * 1024 });
```

## Security

- **Network access disabled** (`NONET`) — XML parsing never fetches external resources, preventing XXE (XML External Entity) attacks.
- **Entity expansion protection** (`processEntities: true` by default) — guards against billion laughs / exponential entity expansion attacks. Can be disabled for trusted self-generated XML to reduce overhead.
- **Payload size limit** (`maxXmlSize`: 10 MB by default) — prevents memory exhaustion from oversized XML inputs.
- **`HUGE` flag** — used **only** when loading the built-in XSD schemas (trusted, shipped with the package). Never applied to user-provided XML or custom schemas.

## Support

If you find this package useful, consider supporting the development:

- [Buy me a coffee (GitHub Sponsors)](https://github.com/sponsors/kzolti)
- [Buy me a coffee (Revolut)](https://revolut.me/zoltnifdgo?note=nav-osa-core)

## License

Apache-2.0
