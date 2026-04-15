import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_API_VERSION = '2026-04';
const DEFAULT_SHOPIFY_APP_CONFIG = 'shopify.app.products-get-new.toml';
const DEFAULT_OUTPUT_FILE = 'public/miglavita_salidzini.xml';
const DEFAULT_KURPIRKT_OUTPUT_FILE = 'public/miglavita_kurpirkt.xml';
const DEFAULT_FEED_REFRESH_TIME = '05:00';
const DEFAULT_SHOPIFY_LOCALE = 'lv';
const REQUIRED_SCOPES = ['read_products', 'read_translations'];

export function getConfig(env = process.env) {
  const appConfig = loadShopifyAppConfig(env.SHOPIFY_APP_CONFIG || DEFAULT_SHOPIFY_APP_CONFIG);
  const shopDomain = required(env.SHOPIFY_SHOP_DOMAIN, 'SHOPIFY_SHOP_DOMAIN');
  const shopifyClientId = required(
    env.SHOPIFY_API_KEY || appConfig.clientId,
    'SHOPIFY_API_KEY or Shopify app config client_id',
  );
  const shopifyClientSecret = required(
    env.SHOPIFY_APP_SECRET || env.SHOPIFY_CLIENT_SECRET,
    'SHOPIFY_APP_SECRET or SHOPIFY_CLIENT_SECRET',
  );
  const storeUrl = trimTrailingSlash(
    required(env.SHOPIFY_STORE_URL || appConfig.applicationUrl, 'SHOPIFY_STORE_URL'),
  );
  const apiVersion = env.SHOPIFY_API_VERSION || appConfig.apiVersion || DEFAULT_API_VERSION;

  validateShopifyAppScopes(appConfig);

  return {
    shopDomain,
    shopifyClientId,
    shopifyClientSecret,
    apiVersion,
    locale: env.SHOPIFY_LOCALE || DEFAULT_SHOPIFY_LOCALE,
    storeUrl,
    outputFile: env.SALIDZINI_OUTPUT_FILE || DEFAULT_OUTPUT_FILE,
    feeds: [
      {
        name: 'salidzini',
        format: 'salidzini',
        outputFile: env.SALIDZINI_OUTPUT_FILE || DEFAULT_OUTPUT_FILE,
      },
      {
        name: 'kurpirkt',
        format: 'kurpirkt',
        outputFile: env.KURPIRKT_OUTPUT_FILE || DEFAULT_KURPIRKT_OUTPUT_FILE,
      },
    ],
    feedRefreshTime: env.FEED_REFRESH_TIME || DEFAULT_FEED_REFRESH_TIME,
    defaults: {
      used: env.DEFAULT_USED || '',
      adult: env.DEFAULT_ADULT || '',
      overTheCounterMedicine: env.DEFAULT_OVER_THE_COUNTER_MEDICINE || '',
    },
    metafields: {
      mpn: parseMetafield(env.MPN_METAFIELD),
      ean: parseMetafield(env.EAN_METAFIELD),
      model: parseMetafield(env.MODEL_METAFIELD),
      color: parseMetafield(env.COLOR_METAFIELD),
    },
  };
}

function loadShopifyAppConfig(path) {
  const resolvedPath = resolve(path);

  if (!existsSync(resolvedPath)) {
    return {};
  }

  const parsed = parseToml(readFileSync(resolvedPath, 'utf8'));

  return {
    clientId: parsed.client_id,
    applicationUrl: parsed.application_url,
    apiVersion: parsed.webhooks?.api_version,
    scopes: parseScopes(parsed.access_scopes?.scopes),
  };
}

function validateShopifyAppScopes(appConfig) {
  if (!appConfig.scopes?.length) {
    return;
  }

  const missingScopes = REQUIRED_SCOPES.filter((scope) => !appConfig.scopes.includes(scope));

  if (missingScopes.length) {
    throw new Error(
      `Shopify app config must include ${missingScopes.join(', ')} in [access_scopes].scopes to use localized product exports`,
    );
  }
}

function required(value, name) {
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function parseToml(content) {
  const root = {};
  let section = root;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim();

    if (!line) {
      continue;
    }

    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      section = root;

      for (const part of sectionMatch[1].split('.')) {
        section[part] ||= {};
        section = section[part];
      }

      continue;
    }

    const keyValueMatch = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
    if (keyValueMatch) {
      section[keyValueMatch[1]] = parseTomlValue(keyValueMatch[2].trim());
    }
  }

  return root;
}

function stripComment(line) {
  let inString = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"' && line[index - 1] !== '\\') {
      inString = !inString;
    }

    if (character === '#' && !inString) {
      return line.slice(0, index);
    }
  }

  return line;
}

function parseTomlValue(value) {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();

    if (!inner) {
      return [];
    }

    return inner.split(',').map((item) => parseTomlValue(item.trim()));
  }

  return value;
}

function parseScopes(value) {
  if (!value) {
    return [];
  }

  return String(value)
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function parseMetafield(value) {
  if (!value) {
    return null;
  }

  const [namespace, key] = value.split('.');
  if (!namespace || !key) {
    throw new Error(`Invalid metafield mapping "${value}". Expected format: namespace.key`);
  }

  return { namespace, key };
}
