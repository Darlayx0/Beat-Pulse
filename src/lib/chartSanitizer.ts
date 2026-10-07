import { Song, Chart, Note, DifficultyLevel } from '../types';

/**
 * Validates, repairs, and sanitizes a single Note object.
 * Removes NaN, clamps lane to 0..3, ensures valid timestamp and duration.
 */
export function sanitizeNote(rawNote: any, index: number = 0): Note | null {
  if (!rawNote || typeof rawNote !== 'object') return null;

  const rawTime = Number(rawNote.time);
  if (isNaN(rawTime) || !isFinite(rawTime) || rawTime < 0) {
    return null;
  }

  const rawLane = Number(rawNote.lane);
  const lane = isNaN(rawLane) ? 0 : Math.max(0, Math.min(3, Math.floor(rawLane)));

  let duration: number | undefined = undefined;
  if (rawNote.duration !== undefined && rawNote.duration !== null) {
    const rawDur = Number(rawNote.duration);
    if (!isNaN(rawDur) && isFinite(rawDur) && rawDur > 0.05) {
      duration = Math.max(0.05, Math.min(60, rawDur));
    }
  }

  const id = typeof rawNote.id === 'string' && rawNote.id.trim().length > 0
    ? rawNote.id
    : `note_${index}_${Math.round(rawTime * 1000)}_${lane}`;

  return {
    id,
    lane,
    time: Number(rawTime.toFixed(4)),
    ...(duration ? { duration: Number(duration.toFixed(4)) } : {}),
  };
}

/**
 * Validates, repairs, and sanitizes an entire Chart object.
 * Guarantees all notes are valid, sorted, and that essential fields exist.
 */
export function sanitizeChart(
  rawChart: any,
  fallbackSongId: string,
  fallbackDifficulty: DifficultyLevel = 'Medium',
  fallbackBpm: number = 120
): Chart {
  const songId = typeof rawChart?.songId === 'string' ? rawChart.songId : fallbackSongId;
  const difficulty = typeof rawChart?.difficulty === 'string' ? rawChart.difficulty : fallbackDifficulty;
  const bpm = typeof rawChart?.bpm === 'number' && !isNaN(rawChart.bpm) && rawChart.bpm > 20
    ? rawChart.bpm
    : fallbackBpm;
  const offset = typeof rawChart?.offset === 'number' && !isNaN(rawChart.offset)
    ? rawChart.offset
    : 0;

  const id = typeof rawChart?.id === 'string' && rawChart.id.length > 0
    ? rawChart.id
    : `chart_${songId}_${difficulty}`;

  const rawNotes = Array.isArray(rawChart?.notes) ? rawChart.notes : [];
  const cleanNotes: Note[] = [];

  for (let i = 0; i < rawNotes.length; i++) {
    const valid = sanitizeNote(rawNotes[i], i);
    if (valid) {
      cleanNotes.push(valid);
    }
  }

  // Sort notes chronologically
  cleanNotes.sort((a, b) => a.time - b.time);

  // If chart had zero valid notes (e.g. completely corrupted), generate minimal starter rhythm
  if (cleanNotes.length === 0) {
    const beatInterval = 60 / bpm;
    for (let b = 1; b <= 16; b++) {
      cleanNotes.push({
        id: `auto_${b}`,
        lane: (b - 1) % 4,
        time: Number((b * beatInterval).toFixed(4)),
      });
    }
  }

  return {
    id,
    songId,
    difficulty,
    bpm,
    offset,
    notes: cleanNotes,
    creator: typeof rawChart?.creator === 'string' ? rawChart.creator : 'BeatPulse Studio',
    createdAt: typeof rawChart?.createdAt === 'number' ? rawChart.createdAt : Date.now(),
  };
}

/**
 * Validates, repairs, and protects an entire Song object and all its charts.
 */
export function sanitizeSong(rawSong: any): Song {
  const id = typeof rawSong?.id === 'string' ? rawSong.id : `song_${Date.now()}`;
  const title = typeof rawSong?.title === 'string' && rawSong.title.trim().length > 0
    ? rawSong.title.trim()
    : 'Lagu Tanpa Judul';
  const artist = typeof rawSong?.artist === 'string' && rawSong.artist.trim().length > 0
    ? rawSong.artist.trim()
    : 'Artis Tidak Diketahui';
  const bpm = typeof rawSong?.bpm === 'number' && !isNaN(rawSong.bpm) && rawSong.bpm > 20
    ? rawSong.bpm
    : 120;
  const duration = typeof rawSong?.duration === 'number' && !isNaN(rawSong.duration) && rawSong.duration > 1
    ? rawSong.duration
    : 60;

  const rawCharts = rawSong?.charts && typeof rawSong.charts === 'object' ? rawSong.charts : {};
  const cleanCharts: Record<string, Chart> = {};

  const diffKeys = Object.keys(rawCharts);
  if (diffKeys.length > 0) {
    for (const diff of diffKeys) {
      cleanCharts[diff] = sanitizeChart(rawCharts[diff], id, diff, bpm);
    }
  } else {
    // Generate default charts if missing
    cleanCharts['Easy'] = sanitizeChart(null, id, 'Easy', bpm);
    cleanCharts['Medium'] = sanitizeChart(null, id, 'Medium', bpm);
    cleanCharts['Hard'] = sanitizeChart(null, id, 'Hard', bpm);
  }

  return {
    id,
    title,
    artist,
    bpm,
    duration,
    isPreset: Boolean(rawSong?.isPreset),
    coverColor: typeof rawSong?.coverColor === 'string' ? rawSong.coverColor : '#4f46e5',
    youtubeVideoId: typeof rawSong?.youtubeVideoId === 'string' ? rawSong.youtubeVideoId : undefined,
    youtubeUrl: typeof rawSong?.youtubeUrl === 'string' ? rawSong.youtubeUrl : undefined,
    userId: typeof rawSong?.userId === 'string' ? rawSong.userId : undefined,
    creator: typeof rawSong?.creator === 'string' ? rawSong.creator : undefined,
    createdAt: typeof rawSong?.createdAt === 'number' ? rawSong.createdAt : Date.now(),
    updatedAt: typeof rawSong?.updatedAt === 'number' ? rawSong.updatedAt : Date.now(),
    charts: cleanCharts,
  };
}

/**
 * Downloads a chart as a clean, standardized JSON file to prevent any data loss.
 */
export function exportChartAsJson(chart: Chart, songTitle: string): void {
  const exportPayload = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    songTitle,
    chart: sanitizeChart(chart, chart.songId, chart.difficulty, chart.bpm),
  };

  const jsonString = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${songTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_${chart.difficulty}_chart.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Parses and verifies an imported chart JSON file.
 */
export function parseChartJson(jsonString: string, targetSongId: string): Chart | null {
  try {
    const data = JSON.parse(jsonString);
    const rawChart = data.chart || data;
    if (!rawChart) return null;
    return sanitizeChart(rawChart, targetSongId, rawChart.difficulty || 'Custom', rawChart.bpm || 120);
  } catch (err) {
    console.error('Gagal membaca file JSON chart:', err);
    return null;
  }
}
