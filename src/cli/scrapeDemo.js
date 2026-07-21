'use strict';

/**
 * Optional manual smoke CLI for the scraper engine.
 * Usage:
 *   node src/cli/scrapeDemo.js
 *   node src/cli/scrapeDemo.js --site=tubev --section=home --page=1
 *   node src/cli/scrapeDemo.js --dry-run
 */

const { createScraperEngine, SECTIONS } = require('../scrapers');

function parseArgs(argv) {
  const out = { site: 'tubev', section: SECTIONS.HOME, page: 1, dryRun: false, parentUrl: '' };
  for (const arg of argv) {
    if (arg === '--dry-run') {
      out.dryRun = true;
    } else if (arg.startsWith('--site=')) {
      out.site = arg.slice('--site='.length);
    } else if (arg.startsWith('--section=')) {
      out.section = arg.slice('--section='.length);
    } else if (arg.startsWith('--page=')) {
      out.page = parseInt(arg.slice('--page='.length), 10) || 1;
    } else if (arg.startsWith('--parent=')) {
      out.parentUrl = arg.slice('--parent='.length);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const engine = createScraperEngine();

  if (args.dryRun) {
    process.stdout.write(
      `${JSON.stringify({ ok: true, sites: engine.listSites(), args }, null, 2)}\n`,
    );
    return;
  }

  let result;
  if (args.parentUrl) {
    result = await engine.scrapeChildren(args.site, args.section, args.parentUrl, {
      page: args.page,
    });
  } else if (args.section === SECTIONS.HOME) {
    result = await engine.scrapeHome(args.site, { page: args.page });
  } else {
    result = await engine.scrapeParents(args.site, args.section, { page: args.page });
  }

  const preview = {
    siteId: result.siteId,
    section: result.section,
    kind: result.kind,
    url: result.url,
    totalItems: result.totalItems,
    durationMs: result.durationMs,
    sample: result.items.slice(0, 3),
  };

  process.stdout.write(`${JSON.stringify(preview, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({ error: error.message, code: error.code, meta: error.meta }, null, 2)}\n`,
  );
  process.exitCode = 1;
});
