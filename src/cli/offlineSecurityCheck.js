'use strict';

/**
 * Offline security checks (no network).
 */
const assert = require('assert');
const { assertSafeFetchUrl } = require('../utils/ssrf.util');
const { redactSensitive, maskString, assertSafeRelativePath } = require('../utils/sanitize.util');
const { validateEnv } = require('../config/validateEnv');
const path = require('path');
const os = require('os');

function run() {
  assert.strictEqual(assertSafeFetchUrl('').ok, false);
  assert.strictEqual(assertSafeFetchUrl('file:///etc/passwd').ok, false);
  assert.strictEqual(assertSafeFetchUrl('ftp://example.com/a').ok, false);
  assert.strictEqual(assertSafeFetchUrl('http://localhost/a').ok, false);
  assert.strictEqual(assertSafeFetchUrl('http://127.0.0.1/a').ok, false);
  assert.strictEqual(assertSafeFetchUrl('http://192.168.1.1/a').ok, false);
  assert.strictEqual(assertSafeFetchUrl('http://169.254.169.254/latest').ok, false);
  assert.strictEqual(assertSafeFetchUrl('https://user:pass@evil.com/').ok, false);
  assert.strictEqual(assertSafeFetchUrl('https://www.tubev.sex/watch/1').ok, true);

  const long = `https://ex.com/${'a'.repeat(5000)}`;
  assert.strictEqual(assertSafeFetchUrl(long).code, 'URL_TOO_LONG');

  const masked = maskString('Bearer ghp_abcdefghijklmnopqrstuvwxyz123456 Authorization: Bearer x');
  assert.ok(!masked.includes('ghp_'));
  assert.ok(masked.includes('[REDACTED]'));

  const redacted = redactSensitive({
    authorization: 'Bearer secret',
    token: 'abc',
    nested: { github_token: 'ghp_xxx' },
    url: 'https://ok.com',
  });
  assert.strictEqual(redacted.authorization, '[REDACTED]');
  assert.strictEqual(redacted.token, '[REDACTED]');
  assert.strictEqual(redacted.nested.github_token, '[REDACTED]');
  assert.strictEqual(redacted.url, 'https://ok.com');

  const root = path.join(os.tmpdir(), 'sec-root');
  const safe = assertSafeRelativePath(root, 'cache/a.json');
  assert.strictEqual(safe.ok, true);
  const evil = assertSafeRelativePath(root, '../outside.txt');
  assert.strictEqual(evil.ok, false);

  const result = validateEnv({ strict: false });
  assert.ok(typeof result.ok === 'boolean');

  process.stdout.write('offline security checks passed\n');
}

try {
  run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
