import { audioEngine } from '../lib/audioEngine';
import { createSynthesizedAudioBuffer } from '../lib/defaultSongs';

export class AudioService {
  static getContext(): AudioContext {
    return audioEngine.getContext();
  }

  static async decodeAudioBlob(blob: Blob): Promise<AudioBuffer> {
    try {
      if (!blob || !(blob instanceof Blob) || blob.size === 0) {
        throw new Error('Objek audio tidak ditemukan atau kosong.');
      }

      let arrayBuffer: ArrayBuffer;
      try {
        arrayBuffer = await blob.arrayBuffer();
      } catch (readErr: any) {
        // Fallback: FileReader in case blob.arrayBuffer() encounters a detached handle
        try {
          arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = () => reject(reader.error || new Error('Gagal membaca data biner audio'));
            reader.readAsArrayBuffer(blob);
          });
        } catch {
          throw new Error('Data biner audio tidak dapat diakses.');
        }
      }

      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('Data audio kosong (0 bytes).');
      }

      return await audioEngine.decodeAudioData(arrayBuffer, blob.type || 'audio/webm');
    } catch (err: any) {
      console.warn('Audio decoding warning:', err?.message || err);
      throw new Error(err?.message || 'Gagal mendekode file audio. Pastikan format file audio (MP3, WAV, OGG, WEBM, M4A) valid.');
    }
  }

  static createSynthAudio(
    bpm: number,
    duration: number,
    style: 'calm' | 'synthwave' | 'cyber' = 'synthwave'
  ): AudioBuffer {
    const ctx = audioEngine.getContext();
    const buf = createSynthesizedAudioBuffer(ctx, bpm, duration, style);
    (buf as any)._isFallbackSynth = true;
    return buf;
  }

  static loadBuffer(buffer: AudioBuffer): void {
    audioEngine.loadBuffer(buffer);
  }

  static playBGM(startTime: number = 0): void {
    audioEngine.playBGM(startTime);
  }

  static pauseBGM(): void {
    audioEngine.pauseBGM();
  }

  static seek(timeInSeconds: number): void {
    audioEngine.seek(timeInSeconds);
  }

  static getCurrentTime(): number {
    return audioEngine.getCurrentTime();
  }

  static setVolumes(bgmVol: number, sfxVol: number): void {
    audioEngine.setVolumes(bgmVol, sfxVol);
  }

  static playHitsound(type: 'tap' | 'perfect' | 'hold'): void {
    audioEngine.playHitsound(type);
  }
}
