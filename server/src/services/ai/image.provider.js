import { GeminiImageProvider } from './gemini.provider.js';
import { CloudflareImageProvider } from './cloudflare.provider.js';

export function imageProvider(env) {
  if (env.IMAGE_PROVIDER === 'cloudflare') return new CloudflareImageProvider(env);
  if (env.IMAGE_PROVIDER === 'gemini') return new GeminiImageProvider(env);
  throw new Error('Configuration error: IMAGE_PROVIDER is unsupported');
}
