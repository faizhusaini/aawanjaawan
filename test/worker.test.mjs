import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker, { validatePost, indiaToday } from '../cloudflare/worker.mjs';

const code = await readFile(
  new URL('./worker-checks.js', import.meta.url),
  'utf8',
);
const runWorkerChecks = new Function(code + ';return runWorkerChecks;')();
test('Cloudflare Worker request/response and D1 contract regression', async () => {
  const count = await runWorkerChecks(worker, validatePost, indiaToday);
  assert.ok(count > 100);
  console.log('Cloudflare Worker assertions:', count);
});
