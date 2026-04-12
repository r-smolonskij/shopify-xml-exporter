import assert from 'node:assert/strict';
import test from 'node:test';
import { buildXml } from '../src/xml.js';
import {
  feedItemsToKurpirktItems,
  productsToFeedItems,
  validateFeedItems,
} from '../src/transform.js';

const config = {
  storeUrl: 'https://example.lv',
  defaults: {
    used: '0',
    adult: 'no',
    overTheCounterMedicine: '0',
  },
  metafields: {
    mpn: { namespace: 'custom', key: 'mpn' },
    ean: { namespace: 'custom', key: 'ean' },
    model: { namespace: 'custom', key: 'model' },
    color: { namespace: 'custom', key: 'color' },
  },
};

test('maps Shopify product variants to XML feed items', () => {
  const items = productsToFeedItems([{
    title: 'Acme Chair',
    handle: 'acme-chair',
    vendor: 'Acme',
    productType: 'Furniture > Chairs',
    category: { fullName: 'Home & Garden > Furniture > Chairs' },
    images: { nodes: [{ url: 'https://cdn.example.lv/chair.jpg' }] },
    collections: { nodes: [
      { title: 'Chairs', handle: 'chairs' },
      { title: 'Sale', handle: 'sale' },
    ] },
    metafields: { nodes: [{ namespace: 'custom', key: 'mpn', value: 'MPN-1' }] },
    variants: {
      nodes: [{
        id: 'gid://shopify/ProductVariant/123',
        title: 'Black',
        sku: 'SKU-1',
        barcode: '4750000000001',
        price: '49.9',
        inventoryQuantity: 7,
        selectedOptions: [{ name: 'Color', value: 'Black' }],
        image: null,
        metafields: { nodes: [{ namespace: 'custom', key: 'model', value: 'Chair 2026' }] },
      }],
    },
  }], config);

  assert.equal(items.length, 1);
  assert.deepEqual(items[0], {
    name: 'Acme Chair Black',
    link: 'https://example.lv/products/acme-chair?variant=123',
    price: '49.90',
    category_full: 'Uztura bagātinātāji >> Vitamīni >> Veselība >> Chairs >> Sale',
    category_link: 'https://example.lv/collections/chairs',
    image: 'https://cdn.example.lv/chair.jpg',
    in_stock: '7',
    brand: 'Acme',
    model: 'Chair 2026',
    color: 'Black',
    mpn: 'MPN-1',
    ean: '4750000000001',
    used: '0',
    adult: 'no',
    over_the_counter_medicine: '0',
    delivery_latvija: '2.49',
    delivery_days_latvija: '2',
  });

  validateFeedItems(items);
});

test('uses localized Shopify translations when available', () => {
  const items = productsToFeedItems([{
    title: 'Ashwagandha',
    handle: 'ashwagandha',
    translations: [
      { key: 'title', value: 'Ašvaganda' },
      { key: 'handle', value: 'asvaganda' },
    ],
    vendor: 'Acme',
    productType: 'Vitamins',
    images: { nodes: [{ url: 'https://cdn.example.lv/product.jpg' }] },
    collections: {
      nodes: [{
        title: 'Supplements',
        handle: 'supplements',
        translations: [
          { key: 'title', value: 'Uztura bagātinātāji 🌿' },
          { key: 'handle', value: 'uztura-bagatinataji' },
        ],
      }, {
        title: 'Vitamins',
        handle: 'vitamins',
        translations: [
          { key: 'title', value: 'Vitamīni' },
          { key: 'handle', value: 'vitamini' },
        ],
      }],
    },
    variants: {
      nodes: [{
        id: 'gid://shopify/ProductVariant/321',
        title: 'Black',
        translations: [{ key: 'title', value: 'Melns' }],
        price: '14.5',
        inventoryQuantity: 4,
      }],
    },
  }], config);

  assert.equal(items[0].name, 'Ašvaganda Melns');
  assert.equal(items[0].link, 'https://example.lv/products/asvaganda?variant=321');
  assert.equal(items[0].category_full, 'Uztura bagātinātāji >> Vitamīni >> Veselība');
  assert.equal(items[0].category_link, 'https://example.lv/collections/uztura-bagatinataji');
});

test('keeps empty image tag and creates valid XML', () => {
  const xml = buildXml([{
    name: 'Product',
    link: 'https://example.lv/products/product',
    price: '10.00',
    image: '',
  }], { generatedAt: new Date('2026-04-12T05:00:00.000Z') });

  assert.match(
    xml,
    /^<\?xml version="1\.0" encoding="utf-8" \?>\n<!-- generated_at: 2026-04-12T05:00:00\.000Z -->\n<root>/,
  );
  assert.match(xml, /<image><\/image>/);
});

test('excludes MiglaVita brand products from XML feed items', () => {
  const items = productsToFeedItems([{
    title: 'MiglaVita Product',
    handle: 'miglavita-product',
    vendor: 'MiglaVita',
    productType: 'Supplements',
    images: { nodes: [{ url: 'https://cdn.example.lv/product.jpg' }] },
    variants: {
      nodes: [{
        id: 'gid://shopify/ProductVariant/789',
        title: 'Default Title',
        price: '19.99',
        inventoryQuantity: 5,
      }],
    },
  }, {
    title: 'Other Product',
    handle: 'other-product',
    vendor: 'Other Brand',
    productType: 'Supplements',
    images: { nodes: [{ url: 'https://cdn.example.lv/other.jpg' }] },
    variants: {
      nodes: [{
        id: 'gid://shopify/ProductVariant/790',
        title: 'Default Title',
        price: '29.99',
        inventoryQuantity: 2,
      }],
    },
  }], config);

  assert.equal(items.length, 1);
  assert.equal(items[0].brand, 'Other Brand');
});

test('maps Shopify REST-shaped product data to XML feed items', () => {
  const items = productsToFeedItems([{
    title: 'Acme Table',
    handle: 'acme-table',
    vendor: 'Acme',
    product_type: 'Furniture > Tables',
    images: [{ src: 'https://cdn.example.lv/table.jpg' }],
    options: [{ name: 'Color' }],
    variants: [{
      id: 456,
      title: 'Oak',
      sku: 'SKU-2',
      barcode: '4750000000002',
      price: '129.9',
      inventory_quantity: 3,
      option_values: [{ name: 'Color', value: 'Oak' }],
    }],
  }], config);

  assert.equal(items.length, 1);
  assert.deepEqual(items[0], {
    name: 'Acme Table Oak',
    link: 'https://example.lv/products/acme-table?variant=456',
    price: '129.90',
    category_full: 'Uztura bagātinātāji >> Vitamīni >> Veselība >> Furniture > Tables',
    image: 'https://cdn.example.lv/table.jpg',
    in_stock: '3',
    brand: 'Acme',
    model: 'Oak',
    color: 'Oak',
    mpn: 'SKU-2',
    ean: '4750000000002',
    used: '0',
    adult: 'no',
    over_the_counter_medicine: '0',
    delivery_latvija: '2.49',
    delivery_days_latvija: '2',
  });

  validateFeedItems(items);
});

test('maps feed items to Kurpirkt XML item shape', () => {
  const items = feedItemsToKurpirktItems([{
    name: 'Apple iPhone 13 PRO 512GB black',
    link: 'https://www.example.lv/page.php?prod=1234',
    price: '1200.59',
    image: 'https://www.example.lv/bildes/apple_iphone_13_pro.jpg',
    brand: 'Apple',
    category_full: 'Sakaru līdzekļi > Mobilie telefoni',
    category_link: 'https://www.example.lv/page.php?cat=12',
    in_stock: '5',
    delivery_latvija: '2.49',
    used: '0',
    adult: 'no',
  }]);

  assert.deepEqual(items, [{
    name: 'Apple iPhone 13 PRO 512GB black',
    link: 'https://www.example.lv/page.php?prod=1234',
    price: '1200.59',
    image: 'https://www.example.lv/bildes/apple_iphone_13_pro.jpg',
    manufacturer: 'Apple',
    category: 'Sakaru līdzekļi > Mobilie telefoni',
    category_full: 'Sakaru līdzekļi > Mobilie telefoni',
    category_link: 'https://www.example.lv/page.php?cat=12',
    in_stock: '5',
    delivery_cost_riga: '2.49',
    used: '0',
  }]);
});
