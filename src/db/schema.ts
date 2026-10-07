import { relations } from 'drizzle-orm';
import {
  pgTable,
  serial,
  text,
  integer,
  bigint,
  real,
  boolean,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  username: text('username').notNull(),
  avatarUrl: text('avatar_url').default(''),
  avatarType: text('avatar_type').default('google'),
  presetAvatarId: text('preset_avatar_id'),
  bio: text('bio').default(''),
  title: text('title').default('Novice Beatmaster'),
  level: integer('level').default(1).notNull(),
  exp: integer('exp').default(0).notNull(),
  totalScore: bigint('total_score', { mode: 'number' }).default(0).notNull(),
  songsCompleted: integer('songs_completed').default(0).notNull(),
  maxComboAllTime: integer('max_combo_all_time').default(0).notNull(),
  bestAccuracy: real('best_accuracy').default(0).notNull(),
  unlockedTitles: jsonb('unlocked_titles').$type<string[]>().default(['Novice Beatmaster']),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const gameSettings = pgTable('game_settings', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid')
    .notNull()
    .unique()
    .references(() => users.uid, { onDelete: 'cascade' }),
  scrollSpeed: real('scroll_speed').default(2.2).notNull(),
  audioOffsetMs: integer('audio_offset_ms').default(0).notNull(),
  bgmVolume: real('bgm_volume').default(0.8).notNull(),
  sfxVolume: real('sfx_volume').default(0.9).notNull(),
  noteSkin: text('note_skin').default('neon').notNull(),
  showTimingBar: boolean('show_timing_bar').default(true).notNull(),
  autoPlay: boolean('auto_play').default(false).notNull(),
  touchControlMode: text('touch_control_mode').default('thumb').notNull(),
  hapticFeedback: boolean('haptic_feedback').default(true).notNull(),
  keyBindings: jsonb('key_bindings').$type<{
    lane0: string;
    lane1: string;
    lane2: string;
    lane3: string;
  }>().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const songs = pgTable('songs', {
  id: text('id').primaryKey(), // Song UUID or unique identifier
  userUid: text('user_uid').references(() => users.uid, { onDelete: 'set null' }),
  title: text('title').notNull(),
  artist: text('artist').notNull(),
  bpm: real('bpm').notNull(),
  duration: real('duration').notNull(),
  isPreset: boolean('is_preset').default(false).notNull(),
  coverColor: text('cover_color').default('#6366f1'),
  audioUrl: text('audio_url'),
  youtubeVideoId: text('youtube_video_id'),
  youtubeUrl: text('youtube_url'),
  creator: text('creator'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const charts = pgTable('charts', {
  id: text('id').primaryKey(), // e.g. `${songId}_${difficulty}`
  songId: text('song_id')
    .notNull()
    .references(() => songs.id, { onDelete: 'cascade' }),
  difficulty: text('difficulty').notNull(), // Easy, Normal, Hard, Expert, Master
  bpm: real('bpm').notNull(),
  offset: real('offset').default(0).notNull(),
  notes: jsonb('notes').$type<Array<{
    id: string;
    lane: number;
    time: number;
    duration?: number;
  }>>().notNull(),
  creator: text('creator').default('BeatPulse'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const highScores = pgTable('high_scores', {
  id: serial('id').primaryKey(),
  songId: text('song_id')
    .notNull()
    .references(() => songs.id, { onDelete: 'cascade' }),
  difficulty: text('difficulty').notNull(),
  userUid: text('user_uid')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  score: integer('score').notNull(),
  maxCombo: integer('max_combo').notNull(),
  accuracy: real('accuracy').notNull(),
  grade: text('grade').notNull(),
  timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relationships
export const usersRelations = relations(users, ({ one, many }) => ({
  settings: one(gameSettings, {
    fields: [users.uid],
    references: [gameSettings.userUid],
  }),
  songs: many(songs),
  highScores: many(highScores),
}));

export const gameSettingsRelations = relations(gameSettings, ({ one }) => ({
  user: one(users, {
    fields: [gameSettings.userUid],
    references: [users.uid],
  }),
}));

export const songsRelations = relations(songs, ({ one, many }) => ({
  user: one(users, {
    fields: [songs.userUid],
    references: [users.uid],
  }),
  charts: many(charts),
  highScores: many(highScores),
}));

export const chartsRelations = relations(charts, ({ one }) => ({
  song: one(songs, {
    fields: [charts.songId],
    references: [songs.id],
  }),
}));

export const highScoresRelations = relations(highScores, ({ one }) => ({
  song: one(songs, {
    fields: [highScores.songId],
    references: [songs.id],
  }),
  user: one(users, {
    fields: [highScores.userUid],
    references: [users.uid],
  }),
}));
