import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cloudSongData, remoteWins, visibleToAccount, shouldRestoreDraft, planCloudReconciliation } from '../src/lib/chartSyncPolicy';
import type { Song } from '../src/types';

const song: Song = {
  id: 'song1', title: 'Test', artist: 'Player', bpm: 120, duration: 60,
  userId: 'account-a', updatedAt: 100, charts: {
    Easy: { id: 'c1', songId: 'song1', difficulty: 'Easy', bpm: 120, offset: 0,
      notes: [{ id: 'n1', lane: 0, time: 1 }], creator: 'Player', createdAt: 1 },
  },
};

test('cloud data preserves notes and strips binary audio and device URLs', () => {
  const result = cloudSongData({ ...song, audioBlob: new Blob(['audio']), audioUrl: 'blob:local-device' });
  assert.deepEqual(result.charts, song.charts);
  assert.equal(Object.hasOwn(result, 'audioBlob'), false);
  assert.equal(Object.hasOwn(result, 'audioUrl'), false);
  assert.equal(cloudSongData({ ...song, audioUrl: 'data:audio/mp3;base64,x' }).audioUrl, undefined);
  assert.equal(cloudSongData({ ...song, audioUrl: 'https://example.com/music.mp3' }).audioUrl, 'https://example.com/music.mp3');
});

test('account isolation hides another account library and keeps guest imports', () => {
  assert.equal(visibleToAccount(song, 'account-a'), true);
  assert.equal(visibleToAccount(song, 'account-b'), false);
  assert.equal(visibleToAccount(song), false);
  assert.equal(visibleToAccount({ ...song, userId: '' }, 'account-b'), true);
});

test('newer chart wins even when notes are removed', () => {
  const empty = { ...song, updatedAt: 101, charts: {} };
  assert.equal(remoteWins(song, empty), true);
  assert.equal(remoteWins(empty, song), false);
  assert.equal(remoteWins(song, song), false);
});

test('deletion tombstones beat equal or older local copies but not newer edits', () => {
  assert.equal(remoteWins(song, { ...song, deleted: true }), true);
  assert.equal(remoteWins(song, { ...song, updatedAt: 99, deleted: true }), false);
  assert.equal(remoteWins(undefined, { ...song, deleted: true }), true);
});

test('older draft cannot override a newly received cloud chart', () => {
  assert.equal(shouldRestoreDraft(99, song, 1), false);
  assert.equal(shouldRestoreDraft(101, song, 1), true);
});

test('two devices transfer a saved chart, receive note removals, and apply deletion', () => {
  const firstUpload = planCloudReconciliation([song], [], 'account-a').upload;
  assert.equal(firstUpload.length, 1);
  let secondDevice = planCloudReconciliation([], firstUpload, 'account-a');
  assert.deepEqual(secondDevice.songs[0].charts, song.charts);
  assert.equal(secondDevice.upload.length, 0);
  const edited = { ...song, updatedAt: 200, charts: { Easy: { ...song.charts.Easy, notes: [] } } };
  const offlineEdit = planCloudReconciliation([edited], firstUpload, 'account-a');
  assert.equal(offlineEdit.upload[0].charts.Easy.notes.length, 0);
  secondDevice = planCloudReconciliation(secondDevice.songs, offlineEdit.upload, 'account-a');
  assert.equal(secondDevice.songs[0].charts.Easy.notes.length, 0);
  const deleted = planCloudReconciliation(secondDevice.songs, [{ ...edited, updatedAt: 300, deleted: true }], 'account-a');
  assert.deepEqual(deleted.songs, []);
  assert.deepEqual(deleted.remove, ['song1']);
  assert.deepEqual(deleted.upload, []);
});

test('reconciliation rejects another account and preserves local audio linking', () => {
  const linked = { ...song, audioUrl: 'blob:this-device' };
  const newer = { ...song, updatedAt: 200 };
  const result = planCloudReconciliation([linked], [newer], 'account-a');
  assert.equal(result.songs[0].audioUrl, 'blob:this-device');
  assert.deepEqual(planCloudReconciliation([song], [newer], 'account-b').songs, []);
});

test('guest imports acquire verified account ownership only when first synchronized', () => {
  const result = planCloudReconciliation([{ ...song, userId: '' }], [], 'account-a');
  assert.equal(result.save[0].userId, 'account-a');
  assert.equal(result.upload[0].userId, 'account-a');
  const newerGuest = { ...song, userId: '', updatedAt: 200 };
  const existingCloud = planCloudReconciliation([newerGuest], [song], 'account-a');
  assert.equal(existingCloud.save[0].userId, 'account-a');
  assert.equal(visibleToAccount(existingCloud.songs[0], 'account-b'), false);
});
