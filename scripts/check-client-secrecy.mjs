import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
const forbidden = [
  'culpritSuspectId',
  'correctMotiveOptionId',
  'evidenceMap',
  'canonicalTimeline',
  'generationMeta',
  'GEMINI_API_KEY',
  'CLOUDFLARE_API_TOKEN',
  'SESSION_SECRET',
  'PASSWORD_RESET_TOKEN_SECRET',
  'ASSET_STORAGE_SECRET_KEY',
];
let checked = 0;
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await scan(path);
    else if (/\.(?:js|html|css|json|map)$/.test(entry.name)) {
      checked++;
      const source = await readFile(path, 'utf8');
      const found = forbidden.filter((key) => source.includes(key));
      if (found.length)
        throw new Error(
          `Client secrecy scan failed: ${entry.name} contains forbidden server fields: ${found.join(', ')}`,
        );
    }
  }
}
try {
  await scan('client/dist');
  console.info(`Client secrecy scan passed (${checked} built files).`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
