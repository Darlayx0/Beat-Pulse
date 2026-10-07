import { db } from './index.ts';
import { songs } from './schema.ts';
import { saveSongWithCharts } from './songs.ts';
import { PRESET_SONGS } from '../lib/defaultSongs.ts';

export async function seedPresetSongsIfNeeded() {
  try {
    const existing = await db.select().from(songs);
    if (existing.length === 0) {
      console.log('Seeding initial preset songs into Cloud SQL...');
      for (const preset of PRESET_SONGS) {
        await saveSongWithCharts(preset);
      }
      console.log('Preset songs seeded successfully.');
    }
  } catch (error) {
    console.error('Failed to seed preset songs into Cloud SQL:', error);
  }
}
