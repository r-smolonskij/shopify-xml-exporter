# Shopify XML Exporter

Clean Node.js CLI project that fetches published products from the Shopify Admin GraphQL API and writes XML feeds.

## Setup

```bash
npm install
cp .env.example .env
```

Fill `.env`:

- `SHOPIFY_SHOP_DOMAIN`: Shopify admin domain, for example `my-store.myshopify.com`.
- `SHOPIFY_APP_SECRET`: Shopify app secret used to exchange for a short-lived Admin API access token.
- `SHOPIFY_APP_CONFIG`: Shopify CLI app config file. Default is `shopify.app.products-get-new.toml`.
- `SHOPIFY_STORE_URL`: public storefront base URL, for example `https://example.lv`. If omitted, the exporter uses `application_url` from the Shopify app config.
- `SHOPIFY_API_VERSION`: Shopify Admin GraphQL API version. If omitted, the exporter uses `[webhooks].api_version` from the Shopify app config, then `2026-04`.
- `SHOPIFY_LOCALE`: Shopify translation locale used for product exports. Default is `lv`.
- `SALIDZINI_OUTPUT_FILE`: Salidzini XML output file. Default is `public/miglavita_salidzini.xml`.
- `KURPIRKT_OUTPUT_FILE`: Kurpirkt XML output file. Default is `public/miglavita_kurpirkt.xml`.
- `FEED_REFRESH_TIME`: daily server refresh time in `HH:mm` format. Default is `05:00`.
- `CRON_SECRET`: shared secret used by the Vercel cron endpoint.

The exporter uses the GraphQL `products` query with `status:active published_status:published`. The app config must include `read_products` and `read_translations` in `[access_scopes].scopes`.

The Shopify app config contains `client_id`, but not the shop's `.myshopify.com` domain or app secret. Keep these values in `.env`:

```env
SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com
SHOPIFY_APP_SECRET=shps_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Run

```bash
npm run export
```

Default outputs:

```text
public/miglavita_salidzini.xml
public/miglavita_kurpirkt.xml
```

You can override it:

```bash
SALIDZINI_OUTPUT_FILE=salidzini.xml KURPIRKT_OUTPUT_FILE=kurpirkt.xml npm run export
```

## Public Route

After generating the XML, start the server:

```bash
npm start
```

The feeds are available at:

```text
/miglavita_salidzini.xml
/miglavita_kurpirkt.xml
```

On Vercel, both XML files are refreshed by a cron job that calls `GET /api/cron/refresh`.
Vercel cron schedules run in UTC, so the current schedule is `0 5 * * *`.
If you want a different time, update `crons` in [`vercel.json`](vercel.json).
Visiting `/miglavita_salidzini.xml` or `/miglavita_kurpirkt.xml` no longer triggers a refresh; those routes only serve the already generated XML.

Before each export or refresh, the app exchanges the app secret for a short-lived Admin API access token using `POST /admin/oauth/access_token`.

The refresh endpoint requires `Authorization: Bearer $CRON_SECRET`.
Set `CRON_SECRET` in your Vercel environment before enabling the cron job.

## XML Fields

The exporter creates one XML `<item>` per Shopify variant. This keeps price, stock, SKU, barcode and variant color/model data accurate.

Salidzini generated tags:

- `name`: product title plus variant title, limited to 200 characters.
- `link`: storefront product URL, with variant query parameter when available.
- `price`: variant price in EUR-style decimal format.
- `category_full`: Shopify product category full name, then product type, then first collection title.
- `category_link`: first collection URL.
- `image`: variant image, otherwise product image.
- `in_stock`: variant inventory quantity when available.
- `brand`: Shopify vendor.
- `model`: model metafield when present, otherwise variant title when it is not `Default Title`.
- `color`: color metafield when present, otherwise Color/Krasa selected option.
- `mpn`: MPN metafield when present, otherwise SKU.
- `ean`: EAN metafield when present, otherwise barcode.
- `used`: from `DEFAULT_USED`.
- `adult`: from `DEFAULT_ADULT`.
- `over_the_counter_medicine`: from `DEFAULT_OVER_THE_COUNTER_MEDICINE`.

Optional empty values are omitted, except `image`, which is emitted as an empty tag when the product has no image.

Kurpirkt generated tags:

- `name`: product title plus variant title, limited to 200 characters.
- `link`: storefront product URL, with variant query parameter when available.
- `price`: variant price in EUR-style decimal format.
- `image`: variant image, otherwise product image.
- `manufacturer`: Shopify vendor.
- `category`: last category segment from `category_full`.
- `category_full`: Shopify product category full name, then product type, then first collection title.
- `category_link`: first collection URL.
- `in_stock`: variant inventory quantity when available.
- `delivery_cost_riga`: same value as Salidzini delivery price, currently `2.49`.
- `used`: from `DEFAULT_USED`.

## Tests

```bash
npm test
```
