import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Song } from '../src/types';

class MemoryStorage {
  data = new Map<string, string>();
  get length() { return this.data.size; }
  key(index: number) { return [...this.data.keys()][index] || null; }
  getItem(key: string) { return this.data.get(key) || null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
  clear() { this.data.clear(); }
}

test('GitHub transport transfers charts across devices, retries deletion, and isolates accounts', async () => {
  const local = new MemoryStorage();
  Object.assign(globalThis, { localStorage: local, sessionStorage: new MemoryStorage(), window: new EventTarget() });
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  console.warn = () => {}; // Exercise the existing LocalStorage fallback without IndexedDB.
  let failWrite = false;
  let truncated = false;
  let account = 1;
  const files: Record<string, { content: string; truncated?: boolean }> = { 'beatpulse-sync.json': { content: '{"app":"beatpulse","version":1}' } };
  globalThis.fetch = async (url, init) => {
    const path = new URL(String(url)).pathname;
    if (path === '/user') return Response.json({ id: account, login: `player${account}` });
    const gist = () => ({ id: 'abc', public: false, owner: { id: 1 }, files });
    if (path === '/gists') return Response.json([{ ...gist(), owner: { id: account } }]);
    assert.equal(path, '/gists/abc');
    if (init?.method === 'PATCH') {
      if (failWrite) return new Response('', { status: 503 });
      Object.assign(files, JSON.parse(String(init.body)).files);
    }
    if (truncated && files['song-song1.json']) files['song-song1.json'].truncated = true;
    return Response.json(gist());
  };
  try {
    const { connectGithub, disconnectGithub, syncGithubSongs, queueGithubSong, githubQueueKey, getGithubConnection } = await import('../src/services/githubSyncService');
    const { saveSongToDB, deleteSongFromDB, getAllSongsFromDB } = await import('../src/lib/indexedDb');
    await connectGithub('test-token', false);
    assert.equal(local.getItem('BEATPULSE_GITHUB_SYNC_V1'), null, 'token is session-only by default');
    const song: Song = { id: 'song1', userId: 'github:1', title: 'Test', artist: 'Player', bpm: 120,
      duration: 60, updatedAt: 100, charts: { Easy: { id: 'c', songId: 'song1', difficulty: 'Easy', bpm: 120,
        offset: 0, notes: [{ id: 'n', lane: 0, time: 1 }], creator: 'Player', createdAt: 1 } } };
    await saveSongToDB(song);
    queueGithubSong(song);
    await syncGithubSongs();
    assert.deepEqual(JSON.parse(files['song-song1.json'].content).charts, song.charts);

    disconnectGithub(); local.clear(); // Fresh storage represents device two.
    await connectGithub('second-device-token', false);
    assert.deepEqual((await syncGithubSongs())[0].charts, song.charts);

    // Each operation is saved on one device and received in a fresh browser library.
    const easy = song.charts.Easy;
    const hard = { ...easy, id: 'hard', difficulty: 'Hard', bpm: 150, offset: 0.25 };
    const expert = { ...hard, difficulty: 'Expert' };
    const master = { ...expert, id: 'master', difficulty: 'Master' };
    const changes = [
      { ...song, updatedAt: 110, charts: { Easy: easy, Hard: hard } }, // add
      { ...song, updatedAt: 120, charts: { Easy: easy, Expert: expert } }, // rename
      { ...song, updatedAt: 130, charts: { Easy: easy, Expert: expert, Master: master } }, // duplicate
      { ...song, updatedAt: 140, charts: { Master: master, Expert: expert, Easy: easy } }, // reorder
      { ...song, updatedAt: 150, charts: { Master: { ...master, notes: [], offset: -0.1 }, Easy: easy } }, // edit/delete
    ];
    for (const change of changes) {
      await saveSongToDB(change); queueGithubSong(change);
      await syncGithubSongs();
      disconnectGithub(); local.clear();
      await connectGithub('second-device-token', false);
      const received = (await syncGithubSongs())[0];
      assert.deepEqual(received.charts, change.charts);
      assert.deepEqual(Object.keys(received.charts), Object.keys(change.charts));
      assert.equal(received.trackSnapshotVersion, 1);
    }
    // A stale per-track backup must not undo an authoritative cloud deletion.
    local.setItem('BEATPULSE_TRACK_song1_Expert', JSON.stringify({ ...expert, createdAt: 999 }));
    local.setItem('BEATPULSE_TRACK_song1_Master', JSON.stringify({ ...master, createdAt: 999 }));
    const recovered = (await getAllSongsFromDB())[0];
    assert.deepEqual(Object.keys(recovered.charts), ['Master', 'Easy']);
    assert.deepEqual(recovered.charts.Master.notes, []);
    truncated = true;
    await assert.rejects(syncGithubSongs, /terlalu besar/);
    assert.equal((await getAllSongsFromDB())[0].charts.Easy.notes.length, 1);
    truncated = false; delete files['song-song1.json'].truncated;

    await deleteSongFromDB(song.id);
    queueGithubSong({ ...song, updatedAt: 200, deleted: true });
    failWrite = true;
    await assert.rejects(syncGithubSongs, /503/);
    assert.equal(JSON.parse(local.getItem(githubQueueKey('github:1'))!)[song.id].deleted, true);
    failWrite = false;
    assert.deepEqual(await syncGithubSongs(), []);
    assert.equal(JSON.parse(files['song-song1.json'].content).deleted, true);
    assert.deepEqual(JSON.parse(local.getItem(githubQueueKey('github:1'))!), {});

    disconnectGithub(); local.clear();
    await connectGithub('another-token-same-account', false);
    assert.deepEqual(await syncGithubSongs(), [], 'offline deletion reaches a new device');
    account = 2;
    await connectGithub('different-account', false);
    assert.equal(getGithubConnection()?.uid, 'github:2');
    await assert.rejects(syncGithubSongs, /bukan milik akun/);
    disconnectGithub();
  } finally { globalThis.fetch = originalFetch; console.warn = originalWarn; }
});
