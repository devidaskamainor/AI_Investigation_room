import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { logicalId } from '../../validators/generation.js';
import { Mystery, MysterySolution, GenerationJob, Asset, User } from '../../models/index.js';
import { createMystery } from './creation.service.js';
import { validateCase } from './mysteryValidator.js';
import { stableId, publishCase } from '../generation/publish.js';
import { validImage, deleteMystery } from '../assets/assets.service.js';
import { AppError, missing } from '../../middleware/errors.js';
const directory = new URL('../../../../fixtures/demo-cases/', import.meta.url);
const fixtureSchema = z
  .object({
    version: z.literal(1),
    slug: z.string(),
    provenance: z
      .object({
        provider: z.literal('gemini'),
        model: z.string().min(1),
        generatedAt: z.string().datetime(),
        validator: z.literal(true),
        blindSolver: z.literal(true),
      })
      .strict(),
    draft: z.record(z.unknown()),
    assets: z
      .array(
        z
          .object({
            key: logicalId,
            type: z.enum([
              'suspect_portrait',
              'scene_image',
              'cctv_frame',
              'document_image',
              'other',
            ]),
            mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
            base64: z.string().min(1),
          })
          .strict(),
      )
      .min(8)
      .max(100),
  })
  .strict();
export async function demoManifest(root = directory) {
  return JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
}
export async function loadDemo(slug, root = directory) {
  const manifest = await demoManifest(root),
    entry = manifest.find((c) => c.slug === slug);
  if (!entry) throw missing();
  const fixture = fixtureSchema.parse(
    JSON.parse(await readFile(new URL(`${entry.slug}.json`, root), 'utf8')),
  );
  if (
    fixture.slug !== entry.slug ||
    !validateCase(fixture.draft, { difficulty: entry.difficulty, suspectCount: entry.suspectCount })
      .pass
  )
    throw new Error('Invalid showcase case');
  if (
    new Set(fixture.assets.map((a) => a.key)).size !== fixture.assets.length ||
    fixture.assets.some((a) => !validImage(Buffer.from(a.base64, 'base64'), a.mimeType))
  )
    throw new Error('Invalid showcase assets');
  return { entry, fixture };
}
export async function demoCatalog(root = directory) {
  const items = [];
  for (const entry of await demoManifest(root)) {
    try {
      await loadDemo(entry.slug, root);
      items.push({
        slug: entry.slug,
        title: entry.title,
        difficulty: entry.difficulty,
        suspectCount: entry.suspectCount,
      });
    } catch {
      /* Missing or invalid fixtures are not advertised. */
    }
  }
  return { items };
}
export async function importDemo(userId, slug, env, storage, root = directory) {
  let payload;
  try {
    payload = await loadDemo(slug, root);
  } catch (e) {
    if (e.status === 404) throw e;
    throw new AppError(
      503,
      'DEMO_UNAVAILABLE',
      'This showcase case has not been generated or is unavailable.',
    );
  }
  const { entry, fixture } = payload,
    worker = `demo-${randomUUID()}`,
    created = await createMystery(userId, { ...entry, title: entry.title }, randomUUID(), env, {
      initialStatus: 'publishing',
      lockedBy: worker,
    });
  try {
    const mystery = await Mystery.findById(created.mysteryId),
      draft = structuredClone(fixture.draft);
    draft.assets = {};
    const guard = async () => {
      if (
        !(await Mystery.exists({
          _id: mystery._id,
          ownerId: userId,
          status: { $in: ['generating', 'validating'] },
        }))
      )
        throw missing();
    };
    for (const asset of fixture.assets) {
      const id = stableId(mystery._id, 'asset', asset.key),
        ext =
          asset.mimeType === 'image/png' ? 'png' : asset.mimeType === 'image/jpeg' ? 'jpg' : 'webp',
        key = `${mystery._id}/${id}.${ext}`,
        buffer = Buffer.from(asset.base64, 'base64');
      await Asset.create({
        _id: id,
        mysteryId: mystery._id,
        type: asset.type,
        storageKey: key,
        mimeType: asset.mimeType,
        sizeBytes: buffer.length,
        generationStatus: 'pending',
      });
      await storage.put(key, buffer, asset.mimeType);
      await Asset.updateOne({ _id: id }, { $set: { generationStatus: 'ready' } });
      draft.assets[asset.key] = id;
    }
    if (
      !validateCase(
        draft,
        { difficulty: entry.difficulty, suspectCount: entry.suspectCount },
        { requireAssets: true },
      ).pass
    )
      throw new Error('Incomplete demo');
    await MysterySolution.create({
      mysteryId: mystery._id,
      generationMeta: {
        model: fixture.provenance.model,
        provenance: fixture.provenance,
        checkpoints: draft,
      },
    });
    await publishCase(mystery, draft, guard);
    await Mystery.updateOne({ _id: mystery._id }, { $set: { isDemo: true } });
    await GenerationJob.updateOne(
      { _id: created.jobId },
      {
        $set: {
          status: 'completed',
          currentStage: 'Complete',
          progressPercentage: 100,
          completedAt: new Date(),
        },
        $unset: { lockedBy: 1, lockedUntil: 1 },
      },
    );
    await User.updateOne(
      { _id: userId, activeGenerationId: created.jobId },
      { $unset: { activeGenerationId: 1 } },
    );
    return { ...created, status: 'ready' };
  } catch {
    await deleteMystery(userId, created.mysteryId, storage);
    throw new AppError(
      503,
      'DEMO_UNAVAILABLE',
      'The showcase case could not be imported. Please try again.',
    );
  }
}
export const demoDirectoryPath = join(process.cwd(), 'fixtures', 'demo-cases');
