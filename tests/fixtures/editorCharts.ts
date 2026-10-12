import type { Chart, Song } from '../../src/types';

export function editorFixture(count = 23, offset = 0): Song {
  const chart: Chart = {
    id: 'audit-chart', songId: 'audit-song', difficulty: 'Audit', bpm: 120, offset,
    creator: 'Regression fixture', createdAt: 1,
    notes: Array.from({ length: count }, (_, i) => ({
      id: `fixture-${i}`, lane: i % 4, time: 0.1 + i * 0.125,
      ...(i % 5 === 0 ? { duration: 0.25 } : {}),
    })),
  };
  return { id: 'audit-song', title: 'Audit rhythm', artist: 'Test fixture', bpm: 120,
    duration: Math.max(35, count * 0.125 + 1), charts: { Audit: chart, Empty: { ...chart, id: 'empty', difficulty: 'Empty', notes: [] } } };
}
