import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Song } from '../src/types';

test('imported audio and every difficulty transfer to a fresh device, with retries and replacement', async () => {
  class MemoryStorage {
    data = new Map<string, string>();
    get length() { return this.data.size; }
    key(i: number) { return [...this.data.keys()][i] || null; }
    getItem(k: string) { return this.data.get(k) || null; }
    setItem(k: string, v: string) { this.data.set(k, v); }
    removeItem(k: string) { this.data.delete(k); }
    clear() { this.data.clear(); }
  }
  const local = new MemoryStorage();
  const cached = new Map<string, Response>();
  const cache = {
    put: async (k: string, v: Response) => { cached.set(k, v.clone()); },
    match: async (k: string) => cached.get(k)?.clone(),
    delete: async (k: string) => cached.delete(k),
  };
  const caches = { open: async () => cache };
  Object.assign(globalThis, { localStorage: local, sessionStorage: new MemoryStorage(),
    window: Object.assign(new EventTarget(), { caches }), caches });
  const originalFetch = globalThis.fetch;
  const warn = console.warn;
  console.warn = () => {};
  const files: Record<string, { content: string }> = { 'beatpulse-sync.json': { content: '{}' } };
  const audioFiles = new Map<string, Uint8Array>();
  let repoExists = false;
  let failUpload = false;
  let corruptDownload = false;
  let uploads = 0;
  const repo = { private: true, owner: { id: 1 } };
  const gist = () => ({ id: 'abc', public: false, owner: { id: 1 }, files });
  globalThis.fetch = async (url, init) => {
    const path = new URL(String(url)).pathname;
    if (path === '/user') return Response.json({ id: 1, login: 'player1' });
    if (path === '/gists') return Response.json([gist()]);
    if (path === '/gists/abc') {
      if (init?.method === 'PATCH') Object.assign(files, JSON.parse(String(init.body)).files);
      return Response.json(gist());
    }
    if (path === '/repos/player1/beatpulse-library') return repoExists ? Response.json(repo) : new Response('', { status: 404 });
    if (path === '/user/repos') {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.private, true);
      repoExists = true;
      return Response.json(repo);
    }
    assert.ok(path.startsWith('/repos/player1/beatpulse-library/contents/audio/'));
    if (init?.method === 'PUT') {
      if (failUpload) return new Response('', { status: 503 });
      audioFiles.set(path, Buffer.from(JSON.parse(String(init.body)).content, 'base64'));
      uploads++;
      return Response.json({});
    }
    const bytes = audioFiles.get(path);
    if (!bytes) return new Response('', { status: 404 });
    if (new Headers(init?.headers).get('Accept') === 'application/vnd.github.raw+json') {
      return new Response(corruptDownload ? 'corrupt' : new Uint8Array(bytes));
    }
    return Response.json({ size: bytes.length });
  };
  try {
    const sync = await import('../src/services/githubSyncService');
    const db = await import('../src/lib/indexedDb');
    await sync.connectGithub('token', false);
    const chart = { id: 'c', songId: 'audio1', difficulty: 'Easy', bpm: 120, offset: 0.2,
      notes: [{ id: 'n', lane: 1, time: 2 }], creator: 'Player', createdAt: 1 };
    const song: Song = { id: 'audio1', userId: 'github:1', title: 'Imported', artist: 'Player', bpm: 120,
      duration: 60, updatedAt: 100, charts: { Easy: chart, Hard: { ...chart, id: 'hard', difficulty: 'Hard' } } };
    const audio = new Blob(['original audio bytes'], { type: 'audio/mpeg' });
    await db.saveSongToDB(song, audio);
    sync.queueGithubSong(song);
    failUpload = true;
    await assert.rejects(sync.syncGithubSongs, /503/);
    assert.equal(files['song-audio1.json'], undefined, 'metadata is not published ahead of audio');
    assert.equal(sync.hasPendingGithubChanges(), true);
    failUpload = false;
    const uploaded = (await sync.syncGithubSongs())[0];
    assert.ok(uploaded.githubAudio);
    assert.equal(uploads, 1);
    assert.equal(sync.hasPendingGithubChanges(), false);
    // Existing Gist libraries acquire audio even without a new chart edit.
    const legacy = { ...uploaded, githubAudio: undefined };
    await db.saveSongToDB(legacy);
    files['song-audio1.json'].content = JSON.stringify(legacy);
    assert.ok((await sync.syncGithubSongs())[0].githubAudio);
    assert.equal(uploads, 1, 'migration deduplicates previously uploaded bytes');
    sync.disconnectGithub(); local.clear(); cached.clear();
    await sync.connectGithub('device-two', false);
    corruptDownload = true;
    await assert.rejects(sync.syncGithubSongs, /rusak/);
    assert.equal((await db.getAllSongsFromDB()).length, 0, 'corrupt audio cannot publish a playable snapshot');
    corruptDownload = false;
    const received = (await sync.syncGithubSongs())[0];
    assert.deepEqual(received.charts, song.charts);
    assert.equal(await (await db.getAudioBlobFromDB(song.id))?.text(), await audio.text());
    const edited = { ...received, updatedAt: 200, charts: { Hard: { ...chart, difficulty: 'Hard', offset: -0.3 } } };
    await db.saveSongToDB(edited); sync.queueGithubSong(edited);
    await sync.syncGithubSongs();
    assert.equal(uploads, 1, 'chart editing reuses existing audio');
    const replaced = { ...edited, updatedAt: 300, githubAudio: undefined };
    const newAudio = new Blob(['replacement audio bytes'], { type: 'audio/ogg' });
    await db.saveSongToDB(replaced, newAudio); sync.queueGithubSong(replaced);
    await sync.syncGithubSongs();
    assert.equal(uploads, 2);
    sync.disconnectGithub(); local.clear(); cached.clear();
    await sync.connectGithub('device-three', false);
    const final = (await sync.syncGithubSongs())[0];
    assert.deepEqual(Object.keys(final.charts), ['Hard']);
    assert.equal(final.charts.Hard.offset, -0.3);
    assert.equal(await (await db.getAudioBlobFromDB(song.id))?.text(), await newAudio.text());
    assert.equal((await db.getAudioBlobFromDB(song.id))?.type, 'audio/ogg');
    cached.clear();
    await sync.syncGithubSongs();
    assert.equal(await (await db.getAudioBlobFromDB(song.id))?.text(), await newAudio.text(), 'sync restores audio purged by the browser');
    sync.queueGithubSong({ ...final, githubAudio: { ...final.githubAudio!, path: '../invalid' }, updatedAt: 400 });
    await assert.rejects(() => sync.downloadGithubAudio({ ...final, githubAudio: { ...final.githubAudio!, path: '../invalid' } }), /tidak valid/);
    sync.disconnectGithub();
  } finally { globalThis.fetch = originalFetch; console.warn = warn; }
});
