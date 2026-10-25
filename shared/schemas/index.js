import { z } from 'zod';
import { DIFFICULTIES, MYSTERY_TYPES } from '../constants/index.js';
export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
export const text = (min = 1, max = 4000) => z.string().trim().min(min).max(max);
export const createMysterySchema = z
  .object({
    scenario: text(30, 2000),
    title: text(0, 120).optional(),
    difficulty: z.enum(DIFFICULTIES).default('medium'),
    mysteryType: z.enum(MYSTERY_TYPES).default('general'),
    suspectCount: z.number().int().min(3).max(6).default(4),
  })
  .strict();
export const registerSchema = z
  .object({
    name: text(1, 80),
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    password: z.string().min(8).max(128),
  })
  .strict();
export const loginSchema = registerSchema.omit({ name: true });
export const forgotSchema = z.object({ email: registerSchema.shape.email }).strict();
export const resetSchema = z
  .object({ token: z.string().regex(/^[a-f\d]{64}$/), password: registerSchema.shape.password })
  .strict();
export const accusationSchema = z
  .object({
    suspectId: objectId,
    motiveOptionId: text(1, 32),
    evidenceIds: z
      .array(objectId)
      .min(1)
      .max(5)
      .refine((v) => new Set(v).size === v.length, 'Choose distinct evidence'),
  })
  .strict();
export const noteSchema = z.object({ text: text(1, 10000) }).strict();
export const pinsSchema = z
  .object({
    pins: z
      .array(z.object({ evidenceId: objectId, label: text(0, 120).default('') }).strict())
      .max(12)
      .refine((v) => new Set(v.map((p) => p.evidenceId)).size === v.length, 'Duplicate pin'),
  })
  .strict();
export const listSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
    status: z
      .enum([
        'draft',
        'generating',
        'validating',
        'ready',
        'failed',
        'archived',
        'in_progress',
        'completed',
      ])
      .optional(),
  })
  .strict();
const timestamp = z.string().datetime({ offset: true });
const message = z
  .object({
    senderSuspectId: z.string().nullable(),
    senderName: text(1, 80),
    text: text(0, 2000),
    sentAt: timestamp,
    deleted: z.boolean(),
  })
  .strict();
export const evidenceContentSchemas = {
  message: z
    .object({
      participants: z.array(text(1, 80)).min(2).max(8),
      messages: z.array(message).min(8).max(25),
    })
    .strict(),
  image: z.object({ caption: text(), altText: text(1, 500), assetId: text() }).strict(),
  cctv: z
    .object({
      cameraLabel: text(1, 100),
      location: text(1, 200),
      frames: z
        .array(z.object({ assetId: text(), timestamp, caption: text(1, 500) }).strict())
        .min(3)
        .max(6),
      isReconstruction: z.literal(true),
    })
    .strict(),
  document: z
    .object({
      docType: text(1, 80),
      author: text(1, 100),
      createdAt: timestamp,
      body: text(1, 10000),
    })
    .strict(),
  witness_statement: z
    .object({
      witnessName: text(1, 100),
      interviewedAt: timestamp,
      statement: text(1, 10000),
      relatedSuspectIds: z.array(z.string()).max(6),
    })
    .strict(),
  timeline: z
    .object({
      entries: z
        .array(
          z
            .object({
              time: timestamp,
              text: text(1, 1000),
              relatedSuspectIds: z.array(z.string()).max(6),
            })
            .strict(),
        )
        .min(1)
        .max(30),
    })
    .strict(),
  other: z.object({ body: text(1, 10000) }).strict(),
};
