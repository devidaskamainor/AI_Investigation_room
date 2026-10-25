import { z } from 'zod';

const minimumMix = {
  message: 2,
  image: 2,
  cctv: 1,
  document: 1,
  witness_statement: 1,
  timeline: 1,
};

// Named, required slots make category counts part of the decoding structure.
// The model still writes all evidence metadata and its links to the fixed facts.
export function evidenceContract(schema, input) {
  const profile = input.profile;
  const previous = input.previous?.items || [];
  const count = Math.min(profile.max, Math.max(profile.min, previous.length));
  const used = new Set();
  const slots = [];
  for (const item of previous.slice(0, count)) {
    if (used.has(item.id)) continue;
    slots.push({ id: item.id, category: item.category });
    used.add(item.id);
  }
  for (let number = 1; slots.length < count; number++) {
    const id = `E${number}`;
    if (used.has(id)) continue;
    slots.push({ id, category: 'document' });
    used.add(id);
  }
  const counts = {};
  for (const slot of slots) counts[slot.category] = (counts[slot.category] || 0) + 1;
  for (const [category, needed] of Object.entries(minimumMix)) {
    while ((counts[category] || 0) < needed) {
      const slot = slots.find((slot) => counts[slot.category] > (minimumMix[slot.category] || 0));
      counts[slot.category]--;
      slot.category = category;
      counts[category] = (counts[category] || 0) + 1;
    }
  }
  const itemSchema = schema.shape.items.element;
  return {
    schema: schema.extend({
      items: z
        .object(
          Object.fromEntries(
            slots.map(({ id, category }) => [
              id,
              itemSchema.extend({ id: z.literal(id), category: z.literal(category) }),
            ]),
          ),
        )
        .strict(),
    }),
    decode: (value) => ({ ...value, items: slots.map(({ id }) => value.items[id]) }),
  };
}
