import { ok } from '../middleware/errors.js';
import { readAsset, deleteMystery } from '../services/assets/assets.service.js';
export function assetsController(storage) {
  return {
    read: async (req, res) => {
      const { buffer, mimeType } = await readAsset(req.userId, req.params.assetId, storage);
      res
        .set({
          'Content-Type': mimeType,
          'Cache-Control': 'private, max-age=3600',
          'X-Content-Type-Options': 'nosniff',
        })
        .send(buffer);
    },
    delete: async (req, res) => {
      await deleteMystery(req.userId, req.params.id, storage);
      ok(res, {});
    },
  };
}
