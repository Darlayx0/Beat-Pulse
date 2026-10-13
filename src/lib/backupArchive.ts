import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import type { FullLibraryBackup } from './indexedDb';

const MAX_BYTES = 512 * 1024 * 1024;
async function checksum(bytes: Uint8Array): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>)), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function encodeBackupArchive(backup: FullLibraryBackup): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  const audio: Record<string, { file: string; mime: string }> = {};
  let index = 0;
  for (const [id, data] of Object.entries(backup.audioBlobs || {})) {
    const [header, content] = data.split(',');
    const raw = atob(content);
    const path = `audio/${index++}.bin`;
    files[path] = Uint8Array.from(raw, char => char.charCodeAt(0));
    audio[id] = { file: path, mime: header.match(/^data:([^;]*);/)?.[1] || 'audio/mpeg' };
  }
  files['library.json'] = strToU8(JSON.stringify({ ...backup, audioBlobs: undefined }));
  const hashes = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([path, bytes]) => [path, await checksum(bytes)])));
  files['manifest.json'] = strToU8(JSON.stringify({ app: 'BeatPulse Studio', formatVersion: 1, hashes, audio }));
  if (Object.values(files).reduce((sum, data) => sum + data.length, 0) > MAX_BYTES - 1024 * 1024) throw new Error('Cadangan melebihi batas 512 MiB. Kurangi ukuran audio sebelum mengekspor.');
  return zipSync(files, { level: 0 }); // Audio is already compressed; avoid blocking recompression.
}
export async function decodeBackupArchive(bytes: Uint8Array): Promise<FullLibraryBackup> {
  if (bytes.length > MAX_BYTES) throw new Error('Cadangan melebihi batas 512 MiB.');
  let total = 0;
  const files = unzipSync(bytes, { filter: file => {
    total += file.originalSize;
    if (total > MAX_BYTES || !/^(manifest\.json|library\.json|audio\/\d+\.bin)$/.test(file.name)) throw new Error('Isi arsip cadangan tidak valid atau terlalu besar.');
    return true;
  } });
  if (!files['manifest.json'] || !files['library.json']) throw new Error('Manifest cadangan tidak ditemukan.');
  const manifest = JSON.parse(strFromU8(files['manifest.json']));
  if (manifest.app !== 'BeatPulse Studio' || manifest.formatVersion !== 1 || !manifest.hashes || !manifest.audio) throw new Error('Format arsip cadangan tidak didukung.');
  for (const [path, data] of Object.entries(files)) {
    if (path !== 'manifest.json' && manifest.hashes[path] !== await checksum(data)) throw new Error(`Cadangan rusak: ${path}. Tidak ada data yang dipulihkan.`);
  }
  for (const path of Object.keys(manifest.hashes)) if (!files[path]) throw new Error('Cadangan tidak lengkap.');
  const backup: FullLibraryBackup = JSON.parse(strFromU8(files['library.json']));
  backup.audioBlobs = {};
  for (const [id, reference] of Object.entries(manifest.audio) as [string, { file: string; mime: string }][]) {
    const data = files[reference.file];
    if (!data || !/^audio\/\d+\.bin$/.test(reference.file) || !/^[-\w.+/]*$/.test(reference.mime)) throw new Error('Referensi audio cadangan tidak valid.');
    const chunks: string[] = [];
    for (let i = 0; i < data.length; i += 32768) chunks.push(String.fromCharCode(...data.subarray(i, i + 32768)));
    backup.audioBlobs[id] = `data:${reference.mime};base64,${btoa(chunks.join(''))}`;
  }
  return backup;
}
