const MAX = {
  name: 200,
  link: 500,
  categoryFull: 1000,
  categoryLink: 500,
  image: 500,
};
const CATEGORY_PREFIX = ['Uztura bagātinātāji', 'Vitamīni', 'Veselība'];
const CATEGORY_SEPARATOR = ' >> ';

export function productsToFeedItems(products, config) {
  return products.flatMap((product) => {
    const variants = productVariants(product);

    return variants
      .map((variant) => productVariantToFeedItem(product, variant, config))
      .filter((item) => item.brand !== 'MiglaVita');
  });
}

export function feedItemsToKurpirktItems(items) {
  return items.map((item) => removeEmpty({
    name: item.name,
    link: item.link,
    price: item.price,
    image: item.image,
    manufacturer: item.brand,
    category: item.category_full,
    category_full: item.category_full,
    category_link: item.category_link,
    in_stock: item.in_stock,
    delivery_cost_riga: item.delivery_latvija,
    used: item.used,
  }, ['image']));
}

function productVariantToFeedItem(product, variant, config) {
  const metafields = mergeMetafields(product.metafields, variant?.metafields);
  const collections = productCollections(product);
  const collection = collections[0];
  const productTitle = translationValue(product.translations, 'title') || product.title;
  const productHandle = translationValue(product.translations, 'handle') || product.handle;
  const productType = translationValue(product.translations, 'product_type')
    || translationValue(product.translations, 'productType')
    || product.productType
    || product.product_type;
  const rawVariantTitle = variant?.title && variant.title !== 'Default Title'
    ? translationValue(variant?.translations, 'title') || variant.title
    : '';
  const variantTitle = rawVariantTitle || '';
  const name = compact([productTitle, variantTitle]).join(' ');
  const link = productUrl(config.storeUrl, productHandle, variant?.id);
  const image = variantImageUrl(variant) || productImageUrl(product) || '';
  const collectionTitles = unique(collections.map((item) => (
    translationValue(item.translations, 'title') || item.title
  )));
  const categoryFull = categoryPath(collectionTitles.length
    ? collectionTitles
    : [productType || product.category?.fullName]);
  const collectionHandle = translationValue(collection?.translations, 'handle') || collection?.handle;

  return removeEmpty({
    name: truncate(name, MAX.name),
    link: truncate(link, MAX.link),
    price: normalizePrice(variant?.price),
    category_full: truncate(categoryFull, MAX.categoryFull),
    category_link: truncate(collectionHandle ? `${config.storeUrl}/collections/${collectionHandle}` : '', MAX.categoryLink),
    image: truncate(image, MAX.image),
    in_stock: numberOrEmpty(variant?.inventoryQuantity ?? variant?.inventory_quantity),
    brand: product.vendor || '',
    model: metafieldValue(metafields, config.metafields.model) || variantTitle,
    color: metafieldValue(metafields, config.metafields.color) || selectedOption(product, variant, ['color', 'krasa', 'krāsa']),
    mpn: metafieldValue(metafields, config.metafields.mpn) || variant?.sku || '',
    ean: metafieldValue(metafields, config.metafields.ean) || variant?.barcode || '',
    used: config.defaults.used,
    adult: config.defaults.adult,
    over_the_counter_medicine: config.defaults.overTheCounterMedicine,
    delivery_latvija: '2.49',
    delivery_days_latvija: '2',
  }, ['image']);
}

export function validateFeedItems(items) {
  const errors = [];

  items.forEach((item, index) => {
    for (const field of ['name', 'link', 'price']) {
      if (!item[field]) {
        errors.push(`Item ${index + 1} is missing required field: ${field}`);
      }
    }

    if (item.price && !/^\d+(\.\d+)?$/.test(item.price)) {
      errors.push(`Item ${index + 1} has invalid price: ${item.price}`);
    }
  });

  if (errors.length) {
    throw new Error(`Feed validation failed:\n${errors.join('\n')}`);
  }
}

function productUrl(storeUrl, handle, variantId) {
  const url = new URL(`${storeUrl}/products/${handle}`);

  if (variantId) {
    url.searchParams.set('variant', String(variantId).split('/').pop());
  }

  return url.toString();
}

function normalizePrice(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '';
  }

  return number.toFixed(2);
}

function selectedOption(product, variant, names) {
  const options = variant?.selectedOptions || [];
  const match = options.find((option) => names.includes(option.name.toLowerCase()));

  if (match) {
    return match.value || '';
  }

  const restMatch = (variant?.option_values || []).find((option) => (
    names.includes(String(option.name || '').toLowerCase())
  ));

  if (restMatch) {
    return restMatch.value || '';
  }

  const productOptions = product.options?.nodes || product.options || [];
  const optionIndex = productOptions.findIndex((option) => (
    names.includes(String(option.name || '').toLowerCase())
  ));

  if (optionIndex >= 0) {
    return variant?.[`option${optionIndex + 1}`] || '';
  }

  return '';
}

function productVariants(product) {
  if (product.variants?.nodes?.length) {
    return product.variants.nodes;
  }

  if (Array.isArray(product.variants) && product.variants.length) {
    return product.variants;
  }

  return [null];
}

function productCollections(product) {
  if (product.collections?.nodes?.length) {
    return product.collections.nodes;
  }

  if (Array.isArray(product.collections) && product.collections.length) {
    return product.collections;
  }

  return [];
}

function productImageUrl(product) {
  if (product.images?.nodes?.[0]?.url) {
    return product.images.nodes[0].url;
  }

  return product.images?.[0]?.src || product.image?.src || '';
}

function variantImageUrl(variant) {
  if (variant?.image?.url) {
    return variant.image.url;
  }

  return variant?.image?.src || '';
}

function mergeMetafields(...metafieldLists) {
  const map = new Map();

  for (const list of metafieldLists) {
    for (const metafield of metafieldNodes(list)) {
      if (metafield) {
        map.set(`${metafield.namespace}.${metafield.key}`, metafield.value);
      }
    }
  }

  return map;
}

function metafieldNodes(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value.nodes)) {
    return value.nodes;
  }

  if (Array.isArray(value.edges)) {
    return value.edges.map((edge) => edge.node).filter(Boolean);
  }

  return [];
}

function metafieldValue(metafields, mapping) {
  if (!mapping) {
    return '';
  }

  return metafields.get(`${mapping.namespace}.${mapping.key}`) || '';
}

function translationValue(translations, key) {
  const translation = (translations || []).find((item) => item.key === key && item.value);

  return translation?.value || '';
}

function removeEmpty(item, keepEmptyFields = []) {
  return Object.fromEntries(
    Object.entries(item).filter(([key, value]) => keepEmptyFields.includes(key) || value !== ''),
  );
}

function truncate(value, maxLength) {
  return Array.from(stripEmoji(value)).slice(0, maxLength).join('');
}

function numberOrEmpty(value) {
  return Number.isFinite(value) ? String(value) : '';
}

function compact(values) {
  return values.filter((value) => value !== null && value !== undefined && String(value).trim());
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined && String(value).trim()))];
}

function categoryPath(values) {
  return unique([...CATEGORY_PREFIX, ...values].map(stripEmoji)).join(CATEGORY_SEPARATOR);
}

function stripEmoji(value) {
  return String(value || '')
    .replace(/\p{Emoji_Presentation}/gu, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\uFE0F/gu, '')
    .replace(/[\u200D\uFE0E]/gu, '')
    .replace(/\s+([,.])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
