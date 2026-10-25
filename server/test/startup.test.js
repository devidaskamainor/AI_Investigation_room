import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { testDatabase, testEnv } from './database.js';
describe('M1 real process startup', () => {
  let db;
  const children = [];
  beforeAll(async () => {
    db = await testDatabase();
  });
  afterAll(async () => {
    for (const child of children) {
      if (child.exitCode === null) {
        const stopped = once(child, 'exit');
        child.kill('SIGTERM');
        await stopped;
      }
    }
    await db?.close();
  });
  function launch(file, env, expected) {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [file], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          ...Object.fromEntries(
            Object.entries({
              ...testEnv,
              NODE_ENV: 'development',
              MONGODB_URI: db.uri,
              ...env,
            }).map(([k, v]) => [k, String(v)]),
          ),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      children.push(child);
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error('Process startup timed out'));
      }, 10000);
      let output = '';
      child.stdout.on('data', (chunk) => {
        output += chunk.toString();
        if (output.includes(expected)) {
          clearTimeout(timer);
          resolve(child);
        }
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        if (!output.includes(expected)) reject(new Error(`Process failed to start (${code})`));
      });
    });
  }
  it('starts the API, answers health and starts the queue worker without a provider call', async () => {
    const probe = createServer();
    await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
    const port = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));
    await launch('server/src/server.js', { PORT: port }, 'API listening');
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
    expect(response.status).toBe(200);
    await launch('server/src/worker.js', {}, 'Worker connected');
  });
});
