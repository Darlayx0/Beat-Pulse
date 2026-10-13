import type { HighScore, UserProfile } from '../types';

export const ACCOUNT_PREFIX = 'BEATPULSE_ACCOUNT_V1_';
export type StateEntry = { updatedAt: number; value: any };
export type AccountState = { version: 1; uid: string; entries: Record<string, StateEntry> };
export const emptyAccountState = (uid: string): AccountState => ({ version: 1, uid, entries: {} });
export function validateAccountState(state: AccountState, uid: string): void {
  if (!state || state.version !== 1 || state.uid !== uid || !state.entries || Array.isArray(state.entries)) throw new Error('Data akun cadangan tidak valid.');
  for (const [key, entry] of Object.entries(state.entries)) {
    if (!/^(settings|editor|profile|score:.+|result:.+)$/.test(key) || !entry || !Number.isFinite(entry.updatedAt) || entry.updatedAt < 0 || entry.value === undefined) throw new Error('Entri data akun tidak valid.');
    if (key === 'profile' && entry.value.uid !== uid) throw new Error('Profil berasal dari akun lain.');
    if (key === 'profile' && ['exp', 'level', 'totalScore', 'songsCompleted'].some(field => !Number.isFinite(entry.value[field]) || entry.value[field] < 0)) throw new Error('Progres profil tidak valid.');
    if (key.startsWith('score:') && (!Number.isFinite(entry.value.score) || entry.value.score < 0 || typeof entry.value.songId !== 'string' || typeof entry.value.difficulty !== 'string')) throw new Error('Skor tidak valid.');
    if (key.startsWith('result:') && ['score', 'exp', 'maxCombo', 'accuracy'].some(field => !Number.isFinite(entry.value[field]) || entry.value[field] < 0)) throw new Error('Progres tidak valid.');
  }
}
export function readAccountState(uid: string): AccountState {
  const raw = localStorage.getItem(ACCOUNT_PREFIX + uid);
  if (!raw) return emptyAccountState(uid);
  const state = JSON.parse(raw); validateAccountState(state, uid); return state;
}
export function mergeAccountState(local: AccountState, remote: AccountState): AccountState {
  validateAccountState(local, local.uid); validateAccountState(remote, local.uid);
  const entries = { ...remote.entries };
  for (const [key, entry] of Object.entries(local.entries)) {
    const other = entries[key];
    if (key === 'profile' && other) {
      const winner = entry.updatedAt >= other.updatedAt ? entry : other;
      const value = { ...winner.value };
      for (const counter of ['exp', 'level', 'totalScore', 'songsCompleted', 'maxComboAllTime', 'bestAccuracy']) value[counter] = Math.max(entry.value[counter] || 0, other.value[counter] || 0);
      value.unlockedTitles = [...new Set([...(entry.value.unlockedTitles || []), ...(other.value.unlockedTitles || [])])].sort();
      entries[key] = { updatedAt: Math.max(entry.updatedAt, other.updatedAt), value };
      continue;
    }
    const bestScore = key.startsWith('score:') && other && entry.value.score !== other.value.score;
    if (!other || (bestScore ? entry.value.score > other.value.score : entry.updatedAt > other.updatedAt || (entry.updatedAt === other.updatedAt && JSON.stringify(entry.value) > JSON.stringify(other.value)))) entries[key] = entry;
  }
  return { version: 1, uid: local.uid, entries };
}
export function storeAccountState(state: AccountState): void {
  validateAccountState(state, state.uid);
  localStorage.setItem(ACCOUNT_PREFIX + state.uid, JSON.stringify(state));
}
export function copyAccountState(sourceUid: string, targetUid: string): void {
  if (sourceUid === targetUid) return;
  const source = readAccountState(sourceUid);
  const transferred = emptyAccountState(targetUid);
  for (const [key, entry] of Object.entries(source.entries)) transferred.entries[key] = {
    ...entry, value: key === 'profile' ? { ...entry.value, uid: targetUid } : key.startsWith('score:') ? { ...entry.value, userId: targetUid } : entry.value,
  };
  storeAccountState(mergeAccountState(readAccountState(targetUid), transferred));
}
export function writeAccountEntry(uid: string, key: string, value: unknown): void {
  const state = readAccountState(uid);
  if (JSON.stringify(state.entries[key]?.value) === JSON.stringify(value)) return;
  state.entries[key] = { updatedAt: Math.max(Date.now(), (state.entries[key]?.updatedAt || 0) + 1), value };
  storeAccountState(state);
  window.dispatchEvent(new Event('beatpulse-account-dirty'));
}
export function saveAccountProfile(uid: string, profile: UserProfile): void {
  const previous = readAccountState(uid).entries.profile?.value;
  // Counters are a migration baseline; new game results are immutable separate entries.
  const counters = previous ? Object.fromEntries(['exp', 'level', 'totalScore', 'songsCompleted', 'maxComboAllTime', 'bestAccuracy'].map(key => [key, previous[key] ?? 0])) : {};
  writeAccountEntry(uid, 'profile', { ...profile, uid, ...counters });
}
export function accountProfile(state: AccountState): UserProfile | undefined {
  const base = state.entries.profile?.value as UserProfile | undefined;
  if (!base) return undefined;
  const profile = { ...base };
  for (const [key, entry] of Object.entries(state.entries)) {
    if (!key.startsWith('result:')) continue;
    profile.exp += entry.value.exp; profile.totalScore += entry.value.score; profile.songsCompleted++;
    profile.maxComboAllTime = Math.max(profile.maxComboAllTime || 0, entry.value.maxCombo);
    profile.bestAccuracy = Math.max(profile.bestAccuracy || 0, entry.value.accuracy);
  }
  profile.level = Math.max(base.level, Math.floor(profile.exp / 1000) + 1);
  return profile;
}
export function recordAccountResult(uid: string, profile: UserProfile, score: number, maxCombo: number, accuracy: number): UserProfile {
  if (!readAccountState(uid).entries.profile) saveAccountProfile(uid, profile);
  writeAccountEntry(uid, `result:${crypto.randomUUID()}`, { score, maxCombo, accuracy, exp: Math.max(10, Math.round((score / 1000) * (accuracy / 100))) });
  return accountProfile(readAccountState(uid))!;
}
export function accountScores(state: AccountState, songId: string): Record<string, HighScore> {
  return Object.fromEntries(Object.entries(state.entries).filter(([key, entry]) => key.startsWith('score:') && entry.value.songId === songId).map(([, entry]) => [entry.value.difficulty, entry.value]));
}
export type EditorPreferences = { toolMode: 'pan' | 'tap' | 'hold' | 'select' | 'range' | 'eraser'; holdDuration: number; snapDivision: number; zoomScale: number; playbackSpeed: number; canvasHeightMode: 'normal' | 'large'; enableHitsounds: boolean; enableMetronome: boolean; saveMode: 'auto' | 'manual' };
export const DEFAULT_EDITOR: EditorPreferences = { toolMode: 'tap', holdDuration: 0.5, snapDivision: 4, zoomScale: 90, playbackSpeed: 1, canvasHeightMode: 'normal', enableHitsounds: true, enableMetronome: false, saveMode: 'auto' };
export function sanitizeEditor(input: Partial<EditorPreferences> = {}): EditorPreferences {
  if (!input || typeof input !== 'object') input = {};
  const result = { ...DEFAULT_EDITOR };
  for (const key of ['enableHitsounds', 'enableMetronome'] as const) if (typeof input[key] === 'boolean') result[key] = input[key];
  for (const [key, min, max] of [['holdDuration', 0.01, 60], ['snapDivision', 1, 64], ['zoomScale', 10, 1000], ['playbackSpeed', 0.1, 4]] as const) if (Number.isFinite(input[key]) && input[key]! >= min && input[key]! <= max) result[key] = input[key]!;
  if (['pan', 'tap', 'hold', 'select', 'range', 'eraser'].includes(input.toolMode!)) result.toolMode = input.toolMode!;
  if (['normal', 'large'].includes(input.canvasHeightMode!)) result.canvasHeightMode = input.canvasHeightMode!;
  if (['auto', 'manual'].includes(input.saveMode!)) result.saveMode = input.saveMode!;
  return result;
}
