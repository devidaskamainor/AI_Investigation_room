import { GoogleGenAI } from '@google/genai';
import { readEnv } from '../server/src/config/env.js';
try {
  const env = readEnv();
  const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const pager = await client.models.list({ config: { pageSize: 100 } });
  const models = [];
  for await (const model of pager) {
    if (/^models\/gemini-[a-z0-9.-]+$/i.test(model.name || ''))
      models.push({ name: model.name.slice(7), actions: model.supportedActions || [] });
  }
  console.info(JSON.stringify({ models }, null, 2));
} catch (error) {
  const status = Number(error.status || error.code);
  console.error(
    JSON.stringify({
      error: 'MODEL_LIST_FAILED',
      ...(Number.isInteger(status) ? { httpStatus: status } : {}),
    }),
  );
  process.exitCode = 1;
}
