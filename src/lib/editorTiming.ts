import type { Note } from '../types';

// All domain times are seconds. Beat-grid phase is chart zero, independent of audio offset.
export const GRID_PHASE_SEC = 0;
export const secondsToMs = (seconds: number) => seconds * 1000;
export const msToSeconds = (ms: number) => ms / 1000;
export const chartToAudioTime = (chartTime: number, offset: number) => chartTime - offset;
export const audioToChartTime = (audioTime: number, offset: number) => audioTime + offset;
export function readOffsetSeconds(chart: { offset?: number; offsetUnit?: string } | null | undefined) {
  const offset = Number.isFinite(chart?.offset) ? chart!.offset! : 0;
  // Unmarked legacy data already had seconds semantics in playback. Never guess from magnitude.
  return chart?.offsetUnit === 'milliseconds' ? msToSeconds(offset) : offset;
}
export function snapStepSeconds(bpm: number, subdivision: number) {
  if (!Number.isFinite(bpm) || bpm <= 0 || !Number.isFinite(subdivision) || subdivision <= 0) {
    throw new Error('BPM dan subdivisi harus positif dan terbatas.');
  }
  return 60 / bpm / subdivision;
}
export function snapTimeSeconds(time: number, bpm: number, subdivision: number, phase = GRID_PHASE_SEC) {
  const step = snapStepSeconds(bpm, subdivision);
  return phase + Math.round((time - phase) / step) * step;
}
export function clampSeekSeconds(time: number, duration: number) {
  return Math.max(0, Math.min(duration, Number.isFinite(time) ? time : 0));
}
export function stepTimeSeconds(time: number, bpm: number, subdivision: number, direction: -1 | 1, phase = GRID_PHASE_SEC) {
  const step = snapStepSeconds(bpm, subdivision);
  const relative = (time - phase) / step;
  const index = direction > 0 ? Math.floor(relative + 1e-7) + 1 : Math.ceil(relative - 1e-7) - 1;
  return phase + index * step;
}
export function previewShift(notes: Note[], delta: number, matches: (note: Note) => boolean = () => true) {
  const target = notes.filter(matches);
  const first = target.length ? Math.min(...target.map(n => n.time)) : 0;
  const last = target.length ? Math.max(...target.map(n => n.time + (n.duration || 0))) : 0;
  const valid = Number.isFinite(delta) && target.length > 0 && first + delta >= 0;
  return { count: target.length, first, last, nextFirst: first + delta, nextLast: last + delta, valid,
    error: !Number.isFinite(delta) ? 'Delta harus berupa angka terbatas.' : !target.length ? 'Tidak ada note dalam cakupan.' :
      first + delta < 0 ? `Note terawal ${first.toFixed(3)}s akan menjadi ${(first + delta).toFixed(3)}s. Delta minimum: ${(-first).toFixed(3)}s.` : null };
}
export function shiftNotesSafely(notes: Note[], delta: number, matches: (note: Note) => boolean = () => true) {
  const preview = previewShift(notes, delta, matches);
  if (!preview.valid) return { ...preview, notes };
  return { ...preview, notes: notes.map(n => matches(n) ? { ...n, time: n.time + delta } : n) };
}
export function hitTestNote(notes: Note[], lane: number, time: number, zoom: number, radiusPx = 22) {
  return notes.filter(n => n.lane === lane && Math.abs(n.time - time) * zoom <= radiusPx)
    .reduce<Note | undefined>((best, n) => !best || Math.abs(n.time - time) < Math.abs(best.time - time) ? n : best, undefined);
}
export function validateChartImport(raw: unknown): asserts raw is { notes: Note[]; bpm?: number; offset?: number; offsetUnit?: string; difficulty?: string } {
  const chart = raw as any;
  if (!chart || !Array.isArray(chart.notes)) throw new Error('JSON harus memiliki array notes.');
  if (chart.bpm !== undefined && (!Number.isFinite(chart.bpm) || chart.bpm < 20 || chart.bpm > 400)) throw new Error('BPM harus 20–400.');
  if (chart.offset !== undefined && !Number.isFinite(chart.offset)) throw new Error('Offset tidak valid.');
  if (chart.offsetUnit !== undefined && !['seconds', 'milliseconds'].includes(chart.offsetUnit)) throw new Error('Satuan offset tidak dikenal.');
  const ids = new Set<string>();
  for (const n of chart.notes) {
    if (!n || typeof n.id !== 'string' || !n.id || ids.has(n.id) || !Number.isInteger(n.lane) || n.lane < 0 || n.lane > 3 ||
      !Number.isFinite(n.time) || n.time < 0 || (n.duration !== undefined && (!Number.isFinite(n.duration) || n.duration <= 0))) {
      throw new Error('Note harus memiliki ID unik, lane 0–3, waktu nonnegatif, dan durasi positif.');
    }
    ids.add(n.id);
  }
}
