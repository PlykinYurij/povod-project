import { verifyBundle } from './integrity.mjs';

const [directory, sha, digest, ...options] = process.argv.slice(2);
if (!directory || options.some(option => option !== '--allow-preview')) {
  console.error('Usage: npm run artifact:verify -- <directory> <commit-sha> <trusted-manifest-sha256> [--allow-preview]');
  process.exitCode = 1;
} else {
  verifyBundle(directory, sha, digest, { allowPreview: options.includes('--allow-preview') })
    .then(manifest => console.log(JSON.stringify({ verified: true, sha: manifest.source.sha, target: manifest.target, channel: manifest.channel }, null, 2)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
