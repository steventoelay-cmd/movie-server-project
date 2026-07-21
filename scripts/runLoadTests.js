'use strict';

/**
 * Opt-in load suite runner (cross-platform).
 */
process.env.TEST_LOAD = '1';

const { spawnSync } = require('child_process');
const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['jest', '--runInBand', 'tests/load'],
  { stdio: 'inherit', env: process.env, shell: true },
);

process.exit(result.status == null ? 1 : result.status);
