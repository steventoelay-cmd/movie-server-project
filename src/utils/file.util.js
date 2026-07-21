'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

/**
 * @param {string} dir
 */
async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

/**
 * @param {string} filePath
 * @param {string} content
 */
async function writeTextFile(filePath, content) {
  await ensureDir(path.dirname(filePath));
  await fsp.writeFile(filePath, content, 'utf8');
}

/**
 * @param {string} filePath
 * @param {object} data
 * @param {number} [spaces=2]
 */
async function writeJsonFile(filePath, data, spaces = 2) {
  await writeTextFile(filePath, `${JSON.stringify(data, null, spaces)}\n`);
}

/**
 * @param {string} filePath
 * @returns {Promise<object|null>}
 */
async function readJsonFile(filePath) {
  try {
    const raw = await fsp.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    // Missing or corrupt cache/catalog JSON → treat as absent (recover, do not crash)
    if (error.code === 'ENOENT' || error instanceof SyntaxError) {
      return null;
    }
    throw error;
  }
}

/**
 * Recursively list relative file paths under dir.
 * @param {string} dir
 * @param {string} [base]
 * @returns {Promise<string[]>}
 */
async function listFilesRecursive(dir, base = dir) {
  const out = [];
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return out;
    }
    throw error;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listFilesRecursive(full, base)));
    } else if (entry.isFile()) {
      out.push(path.relative(base, full).split(path.sep).join('/'));
    }
  }
  return out;
}

/**
 * Copy directory tree (files only overwrite).
 * @param {string} src
 * @param {string} dest
 */
async function copyDir(src, dest) {
  await ensureDir(dest);
  const files = await listFilesRecursive(src);
  for (const rel of files) {
    const from = path.join(src, rel);
    const to = path.join(dest, rel);
    await ensureDir(path.dirname(to));
    await fsp.copyFile(from, to);
  }
}

/**
 * Remove directory if it exists.
 * @param {string} dir
 */
async function removeDir(dir) {
  await fsp.rm(dir, { recursive: true, force: true });
}

/**
 * Sync dest to match src (replace contents).
 * @param {string} src
 * @param {string} dest
 */
async function replaceDir(src, dest) {
  await removeDir(dest);
  await copyDir(src, dest);
}

/**
 * Acquire a simple file lock. Returns release function.
 * @param {string} lockPath
 * @param {number} [staleMs]
 */
async function acquireFileLock(lockPath, staleMs = 3 * 60 * 60 * 1000) {
  await ensureDir(path.dirname(lockPath));
  try {
    const fd = fs.openSync(lockPath, 'wx');
    fs.writeFileSync(fd, String(process.pid), 'utf8');
    fs.closeSync(fd);
  } catch (error) {
    if (error.code === 'EEXIST') {
      try {
        const stat = await fsp.stat(lockPath);
        if (Date.now() - stat.mtimeMs > staleMs) {
          await fsp.unlink(lockPath);
          return acquireFileLock(lockPath, staleMs);
        }
      } catch {
        // ignore
      }
      const err = new Error('Pipeline already running');
      err.code = 'PIPELINE_LOCKED';
      throw err;
    }
    throw error;
  }

  return async () => {
    try {
      await fsp.unlink(lockPath);
    } catch {
      // ignore
    }
  };
}

module.exports = {
  ensureDir,
  writeTextFile,
  writeJsonFile,
  readJsonFile,
  listFilesRecursive,
  copyDir,
  removeDir,
  replaceDir,
  acquireFileLock,
};
