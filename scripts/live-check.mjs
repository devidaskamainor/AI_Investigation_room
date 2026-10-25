import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { readEnv } from '../server/src/config/env.js';
import { imageProvider } from '../server/src/services/ai/image.provider.js';
import { validImage } from '../server/src/services/assets/assets.service.js';
let stage = 'configuration';
let textPassed = false;
try {
  const env = readEnv(),
    client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  stage = 'text';
  const result = await client.models.generateContent({
    model: env.GEMINI_MODEL,
    contents: 'Return a JSON object with ok set to true. This is a connectivity check.',
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: {
        type: 'object',
        properties: { ok: { type: 'boolean' } },
        required: ['ok'],
        additionalProperties: false,
      },
      abortSignal: AbortSignal.timeout(env.GEMINI_TIMEOUT_MS),
    },
  });
  z.object({ ok: z.literal(true) })
    .strict()
    .parse(JSON.parse(result.text));
  textPassed = true;
  stage = 'image';
  const image = await imageProvider(env).generate(
    'A fictional empty gallery with a locked cabinet, clear cinematic photograph, no text, people, brands or logos.',
  );
  if (!validImage(image.buffer, image.mimeType)) throw new Error('IMAGE_CHECK_FAILED');
  console.info(
    JSON.stringify({
      text: 'passed',
      image: 'passed',
      textModel: env.GEMINI_MODEL,
      imageProvider: env.IMAGE_PROVIDER,
      imageModel:
        env.IMAGE_PROVIDER === 'cloudflare' ? env.CLOUDFLARE_IMAGE_MODEL : env.GEMINI_IMAGE_MODEL,
    }),
  );
} catch (e) {
  if (e.message.startsWith('Configuration error')) console.error(e.message);
  else {
    const status = Number(e.status || e.code),
      message = String(e.message || ''),
      networkCode = String(e.cause?.code || e.code || '');
    const patterns = [
      ['KEY_INVALID', /API_KEY_INVALID|API key not valid/i],
      ['KEY_REVOKED', /key.*(?:leaked|revoked)/i],
      ['KEY_RESTRICTED', /API_KEY_(?:SERVICE|HTTP_REFERRER|IP_ADDRESS)_BLOCKED/i],
      ['API_DISABLED', /SERVICE_DISABLED|API has not been used/i],
      ['QUOTA_EXCEEDED', /quota|RESOURCE_EXHAUSTED|PROVIDER_RATE_LIMIT/i],
      ['BILLING_REQUIRED', /billing/i],
      ['MODEL_UNAVAILABLE', /not found|not supported|NOT_FOUND/i],
      ['TLS_CERTIFICATE_ERROR', /certificate|CERT_|UNABLE_TO_VERIFY/i],
      ['NETWORK_ERROR', /fetch failed|network|ECONN|ENOTFOUND|EACCES/i],
      ['TIMEOUT', /timeout|timed out|AbortError|aborted|deadline/i],
    ];
    const reason =
      patterns.find(([, pattern]) =>
        pattern.test(message + ' ' + networkCode + ' ' + e.name),
      )?.[0] ||
      {
        400: 'INVALID_REQUEST',
        401: 'AUTHENTICATION_FAILED',
        403: 'ACCESS_DENIED',
        404: 'MODEL_UNAVAILABLE',
        429: 'QUOTA_EXCEEDED',
      }[status] ||
      'PROVIDER_ERROR';
    console.error(
      JSON.stringify({
        stage,
        text: textPassed ? 'passed' : 'failed',
        image: stage === 'image' ? 'failed' : 'not_run',
        ...(Number.isInteger(status) && status >= 100 && status <= 599
          ? { httpStatus: status }
          : {}),
        reason,
      }),
    );
  }
  process.exitCode = 1;
}
