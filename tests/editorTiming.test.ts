import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audioToChartTime, chartToAudioTime, hitTestNote, msToSeconds, readOffsetSeconds, secondsToMs, shiftNotesSafely, snapStepSeconds, snapTimeSeconds, stepTimeSeconds, validateChartImport } from '../src/lib/editorTiming';
import { sanitizeChart } from '../src/lib/chartSanitizer';
import { editorFixture } from './fixtures/editorCharts';
import { generateAutoChart } from '../src/lib/beatDetector';

test('T-01/02: subdivisions at BPM 120/84/180 agree across the grid', () => {
  assert.equal(snapStepSeconds(120, 4), 0.125);
  assert.ok(Math.abs(snapStepSeconds(84, 4) - 0.178571428571) < 1e-10);
  for (const bpm of [84,120,180]) for (const subdivision of [1,2,3,4,6,8,16]) {
    const step = snapStepSeconds(bpm, subdivision);
    assert.equal(snapTimeSeconds(step * 1.1, bpm, subdivision), step);
    assert.equal(stepTimeSeconds(step, bpm, subdivision, 1), step * 2);
  }
});
test('T-03/04: signed offsets are converted only at boundaries', () => {
  assert.equal(chartToAudioTime(2, 0.25), 1.75);
  assert.equal(chartToAudioTime(2, -0.125), 2.125);
  assert.equal(audioToChartTime(1.75, 0.25), 2);
  for (const ms of [250,-125,-250,0]) {
    const offset = msToSeconds(ms);
    assert.equal(secondsToMs(offset), ms);
    assert.equal(audioToChartTime(chartToAudioTime(2,offset),offset),2);
  }
});
test('T-05: invalid shift rejects the entire transaction without mutation', () => {
  const notes = editorFixture(2).charts.Audit.notes;
  const snapshot = JSON.stringify(notes);
  const result = shiftNotesSafely(notes,-0.2);
  assert.equal(result.valid,false); assert.equal(result.notes,notes); assert.equal(JSON.stringify(notes),snapshot);
});
test('T-06: lane shift preserves intervals and leaves other lanes unchanged', () => {
  const before = editorFixture(23).charts.Audit.notes;
  const after = shiftNotesSafely(before,0.3,n=>n.lane===1);
  assert.equal(after.valid,true);
  before.forEach((n,i)=>assert.equal(after.notes[i].time,n.time+(n.lane===1?0.3:0)));
});
test('T-08: explicit offset units roundtrip; ambiguous legacy values are preserved', () => {
  for (const offset of [0.25,-0.125,250,1]) {
    assert.equal(readOffsetSeconds({offset}),offset);
    assert.equal(readOffsetSeconds(JSON.parse(JSON.stringify({offset,offsetUnit:'seconds'}))),offset);
  }
  assert.equal(readOffsetSeconds({offset:250,offsetUnit:'milliseconds'}),0.25);
  const chart = sanitizeChart({...editorFixture(1).charts.Audit,offset:250,offsetUnit:'milliseconds'},'audit-song');
  assert.equal(chart.offset,0.25); assert.equal(chart.offsetUnit,'seconds');
  assert.equal(sanitizeChart({...chart,notes:[]},'audit-song').notes.length,0);
});
test('pixel hit tests choose nearest note across zoom levels', () => {
  const notes = editorFixture(1).charts.Audit.notes;
  for (const zoom of [40,90,240]) {
    assert.equal(hitTestNote(notes,0,0.1+20/zoom,zoom)?.id,notes[0].id);
    assert.equal(hitTestNote(notes,0,0.1+23/zoom,zoom),undefined);
  }
});
test('import validation preserves empty charts and rejects malformed data', () => {
  validateChartImport({notes:[]});
  for (const raw of [{}, {notes:[{id:'x',lane:4,time:0}]}, {notes:[],offset:Infinity}, {notes:[],bpm:0}]) {
    assert.throws(()=>validateChartImport(raw));
  }
});
test('new generated charts map detected audio beats to chart zero without double offset', () => {
  const analysis = {bpm:120,offset:0.25,peaks:[],vocalPeaks:[],instrumentPeaks:[],energyProfile:new Float32Array(3500).fill(0.5),vocalProfile:new Float32Array(3500),bassProfile:new Float32Array(3500).fill(0.5)};
  const chart = generateAutoChart('fixture',35,analysis,'Medium');
  assert.equal(chart.offset,-0.25);
  assert.equal(chart.offsetUnit,'seconds');
  assert.ok(chart.notes.length > 0);
  for (const note of chart.notes) {
    assert.ok(note.time>=0);
    assert.ok(Math.abs(audioToChartTime(chartToAudioTime(note.time,chart.offset),chart.offset) - note.time) < 1e-10);
  }
});
