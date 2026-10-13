import type { Note } from '../types';
import { chartToAudioTime } from './editorTiming';

export interface SyncAnchor { noteId: string; chartTime: number; audioTime: number }
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

// Stored offset has legacy semantics: audioTime = chartTime - offset.
// User-facing shift has the opposite sign: positive means later in the song.
export function previewChartAlignment(notes: Note[], offset: number, delta: number, audioDuration: number) {
  const nextOffset = offset - delta;
  let first = Infinity;
  let last = -Infinity;
  for (const note of notes) {
    first = Math.min(first, note.time);
    last = Math.max(last, note.time + (note.duration || 0));
  }
  const nextFirst = chartToAudioTime(first, nextOffset);
  const nextLast = chartToAudioTime(last, nextOffset);
  const error = !Number.isFinite(offset) || !Number.isFinite(delta) || !Number.isFinite(nextOffset)
    ? 'Delta dan offset harus berupa angka terbatas.'
    : !notes.length ? 'Tidak ada note dalam chart.'
    : !Number.isFinite(nextFirst) || !Number.isFinite(nextLast) ? 'Waktu note tidak valid.'
    : nextFirst < 0 ? 'Note akan berada sebelum awal audio. Koreksi ditolak tanpa memotong note.'
    : audioDuration > 0 && nextLast > audioDuration ? 'Note atau akhir hold akan melewati akhir audio. Koreksi ditolak.'
    : null;
  return { valid: !error, error, nextOffset, first: chartToAudioTime(first, offset),
    last: chartToAudioTime(last, offset), nextFirst, nextLast, count: notes.length };
}

export function analyzeSyncAnchors(anchors: SyncAnchor[], offset: number) {
  if (!anchors.length || !Number.isFinite(offset) || anchors.some(a => !Number.isFinite(a.chartTime) || !Number.isFinite(a.audioTime) || a.chartTime < 0 || a.audioTime < 0)) return null;
  const corrections = anchors.map(a => a.audioTime - chartToAudioTime(a.chartTime, offset));
  const delta = median(corrections);
  const residuals = corrections.map(c => c - delta);
  const span = Math.max(...anchors.map(a => a.chartTime)) - Math.min(...anchors.map(a => a.chartTime));
  const slopes: number[] = [];
  for (let i = 0; i < anchors.length; i++) for (let j = i + 1; j < anchors.length; j++) {
    const distance = anchors[j].chartTime - anchors[i].chartTime;
    if (Math.abs(distance) >= 10) slopes.push((anchors[j].audioTime - anchors[i].audioTime) / distance);
  }
  const scale = slopes.length ? median(slopes) : 1;
  const intercept = median(anchors.map(a => a.audioTime - scale * a.chartTime));
  const fitAgreement = anchors.filter(a => Math.abs(a.audioTime - (scale * a.chartTime + intercept)) <= 0.02).length / anchors.length;
  const offsetAgreement = residuals.filter(r => Math.abs(r) <= 0.02).length / anchors.length;
  // 20 ms is a diagnostic threshold, not a guarantee of perceptual accuracy.
  const sufficient = anchors.length >= 3 && span >= 10 && slopes.length > 0;
  const kind = !sufficient ? 'insufficient' : offsetAgreement >= 0.75 ? 'offset'
    : scale > 0 && Math.abs((scale - 1) * span) > 0.02 && fitAgreement >= 0.75 ? 'drift' : 'inconsistent';
  return { delta, residuals, span, scale, kind, canApply: kind === 'offset' || kind === 'insufficient' };
}
