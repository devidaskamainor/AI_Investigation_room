import { z } from 'zod';
import { CATEGORIES } from '../../../shared/constants/index.js';
import { objectId, noteSchema, pinsSchema } from '../../../shared/schemas/index.js';
import { ok } from '../middleware/errors.js';
import { progressDto } from '../services/mystery/dto.js';
import * as investigation from '../services/evidence/investigation.service.js';
const filters = z
  .object({ category: z.enum(CATEGORIES).optional(), suspectId: objectId.optional() })
  .strict();
export const investigationController = {
  suspects: async (req, res) =>
    ok(res, await investigation.listSuspects(req.userId, req.params.id)),
  suspect: async (req, res) =>
    ok(res, await investigation.getSuspect(req.userId, req.params.id, req.params.suspectId)),
  evidence: async (req, res) =>
    ok(res, await investigation.listEvidence(req.userId, req.params.id, filters.parse(req.query))),
  detail: async (req, res) =>
    ok(res, await investigation.getEvidence(req.userId, req.params.id, req.params.evidenceId)),
  view: async (req, res) =>
    ok(res, await investigation.viewEvidence(req.userId, req.params.id, req.params.evidenceId)),
  progress: async (req, res) =>
    ok(res, progressDto(await investigation.getProgress(req.userId, req.params.id))),
  noteCreate: async (req, res) =>
    ok(
      res,
      await investigation.noteCreate(req.userId, req.params.id, noteSchema.parse(req.body).text),
    ),
  noteUpdate: async (req, res) =>
    ok(
      res,
      await investigation.noteUpdate(
        req.userId,
        req.params.id,
        req.params.noteId,
        noteSchema.parse(req.body).text,
      ),
    ),
  noteDelete: async (req, res) =>
    ok(res, await investigation.noteDelete(req.userId, req.params.id, req.params.noteId)),
  pins: async (req, res) =>
    ok(
      res,
      await investigation.replacePins(req.userId, req.params.id, pinsSchema.parse(req.body).pins),
    ),
  hint: async (req, res) => ok(res, await investigation.nextHint(req.userId, req.params.id)),
};
