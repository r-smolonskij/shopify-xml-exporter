import { getConfig } from './config.js';
import { exportFeeds } from './exporter.js';

async function main() {
  const result = await exportFeeds(getConfig());

  for (const output of result.outputs) {
    console.log(`Exported ${output.itemCount} ${output.name} items to ${output.outputFile}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
