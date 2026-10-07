import { Song, Chart } from '../types';

export function createSynthesizedAudioBuffer(
  audioCtx: AudioContext,
  bpm: number,
  durationSec: number = 30,
  style: 'calm' | 'synthwave' | 'cyber' = 'synthwave'
): AudioBuffer {
  const sampleRate = audioCtx.sampleRate;
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = audioCtx.createBuffer(2, numSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  const beatSec = 60 / bpm;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sampleL = 0;
    let sampleR = 0;

    const beatPhase = (t % beatSec) / beatSec;
    const beatIndex = Math.floor(t / beatSec) % 4;

    if (style === 'calm') {
      // Soft gentle kick on beat 1 and 3
      if ((beatIndex === 0 || beatIndex === 2) && beatPhase < 0.25) {
        const kickFreq = 100 * Math.exp(-beatPhase * 18);
        const kickEnv = Math.exp(-beatPhase * 10);
        const kick = Math.sin(2 * Math.PI * kickFreq * t) * kickEnv * 0.4;
        sampleL += kick;
        sampleR += kick;
      }

      // Smooth ambient chord pad (flat, relaxing)
      const chordNotes = [220, 261.63, 329.63, 392]; // A3, C4, E4, G4
      const noteFreq = chordNotes[beatIndex];
      const sinePad = Math.sin(2 * Math.PI * noteFreq * t) * 0.15;
      const subPad = Math.sin(2 * Math.PI * (noteFreq / 2) * t) * 0.12;
      sampleL += sinePad + subPad;
      sampleR += sinePad + subPad;

      // Soft rimshot on beat 3
      if (beatIndex === 2 && beatPhase < 0.08) {
        const rim = Math.sin(2 * Math.PI * 800 * t) * Math.exp(-beatPhase * 40) * 0.15;
        sampleL += rim;
        sampleR += rim;
      }
    } else {
      // Kick Drum on every beat for synthwave / cyber
      if (beatPhase < 0.2) {
        const kickFreq = (style === 'cyber' ? 170 : 140) * Math.exp(-beatPhase * 25);
        const kickEnv = Math.exp(-beatPhase * 15);
        const kick = Math.sin(2 * Math.PI * kickFreq * t) * kickEnv * 0.7;
        sampleL += kick;
        sampleR += kick;
      }

      // Snare / Clap on beats 2 and 4
      if ((beatIndex === 1 || beatIndex === 3) && beatPhase < 0.15) {
        const noise = (Math.random() * 2 - 1) * Math.exp(-beatPhase * 30);
        sampleL += noise * 0.4;
        sampleR += noise * 0.4;
      }

      // Hi-Hat on 8th notes
      const hihatPhase = (t % (beatSec / 2)) / (beatSec / 2);
      if (hihatPhase < 0.05) {
        const hihat = (Math.random() * 2 - 1) * Math.exp(-hihatPhase * 60) * 0.2;
        sampleL += hihat;
        sampleR += hihat;
      }

      // Synth Melodies
      if (style === 'cyber') {
        const bassFreq = beatIndex === 0 ? 55 : beatIndex === 2 ? 65 : 49; // A1, C2, G1
        const bassSaw = ((t * bassFreq) % 1) * 2 - 1;
        const bassEnv = Math.exp(-beatPhase * 4);
        sampleL += bassSaw * bassEnv * 0.25;
        sampleR += bassSaw * bassEnv * 0.25;
      } else {
        // Synthwave Arp
        const notes = [110, 138.59, 164.81, 220]; // A2, C#3, E3, A3
        const arpIndex = Math.floor((t % beatSec) / (beatSec / 4));
        const arpFreq = notes[arpIndex];
        const arpSquare = Math.sin(2 * Math.PI * arpFreq * t) > 0 ? 0.2 : -0.2;
        const arpEnv = Math.exp(-((t % (beatSec / 4)) / (beatSec / 4)) * 6);
        sampleL += arpSquare * arpEnv * 0.3;
        sampleR += arpSquare * arpEnv * 0.3;
      }
    }

    left[i] = Math.max(-1, Math.min(1, sampleL));
    right[i] = Math.max(-1, Math.min(1, sampleR));
  }

  return buffer;
}

export function generatePresetCharts(songId: string, bpm: number, durationSec: number): Song['charts'] {
  const beatSec = 60 / bpm;
  const totalBeats = Math.floor(durationSec / beatSec);

  // Helper to make notes
  const buildNotes = (density: 'easy' | 'medium' | 'hard' | 'expert') => {
    const notes = [];
    let idCounter = 1;
    let lastLane = 0;

    for (let b = 1; b < totalBeats - 2; b++) {
      const time = b * beatSec;

      if (density === 'easy') {
        if (b % 2 === 0) {
          lastLane = (lastLane + 1) % 4;
          notes.push({ id: `ez_${idCounter++}`, lane: lastLane, time: Number(time.toFixed(3)) });
        }
      } else if (density === 'medium') {
        lastLane = (lastLane + (b % 2 === 0 ? 1 : 2)) % 4;
        notes.push({ id: `med_${idCounter++}`, lane: lastLane, time: Number(time.toFixed(3)) });
      } else if (density === 'hard') {
        lastLane = (lastLane + 1) % 4;
        notes.push({ id: `hd_${idCounter++}`, lane: lastLane, time: Number(time.toFixed(3)) });

        // Add 8th note subdiv
        if (b % 2 === 0) {
          const subTime = time + beatSec / 2;
          const subLane = (lastLane + 2) % 4;
          notes.push({ id: `hd_${idCounter++}`, lane: subLane, time: Number(subTime.toFixed(3)) });
        }
      } else {
        // Expert
        lastLane = (lastLane + 1) % 4;
        notes.push({ id: `exp_${idCounter++}`, lane: lastLane, time: Number(time.toFixed(3)) });

        const subTime1 = time + beatSec / 4;
        const subTime2 = time + beatSec / 2;
        const subTime3 = time + (beatSec * 3) / 4;

        notes.push({ id: `exp_${idCounter++}`, lane: (lastLane + 1) % 4, time: Number(subTime1.toFixed(3)) });
        notes.push({ id: `exp_${idCounter++}`, lane: (lastLane + 2) % 4, time: Number(subTime2.toFixed(3)) });
        if (b % 2 === 0) {
          notes.push({ id: `exp_${idCounter++}`, lane: (lastLane + 3) % 4, time: Number(subTime3.toFixed(3)) });
        }
      }
    }
    return notes;
  };

  const createChartObj = (diff: 'Easy' | 'Medium' | 'Hard' | 'Expert', density: 'easy' | 'medium' | 'hard' | 'expert'): Chart => ({
    id: `chart_${songId}_${diff.toLowerCase()}`,
    songId,
    difficulty: diff,
    bpm,
    offset: 0,
    notes: buildNotes(density),
    creator: 'BeatPulse Studio',
    createdAt: Date.now(),
  });

  return {
    Easy: createChartObj('Easy', 'easy'),
    Medium: createChartObj('Medium', 'medium'),
    Hard: createChartObj('Hard', 'hard'),
    Expert: createChartObj('Expert', 'expert'),
  };
}

export const PRESET_SONGS: Song[] = [
  {
    id: 'preset_serene_breeze',
    title: 'Serene Breeze (Flat & Relax)',
    artist: 'BeatPulse Ambient',
    bpm: 84,
    duration: 35,
    isPreset: true,
    coverColor: 'from-emerald-600 to-teal-900',
    charts: generatePresetCharts('preset_serene_breeze', 84, 35),
  },
  {
    id: 'preset_neon_horizon',
    title: 'Neon Horizon (Hidup & Groovy)',
    artist: 'Retro Synth Wave',
    bpm: 112,
    duration: 35,
    isPreset: true,
    coverColor: 'from-purple-600 to-pink-900',
    charts: generatePresetCharts('preset_neon_horizon', 112, 35),
  },
  {
    id: 'preset_cyber_overdrive',
    title: 'Cybernetic Overdrive (Dinamis & Fast)',
    artist: 'BeatPulse Synthesizer',
    bpm: 136,
    duration: 35,
    isPreset: true,
    coverColor: 'from-cyan-600 to-blue-900',
    charts: generatePresetCharts('preset_cyber_overdrive', 136, 35),
  },
];

/**
 * Pure helper to guarantee preset tracks are always present and cleanly merged with user customizations
 */
export function mergeSongsWithPresets(userSongs: Song[] = []): Song[] {
  const userSongMap = new Map<string, Song>();
  (userSongs || []).forEach((s) => {
    if (s && s.id) {
      userSongMap.set(s.id, s);
    }
  });

  const combinedSongs: Song[] = [];

  // 1. Always prioritize presets as the first fundamental track set
  for (const preset of PRESET_SONGS) {
    if (userSongMap.has(preset.id)) {
      const savedPreset = userSongMap.get(preset.id)!;
      combinedSongs.push({
        ...preset,
        ...savedPreset,
        charts: {
          ...preset.charts,
          ...(savedPreset.charts || {}),
        },
        isPreset: true,
      });
      userSongMap.delete(preset.id);
    } else {
      combinedSongs.push(preset);
    }
  }

  // 2. Add all custom imported local and YouTube songs
  for (const customSong of userSongMap.values()) {
    if (customSong && customSong.id) {
      combinedSongs.push({ ...customSong, isPreset: false });
    }
  }

  return combinedSongs;
}

