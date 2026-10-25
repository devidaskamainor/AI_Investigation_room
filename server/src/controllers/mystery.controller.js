import { createMysterySchema } from '../../../shared/schemas/index.js';
import { ok } from '../middleware/errors.js';
import { ownedMystery } from '../middleware/security.js';
import { mysteryDto } from '../services/mystery/dto.js';
import {
  createMystery,
  listMysteries,
  retryJob,
  getJob,
} from '../services/mystery/creation.service.js';
export function mysteryController(env) {
  return {
    create: async (req, res) =>
      ok(
        res,
        await createMystery(
          req.userId,
          createMysterySchema.parse(req.body),
          req.get('Idempotency-Key'),
          env,
        ),
        202,
      ),
    list: async (req, res) => ok(res, await listMysteries(req.userId, req.query)),
    get: async (req, res) => ok(res, mysteryDto(await ownedMystery(req.userId, req.params.id))),
    job: async (req, res) => ok(res, await getJob(req.userId, req.params.jobId)),
    retry: async (req, res) => ok(res, await retryJob(req.userId, req.params.jobId), 202),
  };
}
