import { writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export async function setupEnvironment(target = new URL('../.env', import.meta.url)) {
  const template = `NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://127.0.0.1:27017/ai-mystery-room
SESSION_SECRET=${randomBytes(48).toString('hex')}
PASSWORD_RESET_TOKEN_SECRET=${randomBytes(48).toString('hex')}
COOKIE_DOMAIN=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_TIMEOUT_MS=60000
GEMINI_MAX_RETRIES=3
REPAIR_MAX_CYCLES=2
SOLVER_CHECK_ENABLED=true
IMAGE_PROVIDER=gemini
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
# For Cloudflare images, fill these two values and set IMAGE_PROVIDER=cloudflare above.
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-1-schnell
IMAGE_CONCURRENCY=3
IMAGE_TIMEOUT_MS=90000
ASSET_STORAGE_PROVIDER=local
ASSET_STORAGE_DIR=./storage
ASSET_STORAGE_BUCKET=
ASSET_STORAGE_ACCESS_KEY=
ASSET_STORAGE_SECRET_KEY=
ASSET_STORAGE_REGION=us-east-1
ASSET_STORAGE_ENDPOINT=
DAILY_GENERATION_LIMIT=5
DEMO_MODE=false
VITE_API_URL=/api/v1
`;
  try {
    await writeFile(target, template, { flag: 'wx' });
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const created = await setupEnvironment();
  console.info(
    created
      ? 'Created .env with independent random session/reset secrets. Set GEMINI_API_KEY before starting the API and worker. MongoDB defaults to your local instance.'
      : 'An existing .env was preserved. Check its configuration before starting.',
  );
}
