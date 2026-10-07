export type NoteType = 'tap' | 'hold';

export interface Note {
  id: string;
  lane: number; // 0, 1, 2, 3
  time: number; // Time in seconds when the note should be hit
  duration?: number; // Duration in seconds for hold notes
}

export type DifficultyLevel = string;

export interface Chart {
  id: string;
  songId: string;
  difficulty: DifficultyLevel;
  bpm: number;
  offset: number; // Audio start offset in seconds
  notes: Note[];
  creator: string;
  createdAt: number;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  duration: number; // Duration in seconds
  audioBlob?: Blob; // For local user imported files
  audioUrl?: string; // Fallback or generated URL
  youtubeVideoId?: string; // YouTube Video ID for YouTube imported tracks
  youtubeUrl?: string; // Full YouTube URL
  isPreset?: boolean;
  coverColor?: string;
  userId?: string; // User ID of creator for cloud sync
  creator?: string;
  createdAt?: number;
  updatedAt?: number;
  charts: Record<string, Chart>;
  trackSnapshotVersion?: 1; // Complete difficulty set; absent tracks must not be restored.
}

export type JudgementType = 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS';

export interface JudgementResult {
  type: JudgementType;
  offsetMs: number; // Positive = Late, Negative = Early
  score: number;
  accuracy: number;
  combo: number;
}

export interface GameStats {
  score: number;
  maxCombo: number;
  currentCombo: number;
  perfectCount: number;
  greatCount: number;
  goodCount: number;
  missCount: number;
  accuracy: number; // 0 - 100%
  totalNotes: number;
  processedNotes: number;
  health: number; // 0 - 100
  timingOffsets: number[]; // List of timing offsets in ms for graph
}

export interface KeyBinding {
  lane0: string; // Leftmost
  lane1: string;
  lane2: string;
  lane3: string; // Rightmost
}

export interface GameSettings {
  keyBindings: KeyBinding;
  scrollSpeed: number; // Multiplier, e.g., 2.2
  audioOffsetMs: number; // Calibration offset in milliseconds
  bgmVolume: number; // 0.0 - 1.0
  sfxVolume: number; // 0.0 - 1.0
  noteSkin: 'cyber' | 'neon' | 'pastel' | 'classic';
  showTimingBar: boolean;
  autoPlay: boolean;
  touchControlMode: 'thumb' | 'direct' | 'split'; // Touch mode for mobile
  hapticFeedback: boolean; // Mobile vibration on note tap
}

export interface HighScore {
  songId: string;
  difficulty: DifficultyLevel;
  score: number;
  maxCombo: number;
  accuracy: number;
  grade: 'S+' | 'S' | 'A' | 'B' | 'C' | 'F';
  timestamp: number;
  userId?: string;
  username?: string;
}

// User Profile & Authentication Types
export interface UserProfile {
  uid: string;
  username: string;
  email: string;
  avatarUrl: string;
  avatarType: 'preset' | 'custom' | 'google';
  presetAvatarId?: string;
  bio?: string;
  title?: string;
  level: number;
  exp: number;
  totalScore: number;
  songsCompleted: number;
  createdAt: number;
  updatedAt: number;
  lastSyncedAt?: number;
  authProvider?: 'google' | 'guest' | 'email';
  isGoogleLinked?: boolean;
  settings?: GameSettings;
  googleId?: string;
  googleDisplayName?: string;
  googleEmail?: string;
  googlePhotoUrl?: string;
  unlockedTitles?: string[];
  maxComboAllTime?: number;
  bestAccuracy?: number;
}

export interface SavedAccount {
  uid: string;
  username: string;
  email: string;
  avatarUrl: string;
  avatarType?: 'preset' | 'custom' | 'google';
  presetAvatarId?: string;
  lastActive: number;
  isGuest?: boolean;
  authProvider?: 'google' | 'guest' | 'email';
  isGoogleLinked?: boolean;
  level?: number;
}

export interface FirestoreOptimizationStats {
  cacheHits: number;
  readsSaved: number;
  writesDeduplicated: number;
  totalReads: number;
  totalWrites: number;
  lastSyncTime: number | null;
  bandwidthSavedKB: number;
}

// UI State & Notification Types
export type UIStatus = 'idle' | 'loading' | 'success' | 'error' | 'empty';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}
