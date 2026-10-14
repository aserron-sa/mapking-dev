/**
 * Tests for soc2-evidence-contract — skeleton (MapKMigGon39261)
 * Run from the repo root:  node --test airtable/soc2/tests/soc2-evidence-contract.test.ts
 * Node 22.18+ runs .ts files directly (type stripping), no install needed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVITY_RUN_SOURCE_TYPES,
  CAPTURE_OUTCOMES,
  REQUIRED_CORE_FIELDS,
  SOURCE_TYPES,
  idempotencyKey,
} from '../soc2-evidence-contract.ts';

test('every activity_runs source type is a known source type', () => {
  for (const t of ACTIVITY_RUN_SOURCE_TYPES) assert.ok(SOURCE_TYPES.includes(t), t);
});

test('source types are the five agreed rows, without duplicates', () => {
  assert.deepEqual([...SOURCE_TYPES], ['approval', 'loom', 'ingestion', 'automation', 'ticket_review']);
  assert.equal(new Set(SOURCE_TYPES).size, SOURCE_TYPES.length);
});

test('capture outcomes and required core fields are fixed by the AC', () => {
  assert.deepEqual([...CAPTURE_OUTCOMES], ['evidenced', 'skipped', 'failed']);
  assert.deepEqual([...REQUIRED_CORE_FIELDS], ['run_id', 'source_type', 'finished_at', 'status']);
});

test('idempotency key is source_type + run_id and differs across source types', () => {
  assert.equal(idempotencyKey('loom', 'r1'), 'loom:r1');
  assert.notEqual(idempotencyKey('loom', 'r1'), idempotencyKey('ingestion', 'r1'));
});
