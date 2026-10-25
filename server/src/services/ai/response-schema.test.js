import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { responseContract } from './response-schema.js';
import {
  planSchema,
  suspectsSchema,
  evidencePlanSchema,
  evidenceWriteSchema,
  reviewSchema,
  solverSchema,
  explanationSchema,
} from '../../validators/generation.js';
import { GeminiProvider, classify } from './gemini.provider.js';
import { testEnv } from '../../../test/database.js';
describe('Gemini response contract compatibility', () => {
  it('keeps response structure while enforcing detailed constraints locally', () => {
    const schema = z
      .object({
        items: z
          .array(
            z
              .object({
                code: z
                  .string()
                  .regex(/^S\d+$/)
                  .min(2)
                  .max(8),
                type: z.enum(['clue', 'context']),
              })
              .strict(),
          )
          .min(3)
          .max(6),
      })
      .strict();
    const contract = responseContract(schema);
    expect(contract.schema).toEqual({
      type: 'object',
      required: ['items'],
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            required: ['code', 'type'],
            properties: {
              code: { type: 'string' },
              type: { type: 'string', enum: ['clue', 'context'] },
            },
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    });
    expect(contract.instructions).toContain('"minItems":3');
    const complete = JSON.parse(
      contract.instructions.split('<output_contract>\n')[1].split('\n</output_contract>')[0],
    );
    expect(complete.properties.items.items.properties.code.pattern).toBe('^S\\d+$');
    expect(schema.safeParse({ items: [{ code: 'bad', type: 'clue' }] }).success).toBe(false);
  });
  it('retains nullable values and property names that resemble schema keywords', () => {
    const schema = z
      .object({
        minLength: z.string().min(2),
        value: z.string().nullable(),
        lookup: z.record(z.number().int().min(0)),
      })
      .strict();
    const result = responseContract(schema).schema;
    expect(result.properties.minLength).toEqual({ type: 'string' });
    expect(result.properties.value.type).toEqual(['string', 'null']);
    expect(result.properties.lookup.additionalProperties).toEqual({ type: 'integer' });
  });
  it('creates schemas for every pipeline stage without provider decoding bounds', () => {
    const schemas = [
      planSchema,
      suspectsSchema,
      evidencePlanSchema,
      reviewSchema,
      solverSchema,
      explanationSchema,
      ...['message', 'image', 'cctv', 'document', 'witness_statement', 'timeline', 'other'].map(
        evidenceWriteSchema,
      ),
    ];
    for (const schema of schemas) {
      const output = JSON.stringify(responseContract(schema).schema);
      expect(output).not.toMatch(
        /"(?:minItems|maxItems|minLength|maxLength|pattern|format|const)":/,
      );
      expect(JSON.parse(output).type).toBe('object');
    }
  });
  it('rejects a model response that meets the provider structure but violates Zod limits', async () => {
    const provider = new GeminiProvider(testEnv);
    let request;
    provider.client = {
      models: {
        generateContent: async (args) => {
          request = args;
          return { text: '{"value":"x"}' };
        },
      },
    };
    await expect(
      provider.generate(
        'mystery-planner',
        { scenario: 'A fictional test' },
        z.object({ value: z.string().min(10) }).strict(),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_AI_SCHEMA' });
    expect(request.config.responseJsonSchema.properties.value).toEqual({ type: 'string' });
    expect(request.config.systemInstruction).toContain('"minLength":10');
  });
  it.each([
    [400, 'PROVIDER_REQUEST_REJECTED'],
    [401, 'PROVIDER_AUTH_ERROR'],
    [403, 'PROVIDER_AUTH_ERROR'],
    [404, 'PROVIDER_MODEL_UNAVAILABLE'],
    [429, 'PROVIDER_RATE_LIMIT'],
  ])('maps HTTP %i to a safe error code', (status, code) =>
    expect(classify({ status, message: 'private provider details' }).code).toBe(code),
  );
});
