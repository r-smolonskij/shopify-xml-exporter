import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { getConfig } from '../src/config.js';

test('uses Shopify app TOML for API version, store URL, and scope validation', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'shopify-config-'));
  const appConfigPath = join(directory, 'shopify.app.toml');

  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  await writeFile(appConfigPath, `
application_url = "https://example.lv"

[webhooks]
api_version = "2026-04"

[access_scopes]
scopes = "read_products,read_translations"
`, 'utf8');

  const config = getConfig({
    SHOPIFY_APP_CONFIG: appConfigPath,
    SHOPIFY_SHOP_DOMAIN: 'example.myshopify.com',
    SHOPIFY_ADMIN_ACCESS_TOKEN: 'shpat_test',
  });

  assert.equal(config.storeUrl, 'https://example.lv');
  assert.equal(config.apiVersion, '2026-04');
  assert.equal(config.locale, 'lv');
  assert.deepEqual(config.feeds.map((feed) => feed.outputFile), [
    'public/miglavita_salidzini.xml',
    'public/miglavita_kurpirkt.xml',
  ]);
});

test('environment values override Shopify app TOML defaults', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'shopify-config-'));
  const appConfigPath = join(directory, 'shopify.app.toml');

  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  await writeFile(appConfigPath, `
application_url = "https://example.lv"

[webhooks]
api_version = "2026-01"

[access_scopes]
scopes = "read_products,read_translations"
`, 'utf8');

  const config = getConfig({
    SHOPIFY_APP_CONFIG: appConfigPath,
    SHOPIFY_SHOP_DOMAIN: 'example.myshopify.com',
    SHOPIFY_ADMIN_ACCESS_TOKEN: 'shpat_test',
    SHOPIFY_STORE_URL: 'https://store.example.lv/',
    SHOPIFY_API_VERSION: '2025-10',
    SHOPIFY_LOCALE: 'en',
    SALIDZINI_OUTPUT_FILE: 'public/custom_salidzini.xml',
    KURPIRKT_OUTPUT_FILE: 'public/custom_kurpirkt.xml',
    OUTPUT_FILE: 'dist/products.xml',
  });

  assert.equal(config.storeUrl, 'https://store.example.lv');
  assert.equal(config.apiVersion, '2025-10');
  assert.equal(config.locale, 'en');
  assert.deepEqual(config.feeds.map((feed) => feed.outputFile), [
    'public/custom_salidzini.xml',
    'public/custom_kurpirkt.xml',
  ]);
});

test('requires product and translation scopes when Shopify app TOML scopes are present', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'shopify-config-'));
  const appConfigPath = join(directory, 'shopify.app.toml');

  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  await writeFile(appConfigPath, `
[access_scopes]
scopes = "read_product_listings"
`, 'utf8');

  assert.throws(() => getConfig({
    SHOPIFY_APP_CONFIG: appConfigPath,
    SHOPIFY_SHOP_DOMAIN: 'example.myshopify.com',
    SHOPIFY_ADMIN_ACCESS_TOKEN: 'shpat_test',
    SHOPIFY_STORE_URL: 'https://example.lv',
  }), /read_products, read_translations/);
});
