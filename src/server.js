import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from './config.js';
import { exportFeeds } from './exporter.js';

const port = Number(process.env.PORT || 3000);
let config;
let configError;
let feedRoutes = [];
let refreshInProgress = false;

export async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === '/' && ['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(200, {
      'Cache-Control': 'public, max-age=300',
      'Content-Type': 'text/html; charset=utf-8',
    });
    response.end(request.method === 'HEAD' ? undefined : '<!doctype html><title>Miglavita.eu API</title><p>Miglavita.eu API</p>');
    return;
  }

  const activeConfig = loadServerConfig();

  if (!activeConfig) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(`Server configuration error: ${configError.message}\n`);
    return;
  }

  const feed = feedRoutes.find((candidate) => candidate.route === url.pathname);

  if (!['GET', 'HEAD'].includes(request.method) || !feed) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(`Not found. XML feeds are available at ${feedRoutes.map(({ route }) => route).join(', ')}\n`);
    return;
  }

  try {
    const xml = await readFile(feed.outputFile, 'utf8');

    response.writeHead(200, {
      'Cache-Control': 'public, max-age=300',
      'Content-Type': 'application/xml; charset=utf-8',
    });
    response.end(request.method === 'HEAD' ? undefined : xml);
  } catch (error) {
    if (error.code === 'ENOENT') {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(`XML feed file not found. Run npm run export first.\n`);
      return;
    }

    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Failed to read XML feed.\n');
  }
}

export default handleRequest;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createServer(handleRequest);

  server.listen(port, () => {
    startRefreshScheduler();
  });
}

function startRefreshScheduler() {
  const activeConfig = loadServerConfig();

  if (!activeConfig) {
    console.error(`XML feed routes are unavailable: ${configError.message}`);
    return;
  }

  for (const feed of feedRoutes) {
    console.log(`${feed.name} XML feed available at http://localhost:${port}${feed.route}`);
  }

  scheduleNextRefresh();
}

function scheduleNextRefresh(now = new Date()) {
  const nextRefresh = nextRefreshDate(loadServerConfig().feedRefreshTime, now);
  const delay = nextRefresh.getTime() - now.getTime();

  console.log(`Next XML feed refresh scheduled at ${nextRefresh.toString()}`);

  setTimeout(async () => {
    await refreshFeed();
    scheduleNextRefresh();
  }, delay);
}

async function refreshFeed() {
  const activeConfig = loadServerConfig();

  if (!activeConfig) {
    console.error(`Skipping XML feed refresh: ${configError.message}`);
    return;
  }

  if (refreshInProgress) {
    console.warn('Skipping XML feed refresh because a previous refresh is still running');
    return;
  }

  refreshInProgress = true;

  try {
    const result = await exportFeeds(activeConfig);

    for (const output of result.outputs) {
      console.log(`Refreshed ${output.itemCount} ${output.name} items in ${output.outputFile}`);
    }
  } catch (error) {
    console.error(`Failed to refresh XML feed: ${error.message}`);
  } finally {
    refreshInProgress = false;
  }
}

function nextRefreshDate(time, now) {
  const [hours, minutes] = parseRefreshTime(time);
  const next = new Date(now);

  next.setHours(hours, minutes, 0, 0);

  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

function parseRefreshTime(time) {
  const match = String(time).match(/^([01]\d|2[0-3]):([0-5]\d)$/);

  if (!match) {
    throw new Error(`Invalid FEED_REFRESH_TIME "${time}". Expected HH:mm, for example 05:00`);
  }

  return [Number(match[1]), Number(match[2])];
}

function loadServerConfig() {
  if (config || configError) {
    return config;
  }

  try {
    config = getConfig();
    feedRoutes = config.feeds.map((feed) => ({
      ...feed,
      route: `/${basename(feed.outputFile)}`,
    }));
  } catch (error) {
    configError = error;
  }

  return config;
}
