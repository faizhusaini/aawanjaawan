import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');

for (const hostname of [
  'localhost',
  'aawanjaawan.fun',
  'aawanjaawan.aawanjaawan.workers.dev',
]) {
  test(`frontend flows and failure handling on ${hostname}`, async () => {
    const context = vm.createContext({});
    vm.runInContext(source('./frontend-harness.js'), context);
    vm.runInContext(
      `location = {hostname: ${JSON.stringify(hostname)}, protocol: 'https:'}`,
      context,
    );
    vm.runInContext(source('../src/js/app.js'), context);
    vm.runInContext(source('./frontend-checks.js'), context);
    await new Promise(setImmediate);
    const result = vm.runInContext('testResult', context);
    assert.ok(result, 'async frontend checks completed');
    assert.equal(result.ok, true, result.error);
    assert.ok(result.assertions >= 45);
  });
}

test('opening a file directly shows the explicitly labelled local demo', () => {
  const context = vm.createContext({});
  vm.runInContext(source('./frontend-harness.js'), context);
  vm.runInContext("location = {hostname: '', protocol: 'file:'}", context);
  vm.runInContext(source('../src/js/app.js'), context);
  const html = vm.runInContext("node('#posts').innerHTML", context);
  assert.match(html, /Example community member/);
  assert.equal(vm.runInContext("node('#all-count').textContent", context), 6);
});
