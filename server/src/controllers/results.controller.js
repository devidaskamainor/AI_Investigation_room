import { accusationSchema } from '../../../shared/schemas/index.js';
import { ok } from '../middleware/errors.js';
import { accuse, getResults } from '../services/scoring/accusation.service.js';
export const resultsController = {
  accuse: async (req, res) =>
    ok(res, await accuse(req.userId, req.params.id, accusationSchema.parse(req.body))),
  get: async (req, res) => ok(res, await getResults(req.userId, req.params.id)),
};
