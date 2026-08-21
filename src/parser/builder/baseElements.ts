/** Elements that belong to the base namespace per the OSA XSD (ala-address, tax number etc.). */
const BASE_ELEMENTS = [
  "taxpayerId",
  "vatCode",
  "countyCode",
  "simpleAddress",
  "detailedAddress",
  "countryCode",
  "region",
  "postalCode",
  "city",
  "streetName",
  "publicPlaceCategory",
  "number",
  "building",
  "staircase",
  "floor",
  "door",
  "lotNumber",
  "additionalAddressDetail",
] as const;

export const baseElements: ReadonlySet<string> = new Set(BASE_ELEMENTS);
