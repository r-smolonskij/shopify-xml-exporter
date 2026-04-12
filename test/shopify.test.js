import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchProducts } from '../src/shopify.js';

const config = {
  shopDomain: 'example.myshopify.com',
  adminAccessToken: 'shpat_test',
  apiVersion: '2026-04',
  locale: 'lv',
  metafields: {
    mpn: { namespace: 'custom', key: 'mpn' },
    ean: { namespace: 'custom', key: 'ean' },
    model: null,
    color: null,
  },
};

test('fetches Shopify GraphQL products with cursor pagination', async (t) => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (url, options) => {
    requests.push({ url, options, body: JSON.parse(options.body) });

    if (requests.length === 1) {
      return jsonResponse({
        data: {
          products: {
            nodes: [{ id: 'gid://shopify/Product/1', title: 'First' }],
            pageInfo: { hasNextPage: true, endCursor: 'cursor-1' },
          },
        },
      });
    }

    return jsonResponse({
      data: {
        products: {
          nodes: [{ id: 'gid://shopify/Product/2', title: 'Second' }],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    });
  };

  const products = await fetchProducts(config);

  assert.deepEqual(products, [
    { id: 'gid://shopify/Product/1', title: 'First' },
    { id: 'gid://shopify/Product/2', title: 'Second' },
  ]);
  assert.equal(
    requests[0].url,
    'https://example.myshopify.com/admin/api/2026-04/graphql.json',
  );
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(requests[0].options.headers['X-Shopify-Access-Token'], 'shpat_test');
  assert.equal(requests[0].body.variables.cursor, null);
  assert.equal(requests[1].body.variables.cursor, 'cursor-1');
  assert.deepEqual(requests[0].body.variables, { cursor: null, locale: 'lv' });
  assert.match(requests[0].body.query, /products\(first: 50, after: \$cursor/);
  assert.match(requests[0].body.query, /collections\(first: 20\)/);
  assert.match(requests[0].body.query, /translations\(locale: \$locale\)/);
  assert.match(requests[0].body.query, /metafields\(first: 20\)/);
});

test('surfaces Shopify GraphQL errors', async (t) => {
  const originalFetch = globalThis.fetch;

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () => jsonResponse({
    errors: [{ message: 'Access denied' }],
  });

  await assert.rejects(
    () => fetchProducts(config),
    /Shopify GraphQL errors.*Access denied/,
  );
});

function jsonResponse(payload, ok = true, status = 200) {
  return {
    ok,
    status,
    async json() {
      return payload;
    },
  };
}
