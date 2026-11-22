# Pacelli — local working-menu import for BitOS

## Current source boundary

Pacelli is registered as a separate discovery client. No source menu or matching GitHub repository was found during the initial search. Do **not** invent menu items/prices or copy them from another restaurant.

The `/#business` workspace offers a **browser-only** import under Pacelli. It is not an upload to the server, GitHub, an official menu, the delivery/ordering catalog or POS. After a reload, the data is gone. A local menu is for assortment research, draft combinations and hypothetical contribution scenarios only.

### CSV

Use UTF-8, .csv, with commas or semicolons as separators. Recommended headers:

```csv
id;name;category;price
```

This is deliberately an **empty template**: no example menu items or fictional prices are provided. `name` (or `title`) and `price` columns are required, but individual prices may be blank. `id` and `category` are optional, with temporary row IDs and an explicit 'Без категории' label if missing. The importer recognizes common Turkish and international decimal notation, including comma decimals and thousands separators; quoted CSV fields and double quotes are supported.

The currency selector for CSV must be set explicitly in the UI (TRY or RUB; defaults to TRY in the UI but is not a declaration of Pacelli's confirmed currency). Do not mix currencies in a file.

If a `businessId` CSV column exists, each row must be `pacelli`. Without such a column, the user explicitly uploads via Pacelli's workspace and is responsible for choosing the correct source. Never import another business's menu here.

### JSON

The root must explicitly identify the business and currency:

```json
{
  "businessId": "pacelli",
  "currency": "TRY",
  "items": []
}
```

Replace the empty `items` array with the user's original menu items (`id`, `name` or `title`, `category`, and either `price` in currency units or `priceMinor` in integer minor units). The importer does **not** accept an empty array for importing. Missing prices are `null`; zero-priced products are not inferred to be free.

### Validation and privacy

- Allowed formats: .json, .csv, max 2 MB, 1–1000 products.
- Product identifiers must be unique (or generated as stable row numbers for this single local file).
- Invalid, negative, zero, too-large, nonfinite or ambiguous prices are rejected.
- A file naming/branding or `businessId` mismatch is not assumed to be Pacelli.
- Parsed data exists only in React state and cannot change other business catalogs. Dropping the file into Pacelli's workspace does not make it publicly available.
- No images, sales history, client personal data, fees, food costs or paid orders are sent to or stored by the site.
- An imported catalog can be used for manual two-item pairing at **the sum of original prices**, and for explicitly transferring only the add-on price to Revenue Lab. This remains a hypothesis, not a sale or an offer approved by the restaurant.

### Next step

Locate or receive the *actual* previously-entered Pacelli menu file. Import it into Pacelli's workspace and compare the number of items, category names and missing prices against the source. Decide separately whether it should become a stable versioned snapshot and whether any public publishing is permitted.
