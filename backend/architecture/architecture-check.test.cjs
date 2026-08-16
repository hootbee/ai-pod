const test = require('node:test');
const assert = require('node:assert/strict');
const { findCycles } = require('./architecture-check.cjs');

test('detects a directed module cycle', () => {
  const graph = new Map([
    ['auth', new Set(['users'])],
    ['users', new Set(['auth'])],
  ]);

  assert.deepEqual(findCycles(graph), ['auth<->users']);
});

test('does not report an acyclic module graph', () => {
  const graph = new Map([
    ['controller', new Set(['service'])],
    ['service', new Set(['repository'])],
    ['repository', new Set()],
  ]);

  assert.deepEqual(findCycles(graph), []);
});
