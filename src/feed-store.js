import { getCache } from '@vercel/functions';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const CACHE_NAMESPACE = `shopify-xml-exporter:${process.env.VERCEL_GIT_COMMIT_SHA || 'local'}`;
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

let cache;

function getFeedCache() {
  if (cache) {
    return cache;
  }

  try {
    cache = getCache({ namespace: CACHE_NAMESPACE });
  } catch {
    cache = null;
  }

  return cache;
}

function cacheKey(outputFile) {
  return `feed:${outputFile}`;
}

export async function readFeedXml(outputFile, options = {}) {
  const { allowFileFallback = true } = options;
  const feedCache = getFeedCache();

  if (feedCache) {
    const cachedXml = await feedCache.get(cacheKey(outputFile));

    if (typeof cachedXml === 'string' && cachedXml.length) {
      return cachedXml;
    }

    if (!allowFileFallback) {
      const error = new Error(`Cached XML feed not found for ${outputFile}`);
      error.code = 'CACHE_MISS';
      throw error;
    }
  }

  if (!allowFileFallback) {
    const error = new Error(`Cached XML feed not found for ${outputFile}`);
    error.code = 'CACHE_MISS';
    throw error;
  }

  return readFile(outputFile, 'utf8');
}

export async function writeFeedXml(outputFile, xml) {
  if (!process.env.VERCEL) {
    await mkdir(dirname(outputFile), { recursive: true });
    await writeFile(outputFile, xml, 'utf8');
  }

  const feedCache = getFeedCache();
  if (!feedCache) {
    return;
  }

  await feedCache.set(cacheKey(outputFile), xml, {
    ttl: CACHE_TTL_SECONDS,
  });
}
