'use strict';

/**
 * Force-upload selected section folders from output/ to GitHub,
 * bypassing previous/ diff (needed when local previous was updated without upload).
 *
 * Usage: node scripts/forceUploadSections.js myanmar models channels tags
 */
const path = require('path');
const fsp = require('fs/promises');
const { GitHubSyncService } = require('../src/infrastructure/github/GitHubSyncService');
const { pipelineConfig } = require('../src/config/pipeline.config');

async function walkJson(dir, baseRel = '') {
  const out = [];
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const rel = baseRel ? `${baseRel}/${ent.name}` : ent.name;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...(await walkJson(full, rel)));
    } else if (ent.isFile() && ent.name.endsWith('.json')) {
      const content = JSON.parse(await fsp.readFile(full, 'utf8'));
      out.push({ path: rel.replace(/\\/g, '/'), content });
    }
  }
  return out;
}

async function main() {
  const folders = process.argv.slice(2);
  if (!folders.length) {
    console.error('Usage: node scripts/forceUploadSections.js myanmar models channels tags');
    process.exitCode = 1;
    return;
  }

  const changed = [];
  for (const folder of folders) {
    const dir = path.join(pipelineConfig.outputDir, folder);
    const files = await walkJson(dir, folder);
    console.log(`${folder}: ${files.length} files`);
    changed.push(...files);
  }

  if (!changed.length) {
    console.error('No files found under output/');
    process.exitCode = 1;
    return;
  }

  const github = new GitHubSyncService();
  const result = await github.uploadChangedFiles(changed, {
    sections: folders,
    generatedAt: new Date().toISOString(),
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
