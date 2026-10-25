import pLimit from 'p-limit';
import { Mystery, MysterySolution, GenerationJob, User } from '../../models/index.js';
import { PROFILES } from '../../../../shared/constants/index.js';
import {
  planSchema,
  suspectsSchema,
  evidencePlanSchema,
  evidenceWriteSchema,
  explanationSchema,
  reviewSchema,
  solverSchema,
  suspectSchema,
} from '../../validators/generation.js';
import { validateCase, publicDraft } from '../mystery/mysteryValidator.js';
import { ProviderError } from '../ai/retry.js';
import { publishCase } from './publish.js';
import { PROMPT_VERSION } from '../ai/gemini.provider.js';
import { logger } from '../../config/logger.js';
import { publicGenerationError } from './error-message.js';
import { canonicalPlanWindow } from './plan-window.js';
export async function runJob(
  job,
  { env, provider, generateAssets, cleanupOrphans = async () => {}, shouldStop = () => false },
) {
  const started = Date.now(),
    worker = job.lockedBy;
  let mystery;
  const assertLease = async () => {
    if (
      !(await Mystery.exists({
        _id: job.mysteryId,
        ownerId: job.ownerId,
        status: { $ne: 'archived' },
      }))
    )
      throw new ProviderError('CASE_DELETED');
    if (
      !(await GenerationJob.exists({
        _id: job._id,
        lockedBy: worker,
        lockedUntil: { $gt: new Date() },
        status: { $nin: ['completed', 'failed'] },
      }))
    )
      throw new ProviderError('LEASE_LOST');
  };
  const stage = async (status, currentStage, progressPercentage) => {
    await assertLease();
    if (shouldStop()) throw new ProviderError('WORKER_STOPPING');
    await GenerationJob.updateOne(
      { _id: job._id, lockedBy: worker },
      { $set: { status, currentStage, progressPercentage } },
    );
    logger.info(
      { jobId: String(job._id), mysteryId: String(job.mysteryId), stage: status },
      'Generation stage',
    );
  };
  try {
    await assertLease();
    mystery = await Mystery.findById(job.mysteryId);
    if (mystery.status === 'ready') {
      await GenerationJob.updateOne(
        { _id: job._id, lockedBy: worker },
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
        { _id: job.ownerId, activeGenerationId: job._id },
        { $unset: { activeGenerationId: 1 } },
      );
      return true;
    }
    let solution = await MysterySolution.findOne({ mysteryId: job.mysteryId });
    if (!solution)
      solution = await MysterySolution.create({
        mysteryId: job.mysteryId,
        generationMeta: {
          model: env.GEMINI_MODEL,
          promptVersions: { all: PROMPT_VERSION },
          checkpoints: {},
          tokenUsage: [],
        },
      });
    const draft = structuredClone(solution.generationMeta?.checkpoints || {});
    draft.evidence ||= {};
    const save = async (key, value) => {
      await assertLease();
      const result = await MysterySolution.updateOne(
        { _id: solution._id, frozenAt: null },
        { $set: { [`generationMeta.checkpoints.${key}`]: value } },
      );
      if (!result.matchedCount) throw new ProviderError('SOLUTION_FROZEN');
    };
    const checkpoint = async (key, fn) => {
      if (draft[key]) return draft[key];
      const value = await fn();
      await save(key, value);
      draft[key] = value;
      return value;
    };
    const context = {
      scenario: `<user_scenario>${mystery.originalScenario}</user_scenario>`,
      title: mystery.title === 'An untitled mystery' ? '' : mystery.title,
      difficulty: mystery.difficulty,
      mysteryType: mystery.mysteryType,
      suspectCount: mystery.requestedSuspectCount,
      profile: PROFILES[mystery.difficulty],
    };
    await stage('planning', 'Planning the truth', 5);
    await checkpoint('plan', async () =>
      canonicalPlanWindow(await provider.generate('mystery-planner', context, planSchema)),
    );
    const enclosedPlan = canonicalPlanWindow(draft.plan);
    if (enclosedPlan !== draft.plan) {
      draft.plan = enclosedPlan;
      await save('plan', draft.plan);
    }
    await stage('generating_suspects', 'Building the suspect directory', 20);
    await checkpoint('suspects', () =>
      provider.generate(
        'suspect-generator',
        { plan: draft.plan, suspectCount: context.suspectCount },
        suspectsSchema,
      ),
    );
    await stage('generating_evidence', 'Planning the evidence', 30);
    await checkpoint('evidencePlan', () =>
      provider.generate(
        'evidence-planner',
        { plan: draft.plan, suspects: draft.suspects, profile: context.profile },
        evidencePlanSchema,
      ),
    );
    await stage('generating_evidence', 'Writing conversations and evidence', 40);
    const write = async (item, findings) => {
      const value = await provider.generate(
        'evidence-generator',
        {
          plan: draft.plan,
          suspects: draft.suspects,
          item,
          ...(findings ? { repairFindings: findings } : {}),
        },
        evidenceWriteSchema(item.category),
      );
      await save(`evidence.${item.id}`, value);
      draft.evidence[item.id] = value;
    };
    const limit = pLimit(3);
    await Promise.all(
      draft.evidencePlan.items.map((item) =>
        limit(async () => {
          if (!draft.evidence[item.id]) await write(item);
        }),
      ),
    );
    await checkpoint('explanation', () =>
      provider.generate(
        'solution-explainer',
        {
          plan: draft.plan,
          suspects: draft.suspects,
          evidencePlan: draft.evidencePlan,
          evidence: draft.evidence,
        },
        explanationSchema,
      ),
    );
    let lastFindings = [];
    for (let cycle = 0; cycle <= env.REPAIR_MAX_CYCLES; cycle++) {
      await stage('validating', 'Checking the written evidence', 55);
      let validation = validateCase(draft, {
        difficulty: context.difficulty,
        suspectCount: context.suspectCount,
      });
      if (validation.pass) {
        await stage('generating_assets', 'Creating the visual evidence', 60);
        draft.assets = await generateAssets(mystery, draft, assertLease);
        await save('assets', draft.assets);
        await stage('validating', 'Checking references and solvability', 85);
        validation = validateCase(
          draft,
          { difficulty: context.difficulty, suspectCount: context.suspectCount },
          { requireAssets: true },
        );
      }
      await Mystery.updateOne(
        { _id: mystery._id, status: 'generating' },
        { $set: { status: 'validating' } },
      );
      if (validation.pass) {
        const review = await provider.generate(
          'consistency-validator',
          { difficulty: context.difficulty, case: draft },
          reviewSchema,
        );
        validation = {
          pass: review.pass && !review.findings.some((f) => f.severity === 'critical'),
          findings: review.findings,
        };
        if (!validation.pass && !validation.findings.length)
          validation.findings = [
            {
              severity: 'critical',
              recordId: 'evidencePlan',
              message: 'Semantic review rejected the case',
              suggestedFix: 'Repair the evidence so it proves the solution',
            },
          ];
      }
      if (validation.pass && env.SOLVER_CHECK_ENABLED) {
        const solved = await provider.generate('blind-solver', publicDraft(draft), solverSchema);
        if (
          solved.suspectId !== draft.plan.culpritSuspectId ||
          solved.motiveOptionId !== draft.plan.correctMotiveOptionId ||
          !solved.evidenceIds.some((id) => draft.evidencePlan.keyEvidenceIds.includes(id))
        ) {
          await GenerationJob.updateOne({ _id: job._id }, { $inc: { solverFailures: 1 } });
          validation = {
            pass: false,
            findings: [
              {
                severity: 'critical',
                recordId: 'evidencePlan',
                message: 'The independent solver could not establish the solution',
                suggestedFix: 'Make the culprit chain deducible from public evidence',
              },
            ],
          };
        }
      }
      if (validation.pass) {
        await stage('publishing', 'Sealing the case file', 95);
        await publishCase(mystery, draft, assertLease);
        await GenerationJob.updateOne(
          { _id: job._id, lockedBy: worker },
          {
            $set: {
              status: 'completed',
              currentStage: 'Complete',
              progressPercentage: 100,
              completedAt: new Date(),
              durationMs: Date.now() - started,
            },
            $unset: { lockedBy: 1, lockedUntil: 1, errorCode: 1, safeErrorMessage: 1 },
          },
        );
        await User.updateOne(
          { _id: job.ownerId, activeGenerationId: job._id },
          { $unset: { activeGenerationId: 1 } },
        );
        return true;
      }
      await GenerationJob.updateOne({ _id: job._id }, { $inc: { validationFailures: 1 } });
      lastFindings = validation.findings;
      await save('validationFindings', lastFindings);
      if (cycle === env.REPAIR_MAX_CYCLES) break;
      await stage('repairing', 'Refining inconsistent clues', 88);
      await GenerationJob.updateOne({ _id: job._id }, { $inc: { repairCycles: 1 } });
      const targets = [
        ...new Set(
          lastFindings
            .filter((f) => f.severity === 'critical')
            .map((f) => f.repairTarget || f.recordId),
        ),
      ];
      for (const target of targets) {
        const item = draft.evidencePlan.items.find((e) => e.id === target),
          person = draft.suspects.suspects.find((s) => s.id === target);
        if (item)
          await write(
            item,
            lastFindings.filter((f) => f.recordId === target),
          );
        else if (person) {
          const revised = await provider.generate(
            'suspect-generator',
            { plan: draft.plan, repairSuspect: person, findings: lastFindings },
            suspectSchema,
          );
          draft.suspects.suspects = draft.suspects.suspects.map((s) =>
            s.id === target ? revised : s,
          );
          await save('suspects', draft.suspects);
        } else if (target === 'suspects') {
          draft.suspects = await provider.generate(
            'suspect-generator',
            {
              plan: draft.plan,
              suspectCount: context.suspectCount,
              previous: draft.suspects,
              repairFindings: lastFindings,
            },
            suspectsSchema,
          );
          await save('suspects', draft.suspects);
        } else if (target === 'plan') {
          throw new ProviderError('IMMUTABLE_PLAN_INVALID');
        } else if (target === 'explanation') {
          draft.explanation = await provider.generate(
            'solution-explainer',
            {
              plan: draft.plan,
              evidencePlan: draft.evidencePlan,
              evidence: draft.evidence,
              repairFindings: lastFindings,
            },
            explanationSchema,
          );
          await save('explanation', draft.explanation);
        } else {
          const previousPlan = draft.evidencePlan;
          draft.evidencePlan = await provider.generate(
            'evidence-planner',
            {
              plan: draft.plan,
              suspects: draft.suspects,
              profile: context.profile,
              previous: draft.evidencePlan,
              repairFindings: lastFindings,
            },
            evidencePlanSchema,
          );
          await save('evidencePlan', draft.evidencePlan);
          for (const planned of draft.evidencePlan.items) {
            const previous = previousPlan.items.find((item) => item.id === planned.id);
            if (!draft.evidence[planned.id] || JSON.stringify(previous) !== JSON.stringify(planned))
              await write(planned, lastFindings);
          }
        }
      }
      draft.explanation = await provider.generate(
        'solution-explainer',
        { plan: draft.plan, evidencePlan: draft.evidencePlan, evidence: draft.evidence },
        explanationSchema,
      );
      await save('explanation', draft.explanation);
    }
    throw new ProviderError('CASE_VALIDATION_FAILED');
  } catch (error) {
    if (error.code === 'LEASE_LOST') return false;
    if (error.code === 'WORKER_STOPPING') {
      await GenerationJob.updateOne(
        { _id: job._id, lockedBy: worker },
        {
          $set: { status: 'queued', currentStage: 'Resuming after worker restart' },
          $unset: { lockedBy: 1, lockedUntil: 1 },
        },
      );
      return false;
    }
    await GenerationJob.updateOne(
      { _id: job._id, lockedBy: worker },
      {
        $set: {
          status: 'failed',
          currentStage: 'Generation failed',
          ...publicGenerationError(error.code),
          completedAt: new Date(),
          durationMs: Date.now() - started,
        },
        $unset: { lockedBy: 1, lockedUntil: 1 },
      },
    );
    await Mystery.updateOne(
      { _id: job.mysteryId, status: { $nin: ['ready', 'archived'] } },
      { $set: { status: 'failed' } },
    );
    await User.updateOne(
      { _id: job.ownerId, activeGenerationId: job._id },
      { $unset: { activeGenerationId: 1 } },
    );
    if (!(await Mystery.exists({ _id: job.mysteryId, status: { $ne: 'archived' } })))
      await cleanupOrphans(job.mysteryId);
    logger.warn(
      {
        jobId: String(job._id),
        mysteryId: String(job.mysteryId),
        code: error.code || 'GENERATION_FAILED',
      },
      'Generation failed',
    );
    return false;
  }
}
