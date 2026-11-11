import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';

const shaPattern = /^[a-f0-9]{40}$/;
const digestPattern = /^[a-f0-9]{64}$/;
const componentFiles = { web: 'web.tar.gz', api: 'api.tar.gz' };

export async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function regularFile(file) {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Expected a regular file');
  return stat;
}

export async function verifyBundle(directory, expectedSha, expectedDigest, { allowPreview = false } = {}) {
  if (!shaPattern.test(expectedSha) || !digestPattern.test(expectedDigest)) {
    throw new Error('Expected full commit SHA and trusted manifest SHA-256');
  }
  const manifestFile = path.join(directory, 'manifest.json');
  await regularFile(manifestFile);
  if (await sha256(manifestFile) !== expectedDigest) throw new Error('Manifest digest mismatch');
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  if (manifest.schemaVersion !== 1 || manifest.source?.sha !== expectedSha) throw new Error('Source SHA mismatch');
  if (!['linux', 'win32'].includes(manifest.target?.platform) || !['x64', 'arm64'].includes(manifest.target?.arch)) {
    throw new Error('Unsupported target');
  }
  if (!/^\d+\.\d+\.\d+$/.test(manifest.target?.node ?? '')) throw new Error('Invalid runtime version');
  if (!allowPreview && manifest.channel !== 'candidate') throw new Error('Preview bundle cannot be promoted');
  if (!['candidate', 'preview'].includes(manifest.channel)) throw new Error('Invalid channel');
  if (['typecheck', 'build', 'runtimeSmoke'].some(check => manifest.checks?.[check] !== 'passed')) {
    throw new Error('Bundle checks did not pass');
  }
  if (Object.keys(manifest.components ?? {}).sort().join(',') !== 'api,web') throw new Error('Invalid components');
  for (const [component, filename] of Object.entries(componentFiles)) {
    const entry = manifest.components[component];
    if (entry.file !== filename || !digestPattern.test(entry.sha256 ?? '') || !Number.isSafeInteger(entry.bytes)) {
      throw new Error('Invalid component descriptor');
    }
    const file = path.join(directory, filename);
    const stat = await regularFile(file);
    if (stat.size !== entry.bytes || await sha256(file) !== entry.sha256) throw new Error(`${component} digest mismatch`);
  }
  return manifest;
}

// Traced dependencies may use symlinks; nothing may escape the staged runtime.
export async function checkRuntimeFiles(root) {
  const boundary = await realpath(root);
  const visited = new Set();
  async function walk(directory) {
    const resolved = await realpath(directory);
    const relative = path.relative(boundary, resolved);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error('Runtime symlink escapes its component');
    }
    if (visited.has(resolved)) return;
    visited.add(resolved);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === '.env' || entry.name.startsWith('.env.')) throw new Error('Environment file in runtime');
      const file = path.join(directory, entry.name);
      const target = await realpath(file);
      const targetRelative = path.relative(boundary, target);
      if (targetRelative === '..' || targetRelative.startsWith(`..${path.sep}`) || path.isAbsolute(targetRelative)) {
        throw new Error('Runtime symlink escapes its component');
      }
      if ((await lstat(target)).isDirectory()) await walk(file);
    }
  }
  await walk(root);
}
