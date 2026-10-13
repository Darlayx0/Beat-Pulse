import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSyncAnchors, previewChartAlignment } from '../src/lib/chartAlignment';
import { audioToChartTime, chartToAudioTime, readOffsetSeconds } from '../src/lib/editorTiming';

const notes = [{ id: 'a', lane: 0, time: 1 }, { id: 'b', lane: 1, time: 20, duration: 2 }];
const anchors = (corrections: number[]) => corrections.map((c, i) => ({ noteId: String(i), chartTime: 10 + i * 30, audioTime: 10 + i * 30 + c }));
test('global alignment moves audio timing in both directions without rewriting notes or holds', () => {
  const original = structuredClone(notes);
  for (const delta of [0.1, -0.1, 0.001, -0.001]) {
    const p = previewChartAlignment(notes, 0.25, delta, 100);
    assert.equal(p.valid, true);
    assert.ok(Math.abs(p.nextFirst - p.first - delta) < 1e-10);
    assert.ok(Math.abs(p.nextLast - p.last - delta) < 1e-10);
    const restored = readOffsetSeconds(JSON.parse(JSON.stringify({ offset: p.nextOffset, offsetUnit: 'seconds' })));
    for (const n of notes) {
      assert.ok(Math.abs(audioToChartTime(chartToAudioTime(n.time, restored), restored) - n.time) < 1e-10);
    }
  }
  assert.deepEqual(notes, original);
});
test('alignment blocks negative audio positions, hold tails past duration and nonfinite values atomically', () => {
  for (const [offset, delta, duration] of [[0, -2, 100], [0, 1, 22], [0, NaN, 100], [Infinity, 0, 100], [Number.MAX_VALUE, -Number.MAX_VALUE, 100]]) {
    assert.equal(previewChartAlignment(notes, offset, delta, duration).valid, false);
  }
  assert.equal(previewChartAlignment([], 0, 0, 100).valid, false);
  assert.equal(previewChartAlignment(notes, 0, -1, 21).valid, true);
  assert.equal(previewChartAlignment(notes, 0, 0, 0).valid, true, 'unknown duration does not invent a boundary');
});
test('median offset tolerates one bad reference and reports its residual', () => {
  const p = analyzeSyncAnchors(anchors([0.1, 0.1, 0.1, 5]), 0.25)!;
  assert.equal(p.kind, 'offset');
  assert.ok(Math.abs(p.delta - 0.35) < 1e-10);
  assert.ok(Math.abs(p.residuals[3] - 4.9) < 1e-10);
  assert.equal(p.canApply, true);
});
test('drift and inconsistent local timing block automatic offset suggestions', () => {
  const drift = analyzeSyncAnchors(anchors([0.1, 0.16, 0.22]), 0)!;
  assert.equal(drift.kind, 'drift');
  assert.equal(drift.canApply, false);
  assert.ok(Math.abs(drift.scale - 1.002) < 1e-10);
  const local = analyzeSyncAnchors(anchors([0, 0.5, 0]), 0)!;
  assert.equal(local.kind, 'inconsistent');
  assert.equal(local.canApply, false);
});
test('short, sparse and invalid reference data never claim verified global synchronization', () => {
  assert.equal(analyzeSyncAnchors(anchors([0.1]), 0)?.kind, 'insufficient');
  assert.equal(analyzeSyncAnchors(anchors([0.1, 0.1]), 0)?.kind, 'insufficient');
  assert.equal(analyzeSyncAnchors([0, 1, 2].map(t => ({ noteId: String(t), chartTime: t, audioTime: t + 0.1 })), 0)?.kind, 'insufficient');
  assert.equal(analyzeSyncAnchors([], 0), null);
  assert.equal(analyzeSyncAnchors([{ noteId: 'x', chartTime: 0, audioTime: NaN }], 0), null);
});
