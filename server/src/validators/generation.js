import { z } from 'zod';
import { text, evidenceContentSchemas } from '../../../shared/schemas/index.js';
import { CATEGORIES } from '../../../shared/constants/index.js';
export const logicalId = z.string().regex(/^[A-Z][A-Z0-9_]{0,30}$/);
const ids = z.array(logicalId).max(40);
const datetime = z.string().datetime({ offset: true });
export const planSchema = z
  .object({
    title: text(1, 120),
    premise: text(30, 4000),
    incident: z
      .object({
        summary: text(10, 2000),
        location: text(1, 200),
        whenLabel: text(1, 200),
        startsAt: datetime,
        endsAt: datetime,
      })
      .strict(),
    suspectIds: ids.min(3).max(6),
    culpritSuspectId: logicalId,
    correctMotiveOptionId: logicalId,
    motive: text(),
    method: text(),
    opportunity: text(),
    motiveOptions: z.array(z.object({ id: logicalId, text: text(1, 300) }).strict()).length(4),
    facts: z
      .array(z.object({ id: logicalId, text: text(1, 1000), time: datetime }).strict())
      .min(6)
      .max(40),
    canonicalTimeline: z
      .array(z.object({ time: datetime, event: text(1, 1000), factIds: ids.min(1) }).strict())
      .min(3)
      .max(30),
    chain: z
      .object({ motiveFactId: logicalId, opportunityFactId: logicalId, meansFactId: logicalId })
      .strict(),
    hints: z.array(text(10, 500)).length(3),
    nudge: text(10, 500),
    styleGuide: text(10, 1500),
  })
  .strict();
export const suspectSchema = z
  .object({
    id: logicalId,
    name: text(1, 80),
    age: z.number().int().min(13).max(100),
    occupation: text(1, 120),
    background: text(),
    relationshipToIncident: text(),
    publicMotive: text(),
    alibi: text(),
    initialStatement: text(),
    portraitPrompt: text(20, 1500),
    claims: z
      .array(
        z
          .object({ id: logicalId, text: text(), contradictedByFactId: logicalId.nullable() })
          .strict(),
      )
      .min(1)
      .max(6),
    excludedByFactIds: ids,
  })
  .strict();
export const suspectsSchema = z.object({ suspects: z.array(suspectSchema).min(3).max(6) }).strict();
export const evidencePlanSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            id: logicalId,
            category: z.enum(CATEGORIES),
            title: text(1, 120),
            description: text(1, 1000),
            sourceLabel: text(1, 120),
            occurredAt: datetime,
            relatedSuspectIds: ids.max(6),
            establishes: ids,
            roles: z
              .array(z.enum(['supporting', 'contradicting', 'red_herring', 'contextual']))
              .min(1),
            purpose: text(1, 1000),
          })
          .strict(),
      )
      .min(8)
      .max(15),
    keyEvidenceIds: ids.min(2).max(5),
    contradictionEvidenceIds: ids.min(1),
    redHerrings: z
      .array(z.object({ evidenceId: logicalId, explanation: text() }).strict())
      .min(1)
      .max(6),
  })
  .strict();
export const assetPromptSchema = z
  .object({ key: logicalId, type: z.enum(['scene_image', 'cctv_frame']), prompt: text(20, 2000) })
  .strict();
export const evidenceWriteSchema = (category) =>
  z
    .object({
      id: logicalId,
      content: evidenceContentSchemas[category],
      assets: z.array(assetPromptSchema).max(6),
    })
    .strict();
export const explanationSchema = z
  .object({ explanation: text(30, 10000), evidenceIds: ids.min(2) })
  .strict();
export const reviewSchema = z
  .object({
    pass: z.boolean(),
    findings: z
      .array(
        z
          .object({
            severity: z.enum(['info', 'warning', 'critical']),
            recordId: z.string(),
            message: text(1, 1000),
            suggestedFix: text(1, 1500),
          })
          .strict(),
      )
      .max(30),
  })
  .strict();
export const solverSchema = z
  .object({
    suspectId: logicalId,
    motiveOptionId: logicalId,
    evidenceIds: ids.min(1).max(5),
    reasoning: text(10, 4000),
  })
  .strict();
