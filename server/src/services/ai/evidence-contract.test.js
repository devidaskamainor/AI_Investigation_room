import { describe, expect, it, vi } from 'vitest';
import { evidenceContract } from './evidence-contract.js';
import { evidencePlanSchema } from '../../validators/generation.js';
import { PROFILES } from '../../../../shared/constants/index.js';
import { caseFixture } from '../../../test/fixtures/case.js';
import { GeminiProvider } from './gemini.provider.js';
import { testEnv } from '../../../test/database.js';

describe('required evidence slots', () => {
  it.each(['easy', 'medium', 'hard'])('requires the full evidence mix for %s', (difficulty) => {
    const contract = evidenceContract(evidencePlanSchema, { profile: PROFILES[difficulty] });
    const slots = contract.schema.shape.items.shape;
    expect(Object.keys(slots)).toHaveLength(PROFILES[difficulty].min);
    const counts = {};
    for (const slot of Object.values(slots)) {
      const category = slot.shape.category.value;
      counts[category] = (counts[category] || 0) + 1;
    }
    expect(counts).toMatchObject({
      message: 2,
      image: 2,
      cctv: 1,
      witness_statement: 1,
      timeline: 1,
    });
    expect(counts.document).toBeGreaterThanOrEqual(1);
  });

  it('preserves a valid existing layout and its IDs', () => {
    const previous = caseFixture().evidencePlan;
    const contract = evidenceContract(evidencePlanSchema, { profile: PROFILES.easy, previous });
    const wire = {
      ...previous,
      items: Object.fromEntries(previous.items.map((item) => [item.id, item])),
    };
    expect(contract.schema.safeParse(wire).success).toBe(true);
    expect(contract.decode(wire)).toEqual(previous);
  });

  it('corrects a missing category by assigning only an excess slot', () => {
    const previous = caseFixture().evidencePlan;
    previous.items[2].category = 'cctv';
    const contract = evidenceContract(evidencePlanSchema, { profile: PROFILES.easy, previous });
    const slots = contract.schema.shape.items.shape;
    expect(slots.E1.shape.category.value).toBe('message');
    expect(slots.E2.shape.category.value).toBe('message');
    expect(slots.E3.shape.category.value).toBe('image');
    expect(slots.E5.shape.category.value).toBe('cctv');
  });

  it('normalizes the provider response to the existing array contract and enforces literals', async () => {
    const fixture = caseFixture();
    const wire = {
      ...fixture.evidencePlan,
      items: Object.fromEntries(fixture.evidencePlan.items.map((item) => [item.id, item])),
    };
    const provider = new GeminiProvider(testEnv);
    const generateContent = vi.fn(async () => ({ text: JSON.stringify(wire) }));
    provider.client = { models: { generateContent } };
    const result = await provider.generate(
      'evidence-planner',
      {
        profile: PROFILES.easy,
        previous: fixture.evidencePlan,
      },
      evidencePlanSchema,
    );
    expect(result).toEqual(fixture.evidencePlan);
    const itemSchema = generateContent.mock.calls[0][0].config.responseJsonSchema.properties.items;
    expect(itemSchema.type).toBe('object');
    expect(itemSchema.properties.E3.properties.category.enum).toEqual(['image']);
    wire.items.E3.category = 'cctv';
    await expect(
      provider.generate(
        'evidence-planner',
        {
          profile: PROFILES.easy,
          previous: fixture.evidencePlan,
        },
        evidencePlanSchema,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_AI_SCHEMA' });
  });
});
