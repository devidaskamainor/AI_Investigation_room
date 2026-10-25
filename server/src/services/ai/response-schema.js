import { zodToJsonSchema } from 'zod-to-json-schema';

// Keep the provider's decoding schema small. The full contract is still supplied
// as instructions and enforced locally with Zod before anything can be saved.
export function providerSchema(schema) {
  const result = {};
  for (const key of ['type', 'description', 'enum', 'required']) {
    if (schema[key] !== undefined) result[key] = schema[key];
  }
  if (typeof schema.const === 'string') result.enum = [schema.const];
  if (schema.properties)
    result.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([name, value]) => [name, providerSchema(value)]),
    );
  if (schema.items) result.items = providerSchema(schema.items);
  if (schema.anyOf) result.anyOf = schema.anyOf.map(providerSchema);
  if (schema.additionalProperties !== undefined)
    result.additionalProperties =
      typeof schema.additionalProperties === 'boolean'
        ? schema.additionalProperties
        : providerSchema(schema.additionalProperties);
  return result;
}

export function responseContract(schema) {
  const contract = zodToJsonSchema(schema, { $refStrategy: 'none' });
  delete contract.$schema;
  return {
    schema: providerSchema(contract),
    instructions: `Follow this complete output contract, including its counts, lengths, formats, patterns and literal values. The server validates every constraint:\n<output_contract>\n${JSON.stringify(contract)}\n</output_contract>`,
  };
}
