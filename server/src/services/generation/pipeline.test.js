import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { testDatabase, testEnv } from '../../../test/database.js';
import { caseFixture, MockGeminiProvider } from '../../../test/fixtures/case.js';
import {
  User,
  Mystery,
  MysterySolution,
  Suspect,
  Evidence,
  GenerationJob,
  ensureIndexes,
} from '../../models/index.js';
import { createMystery, retryJob } from '../mystery/creation.service.js';
import { validateCase, publicDraft } from '../mystery/mysteryValidator.js';
import { scanPublic } from '../mystery/dto.js';
import { claimJob } from '../../jobs/queue.js';
import { runJob } from './pipeline.js';
import { stableId } from './publish.js';
import { ProviderError } from '../ai/retry.js';
describe('M4 solution-first generation', () => {
  let db, user;
  beforeAll(async () => {
    db = await testDatabase();
    await ensureIndexes();
  });
  afterAll(async () => {
    await db.close();
  });
  beforeEach(async () => {
    await Promise.all(
      [User, Mystery, MysterySolution, Suspect, Evidence, GenerationJob].map((m) =>
        m.deleteMany({}),
      ),
    );
    user = await User.create({
      name: 'Detective',
      email: 'detective@example.test',
      passwordHash: 'test-only',
    });
  });
  const input = {
    scenario: 'A sculpture vanishes during a private gallery exhibition.',
    difficulty: 'easy',
    mysteryType: 'theft',
    suspectCount: 3,
  };
  async function job() {
    await createMystery(String(user._id), input, 'test-key-0001', testEnv);
    return claimJob('test-worker');
  }
  const assets = async (m, d) =>
    Object.fromEntries(
      [
        ...d.suspects.suspects.map((s) => `A${s.id}`),
        ...Object.values(d.evidence).flatMap((e) => e.assets.map((a) => a.key)),
      ].map((k) => [k, stableId(m._id, 'asset', k)]),
    );
  it('AC-04 publishes only a complete validated case and freezes its solution', async () => {
    const j = await job(),
      provider = new MockGeminiProvider();
    expect(await runJob(j, { env: testEnv, provider, generateAssets: assets })).toBe(true);
    const m = await Mystery.findById(j.mysteryId),
      s = await MysterySolution.findOne({ mysteryId: m._id });
    expect(m.status).toBe('ready');
    expect(m.suspectIds).toHaveLength(3);
    expect(m.evidenceIds).toHaveLength(8);
    expect(s.frozenAt).toBeTruthy();
    expect((await GenerationJob.findById(j._id)).progressPercentage).toBe(100);
    expect(scanPublic(publicDraft(provider.fixture))).toEqual([]);
    expect(provider.calls.find((c) => c.stage === 'blind-solver').input).not.toHaveProperty('plan');
  });
  it('AC-08 gracefully releases a checkpointed stage and resumes with another worker', async () => {
    const j = await job(),
      provider = new MockGeminiProvider();
    expect(
      await runJob(j, {
        env: testEnv,
        provider,
        generateAssets: assets,
        shouldStop: () => provider.calls.length > 0,
      }),
    ).toBe(false);
    expect((await GenerationJob.findById(j._id)).status).toBe('queued');
    const resumed = await claimJob('graceful-replacement'),
      replacement = new MockGeminiProvider();
    expect(
      await runJob(resumed, { env: testEnv, provider: replacement, generateAssets: assets }),
    ).toBe(true);
    expect(replacement.calls.some((call) => call.stage === 'mystery-planner')).toBe(false);
  });
  it('FR-21 requeues an eligible failure with a bounded manual retry count', async () => {
    const j = await job();
    await GenerationJob.updateOne(
      { _id: j._id },
      { $set: { status: 'failed', errorCode: 'PROVIDER_TIMEOUT' } },
    );
    await Mystery.updateOne({ _id: j.mysteryId }, { $set: { status: 'failed' } });
    await User.updateOne({ _id: user._id }, { $unset: { activeGenerationId: 1 } });
    expect((await retryJob(String(user._id), j._id)).status).toBe('queued');
    expect((await GenerationJob.findById(j._id)).attempts).toBe(1);
    expect((await Mystery.findById(j.mysteryId)).status).toBe('generating');
  });
  it('AC-08 releases a stale reservation left before a job was persisted', async () => {
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          activeGenerationId: '111111111111111111111111',
          generationReservedAt: new Date(Date.now() - 360000),
        },
      },
    );
    await claimJob('orphan-recovery');
    expect((await User.findById(user._id)).activeGenerationId).toBeUndefined();
    expect(
      (await createMystery(String(user._id), input, 'recovered-key-0001', testEnv)).status,
    ).toBe('queued');
  });
  it('FR-12 creation is idempotent and FR-13 allows one running job', async () => {
    const a = await createMystery(String(user._id), input, 'same-key-0001', testEnv),
      b = await createMystery(String(user._id), input, 'same-key-0001', testEnv);
    expect(a.mysteryId).toBe(b.mysteryId);
    await expect(
      createMystery(String(user._id), input, 'other-key-0001', testEnv),
    ).rejects.toMatchObject({ code: 'GENERATION_IN_PROGRESS' });
  });
  it('AC-08 resumes checkpointed work after lease expiry without duplicate records', async () => {
    const j = await job();
    await MysterySolution.create({
      mysteryId: j.mysteryId,
      generationMeta: { checkpoints: { plan: caseFixture().plan } },
    });
    await GenerationJob.updateOne(
      { _id: j._id },
      { $set: { lockedUntil: new Date(Date.now() - 1000) } },
    );
    const resumed = await claimJob('replacement-worker'),
      provider = new MockGeminiProvider();
    await runJob(resumed, { env: testEnv, provider, generateAssets: assets });
    expect(provider.calls.some((c) => c.stage === 'mystery-planner')).toBe(false);
    expect(await Evidence.countDocuments({ mysteryId: j.mysteryId })).toBe(8);
    expect(await claimJob('third-worker')).toBeNull();
  });
  it('AC-07 provider failures never publish partial work or expose provider messages', async () => {
    const j = await job();
    await runJob(j, {
      env: testEnv,
      provider: {
        generate: async () => {
          throw new ProviderError('PROVIDER_TIMEOUT');
        },
      },
      generateAssets: assets,
    });
    const failed = await GenerationJob.findById(j._id);
    expect(failed.status).toBe('failed');
    expect((await Mystery.findById(j.mysteryId)).status).toBe('failed');
    expect(failed.safeErrorMessage).toBe(
      'The AI service took too long to respond. Please try again.',
    );
    expect(failed.progressPercentage).toBeLessThan(100);
  });
  it('AC-06 blind solver failure exhausts bounded repairs and fails the case', async () => {
    const j = await job(),
      provider = new MockGeminiProvider(),
      generate = provider.generate.bind(provider);
    provider.generate = async (stage, input, schema) =>
      stage === 'blind-solver'
        ? {
            suspectId: 'S2',
            motiveOptionId: 'M1',
            evidenceIds: ['E1'],
            reasoning: 'An intentionally wrong test answer.',
          }
        : generate(stage, input, schema);
    await runJob(j, { env: testEnv, provider, generateAssets: assets });
    const failed = await GenerationJob.findById(j._id);
    expect(failed.status).toBe('failed');
    expect(failed.repairCycles).toBe(2);
    expect(failed.solverFailures).toBe(3);
  });
  it('AC-05 repairs only a failing evidence record', async () => {
    const j = await job(),
      provider = new MockGeminiProvider(),
      generate = provider.generate.bind(provider);
    let first = true;
    provider.generate = async (stage, input, schema) => {
      const result = await generate(stage, input, schema);
      if (stage === 'evidence-generator' && input.item.id === 'E3' && first) {
        first = false;
        result.assets = [];
      }
      return result;
    };
    expect(await runJob(j, { env: testEnv, provider, generateAssets: assets })).toBe(true);
    expect((await GenerationJob.findById(j._id)).repairCycles).toBe(1);
    expect(
      provider.calls.filter((c) => c.stage === 'evidence-generator' && c.input.item.id === 'E3'),
    ).toHaveLength(2);
    expect(
      provider.calls.filter((c) => c.stage === 'evidence-generator' && c.input.item.id === 'E1'),
    ).toHaveLength(1);
  });
  it('encloses canonical history before deriving evidence without changing the truth', async () => {
    const j = await job();
    const provider = new MockGeminiProvider();
    provider.fixture.plan.incident.startsAt = '2026-01-10T22:00:00Z';
    const original = structuredClone(provider.fixture.plan);
    expect(await runJob(j, { env: testEnv, provider, generateAssets: assets })).toBe(true);
    const stored = await MysterySolution.findOne({ mysteryId: j.mysteryId });
    const plan = stored.generationMeta.checkpoints.plan;
    expect(plan.incident.startsAt).toBe('2026-01-10T21:42:00.000Z');
    expect(plan.canonicalTimeline).toEqual(original.canonicalTimeline);
    expect(plan.facts).toEqual(original.facts);
    expect(plan.culpritSuspectId).toBe(original.culpritSuspectId);
    expect(plan.motive).toBe(original.motive);
  });
  it('repairs evidence metadata in the planner before requesting any images', async () => {
    const j = await job();
    const provider = new MockGeminiProvider();
    const generate = provider.generate.bind(provider);
    let initialPlan = true;
    provider.generate = async (stage, input, schema) => {
      const result = await generate(stage, input, schema);
      if (stage === 'evidence-planner' && initialPlan) {
        initialPlan = false;
        result.items[5].occurredAt = '2000-01-01T00:00:00Z';
        result.items[2].roles = ['supporting'];
      }
      return result;
    };
    const checkedAssets = vi.fn(async (mystery, draft) => {
      expect(validateCase(draft, { difficulty: 'easy', suspectCount: 3 }).pass).toBe(true);
      return assets(mystery, draft);
    });
    expect(await runJob(j, { env: testEnv, provider, generateAssets: checkedAssets })).toBe(true);
    expect(provider.calls.filter((call) => call.stage === 'evidence-planner')).toHaveLength(2);
    expect(checkedAssets).toHaveBeenCalledTimes(1);
    expect(
      provider.calls.filter(
        (call) => call.stage === 'evidence-generator' && call.input.item.id === 'E1',
      ),
    ).toHaveLength(1);
  });
  it('does not spend image quota when required evidence remains invalid after bounded repairs', async () => {
    const j = await job();
    const provider = new MockGeminiProvider();
    provider.fixture.evidencePlan.items[1].category = 'document';
    provider.fixture.evidence.E2 = { ...structuredClone(provider.fixture.evidence.E6), id: 'E2' };
    const checkedAssets = vi.fn(assets);
    expect(await runJob(j, { env: testEnv, provider, generateAssets: checkedAssets })).toBe(false);
    expect(checkedAssets).not.toHaveBeenCalled();
    const failed = await GenerationJob.findById(j._id);
    expect(failed.repairCycles).toBe(2);
    expect(failed.errorCode).toBe('CASE_VALIDATION_FAILED');
  });
  it('FR-21 limits manual retries to three', async () => {
    const j = await job();
    await GenerationJob.updateOne({ _id: j._id }, { $set: { status: 'failed', attempts: 3 } });
    await User.updateOne({ _id: user._id }, { $unset: { activeGenerationId: 1 } });
    await expect(retryJob(String(user._id), j._id)).rejects.toMatchObject({
      code: 'RETRY_UNAVAILABLE',
    });
  });
  it('FR-13 daily quota survives completed jobs', async () => {
    await User.updateOne(
      { _id: user._id },
      { $set: { generationDay: new Date().toISOString().slice(0, 10), generationCount: 5 } },
    );
    await expect(
      createMystery(String(user._id), input, 'quota-key-0001', testEnv),
    ).rejects.toMatchObject({ status: 429 });
  });
});
describe('AC-05 deterministic and fact graph validation', () => {
  for (const difficulty of ['easy', 'medium', 'hard'])
    it(`accepts a structurally fair ${difficulty} case`, () => {
      expect(validateCase(caseFixture({ difficulty }), { difficulty, suspectCount: 3 }).pass).toBe(
        true,
      );
    });
  for (const [name, mutate] of Object.entries({
    foreign_reference: (d) => d.evidencePlan.items[0].relatedSuspectIds.push('S99'),
    missing_exclusion: (d) => (d.suspects.suspects[1].excludedByFactIds = []),
    missing_means: (d) => (d.plan.chain.meansFactId = 'F99'),
    bad_timeline: (d) => (d.plan.canonicalTimeline[0].time = '2000-01-01T00:00:00Z'),
    orphan: (d) => (d.evidencePlan.items[0].establishes = []),
    bad_asset: (d) => (d.evidence.E3.assets = []),
    missing_field: (d) => delete d.plan.motive,
    foreign_reveal: (d) => d.explanation.evidenceIds.push('E99'),
    hint_leak: (d) => (d.plan.hints[0] = 'The culprit is Ada Vale.'),
  }))
    it(`rejects ${name}`, () => {
      const draft = caseFixture();
      mutate(draft);
      expect(validateCase(draft, { difficulty: 'easy', suspectCount: 3 }).pass).toBe(false);
    });
});
