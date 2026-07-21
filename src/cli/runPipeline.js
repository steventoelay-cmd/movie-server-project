'use strict';

/**
 * Manual pipeline CLI.
 *
 * Examples:
 *   node src/cli/runPipeline.js
 *   node src/cli/runPipeline.js --section=home
 *   node src/cli/runPipeline.js --section=model --section=channel
 *   node src/cli/runPipeline.js --all --no-upload
 *   node src/cli/runPipeline.js --schedule
 */

const { SyncOrchestrator } = require('../application/sync/SyncOrchestrator');
const { PipelineScheduler } = require('../jobs/scheduler');
const { schedulerConfig } = require('../config/scheduler.config');

function parseArgs(argv) {
  const out = {
    sections: [],
    all: false,
    upload: true,
    schedule: false,
  };

  for (const arg of argv) {
    if (arg === '--all') {
      out.all = true;
    } else if (arg === '--no-upload') {
      out.upload = false;
    } else if (arg === '--schedule') {
      out.schedule = true;
    } else if (arg.startsWith('--section=')) {
      out.sections.push(arg.slice('--section='.length));
    }
  }

  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.schedule) {
    const scheduler = new PipelineScheduler();
    scheduler.start();
    process.stdout.write(
      `${JSON.stringify(
        {
          message: 'Scheduler running',
          cron: schedulerConfig.cron,
          timezone: schedulerConfig.timezone,
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  const orchestrator = new SyncOrchestrator({ upload: args.upload });
  const sections = args.all || args.sections.length === 0 ? 'all' : args.sections;
  const report = await orchestrator.run({ sections, upload: args.upload });

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: report.errors.length === 0,
        durationMs: report.durationMs,
        sections: report.sections,
        filesGenerated: report.filesGenerated.length,
        filesChanged: report.filesChanged.length,
        filesUploaded: report.filesUploaded,
        upload: report.upload,
        errors: report.errors,
        sectionResults: report.sectionResults.map((s) => ({
          section: s.section,
          ok: s.ok,
          totalItems: s.totalItems,
          files: s.files?.length,
          error: s.error,
        })),
      },
      null,
      2,
    )}\n`,
  );

  if (report.errors.length) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({ error: error.message, code: error.code }, null, 2)}\n`,
  );
  process.exitCode = 1;
});
