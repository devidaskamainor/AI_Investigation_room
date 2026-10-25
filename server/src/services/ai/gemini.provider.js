import { GoogleGenAI } from '@google/genai';
import { readFile } from 'node:fs/promises';
import { ProviderError, withRetry, deadline, classify } from './retry.js';
import { responseContract } from './response-schema.js';
import { evidenceContract } from './evidence-contract.js';
export { classify } from './retry.js';
export const PROMPT_VERSION = '1.0.0';
const safetySettings = [
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  'HARM_CATEGORY_DANGEROUS_CONTENT',
].map((category) => ({ category, threshold: 'BLOCK_MEDIUM_AND_ABOVE' }));
export class GeminiProvider {
  constructor(env, { onUsage = () => {}, onRetry = () => {} } = {}) {
    this.env = env;
    this.client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    this.onUsage = onUsage;
    this.onRetry = onRetry;
  }
  async generate(stage, input, schema) {
    const prompt = await readFile(
      new URL(`../../prompts/${stage}.prompt.md`, import.meta.url),
      'utf8',
    );
    return withRetry(
      async () => {
        try {
          const format =
            stage === 'evidence-planner'
              ? evidenceContract(schema, input)
              : { schema, decode: (value) => value };
          const contract = responseContract(format.schema);
          const response = await deadline(
            (signal) =>
              this.client.models.generateContent({
                model: this.env.GEMINI_MODEL,
                contents: `<stage_input>\n${JSON.stringify(input)}\n</stage_input>`,
                config: {
                  systemInstruction: `${prompt}\n\n${contract.instructions}${
                    this.env.IMAGE_PROVIDER === 'cloudflare'
                      ? '\nFor the configured image service, keep styleGuide within 300 characters and each portraitPrompt or asset prompt within 1500 characters. Include every visible clue in the individual image prompt.'
                      : ''
                  }`,
                  responseMimeType: 'application/json',
                  responseJsonSchema: contract.schema,
                  safetySettings,
                  abortSignal: signal,
                  temperature: 0.65,
                },
              }),
            this.env.GEMINI_TIMEOUT_MS,
          );
          if (
            response.promptFeedback?.blockReason ||
            response.candidates?.some((c) => c.finishReason === 'SAFETY')
          )
            throw new ProviderError('SAFETY_BLOCK');
          await this.onUsage(stage, response.usageMetadata?.totalTokenCount || 0);
          let parsed;
          try {
            parsed = JSON.parse(response.text);
          } catch {
            throw new ProviderError('INVALID_AI_JSON');
          }
          const wireResult = format.schema.safeParse(parsed);
          if (!wireResult.success) throw new ProviderError('INVALID_AI_SCHEMA');
          const result = schema.safeParse(format.decode(wireResult.data));
          if (!result.success) throw new ProviderError('INVALID_AI_SCHEMA');
          return result.data;
        } catch (e) {
          throw classify(e);
        }
      },
      { attempts: this.env.GEMINI_MAX_RETRIES, onRetry: this.onRetry },
    );
  }
}
export class GeminiImageProvider {
  constructor(env) {
    this.env = env;
    this.client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }
  async generate(prompt) {
    return withRetry(
      async () => {
        try {
          const response = await deadline(
            (signal) =>
              this.client.models.generateContent({
                model: this.env.GEMINI_IMAGE_MODEL,
                contents: prompt,
                config: {
                  responseModalities: ['TEXT', 'IMAGE'],
                  safetySettings,
                  abortSignal: signal,
                },
              }),
            this.env.IMAGE_TIMEOUT_MS,
          );
          const parts = response.candidates?.flatMap((c) => c.content?.parts || []) || [];
          const data = parts.find((p) => p.inlineData?.data)?.inlineData;
          if (!data || !['image/png', 'image/jpeg', 'image/webp'].includes(data.mimeType))
            throw new ProviderError('IMAGE_FAILED');
          return { buffer: Buffer.from(data.data, 'base64'), mimeType: data.mimeType };
        } catch (e) {
          throw classify(e);
        }
      },
      { attempts: 3 },
    );
  }
}
