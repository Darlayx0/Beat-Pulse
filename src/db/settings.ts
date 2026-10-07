import { db } from './index.ts';
import { gameSettings } from './schema.ts';
import { eq } from 'drizzle-orm';
import { GameSettings } from '../types.ts';

const defaultSettings: GameSettings = {
  keyBindings: {
    lane0: 'KeyD',
    lane1: 'KeyF',
    lane2: 'KeyJ',
    lane3: 'KeyK',
  },
  scrollSpeed: 2.2,
  audioOffsetMs: 0,
  bgmVolume: 0.8,
  sfxVolume: 0.9,
  noteSkin: 'neon',
  showTimingBar: true,
  autoPlay: false,
  touchControlMode: 'thumb',
  hapticFeedback: true,
};

export async function getSettingsByUserUid(userUid: string): Promise<GameSettings> {
  try {
    const result = await db
      .select()
      .from(gameSettings)
      .where(eq(gameSettings.userUid, userUid));

    if (result.length === 0) {
      return defaultSettings;
    }

    const row = result[0];
    return {
      keyBindings: (row.keyBindings as GameSettings['keyBindings']) || defaultSettings.keyBindings,
      scrollSpeed: row.scrollSpeed,
      audioOffsetMs: row.audioOffsetMs,
      bgmVolume: row.bgmVolume,
      sfxVolume: row.sfxVolume,
      noteSkin: (row.noteSkin as GameSettings['noteSkin']) || 'neon',
      showTimingBar: row.showTimingBar,
      autoPlay: row.autoPlay,
      touchControlMode: (row.touchControlMode as GameSettings['touchControlMode']) || 'thumb',
      hapticFeedback: row.hapticFeedback,
    };
  } catch (error) {
    console.error('Database query failed in getSettingsByUserUid:', error);
    throw new Error('Failed to retrieve game settings.', { cause: error });
  }
}

export async function upsertSettings(userUid: string, settings: Partial<GameSettings>): Promise<GameSettings> {
  try {
    const merged = { ...defaultSettings, ...settings };
    const result = await db
      .insert(gameSettings)
      .values({
        userUid,
        scrollSpeed: merged.scrollSpeed,
        audioOffsetMs: merged.audioOffsetMs,
        bgmVolume: merged.bgmVolume,
        sfxVolume: merged.sfxVolume,
        noteSkin: merged.noteSkin,
        showTimingBar: merged.showTimingBar,
        autoPlay: merged.autoPlay,
        touchControlMode: merged.touchControlMode,
        hapticFeedback: merged.hapticFeedback,
        keyBindings: merged.keyBindings,
      })
      .onConflictDoUpdate({
        target: gameSettings.userUid,
        set: {
          scrollSpeed: merged.scrollSpeed,
          audioOffsetMs: merged.audioOffsetMs,
          bgmVolume: merged.bgmVolume,
          sfxVolume: merged.sfxVolume,
          noteSkin: merged.noteSkin,
          showTimingBar: merged.showTimingBar,
          autoPlay: merged.autoPlay,
          touchControlMode: merged.touchControlMode,
          hapticFeedback: merged.hapticFeedback,
          keyBindings: merged.keyBindings,
          updatedAt: new Date(),
        },
      })
      .returning();

    const row = result[0];
    return {
      keyBindings: (row.keyBindings as GameSettings['keyBindings']) || defaultSettings.keyBindings,
      scrollSpeed: row.scrollSpeed,
      audioOffsetMs: row.audioOffsetMs,
      bgmVolume: row.bgmVolume,
      sfxVolume: row.sfxVolume,
      noteSkin: (row.noteSkin as GameSettings['noteSkin']) || 'neon',
      showTimingBar: row.showTimingBar,
      autoPlay: row.autoPlay,
      touchControlMode: (row.touchControlMode as GameSettings['touchControlMode']) || 'thumb',
      hapticFeedback: row.hapticFeedback,
    };
  } catch (error) {
    console.error('Database query failed in upsertSettings:', error);
    throw new Error('Failed to save game settings.', { cause: error });
  }
}
