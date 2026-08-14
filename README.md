# nav-osa-core

Shared TypeScript types, XML parser, XSD validator, and XML builder for the Hungarian NAV Online Invoice System (OSA) version 3.0.

**Hybrid architecture:** parsing is done with `libxml2-wasm` (libxml2 compiled to WebAssembly), building with `fast-xml-builder`.

## Contents

- Generic XML parser built on `libxml2-wasm` configured for NAV XML documents
- XML builders: `buildInvoiceXml` for invoice data, `buildApiRequestXml` for API request XML (built on `fast-xml-builder`)
- XSD validation with built-in lazy validator cache (libxml2-wasm)
- `validateAndExtractFields`: validate and extract only specific fields from the DOM without building the full parse object

## Installation

```bash
npm install nav-osa-core nav-osa-types
```

## Usage

### Types

Types are provided by the separate `nav-osa-types` package:

```typescript
import { InvoiceData, TaxNumberType, MonetaryType } from 'nav-osa-types';
```

### Parse XML

`schemaName` is **required** as the second argument — the XML is validated against that schema before parsing. Validation can be disabled with `validate: false`:

```typescript
import { parseXml, XsdSchemaName } from 'nav-osa-core';
import { InvoiceData } from 'nav-osa-types';

const result = await parseXml<{ InvoiceData: InvoiceData }>(xmlString, XsdSchemaName.Data);
const resultNoValidation = await parseXml(xmlString, XsdSchemaName.Data, { validate: false });
```

If validation fails, a detailed `XmlValidationError` is thrown; a document without a root element also throws `XmlValidationError` instead of returning an empty object:

```typescript
import { XmlValidationError } from 'nav-osa-core';

try {
  const result = await parseXml(xmlString, XsdSchemaName.Data);
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

Validators are cached by schema name after the first call.

### Validate XML and extract specific fields

When you only need a few fields (e.g. `invoiceNumber`, `invoiceReference`) after validation, use `validateAndExtractFields` — it validates the document and reads **only the requested fields** directly from the libxml2-wasm DOM via WASM pointer traversal, skipping the full parse object. This minimizes string copies across the WASM↔V8 boundary.
```typescript
import { validateAndExtractFields, XsdSchemaName } from 'nav-osa-core';

const { fields, errors } = await validateAndExtractFields(
  xmlString,
  XsdSchemaName.Data,
  ['invoiceNumber', 'originalInvoiceNumber', 'modifyWithoutMaster', 'modificationIndex']
);
// fields.invoiceNumber === 'ZZZ000009'
// fields.modifyWithoutMaster === 'false'
```

> **Important:** the returned `fields` are **not a typed JSON object** — there is no type conversion (no booleans, no numbers, no nested structure). You get a flat `Record<string, string | string[]>` of raw tag contents as they appear in the XML:
>
> - `'false'` is the string `"false"`, not the boolean `false`
> - `'1'` is the string `"1"`, not the number `1`
> - The plain `xmlParser` (full parse) is the typed path; use that when you need the typed `InvoiceData` structure.

- Repeated fields (e.g. `lineNumber` in multi-line invoices) are aggregated into `string[]`.

#### Typed extraction with `convertValues: true`

You can opt into the same tag-name based type conversion that the full parse uses (known boolean/number fields become `true`/`false` and numbers, known string fields stay strings):

```typescript
const { fields } = await validateAndExtractFields(
  xmlString,
  XsdSchemaName.Data,
  ['invoiceNumber', 'modifyWithoutMaster', 'modificationIndex'],
  { convertValues: true }
);
// fields.modifyWithoutMaster === false   // boolean
// fields.modificationIndex === 1         // number
// fields.invoiceNumber === 'ZZZ000009'   // string (STRING_FIELDS)
```

The result type can also be narrowed via the generic parameter: `validateAndExtractFields<MyFieldShape>(...)`.
- By default an invalid document throws `XmlValidationError`; pass `{ errorOnInvalid: false }` to get the results with an `errors` array instead:

```typescript
const { fields, errors } = await validateAndExtractFields(
  xmlString,
  XsdSchemaName.Data,
  ['invoiceNumber'],
  { errorOnInvalid: false }
);
if (errors.length > 0) {
  console.log('Validation failed:', errors);
}
```

The low-level `extractFieldsFast(rootPtr, fieldNames)` is also exported if you already hold a libxml2-wasm document pointer and want to walk it directly.

### Build invoice XML from JSON

Converts an `InvoiceData` object to XML and validates it against the built-in `data.xsd` schema. **Validation is mandatory and cannot be disabled** — the builder never returns XML that the tax authority would reject:

```typescript
import { buildInvoiceXml } from 'nav-osa-core';
import { InvoiceData } from 'nav-osa-types';

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

Build and validate API request XML (`TokenExchangeRequest`, `QueryInvoiceDigestRequest`, etc.) with an `ApiRequestType` enum member as the root element. **Validation is mandatory and cannot be disabled** (`validate: false` exists only on the parsing side). The namespace declarations and the `common:` prefixing of the `header`/`user` subtrees are applied automatically:

```typescript
import { buildApiRequestXml, ApiRequestType } from 'nav-osa-core';

const xml = await buildApiRequestXml(ApiRequestType.TokenExchangeRequest, {
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
});
```

The builder injects `xmlns="http://schemas.nav.gov.hu/OSA/3.0/api"` and `xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common"` on the root element and prefixes the `header` and `user` subtrees — the only common-namespace parts of every OSA API request — with `common:`, so the output becomes:

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

An unknown request type is rejected with an `XmlBuildError` before any XML is produced. The enum contains exactly the request roots of `invoiceApi.xsd`:

- `TokenExchangeRequest`, `ManageAnnulmentRequest`, `ManageInvoiceRequest`
- `QueryInvoiceChainDigestRequest`, `QueryInvoiceCheckRequest`, `QueryInvoiceDataRequest`, `QueryInvoiceDigestRequest`
- `QueryTaxpayerRequest`, `QueryTransactionListRequest`, `QueryTransactionStatusRequest`

## XSD schemas

The module ships the official NAV XSD files and an enum to reference them:

- `XsdSchemaName.Common` → `common.xsd` — NTCA Common types
- `XsdSchemaName.InvoiceBase` → `invoiceBase.xsd` — Base invoice types
- `XsdSchemaName.Data` → `data.xsd` — Invoice data types
- `XsdSchemaName.InvoiceApi` → `invoiceApi.xsd` — API request/response types

```typescript
import { validateXml, buildApiRequestXml, XsdSchemaName, ApiRequestType } from 'nav-osa-core';

// Validate against a named schema
await validateXml(xmlString, XsdSchemaName.Data);

// Build and validate API request
await buildApiRequestXml(ApiRequestType.TokenExchangeRequest, data);
```

## Security options

The parser keeps entity references unexpanded by default (`processEntities: false`): the `XML_PARSE_NOENT` flag is off, so internal entity expansion (billion laughs) is not processed and the built-in libxml2 safety limits stay active. If you need entity resolution for trusted XML, enable it explicitly:

```typescript
import { parseXml, XsdSchemaName } from 'nav-osa-core';

const result = await parseXml(xmlString, XsdSchemaName.Data, { processEntities: true });
```

**Warning:** Only enable entity processing when parsing XML you fully control. For external or untrusted input, keep the default — `XML_PARSE_NOENT` is what makes billion-laughs-style entity expansion possible.

### Payload size limit

The parser rejects XML payloads larger than 10 MB by default. You can override this:

```typescript
import { parseXml, XsdSchemaName } from 'nav-osa-core';

const result = await parseXml(xmlString, XsdSchemaName.Data, { maxXmlSize: 50 * 1024 * 1024 });
```

## Security

- **Network access disabled** (`NONET`) — XML parsing never fetches external resources, preventing XXE (XML External Entity) attacks.
- **Entity expansion protection** — entity references stay unexpanded by default (`processEntities: false`), preventing billion laughs / exponential entity expansion attacks. Enable `processEntities: true` only for trusted, self-generated XML.
- **Payload size limit** (`maxXmlSize`: 10 MB by default) — prevents memory exhaustion from oversized XML inputs.
- **`HUGE` flag** — intentionally **not** part of the default parse options: libxml2's built-in safety limits (oversized text, entity expansion) stay active. The `HUGE` flag is used only when loading the built-in XSD schemas (trusted, shipped with the package).

## Support

If you find this package useful, consider supporting the development:

- [Buy me a coffee (GitHub Sponsors)](https://github.com/sponsors/kzolti)
- [Buy me a coffee (Revolut)](https://revolut.me/zoltnifdgo?note=nav-osa-core)

## License

Apache-2.0
