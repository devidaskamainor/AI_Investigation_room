import { describe, it, expect } from 'vitest';
import { S3StorageProvider, storageProvider, LocalStorageProvider } from './storage.provider.js';
import { TEST_PNG } from '../../../test/fixtures/assets.js';
describe('M5 swappable S3 adapter', () => {
  const env = {
      ASSET_STORAGE_PROVIDER: 's3',
      ASSET_STORAGE_REGION: 'us-east-1',
      ASSET_STORAGE_BUCKET: 'test-private-bucket',
      ASSET_STORAGE_ENDPOINT: 'https://storage.example.test',
      ASSET_STORAGE_ACCESS_KEY: 'test-only',
      ASSET_STORAGE_SECRET_KEY: 'test-only',
    },
    key = '111111111111111111111111/222222222222222222222222.png';
  it('keeps image operations private and scoped to validated keys', async () => {
    const storage = new S3StorageProvider(env),
      calls = [];
    storage.client = {
      send: async (command) => {
        calls.push(command);
        return command.constructor.name === 'GetObjectCommand'
          ? { Body: { transformToByteArray: async () => TEST_PNG } }
          : {};
      },
    };
    await storage.put(key, TEST_PNG, 'image/png');
    expect(await storage.get(key)).toEqual(TEST_PNG);
    expect(await storage.exists(key)).toBe(true);
    await storage.delete(key);
    expect(calls.map((c) => c.constructor.name)).toEqual([
      'PutObjectCommand',
      'GetObjectCommand',
      'HeadObjectCommand',
      'DeleteObjectCommand',
    ]);
    expect(
      calls.every((c) => c.input.Bucket === 'test-private-bucket' && c.input.Key === key),
    ).toBe(true);
    expect(calls[0].input).not.toHaveProperty('ACL');
    await expect(storage.get('../escape')).rejects.toThrow('Invalid asset storage key');
  });
  it('distinguishes a missing asset from an unavailable bucket', async () => {
    const storage = new S3StorageProvider(env);
    storage.client = {
      send: async () => {
        throw { $metadata: { httpStatusCode: 404 } };
      },
    };
    expect(await storage.exists(key)).toBe(false);
    storage.client = {
      send: async () => {
        throw new Error('Unavailable');
      },
    };
    await expect(storage.exists(key)).rejects.toThrow('Unavailable');
  });
  it('selects local storage by configuration', () => {
    expect(
      storageProvider({
        ...env,
        ASSET_STORAGE_PROVIDER: 'local',
        ASSET_STORAGE_DIR: '.runtime/assets',
      }),
    ).toBeInstanceOf(LocalStorageProvider);
    expect(storageProvider(env)).toBeInstanceOf(S3StorageProvider);
  });
});
