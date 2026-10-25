import fs from 'node:fs';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { caseFixture } from '../../../test/fixtures/case.js';
import { Mystery, MysterySolution, Evidence, ensureIndexes } from '../../models/index.js';
import { publishCase, stableId } from './publish.js';
describe('AC-08 replica-set atomic publication', () => {
  let db;
  beforeAll(async () => {
    const systemBinary =
      process.env.MONGOMS_SYSTEM_BINARY ||
      (process.platform === 'win32' &&
      fs.existsSync('C:/Program Files/MongoDB/Server/8.2/bin/mongod.exe')
        ? 'C:/Program Files/MongoDB/Server/8.2/bin/mongod.exe'
        : undefined);
    db = await MongoMemoryReplSet.create({
      binary: systemBinary ? { systemBinary, checkMD5: false } : undefined,
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    await mongoose.connect(db.getUri());
    await ensureIndexes();
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await db?.stop();
  });
  async function draftCase() {
    const m = await Mystery.create({
        ownerId: new mongoose.Types.ObjectId(),
        title: 'Transaction test',
        status: 'generating',
      }),
      draft = caseFixture();
    draft.assets = Object.fromEntries(
      [
        ...draft.suspects.suspects.map((s) => `A${s.id}`),
        ...Object.values(draft.evidence).flatMap((e) => e.assets.map((a) => a.key)),
      ].map((key) => [key, stableId(m._id, 'asset', key)]),
    );
    await MysterySolution.create({ mysteryId: m._id });
    return { m, draft };
  }
  it('publishes records and the ready status in one successful transaction', async () => {
    const { m, draft } = await draftCase();
    await publishCase(m, draft, async () => {});
    expect((await Mystery.findById(m._id)).status).toBe('ready');
    expect(await Evidence.countDocuments({ mysteryId: m._id })).toBe(8);
  });
  it('rolls back records and the frozen solution if the lease is lost before ready', async () => {
    const { m, draft } = await draftCase();
    let checks = 0;
    await expect(
      publishCase(m, draft, async () => {
        if (++checks === 3) throw new Error('Simulated lease loss');
      }),
    ).rejects.toThrow('Simulated lease loss');
    expect((await Mystery.findById(m._id)).status).toBe('generating');
    expect(await Evidence.countDocuments({ mysteryId: m._id })).toBe(0);
    expect((await MysterySolution.findOne({ mysteryId: m._id })).frozenAt).toBeUndefined();
  });
});
