import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { investigationHarness } from '../../../test/harness.js';
import { scanPublic } from '../mystery/dto.js';
import { Asset, Mystery } from '../../models/index.js';
describe('M6 persistent investigation and ownership', () => {
  let h, evidence, suspects;
  beforeAll(async () => {
    h = await investigationHarness();
    evidence = (await h.owner.send('get', `${h.base}/evidence`)).body.data.items;
    suspects = (await h.owner.send('get', `${h.base}/suspects`)).body.data.items;
  });
  afterAll(async () => {
    await h?.close();
  });
  it('AC-09 every active-case response passes the leak scan', async () => {
    for (const path of [
      h.base,
      `${h.base}/suspects`,
      `${h.base}/evidence`,
      `${h.base}/progress`,
      `/generation-jobs/${h.jobId}`,
      ...evidence.map((e) => `${h.base}/evidence/${e.id}`),
    ]) {
      const r = await h.owner.send('get', path);
      expect(r.status).toBe(200);
      expect(scanPublic(r.body)).toEqual([]);
      expect(JSON.stringify(r.body)).not.toContain('test-only-key');
    }
  });
  it('AC-10 foreign users cannot read or mutate the case, children, job, progress or assets', async () => {
    const asset = await Asset.findOne({ mysteryId: h.id });
    for (const [method, path, body] of [
      ['get', h.base],
      ['delete', h.base],
      ['get', `${h.base}/suspects`],
      ['get', `${h.base}/suspects/${suspects[0].id}`],
      ['get', `${h.base}/evidence`],
      ['get', `${h.base}/evidence/${evidence[0].id}`],
      ['post', `${h.base}/evidence/${evidence[0].id}/view`],
      ['get', `${h.base}/progress`],
      ['post', `${h.base}/progress/notes`, { text: 'Steal notes' }],
      ['put', `${h.base}/progress/pins`, { pins: [] }],
      ['post', `${h.base}/hints`],
      ['get', `/generation-jobs/${h.jobId}`],
      ['post', `/generation-jobs/${h.jobId}/retry`],
      ['get', `/assets/${asset._id}`],
    ])
      expect((await h.foreign.send(method, path, body)).status, `${method} ${path}`).toBe(404);
  });
  it('AC-11 viewing evidence persists independently of subsequent requests', async () => {
    const r = await h.owner.send('post', `${h.base}/evidence/${evidence[0].id}/view`);
    expect(r.status).toBe(200);
    expect((await h.owner.send('get', `${h.base}/progress`)).body.data.viewedEvidenceIds).toContain(
      evidence[0].id,
    );
  });
  it('AC-12 notes create, edit, reload and delete', async () => {
    const create = await h.owner.send('post', `${h.base}/progress/notes`, {
      text: 'The coat appears after nine.',
    });
    expect(create.status).toBe(200);
    const note = create.body.data.notes[0];
    expect(
      (
        await h.owner.send('patch', `${h.base}/progress/notes/${note.id}`, {
          text: 'Compare this with the key register.',
        })
      ).status,
    ).toBe(200);
    expect((await h.owner.send('get', `${h.base}/progress`)).body.data.notes[0].text).toBe(
      'Compare this with the key register.',
    );
    expect((await h.foreign.send('delete', `${h.base}/progress/notes/${note.id}`)).status).toBe(
      404,
    );
    expect(
      (await h.owner.send('delete', `${h.base}/progress/notes/${note.id}`)).body.data.notes,
    ).toHaveLength(0);
  });
  it('AC-13 pins save labels, order and removal', async () => {
    const pins = [
      { evidenceId: evidence[0].id, label: 'Check time' },
      { evidenceId: evidence[1].id, label: 'A contradiction?' },
    ];
    expect((await h.owner.send('put', `${h.base}/progress/pins`, { pins })).status).toBe(200);
    const reordered = [pins[1], { ...pins[0], label: 'After nine' }];
    await h.owner.send('put', `${h.base}/progress/pins`, { pins: reordered });
    expect((await h.owner.send('get', `${h.base}/progress`)).body.data.pins).toEqual(reordered);
    await h.owner.send('put', `${h.base}/progress/pins`, { pins: [] });
  });
  it('AC-14 releases three ordered hints and rejects a fourth', async () => {
    for (let i = 0; i < 3; i++) {
      const r = await h.owner.send('post', `${h.base}/hints`);
      expect(r.status).toBe(200);
      expect(r.body.data.hintsUsed).toBe(i + 1);
      expect(r.body.data.hint).toBe(h.solution.hints[i]);
      expect(r.body.data).not.toHaveProperty('hints');
    }
    const fourth = await h.owner.send('post', `${h.base}/hints`);
    expect(fourth.status).toBe(409);
    expect(fourth.body.error.code).toBe('HINT_LIMIT_REACHED');
  });
  it('AC-10 validates foreign references and ObjectIds', async () => {
    expect((await h.owner.send('get', '/mysteries/invalid/evidence')).status).toBe(400);
    expect(
      (
        await h.owner.send('put', `${h.base}/progress/pins`, {
          pins: [{ evidenceId: '111111111111111111111111', label: 'Foreign' }],
        })
      ).status,
    ).toBe(400);
    expect((await h.owner.send('get', `${h.base}/evidence?category=invalid`)).status).toBe(400);
  });
  it('AC-07 a generating case cannot expose evidence', async () => {
    const m = await Mystery.create({
      ownerId: h.owner.user.id,
      title: 'Not ready',
      status: 'generating',
    });
    const r = await h.owner.send('get', `/mysteries/${m._id}/evidence`);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('MYSTERY_NOT_READY');
  });
});
