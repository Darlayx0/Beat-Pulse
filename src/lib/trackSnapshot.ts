import type { Song } from '../types';

/** A complete track set: missing difficulties represent intentional removal. */
export function normalizeTrackSnapshot(song: Song): Song {
  return {
    ...song,
    trackSnapshotVersion: 1,
    charts: Object.fromEntries(Object.entries(song.charts || {}).map(([difficulty, chart]) => [
      difficulty, { ...chart, songId: song.id, difficulty },
    ])),
  };
}
