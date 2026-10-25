import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { testDatabase, testEnv } from '../../../test/database.js';
import { caseFixture } from '../../../test/fixtures/case.js';
import { MemoryStorageProvider, TEST_PNG } from '../../../test/fixtures/assets.js';
import { User, Mystery, MysterySolution, ensureIndexes } from '../../models/index.js';
import { demoCatalog, loadDemo, importDemo } from './demo.service.js';
describe('M8 validated showcase import', () => {
  let db, root, path, payload, user, storage;
  beforeAll(async () => {
    db = await testDatabase();
    await ensureIndexes();
    path = await mkdtemp(join(tmpdir(), 'mystery-demo-'));
    root = pathToFileURL(path + sep);
    const draft = caseFixture(),
      assets = [
        ...draft.suspects.suspects.map((s) => ({ key: `A${s.id}`, type: 'suspect_portrait' })),
        ...Object.values(draft.evidence).flatMap((e) =>
          e.assets.map((a) => ({ key: a.key, type: a.type })),
        ),
      ].map((a) => ({ ...a, mimeType: 'image/png', base64: TEST_PNG.toString('base64') }));
    payload = {
      version: 1,
      slug: 'test-case',
      provenance: {
        provider: 'gemini',
        model: 'simulated-provenance-for-unit-test',
        generatedAt: new Date().toISOString(),
        validator: true,
        blindSolver: true,
      },
      draft,
      assets,
    };
    await writeFile(
      new URL('manifest.json', root),
      JSON.stringify([
        {
          slug: 'test-case',
          title: 'Test-only showcase',
          difficulty: 'easy',
          suspectCount: 3,
          mysteryType: 'theft',
          scenario: 'A sculpture vanishes during a private gallery exhibition.',
        },
      ]),
    );
    await writeFile(new URL('test-case.json', root), JSON.stringify(payload));
    user = await User.create({
      name: 'Test detective',
      email: 'demo-test@example.test',
      passwordHash: 'test',
    });
    storage = new MemoryStorageProvider();
  });
  afterAll(async () => {
    await db?.close();
    if (root) {
      await unlink(new URL('test-case.json', root));
      await unlink(new URL('manifest.json', root));
      await rmdir(path);
    }
  });
  it('lists only valid available fixtures and rejects unrecognised paths', async () => {
    expect((await demoCatalog(root)).items).toHaveLength(1);
    await expect(loadDemo('../../secrets', root)).rejects.toMatchObject({ status: 404 });
  });
  it('imports with new case-scoped IDs, local images, private truth and demo label', async () => {
    const result = await importDemo(String(user._id), 'test-case', testEnv, storage, root),
      m = await Mystery.findById(result.mysteryId);
    expect(result.status).toBe('ready');
    expect(m.isDemo).toBe(true);
    expect(m.evidenceIds).toHaveLength(8);
    expect(storage.files.size).toBe(8);
    expect((await MysterySolution.findOne({ mysteryId: m._id })).frozenAt).toBeTruthy();
  });
  it('does not advertise malformed assets or accept fake provenance', async () => {
    await writeFile(
      new URL('test-case.json', root),
      JSON.stringify({ ...payload, provenance: { ...payload.provenance, provider: 'mock' } }),
    );
    expect((await demoCatalog(root)).items).toHaveLength(0);
    await expect(
      importDemo(String(user._id), 'test-case', testEnv, storage, root),
    ).rejects.toMatchObject({ code: 'DEMO_UNAVAILABLE' });
    await writeFile(
      new URL('test-case.json', root),
      JSON.stringify({
        ...payload,
        assets: payload.assets.map((a, i) =>
          i === 0 ? { ...a, base64: Buffer.from('not an image').toString('base64') } : a,
        ),
      }),
    );
    await expect(loadDemo('test-case', root)).rejects.toThrow('Invalid showcase assets');
  });
});
