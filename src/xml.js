import { XMLBuilder } from 'fast-xml-parser';

export function buildXml(items, options = {}) {
  const builder = new XMLBuilder({
    format: true,
    ignoreAttributes: false,
    suppressEmptyNode: false,
  });
  const generatedAt = options.generatedAt || new Date();
  const body = builder.build({
    root: {
      item: items,
    },
  });

  return `<?xml version="1.0" encoding="utf-8" ?>\n<!-- generated_at: ${generatedAt.toISOString()} -->\n${body}`;
}
