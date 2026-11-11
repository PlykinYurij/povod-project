import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { checkRuntimeFiles, sha256, verifyBundle } from './integrity.mjs';

const directories: string[] = [];
const commit = 'a'.repeat(40);

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'povod-integrity-'));
  directories.push(directory);
  const components: Record<string, { file: string; sha256: string; bytes: number }> = {};
  for (const component of ['web', 'api']) {
    const file = `${component}.tar.gz`;
    await writeFile(path.join(directory, file), component);
    components[component] = { file, sha256: await sha256(path.join(directory, file)), bytes: component.length };
  }
  const manifest = {
    schemaVersion: 1, source: { sha: commit }, channel: 'candidate',
    target: { platform: 'linux', arch: 'x64', node: '26.13.0' },
    checks: { typecheck: 'passed', build: 'passed', runtimeSmoke: 'passed' }, components,
  };
  await writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
  return { directory, manifest, digest: await sha256(path.join(directory, 'manifest.json')) };
}

afterEach(async () => {
  for (const directory of directories.splice(0)) {
    // Delete only a directory allocated by this test, under the intended temp prefix.
    if (path.dirname(directory) !== os.tmpdir() || !path.basename(directory).startsWith('povod-integrity-')) throw new Error('Unsafe test cleanup');
    await rm(directory, { recursive: true, force: true });
  }
});

describe('trusted bundle verification', () => {
  it('accepts complete matching bytes and the expected source', async () => {
    const f = await fixture();
    await expect(verifyBundle(f.directory, commit, f.digest)).resolves.toMatchObject({ source: { sha: commit } });
  });
  it('rejects a changed archive even with unchanged length', async () => {
    const f = await fixture();
    await writeFile(path.join(f.directory, 'web.tar.gz'), 'bad');
    await expect(verifyBundle(f.directory, commit, f.digest)).rejects.toThrow('web digest mismatch');
  });
  it('rejects a forged manifest before trusting its own hashes', async () => {
    const f = await fixture();
    await writeFile(path.join(f.directory, 'manifest.json'), '{}');
    await expect(verifyBundle(f.directory, commit, f.digest)).rejects.toThrow('Manifest digest mismatch');
  });
  it('rejects the wrong commit', async () => {
    const f = await fixture();
    await expect(verifyBundle(f.directory, 'b'.repeat(40), f.digest)).rejects.toThrow('Source SHA mismatch');
  });
  it('rejects traversal and missing successful checks even with a trusted digest', async () => {
    const f = await fixture();
    f.manifest.components.web.file = '../outside.tar.gz';
    await writeFile(path.join(f.directory, 'manifest.json'), JSON.stringify(f.manifest));
    await expect(verifyBundle(f.directory, commit, await sha256(path.join(f.directory, 'manifest.json')))).rejects.toThrow('Invalid component descriptor');
    f.manifest.checks.runtimeSmoke = 'pending';
    await writeFile(path.join(f.directory, 'manifest.json'), JSON.stringify(f.manifest));
    await expect(verifyBundle(f.directory, commit, await sha256(path.join(f.directory, 'manifest.json')))).rejects.toThrow('Bundle checks did not pass');
  });
  it('requires an explicit opt-in to inspect preview artifacts', async () => {
    const f = await fixture();
    const manifest = JSON.parse(await readFile(path.join(f.directory, 'manifest.json'), 'utf8'));
    manifest.channel = 'preview';
    await writeFile(path.join(f.directory, 'manifest.json'), JSON.stringify(manifest));
    const digest = await sha256(path.join(f.directory, 'manifest.json'));
    await expect(verifyBundle(f.directory, commit, digest)).rejects.toThrow('Preview bundle cannot be promoted');
    await expect(verifyBundle(f.directory, commit, digest, { allowPreview: true })).resolves.toMatchObject({ channel: 'preview' });
  });
  it('rejects environment files in a staged runtime', async () => {
    const f = await fixture();
    const runtime = path.join(f.directory, 'runtime');
    await mkdir(runtime);
    await writeFile(path.join(runtime, '.env.local'), 'synthetic-only');
    await expect(checkRuntimeFiles(runtime)).rejects.toThrow('Environment file in runtime');
  });
  it('rejects a runtime directory link escaping its component', async () => {
    const f = await fixture();
    const runtime = path.join(f.directory, 'runtime');
    const outside = path.join(f.directory, 'outside');
    await mkdir(runtime); await mkdir(outside);
    await symlink(outside, path.join(runtime, 'escape'), 'junction');
    await expect(checkRuntimeFiles(runtime)).rejects.toThrow('Runtime symlink escapes its component');
  });
});
