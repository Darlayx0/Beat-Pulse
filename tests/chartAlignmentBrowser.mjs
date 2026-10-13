import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.env.EDITOR_TEST_URL || 'http://127.0.0.1:5187';
const server = process.env.EDITOR_TEST_URL ? null : spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5187', '--strictPort'], { stdio: 'pipe', windowsHide: true });
let serverOutput = '';
server?.stdout.on('data', c => { serverOutput += c; });
server?.stderr.on('data', c => { serverOutput += c; });
let browser;
const timeout = setTimeout(() => { server?.kill(); process.exit(1); }, 120000);
const readyBy = Date.now() + 15000;
try {
  while (true) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) throw new Error(serverOutput);
    try { const response = await fetch(base, { signal: AbortSignal.timeout(1000) }); if (response.ok) break; } catch {}
    if (Date.now() >= readyBy) throw new Error(`Vite readiness timeout: ${serverOutput}`);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('AUDIT_FIXTURE'))?.charts.Audit);
  const waitOffset = async offset => page.waitForFunction(expected => JSON.parse(localStorage.getItem('AUDIT_FIXTURE'))?.charts.Audit.offset === expected, offset, { timeout: 6000 });
  const open = async () => {
    await page.locator('#editor-btn-more-hub').click();
    await page.getByRole('button', { name: 'Pergeseran & Playhead', exact: false }).click();
  };
  const close = () => page.getByRole('button', { name: 'Tutup konfigurasi studio', exact: true }).click();
  await page.goto(`${base}/tests/editorHarness.html?count=241`);
  await page.locator('canvas').waitFor();
  await open();
  assert.equal(await page.getByRole('button', { name: 'Dengarkan timing tersimpan', exact: true }).isDisabled(), true, 'fallback synth must not verify the original song');
  const before = await page.getByRole('combobox', { name: 'Note acuan', exact: true }).evaluate(el => [...el.options].map(o => o.value));
  await page.getByRole('spinbutton', { name: 'Geser chart milidetik', exact: true }).fill('125');
  await page.getByRole('button', { name: 'Terapkan sinkronisasi', exact: true }).click();
  await waitOffset(-0.125);
  const originalNotes = (await saved()).notes;
  assert.equal(await page.getByRole('spinbutton', { name: 'Geser chart milidetik', exact: true }).inputValue(), '0');
  assert.equal(await page.getByRole('button', { name: 'Terapkan sinkronisasi', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Undo timing / editing terakhir', exact: true }).click();
  await waitOffset(0);
  assert.deepEqual((await saved()).notes, originalNotes);
  await close();
  await page.getByRole('button', { name: 'Redo (Ctrl+Y / Ctrl+Shift+Z) - Ulangi perubahan', exact: true }).click();
  await waitOffset(-0.125);
  await page.reload(); await page.locator('canvas').waitFor(); await open();
  assert.match(await page.getByLabel('Preview sinkronisasi').innerText(), /-125\.000 ms/);
  assert.deepEqual((await saved()).notes, originalNotes);
  // Three distant references diagnose offset; changing the last exposes nonlinear timing.
  for (const index of [0, 120, 240]) {
    await page.getByRole('combobox', { name: 'Note acuan', exact: true }).selectOption(before[index]);
    await page.getByRole('spinbutton', { name: 'Waktu audio acuan', exact: true }).fill(String(originalNotes[index].time + 0.225));
    await page.getByRole('button', { name: 'Tambahkan / perbarui acuan', exact: true }).click();
  }
  assert.ok((await page.locator('body').innerText()).includes('Acuan mendukung koreksi offset tetap.'));
  await page.getByRole('button', { name: 'Gunakan saran pada preview', exact: true }).click();
  assert.ok(Math.abs(Number(await page.getByRole('spinbutton', { name: 'Geser chart milidetik', exact: true }).inputValue()) - 100) < 1e-8);
  await page.getByRole('spinbutton', { name: 'Waktu audio acuan', exact: true }).fill(String(originalNotes[240].time + 0.5));
  await page.getByRole('button', { name: 'Tambahkan / perbarui acuan', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Gunakan saran pada preview', exact: true }).isDisabled(), true);
  // Drift in three evenly spaced references must also reject a global-offset suggestion.
  for (const [i, index] of [0, 120, 240].entries()) {
    await page.getByRole('combobox', { name: 'Note acuan', exact: true }).selectOption(before[index]);
    await page.getByRole('spinbutton', { name: 'Waktu audio acuan', exact: true }).fill(String(originalNotes[index].time + 0.225 + i * 0.05));
    await page.getByRole('button', { name: 'Tambahkan / perbarui acuan', exact: true }).click();
  }
  assert.ok((await page.locator('body').innerText()).includes('Terdeteksi drift:'));
  assert.equal(await page.getByRole('button', { name: 'Gunakan saran pada preview', exact: true }).isDisabled(), true);
  await page.getByRole('spinbutton', { name: 'Geser chart milidetik', exact: true }).fill('-1000');
  assert.equal(await page.getByRole('button', { name: 'Terapkan sinkronisasi', exact: true }).isDisabled(), true);
  assert.deepEqual((await saved()).notes, originalNotes);
  assert.equal(await page.locator('#editor-more-fullscreen-hub').evaluate(e => e.scrollWidth > e.clientWidth), false);
  await page.getByRole('button', { name: 'Edit waktu note', exact: true }).click();
  await page.getByRole('combobox', { name: 'Cakupan lane', exact: true }).selectOption('1');
  await page.getByRole('spinbutton', { name: 'Delta shift', exact: true }).fill('300');
  await page.getByRole('button', { name: 'Terapkan pergeseran', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('AUDIT_FIXTURE'))?.charts.Audit.notes.find(n => n.id === 'fixture-1').time === 0.525, null, { timeout: 6000 });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('AUDIT_FIXTURE'))?.charts.Audit.notes.find(n => n.id === 'fixture-1').time === 0.225, null, { timeout: 6000 });
  assert.deepEqual((await saved()).notes, originalNotes);
  assert.equal((await saved()).offset, -0.125);
  await close();
  await page.locator('#editor-btn-more-hub').click();
  await page.getByRole('button', { name: 'Track & Relink Audio', exact: false }).click();
  // Decode a real PCM WAV through the application's relink path.
  const sampleRate = 8000;
  const pcmBytes = sampleRate * 35 * 2;
  const wav = Buffer.alloc(44 + pcmBytes);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + pcmBytes, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(pcmBytes, 40);
  for (let i = 0; i < sampleRate * 35; i++) wav.writeInt16LE(Math.round(3000 * Math.sin(2 * Math.PI * 440 * i / sampleRate)), 44 + i * 2);
  await page.locator('#editor-more-fullscreen-hub input[type=file]').setInputFiles({ name: 'clock-fixture.wav', mimeType: 'audio/wav', buffer: wav });
  await page.getByText('Audio "clock-fixture.wav" berhasil dihubungkan!', { exact: false }).waitFor();
  await close(); await open();
  const audition = page.getByRole('button', { name: 'Dengarkan timing tersimpan', exact: true });
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Dengarkan timing tersimpan' && !b.disabled));
  await page.getByRole('combobox', { name: 'Note acuan', exact: true }).selectOption('fixture-120');
  await audition.click();
  const clock = () => page.evaluate(async () => { const { audioEngine } = await import('/src/lib/audioEngine.ts'); return { time: audioEngine.getCurrentTime(), playing: audioEngine.getIsPlaying() }; });
  const start = await clock();
  assert.equal(start.playing, true);
  assert.ok(start.time >= 13.225 && start.time < 14, `audition uses chartTime - offset: ${start.time}`);
  await page.getByRole('button', { name: 'Putar / Jeda Audio (Spasi)', exact: true }).click();
  assert.equal((await clock()).playing, false);
  await page.getByRole('slider', { name: 'Seek linimasa audio', exact: true }).fill('3');
  assert.ok(Math.abs((await clock()).time - 3.125) < 1e-8);
  await page.getByRole('button', { name: 'Putar / Jeda Audio (Spasi)', exact: true }).click();
  await open();
  await page.getByRole('spinbutton', { name: 'Geser chart milidetik', exact: true }).fill('5');
  await page.getByRole('button', { name: 'Terapkan sinkronisasi', exact: true }).click();
  assert.equal((await clock()).playing, false, 'timing edits pause the source rather than running on its old clock');
  await page.getByRole('button', { name: 'Undo timing / editing terakhir', exact: true }).click();
  assert.match(await page.getByLabel('Preview sinkronisasi').innerText(), /-125\.000 ms/);
  assert.deepEqual(errors, []);
  await context.close();
  console.log('PASS: signed offset, atomic Undo/Redo, reload, note/hold preservation, reference diagnosis, drift rejection, bounds, lane editing, mobile overflow, fallback gate, WAV audition, seek and playback pause on timing edits.');
} finally {
  clearTimeout(timeout);
  await browser?.close();
  server?.kill();
}
