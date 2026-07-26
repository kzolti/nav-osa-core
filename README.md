# nav-osa-core

Shared TypeScript types, XML parser, XSD validator, and XML builder for the Hungarian NAV Online Invoice System (OSA) version 3.0.

## Contents

- TypeScript interfaces generated from the official NAV XSD schemas: `common`, `invoiceBase`, `data`, and `invoiceApi`
- Generic XML parser built on `fast-xml-parser` configured for NAV XML documents
- XML builder: convert `InvoiceData` objects to validated XML
- XSD validator using `libxml2-wasm`
- Helper to resolve XSD file paths at runtime

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
// Custom XSD path
const result = await parseXml(xmlString, { xsdPath: '/path/to/custom.xsd' });

// Disable validation (for trusted XML)
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

Available schemas: `XsdSchemaName.Common`, `XsdSchemaName.Data`, `XsdSchemaName.InvoiceApi`, `XsdSchemaName.InvoiceBase`.  
For a custom XSD path, pass a file path string instead:

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
// Returns the validated XML string, or throws XmlValidationError
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
const result = parseXml<InvoiceData>(xmlString, { maxXmlSize: 50 * 1024 * 1024 }); // 50 MB
```

## License

Apache-2.0
