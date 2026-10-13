import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.env.EDITOR_TEST_URL || 'http://127.0.0.1:5174';
const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
const errors = [];
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/tests/editorHarness.html`, { timeout: 20000 });
  await page.locator('canvas').waitFor({ timeout: 15000 });
  const archive = await page.evaluate(async () => {
    const { StorageService } = await import('/src/services/storageService.ts');
    const { saveEditorPreferences } = await import('/src/services/accountPersistence.ts');
    const { recordAccountResult } = await import('/src/lib/accountState.ts');
    const { authService } = await import('/src/services/authService.ts');
    const { DEFAULT_SETTINGS } = await import('/src/lib/indexedDb.ts');
    const { encodeBackupArchive } = await import('/src/lib/backupArchive.ts');
    const chart = { id: 'backup-chart', songId: 'backup-song', difficulty: 'Expert', bpm: 140, offset: 0.25, creator: 'Fixture', createdAt: 1, notes: [{ id: 'n', time: 1, lane: 2, duration: 0.5 }] };
    await StorageService.saveSong({ id: 'backup-song', title: 'Persistence fixture', artist: 'Test', duration: 30, bpm: 140, charts: { Expert: chart, Easy: { ...chart, id: 'easy', difficulty: 'Easy', notes: [] } } }, new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/mpeg' }));
    await StorageService.saveSettings({ ...DEFAULT_SETTINGS, scrollSpeed: 3.5 });
    await StorageService.saveScore({ songId: 'backup-song', difficulty: 'Expert', score: 12345, accuracy: 99, maxCombo: 10, grade: 'S', timestamp: 1 });
    recordAccountResult('guest_unauthenticated', authService.getCurrentProfile(), 12345, 10, 99);
    authService.restorePersistentProfile();
    saveEditorPreferences({ toolMode: 'hold', holdDuration: 1, snapDivision: 8, zoomScale: 180, playbackSpeed: 0.75, canvasHeightMode: 'large', enableHitsounds: false, enableMetronome: true, saveMode: 'manual' });
    localStorage.setItem('BEATPULSE_CHART_DRAFT_backup-song_Expert', JSON.stringify({ notes: chart.notes, bpm: 140, offset: 0.25 }));
    StorageService.saveActiveSession({ tab: 'editor', activeSongId: 'backup-song', activeDifficulty: 'Expert' });
    return Array.from(await encodeBackupArchive(await StorageService.exportBackup()));
  });
  await page.reload();
  await page.locator('canvas').waitFor({ timeout: 15000 });
  assert.equal(await page.evaluate(async () => (await import('/src/services/accountPersistence.ts')).loadEditorPreferences().zoomScale), 180);
  const restoredContext = await browser.newContext();
  const restoredPage = await restoredContext.newPage();
  restoredPage.on('pageerror', error => errors.push(error.message));
  await restoredPage.goto(`${base}/tests/editorHarness.html`, { timeout: 20000 });
  await restoredPage.locator('canvas').waitFor({ timeout: 15000 });
  const restored = await restoredPage.evaluate(async bytes => {
    const { StorageService } = await import('/src/services/storageService.ts');
    const { decodeBackupArchive } = await import('/src/lib/backupArchive.ts');
    const { loadEditorPreferences } = await import('/src/services/accountPersistence.ts');
    const { authService } = await import('/src/services/authService.ts');
    await StorageService.importBackup(await decodeBackupArchive(new Uint8Array(bytes)));
    authService.restorePersistentProfile();
    const song = (await StorageService.loadSongs()).find(item => item.id === 'backup-song');
    return { charts: Object.keys(song.charts), notes: song.charts.Expert.notes, offset: song.charts.Expert.offset,
      audio: Array.from(new Uint8Array(await (await StorageService.getAudioBlob('backup-song')).arrayBuffer())),
      settings: await StorageService.loadSettings(), editor: loadEditorPreferences(), scores: await StorageService.getHighScores('backup-song'),
      profile: authService.getCurrentProfile(), draft: localStorage.getItem('BEATPULSE_CHART_DRAFT_backup-song_Expert'), session: StorageService.loadActiveSession() };
  }, archive);
  assert.deepEqual(restored.charts, ['Expert', 'Easy']);
  assert.equal(restored.notes[0].duration, 0.5);
  assert.equal(restored.offset, 0.25);
  assert.deepEqual(restored.audio, [1, 2, 3, 4]);
  assert.equal(restored.settings.scrollSpeed, 3.5);
  assert.equal(restored.editor.zoomScale, 180);
  assert.equal(restored.editor.saveMode, 'manual');
  assert.equal(restored.scores.Expert.score, 12345);
  assert.equal(restored.profile.songsCompleted, 1);
  assert.equal(restored.profile.totalScore, 12345);
  assert.ok(restored.draft);
  assert.equal(restored.session.activeDifficulty, 'Expert');
  assert.deepEqual(errors, []);
  console.log('PASS: browser reload and ZIP restore in fresh storage preserve audio, chart order, notes, offset, settings, editor preferences, scores, progress, drafts and active difficulty; no page errors.');
  await context.close(); await restoredContext.close();
} finally { await browser.close(); }
