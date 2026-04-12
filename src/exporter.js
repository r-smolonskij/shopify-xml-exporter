import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fetchProducts } from './shopify.js';
import {
  feedItemsToKurpirktItems,
  productsToFeedItems,
  validateFeedItems,
} from './transform.js';
import { buildXml } from './xml.js';

export async function exportFeeds(config) {
  const products = await fetchProducts(config);
  const baseItems = productsToFeedItems(products, config);
  const outputs = [];

  validateFeedItems(baseItems);

  for (const feed of config.feeds) {
    const items = formatFeedItems(baseItems, feed.format);
    const xml = buildXml(items);

    await mkdir(dirname(feed.outputFile), { recursive: true });
    await writeFile(feed.outputFile, xml, 'utf8');

    outputs.push({
      name: feed.name,
      itemCount: items.length,
      outputFile: feed.outputFile,
    });
  }

  return {
    itemCount: baseItems.length,
    outputs,
  };
}

export async function exportFeed(config) {
  const result = await exportFeeds({
    ...config,
    feeds: [{
      name: 'default',
      format: 'salidzini',
      outputFile: config.outputFile,
    }],
  });

  return result.outputs[0];
}

function formatFeedItems(items, format) {
  if (format === 'salidzini') {
    return items;
  }

  if (format === 'kurpirkt') {
    return feedItemsToKurpirktItems(items);
  }

  throw new Error(`Unsupported feed format: ${format}`);
}
