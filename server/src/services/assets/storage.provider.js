import { mkdir, writeFile, rename, readFile, unlink, stat } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
const validKey = (key) => {
  if (!/^[a-f\d]{24}\/[a-f\d]{24}\.(?:png|jpg|webp)$/.test(key))
    throw new Error('Invalid asset storage key');
  return key;
};
export class LocalStorageProvider {
  constructor(root) {
    this.root = resolve(root);
  }
  path(key) {
    const target = resolve(this.root, validKey(key));
    if (!target.startsWith(this.root + sep)) throw new Error('Invalid asset path');
    return target;
  }
  async put(key, buffer) {
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporary, buffer);
    await rename(temporary, path);
  }
  async get(key) {
    return readFile(this.path(key));
  }
  async exists(key) {
    try {
      return (await stat(this.path(key))).isFile();
    } catch {
      return false;
    }
  }
  async delete(key) {
    try {
      await unlink(this.path(key));
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
}
export class S3StorageProvider {
  constructor(env) {
    this.bucket = env.ASSET_STORAGE_BUCKET;
    this.client = new S3Client({
      region: env.ASSET_STORAGE_REGION,
      endpoint: env.ASSET_STORAGE_ENDPOINT || undefined,
      forcePathStyle: Boolean(env.ASSET_STORAGE_ENDPOINT),
      credentials: {
        accessKeyId: env.ASSET_STORAGE_ACCESS_KEY,
        secretAccessKey: env.ASSET_STORAGE_SECRET_KEY,
      },
    });
  }
  async put(key, buffer, mimeType) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: validKey(key),
        Body: buffer,
        ContentType: mimeType,
      }),
    );
  }
  async get(key) {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: validKey(key) }),
    );
    return Buffer.from(await response.Body.transformToByteArray());
  }
  async exists(key) {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: validKey(key) }));
      return true;
    } catch (e) {
      if (e.$metadata?.httpStatusCode === 404) return false;
      throw e;
    }
  }
  async delete(key) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: validKey(key) }));
  }
}
export function storageProvider(env) {
  return env.ASSET_STORAGE_PROVIDER === 's3'
    ? new S3StorageProvider(env)
    : new LocalStorageProvider(env.ASSET_STORAGE_DIR);
}
