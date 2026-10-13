import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, unzipSync } from 'fflate';
import { copyAccountState, emptyAccountState, mergeAccountState, accountProfile, accountScores, recordAccountResult, saveAccountProfile, readAccountState, writeAccountEntry, sanitizeEditor } from '../src/lib/accountState';
import { encodeBackupArchive, decodeBackupArchive } from '../src/lib/backupArchive';
import type { UserProfile } from '../src/types';
import type { FullLibraryBackup } from '../src/lib/indexedDb';

class MemoryStorage {
  data = new Map<string, string>();
  get length() { return this.data.size; }
  key(index: number) { return [...this.data.keys()][index] || null; }
  getItem(key: string) { return this.data.get(key) || null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
  clear() { this.data.clear(); }
}
const local = new MemoryStorage();
Object.assign(globalThis, { localStorage: local, sessionStorage: new MemoryStorage(), window: new EventTarget() });
const profile: UserProfile = { uid: 'github:1', username: 'Player', email: '', avatarUrl: '', avatarType: 'preset', level: 1, exp: 100, totalScore: 200, songsCompleted: 2, createdAt: 1, updatedAt: 1 };

test('offline journal survives reload and isolates accounts, including best scores', () => {
  local.clear();
  writeAccountEntry('github:1', 'editor', { zoomScale: 150, snapDivision: 8 });
  writeAccountEntry('github:1', 'score:song:Hard', { songId: 'song', difficulty: 'Hard', score: 90 });
  assert.equal(readAccountState('github:1').entries.editor.value.zoomScale, 150);
  assert.deepEqual(readAccountState('github:2').entries, {});
  const remote = emptyAccountState('github:1');
  remote.entries['score:song:Hard'] = { updatedAt: Date.now() + 100, value: { songId: 'song', difficulty: 'Hard', score: 10 } };
  const merged = mergeAccountState(readAccountState('github:1'), remote);
  assert.equal(accountScores(merged, 'song').Hard.score, 90);
  assert.throws(() => mergeAccountState(merged, emptyAccountState('github:2')), /akun/);
});

test('concurrent devices preserve both game results and never count replayed synchronization twice', () => {
  local.clear(); saveAccountProfile('github:1', profile);
  const baseline = local.getItem('BEATPULSE_ACCOUNT_V1_github:1')!;
  recordAccountResult('github:1', profile, 1000, 50, 90);
  const first = readAccountState('github:1');
  local.setItem('BEATPULSE_ACCOUNT_V1_github:1', baseline);
  recordAccountResult('github:1', profile, 2000, 70, 95);
  const second = readAccountState('github:1');
  const combined = mergeAccountState(first, second);
  const restored = accountProfile(combined)!;
  assert.equal(restored.totalScore, 3200);
  assert.equal(restored.songsCompleted, 4);
  assert.equal(restored.exp, 120);
  assert.equal(restored.maxComboAllTime, 70);
  assert.deepEqual(accountProfile(mergeAccountState(combined, first)), restored);
  assert.deepEqual(accountProfile(mergeAccountState(second, first)), restored);
});

test('invalid editor preferences use safe defaults', () => {
  assert.equal(sanitizeEditor({ zoomScale: NaN, playbackSpeed: -5, snapDivision: Infinity }).zoomScale, 90);
  assert.equal(sanitizeEditor({ playbackSpeed: -5 }).playbackSpeed, 1);
  assert.equal(sanitizeEditor({ toolMode: 'range', enableMetronome: true }).toolMode, 'range');
});

test('explicit account connection transfers guest progress without erasing the original', () => {
  local.clear();
  saveAccountProfile('guest_unauthenticated', { ...profile, uid: 'guest_unauthenticated' });
  recordAccountResult('guest_unauthenticated', profile, 500, 20, 90);
  const original = readAccountState('guest_unauthenticated');
  copyAccountState('guest_unauthenticated', 'github:1');
  assert.equal(accountProfile(readAccountState('github:1'))!.uid, 'github:1');
  assert.equal(accountProfile(readAccountState('github:1'))!.totalScore, 700);
  assert.deepEqual(readAccountState('guest_unauthenticated'), original);
  copyAccountState('guest_unauthenticated', 'github:1');
  assert.equal(accountProfile(readAccountState('github:1'))!.totalScore, 700);
});

const backup: FullLibraryBackup = { version: 3, appName: 'BeatPulse Studio', exportedAt: '2026-10-13', settings: {} as any,
  songs: [{ id: 'song', title: 'Test', artist: 'Player', bpm: 120, duration: 60, charts: { Hard: { id: 'chart', songId: 'song', difficulty: 'Hard', bpm: 120, offset: 0, creator: 'Player', createdAt: 1, notes: [{ id: 'note', time: 1, lane: 0 }] } } }], highScores: {}, audioBlobs: { song: 'data:audio/mpeg;base64,AQIDBA==' }, accountState: emptyAccountState('github:1'), editorDrafts: { BEATPULSE_CHART_DRAFT_song_Hard: '{"notes":[]}' } };

test('ZIP roundtrip preserves audio, chart order, account data and editor drafts', async () => {
  const restored = await decodeBackupArchive(await encodeBackupArchive(backup));
  assert.deepEqual(restored, backup);
});

test('checksum rejects modified chart before restore and rejects missing audio', async () => {
  const files = unzipSync(await encodeBackupArchive(backup));
  files['library.json'][10] ^= 1;
  await assert.rejects(decodeBackupArchive(zipSync(files)), /rusak/);
  const missing = unzipSync(await encodeBackupArchive(backup));
  delete missing['audio/0.bin'];
  await assert.rejects(decodeBackupArchive(zipSync(missing)), /lengkap/);
});

test('invalid backup data is rejected before any storage mutation', async () => {
  const { importLibraryBackup } = await import('../src/lib/indexedDb');
  const before = [...local.data];
  await assert.rejects(importLibraryBackup({ ...backup, songs: [{ ...backup.songs[0], charts: { Hard: { ...backup.songs[0].charts.Hard, notes: [{ id: 'bad', lane: 9, time: 0 }] } } }] }), /Chart/);
  await assert.rejects(importLibraryBackup({ ...backup, editorDrafts: { BEATPULSE_GITHUB_SYNC_V1: 'token' } }), /Draf/);
  assert.deepEqual([...local.data], before);
});

test('GitHub restores settings and progress on fresh device; failed upload preserves journal; other accounts are rejected', async () => {
  local.clear();
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  console.warn = () => {};
  let failure = false;
  let owner = 1;
  const files: Record<string, { content: string }> = { 'beatpulse-sync.json': { content: '{"version":1}' } };
  globalThis.fetch = async (url, init) => {
    const path = new URL(String(url)).pathname;
    if (path === '/user') return Response.json({ id: owner, login: `player${owner}` });
    const gist = () => ({ id: 'persistent', public: false, owner: { id: owner }, files });
    if (path === '/gists') return Response.json([gist()]);
    assert.equal(path, '/gists/persistent');
    if (init?.method === 'PATCH') {
      if (failure) return new Response('', { status: 503 });
      Object.assign(files, JSON.parse(String(init.body)).files);
    }
    return Response.json(gist());
  };
  try {
    const { connectGithub, disconnectGithub, syncGithubAccountState } = await import('../src/services/githubSyncService');
    await connectGithub('fixture', false);
    writeAccountEntry('github:1', 'editor', { zoomScale: 160 });
    saveAccountProfile('github:1', profile);
    recordAccountResult('github:1', profile, 5000, 100, 99);
    const saved = readAccountState('github:1');
    await syncGithubAccountState(saved);
    disconnectGithub(); local.clear();
    await connectGithub('device-two', false);
    const restored = await syncGithubAccountState(emptyAccountState('github:1'));
    assert.equal(restored.entries.editor.value.zoomScale, 160);
    assert.equal(accountProfile(restored)!.songsCompleted, 3);
    writeAccountEntry('github:1', 'editor', { zoomScale: 180 });
    const pending = readAccountState('github:1');
    failure = true;
    await assert.rejects(syncGithubAccountState(pending), /503/);
    assert.deepEqual(readAccountState('github:1'), pending);
    failure = false;
    await syncGithubAccountState(pending);
    disconnectGithub(); owner = 2;
    await connectGithub('other-account', false);
    await assert.rejects(syncGithubAccountState(saved), /cocok/);
    disconnectGithub();
  } finally { globalThis.fetch = originalFetch; console.warn = originalWarn; }
});
