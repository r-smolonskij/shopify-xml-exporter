const PRODUCTS_QUERY = `
  query ProductsForXmlFeed($cursor: String, $locale: String!) {
    products(first: 50, after: $cursor, query: "status:active published_status:published") {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        title
        handle
        vendor
        productType
        translations(locale: $locale) {
          key
          value
        }
        category {
          fullName
        }
        images(first: 1) {
          nodes {
            url
          }
        }
        collections(first: 20) {
          nodes {
            title
            handle
            translations(locale: $locale) {
              key
              value
            }
          }
        }
        metafields(first: 20) {
          nodes {
            namespace
            key
            value
          }
        }
        variants(first: 100) {
          nodes {
            id
            title
            sku
            barcode
            price
            inventoryQuantity
            translations(locale: $locale) {
              key
              value
            }
            selectedOptions {
              name
              value
            }
            image {
              url
            }
            metafields(first: 20) {
              nodes {
                namespace
                key
                value
              }
            }
          }
        }
      }
    }
  }
`;

export async function fetchProducts(config) {
  const products = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data = await shopifyGraphql(config, PRODUCTS_QUERY, {
      cursor,
      locale: config.locale,
    });

    const connection = data.products;
    products.push(...connection.nodes);
    hasNextPage = connection.pageInfo.hasNextPage;
    cursor = connection.pageInfo.endCursor;
  }

  return products;
}

async function shopifyGraphql(config, query, variables) {
  const response = await fetch(
    `https://${config.shopDomain}/admin/api/${config.apiVersion}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': config.adminAccessToken,
      },
      body: JSON.stringify({ query, variables }),
    },
  );

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      `Shopify GraphQL API request failed with ${response.status}: ${JSON.stringify(payload)}`,
    );
  }

  if (payload.errors?.length) {
    throw new Error(`Shopify GraphQL errors: ${JSON.stringify(payload.errors)}`);
  }

  return payload.data;
}
