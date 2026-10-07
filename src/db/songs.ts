import { db } from './index.ts';
import { songs, charts } from './schema.ts';
import { eq, or, desc } from 'drizzle-orm';
import { Song, Chart } from '../types.ts';

export async function getAllSongs(userUid?: string): Promise<Song[]> {
  try {
    const condition = userUid
      ? or(eq(songs.isPreset, true), eq(songs.userUid, userUid))
      : eq(songs.isPreset, true);

    const songRows = await db
      .select()
      .from(songs)
      .where(condition)
      .orderBy(desc(songs.createdAt));

    if (songRows.length === 0) {
      return [];
    }

    // Fetch charts for these songs
    const songIds = songRows.map((s) => s.id);
    const chartRows = await db.select().from(charts);

    const chartMap: Record<string, Record<string, Chart>> = {};
    for (const c of chartRows) {
      if (!chartMap[c.songId]) chartMap[c.songId] = {};
      chartMap[c.songId][c.difficulty] = {
        id: c.id,
        songId: c.songId,
        difficulty: c.difficulty,
        bpm: c.bpm,
        offset: c.offset,
        notes: (c.notes as Chart['notes']) || [],
        creator: c.creator || 'BeatPulse',
        createdAt: c.createdAt ? new Date(c.createdAt).getTime() : Date.now(),
      };
    }

    return songRows.map((s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      bpm: s.bpm,
      duration: s.duration,
      isPreset: s.isPreset,
      coverColor: s.coverColor || '#6366f1',
      audioUrl: s.audioUrl || undefined,
      youtubeVideoId: s.youtubeVideoId || undefined,
      youtubeUrl: s.youtubeUrl || undefined,
      creator: s.creator || undefined,
      userId: s.userUid || undefined,
      createdAt: s.createdAt ? new Date(s.createdAt).getTime() : Date.now(),
      updatedAt: s.updatedAt ? new Date(s.updatedAt).getTime() : Date.now(),
      charts: chartMap[s.id] || {},
    }));
  } catch (error) {
    console.error('Database query failed in getAllSongs:', error);
    throw new Error('Failed to retrieve songs.', { cause: error });
  }
}

export async function getSongById(songId: string): Promise<Song | null> {
  try {
    const songRows = await db.select().from(songs).where(eq(songs.id, songId));
    if (songRows.length === 0) return null;

    const s = songRows[0];
    const chartRows = await db.select().from(charts).where(eq(charts.songId, songId));

    const songCharts: Record<string, Chart> = {};
    for (const c of chartRows) {
      songCharts[c.difficulty] = {
        id: c.id,
        songId: c.songId,
        difficulty: c.difficulty,
        bpm: c.bpm,
        offset: c.offset,
        notes: (c.notes as Chart['notes']) || [],
        creator: c.creator || 'BeatPulse',
        createdAt: c.createdAt ? new Date(c.createdAt).getTime() : Date.now(),
      };
    }

    return {
      id: s.id,
      title: s.title,
      artist: s.artist,
      bpm: s.bpm,
      duration: s.duration,
      isPreset: s.isPreset,
      coverColor: s.coverColor || '#6366f1',
      audioUrl: s.audioUrl || undefined,
      youtubeVideoId: s.youtubeVideoId || undefined,
      youtubeUrl: s.youtubeUrl || undefined,
      creator: s.creator || undefined,
      userId: s.userUid || undefined,
      createdAt: s.createdAt ? new Date(s.createdAt).getTime() : Date.now(),
      updatedAt: s.updatedAt ? new Date(s.updatedAt).getTime() : Date.now(),
      charts: songCharts,
    };
  } catch (error) {
    console.error('Database query failed in getSongById:', error);
    throw new Error('Failed to retrieve song.', { cause: error });
  }
}

export async function saveSongWithCharts(songData: Song, userUid?: string): Promise<Song> {
  try {
    // 1. Upsert song record
    await db
      .insert(songs)
      .values({
        id: songData.id,
        userUid: userUid || songData.userId || null,
        title: songData.title,
        artist: songData.artist,
        bpm: songData.bpm,
        duration: songData.duration,
        isPreset: Boolean(songData.isPreset),
        coverColor: songData.coverColor || '#6366f1',
        audioUrl: songData.audioUrl || null,
        youtubeVideoId: songData.youtubeVideoId || null,
        youtubeUrl: songData.youtubeUrl || null,
        creator: songData.creator || 'BeatPulse Player',
        createdAt: songData.createdAt ? new Date(songData.createdAt) : new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: songs.id,
        set: {
          title: songData.title,
          artist: songData.artist,
          bpm: songData.bpm,
          duration: songData.duration,
          coverColor: songData.coverColor || '#6366f1',
          audioUrl: songData.audioUrl || null,
          youtubeVideoId: songData.youtubeVideoId || null,
          youtubeUrl: songData.youtubeUrl || null,
          creator: songData.creator || 'BeatPulse Player',
          updatedAt: new Date(),
        },
      });

    // 2. Upsert charts
    if (songData.charts && Object.keys(songData.charts).length > 0) {
      for (const [diff, chart] of Object.entries(songData.charts)) {
        const chartId = chart.id || `${songData.id}_${diff.toLowerCase()}`;
        await db
          .insert(charts)
          .values({
            id: chartId,
            songId: songData.id,
            difficulty: diff,
            bpm: chart.bpm || songData.bpm,
            offset: chart.offset || 0,
            notes: chart.notes || [],
            creator: chart.creator || songData.creator || 'BeatPulse',
            createdAt: chart.createdAt ? new Date(chart.createdAt) : new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: charts.id,
            set: {
              bpm: chart.bpm || songData.bpm,
              offset: chart.offset || 0,
              notes: chart.notes || [],
              creator: chart.creator || songData.creator || 'BeatPulse',
              updatedAt: new Date(),
            },
          });
      }
    }

    const saved = await getSongById(songData.id);
    if (!saved) throw new Error('Could not retrieve saved song');
    return saved;
  } catch (error) {
    console.error('Database query failed in saveSongWithCharts:', error);
    throw new Error('Failed to save song and chart configuration.', { cause: error });
  }
}

export async function deleteSong(songId: string, userUid: string): Promise<boolean> {
  try {
    const existing = await db.select().from(songs).where(eq(songs.id, songId));
    if (existing.length === 0) return false;

    // Check ownership (cannot delete presets or songs belonging to others)
    const song = existing[0];
    if (song.isPreset) {
      throw new Error('Preset songs cannot be deleted.');
    }
    if (song.userUid && song.userUid !== userUid) {
      throw new Error('You do not have permission to delete this song.');
    }

    await db.delete(songs).where(eq(songs.id, songId));
    return true;
  } catch (error) {
    console.error('Database query failed in deleteSong:', error);
    throw new Error('Failed to delete song.', { cause: error });
  }
}
