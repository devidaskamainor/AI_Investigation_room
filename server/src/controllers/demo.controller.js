import { ok } from '../middleware/errors.js';
import { demoCatalog, importDemo } from '../services/mystery/demo.service.js';
export function demoController(env, storage) {
  return {
    list: async (_req, res) => ok(res, await demoCatalog()),
    import: async (req, res) =>
      ok(res, await importDemo(req.userId, req.params.slug, env, storage), 201),
  };
}
