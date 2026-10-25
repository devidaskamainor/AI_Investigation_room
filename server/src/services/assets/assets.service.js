import pLimit from 'p-limit';
import {
  Asset,
  Mystery,
  MysterySolution,
  Suspect,
  Evidence,
  InvestigationProgress,
  GenerationJob,
  User,
} from '../../models/index.js';
import { ProviderError } from '../ai/retry.js';
import { stableId } from '../generation/publish.js';
import { ownedMystery } from '../../middleware/security.js';
import { missing } from '../../middleware/errors.js';
import { validImage } from './image.js';
export { validImage } from './image.js';
export function assetGenerator(env, imageProvider, storage) {
  return async (mystery, draft, assertLease) => {
    const requests = [
        ...draft.suspects.suspects.map((s) => ({
          key: `A${s.id}`,
          type: 'suspect_portrait',
          prompt: s.portraitPrompt,
        })),
        ...draft.evidencePlan.items.flatMap((e) => draft.evidence[e.id].assets),
      ],
      limit = pLimit(env.IMAGE_CONCURRENCY),
      map = {};
    if (new Set(requests.map((a) => a.key)).size !== requests.length)
      throw new ProviderError('ASSET_FAILED');
    await Promise.all(
      requests.map((a) =>
        limit(async () => {
          await assertLease();
          const assetId = stableId(mystery._id, 'asset', a.key),
            existing = await Asset.findOne({
              _id: assetId,
              mysteryId: mystery._id,
              generationStatus: 'ready',
            });
          const promptDigest = stableId(
            mystery._id,
            'prompt',
            `${a.prompt}:${draft.plan.styleGuide}`,
          );
          if (
            existing &&
            existing.metadata?.promptDigest === promptDigest &&
            (await storage.exists(existing.storageKey))
          ) {
            map[a.key] = String(existing._id);
            return;
          }
          let uploadedKey;
          try {
            const { buffer, mimeType } = await imageProvider.generate(
              `${draft.plan.styleGuide}\n${a.prompt}\nFictional reconstruction; no text, typography, timestamps, brands, logos, real people or graphic content.`,
            );
            if (!validImage(buffer, mimeType)) throw new ProviderError('ASSET_FAILED');
            await assertLease();
            const extension =
                mimeType === 'image/png' ? 'png' : mimeType === 'image/jpeg' ? 'jpg' : 'webp',
              key = `${mystery._id}/${assetId}.${extension}`;
            uploadedKey = key;
            await storage.put(key, buffer, mimeType);
            await assertLease();
            await Asset.updateOne(
              { _id: assetId },
              {
                $set: {
                  mysteryId: mystery._id,
                  type: a.type,
                  storageKey: key,
                  mimeType,
                  sizeBytes: buffer.length,
                  generationStatus: 'ready',
                  label: 'AI-generated fiction',
                  metadata: { promptDigest },
                },
              },
              { upsert: true },
            );
            await assertLease();
            if (existing?.storageKey && existing.storageKey !== key)
              await storage.delete(existing.storageKey);
            map[a.key] = assetId;
          } catch (error) {
            if (error.code === 'CASE_DELETED') {
              if (uploadedKey) await storage.delete(uploadedKey);
              await Asset.deleteOne({ _id: assetId });
            }
            if (['LEASE_LOST', 'CASE_DELETED'].includes(error.code)) throw error;
            if (error.code === 'PROVIDER_RATE_LIMIT')
              throw new ProviderError('ASSET_QUOTA_EXCEEDED');
            if (
              [
                'PROVIDER_AUTH_ERROR',
                'PROVIDER_MODEL_UNAVAILABLE',
                'PROVIDER_REQUEST_REJECTED',
                'PROVIDER_TIMEOUT',
              ].includes(error.code)
            )
              throw error;
            throw new ProviderError('ASSET_FAILED');
          }
        }),
      ),
    );
    for (const id of Object.values(map)) {
      const asset = await Asset.findOne({
        _id: id,
        mysteryId: mystery._id,
        generationStatus: 'ready',
      });
      if (!asset || !(await storage.exists(asset.storageKey)))
        throw new ProviderError('ASSET_FAILED');
    }
    await assertLease();
    const unused = await Asset.find({
      mysteryId: mystery._id,
      _id: { $nin: Object.values(map) },
    }).select('storageKey');
    for (const asset of unused) {
      await storage.delete(asset.storageKey);
      await Asset.deleteOne({ _id: asset._id, mysteryId: mystery._id });
    }
    return map;
  };
}
export async function readAsset(userId, assetId, storage) {
  const asset = await Asset.findById(assetId);
  if (!asset) throw missing();
  await ownedMystery(userId, String(asset.mysteryId), true);
  if (asset.generationStatus !== 'ready') throw missing();
  let buffer;
  try {
    buffer = await storage.get(asset.storageKey);
  } catch {
    throw missing();
  }
  return { buffer, mimeType: asset.mimeType };
}
export async function cleanupMystery(mysteryId, storage) {
  const assets = await Asset.find({ mysteryId }).select('storageKey');
  for (const asset of assets) await storage.delete(asset.storageKey);
  await Promise.all(
    [Suspect, Evidence, MysterySolution, InvestigationProgress, GenerationJob, Asset].map((m) =>
      m.deleteMany({ mysteryId }),
    ),
  );
}
export async function deleteMystery(userId, mysteryId, storage) {
  await ownedMystery(userId, mysteryId);
  const jobIds = await GenerationJob.distinct('_id', { mysteryId, ownerId: userId });
  await Mystery.updateOne({ _id: mysteryId, ownerId: userId }, { $set: { status: 'archived' } });
  await GenerationJob.updateMany(
    { mysteryId, ownerId: userId },
    { $set: { status: 'failed', lockedUntil: new Date(0) }, $unset: { lockedBy: 1 } },
  );
  await cleanupMystery(mysteryId, storage);
  await Mystery.deleteOne({ _id: mysteryId, ownerId: userId });
  await User.updateOne(
    { _id: userId, activeGenerationId: { $in: jobIds } },
    { $unset: { activeGenerationId: 1 } },
  );
}
