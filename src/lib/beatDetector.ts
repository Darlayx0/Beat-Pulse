import { Chart, DifficultyLevel, Note } from '../types';

export type PeakType = 'vocal' | 'bass' | 'percussion' | 'hybrid';

export interface AudioPeak {
  time: number;
  energy: number;
  type: PeakType;
  vocalEnergy: number;
  bassEnergy: number;
  highEnergy: number;
  vocalSustainDuration?: number; // Detected duration of vocal sustain in seconds
  pitchTrend?: 'low' | 'mid' | 'high'; // Estimated pitch bucket for lane mapping
}

export interface BeatAnalysisResult {
  bpm: number;
  offset: number; // Offset to first major beat in seconds
  peaks: AudioPeak[]; // All musical peak timestamps
  vocalPeaks: AudioPeak[]; // Isolated vocal onset timestamps
  instrumentPeaks: AudioPeak[]; // Isolated instrument/drum onset timestamps
  energyProfile: Float32Array; // Normalized overall audio energy over time (10ms frames)
  vocalProfile: Float32Array; // Normalized vocal energy profile
  bassProfile: Float32Array; // Normalized bass/kick energy profile
}

export interface AutoBeatConfig {
  preset?: 'balanced' | 'vocal' | 'drum_bass' | 'mania_stream'; // Simple 1-click style preset
  prioritizeVocals?: boolean; // True: prioritizes vocal syllables before instruments
  rhythmVariety?: 'dynamic' | 'standard' | 'dense' | 'triplet_swing'; // Spacing variety
  gridSnapDivision?: 2 | 4 | 8 | 16 | 6 | 'auto'; // Target grid subdivision alignment
  gridSnapMode?: 'strict_grid' | 'magnetic_hybrid' | 'triplet_swing'; // Grid lock mode
  grooveStyle?: 'balanced_mania' | 'syncopated_vocal' | 'stream_speed' | 'jump_impact'; // Playstyle pattern
  includeHolds?: boolean; // Enable vocal sustain hold notes
  holdSensitivity?: number; // Sensitivity for hold notes (0.0 - 1.0)
}

/**
 * 2nd-order Biquad Filter implementation for audio band separation
 */
class BiquadFilter {
  private b0 = 0;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  static lowPass(sampleRate: number, cutoffHz: number, q = 0.707): BiquadFilter {
    const filter = new BiquadFilter();
    const w0 = (2 * Math.PI * cutoffHz) / sampleRate;
    const alpha = Math.sin(w0) / (2 * q);
    const cosw0 = Math.cos(w0);

    const a0 = 1 + alpha;
    filter.b0 = ((1 - cosw0) / 2) / a0;
    filter.b1 = (1 - cosw0) / a0;
    filter.b2 = ((1 - cosw0) / 2) / a0;
    filter.a1 = (-2 * cosw0) / a0;
    filter.a2 = (1 - alpha) / a0;
    return filter;
  }

  static bandPass(sampleRate: number, centerHz: number, bandwidthHz: number): BiquadFilter {
    const filter = new BiquadFilter();
    const w0 = (2 * Math.PI * centerHz) / sampleRate;
    const q = centerHz / bandwidthHz;
    const alpha = Math.sin(w0) / (2 * q);
    const cosw0 = Math.cos(w0);

    const a0 = 1 + alpha;
    filter.b0 = (alpha) / a0;
    filter.b1 = 0;
    filter.b2 = (-alpha) / a0;
    filter.a1 = (-2 * cosw0) / a0;
    filter.a2 = (1 - alpha) / a0;
    return filter;
  }

  static highPass(sampleRate: number, cutoffHz: number, q = 0.707): BiquadFilter {
    const filter = new BiquadFilter();
    const w0 = (2 * Math.PI * cutoffHz) / sampleRate;
    const alpha = Math.sin(w0) / (2 * q);
    const cosw0 = Math.cos(w0);

    const a0 = 1 + alpha;
    filter.b0 = ((1 + cosw0) / 2) / a0;
    filter.b1 = (-(1 + cosw0)) / a0;
    filter.b2 = ((1 + cosw0) / 2) / a0;
    filter.a1 = (-2 * cosw0) / a0;
    filter.a2 = (1 - alpha) / a0;
    return filter;
  }

  process(sample: number): number {
    const y = this.b0 * sample + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = sample;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/**
 * Advanced Multi-Band Spectral Flux Beat & Vocal Peak Detection
 * Analyzes audio across:
 * 1. Bass / Kick Band (30Hz - 260Hz)
 * 2. Vocal Formant Band (300Hz - 3400Hz) with Vocal Activity Detection (VAD) & Sustain
 * 3. High Percussion Band (3500Hz - 16000Hz)
 */
export function detectBpmAndPeaks(audioBuffer: AudioBuffer): BeatAnalysisResult {
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  // 10ms frame hop for high time precision
  const frameDuration = 0.01;
  const frameSize = Math.floor(sampleRate * frameDuration);
  const totalFrames = Math.floor(channelData.length / frameSize);

  if (totalFrames <= 0) {
    return {
      bpm: 120,
      offset: 0,
      peaks: [],
      vocalPeaks: [],
      instrumentPeaks: [],
      energyProfile: new Float32Array(0),
      vocalProfile: new Float32Array(0),
      bassProfile: new Float32Array(0),
    };
  }

  // Multi-band filters
  const bassFilter = BiquadFilter.lowPass(sampleRate, 260);
  const vocalFilter = BiquadFilter.bandPass(sampleRate, 1400, 2400); // 300Hz - 3400Hz Vocal Formants
  const highFilter = BiquadFilter.highPass(sampleRate, 3600);

  const bassEnergies = new Float32Array(totalFrames);
  const vocalEnergies = new Float32Array(totalFrames);
  const highEnergies = new Float32Array(totalFrames);
  const totalEnergies = new Float32Array(totalFrames);
  const vocalPitchTrend = new Float32Array(totalFrames);

  let maxTotal = 0.0001;
  let maxVocal = 0.0001;
  let maxBass = 0.0001;

  for (let f = 0; f < totalFrames; f++) {
    const frameStart = f * frameSize;
    let bSum = 0;
    let vSum = 0;
    let hSum = 0;
    let tSum = 0;
    let prevVSample = 0;
    let vZeroCrossings = 0;

    for (let i = 0; i < frameSize; i++) {
      const s = channelData[frameStart + i] || 0;
      tSum += s * s;

      const bSample = bassFilter.process(s);
      bSum += bSample * bSample;

      const vSample = vocalFilter.process(s);
      vSum += vSample * vSample;

      // Track zero crossings as a rough pitch/formant proxy
      if ((prevVSample > 0 && vSample <= 0) || (prevVSample < 0 && vSample >= 0)) {
        vZeroCrossings++;
      }
      prevVSample = vSample;

      const hSample = highFilter.process(s);
      hSum += hSample * hSample;
    }

    const bE = Math.sqrt(bSum / frameSize);
    const vE = Math.sqrt(vSum / frameSize);
    const hE = Math.sqrt(hSum / frameSize);
    const tE = Math.sqrt(tSum / frameSize);

    bassEnergies[f] = bE;
    vocalEnergies[f] = vE;
    highEnergies[f] = hE;
    totalEnergies[f] = tE;
    vocalPitchTrend[f] = vZeroCrossings / frameSize; // Pitch proxy

    if (tE > maxTotal) maxTotal = tE;
    if (vE > maxVocal) maxVocal = vE;
    if (bE > maxBass) maxBass = bE;
  }

  // Normalize profiles
  const normalizedTotal = new Float32Array(totalFrames);
  const normalizedVocal = new Float32Array(totalFrames);
  const normalizedBass = new Float32Array(totalFrames);

  for (let f = 0; f < totalFrames; f++) {
    normalizedTotal[f] = totalEnergies[f] / maxTotal;
    normalizedVocal[f] = vocalEnergies[f] / maxVocal;
    normalizedBass[f] = bassEnergies[f] / maxBass;
  }

  // Spectral Flux (Positive rate of onset change)
  const bassFlux = new Float32Array(totalFrames);
  const vocalFlux = new Float32Array(totalFrames);
  const highFlux = new Float32Array(totalFrames);
  const compositeFlux = new Float32Array(totalFrames);

  for (let f = 1; f < totalFrames; f++) {
    const bDiff = bassEnergies[f] - bassEnergies[f - 1];
    const vDiff = vocalEnergies[f] - vocalEnergies[f - 1];
    const hDiff = highEnergies[f] - highEnergies[f - 1];

    bassFlux[f] = bDiff > 0 ? bDiff : 0;
    vocalFlux[f] = vDiff > 0 ? vDiff : 0;
    highFlux[f] = hDiff > 0 ? hDiff : 0;

    // Composite flux weights vocals significantly
    compositeFlux[f] = 0.45 * vocalFlux[f] + 0.35 * bassFlux[f] + 0.20 * highFlux[f];
  }

  // Dynamic moving average peak detection
  const allPeaks: AudioPeak[] = [];
  const vocalPeaks: AudioPeak[] = [];
  const instrumentPeaks: AudioPeak[] = [];

  const lookaround = 14; // +/- 140ms adaptive window

  for (let f = lookaround; f < totalFrames - lookaround; f++) {
    let localSum = 0;
    let localVocalSum = 0;
    for (let w = -lookaround; w <= lookaround; w++) {
      localSum += compositeFlux[f + w];
      localVocalSum += vocalFlux[f + w];
    }
    const localMean = localSum / (lookaround * 2 + 1);
    const threshold = localMean * 1.30 + 0.004;

    const isLocalCompositePeak =
      compositeFlux[f] > threshold &&
      compositeFlux[f] > compositeFlux[f - 1] &&
      compositeFlux[f] >= compositeFlux[f + 1];

    const localVocalMean = localVocalSum / (lookaround * 2 + 1);
    const vocalThreshold = localVocalMean * 1.25 + 0.003;
    const isVocalOnsetPeak =
      vocalFlux[f] > vocalThreshold &&
      vocalFlux[f] > vocalFlux[f - 1] &&
      vocalFlux[f] >= vocalFlux[f + 1];

    if (isLocalCompositePeak || isVocalOnsetPeak) {
      const timeInSec = Number((f * frameDuration).toFixed(3));
      const vEnergy = normalizedVocal[f];
      const bEnergy = normalizedBass[f];
      const hEnergy = highEnergies[f] / (maxTotal || 1);

      // Determine peak archetype
      let type: PeakType = 'hybrid';
      const isVocalDominant = vEnergy > 0.35 && (vEnergy >= bEnergy * 0.95 || isVocalOnsetPeak);
      const isBassDominant = bEnergy > 0.4 && bEnergy > vEnergy * 1.2;

      if (isVocalDominant) {
        type = 'vocal';
      } else if (isBassDominant) {
        type = 'bass';
      } else if (hEnergy > 0.4 && hEnergy > bEnergy && hEnergy > vEnergy) {
        type = 'percussion';
      }

      // Check for vocal sustain / vowel hold length
      let vocalSustain = 0;
      if (isVocalDominant && normalizedVocal[f] > 0.4) {
        let sustainFrames = 0;
        for (let sf = f + 1; sf < Math.min(totalFrames, f + 250); sf++) {
          if (normalizedVocal[sf] > 0.25) {
            sustainFrames++;
          } else {
            break;
          }
        }
        if (sustainFrames > 25) {
          // At least 250ms sustain
          vocalSustain = Number((sustainFrames * frameDuration).toFixed(3));
        }
      }

      // Pitch bucket estimation for lane distribution
      const pTrend = vocalPitchTrend[f];
      const pitchBucket: 'low' | 'mid' | 'high' =
        pTrend > 0.18 ? 'high' : pTrend > 0.09 ? 'mid' : 'low';

      const peakObj: AudioPeak = {
        time: timeInSec,
        energy: compositeFlux[f],
        type,
        vocalEnergy: vEnergy,
        bassEnergy: bEnergy,
        highEnergy: hEnergy,
        vocalSustainDuration: vocalSustain > 0 ? vocalSustain : undefined,
        pitchTrend: pitchBucket,
      };

      allPeaks.push(peakObj);
      if (type === 'vocal') {
        vocalPeaks.push(peakObj);
      } else {
        instrumentPeaks.push(peakObj);
      }
    }
  }

  // Interval Histogram for BPM Estimation (Focus on Bass & Vocal rhythm cadence)
  const intervals: number[] = [];
  for (let i = 1; i < allPeaks.length; i++) {
    const dt = allPeaks[i].time - allPeaks[i - 1].time;
    if (dt >= 0.22 && dt <= 1.2) {
      intervals.push(dt);
    }
  }

  let estimatedBpm = 120;
  if (intervals.length > 6) {
    const binCount = 180;
    const bins = new Array(binCount).fill(0);

    intervals.forEach((interval) => {
      const binIdx = Math.floor((interval - 0.2) / 0.005);
      if (binIdx >= 0 && binIdx < binCount) {
        bins[binIdx] += 1.0;
        if (binIdx > 0) bins[binIdx - 1] += 0.5;
        if (binIdx < binCount - 1) bins[binIdx + 1] += 0.5;
      }
    });

    let maxBin = 0;
    let maxVal = -1;
    bins.forEach((val, idx) => {
      if (val > maxVal) {
        maxVal = val;
        maxBin = idx;
      }
    });

    const dominantInterval = 0.2 + maxBin * 0.005;
    if (dominantInterval > 0) {
      let rawBpm = Math.round(60 / dominantInterval);
      while (rawBpm < 105) rawBpm *= 2;
      while (rawBpm > 195) rawBpm /= 2;
      estimatedBpm = Math.round(rawBpm);
    }
  }

  // Offset Search: Evaluate optimal downbeat alignment
  const beatInterval = 60 / estimatedBpm;
  const searchSteps = 48;
  let bestOffset = 0;
  let bestScore = -1;

  for (let s = 0; s < searchSteps; s++) {
    const candidateOffset = (s / searchSteps) * beatInterval;
    let score = 0;

    for (let t = candidateOffset; t < audioBuffer.duration; t += beatInterval) {
      const frameIndex = Math.floor(t / frameDuration);
      if (frameIndex >= 0 && frameIndex < totalFrames) {
        const e0 = compositeFlux[frameIndex] || 0;
        const e1 = compositeFlux[frameIndex - 1] || 0;
        const e2 = compositeFlux[frameIndex + 1] || 0;
        const v = normalizedVocal[frameIndex] || 0;
        const b = normalizedBass[frameIndex] || 0;
        score += Math.max(e0, e1, e2) * 1.5 + v * 0.5 + b * 0.8;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestOffset = candidateOffset;
    }
  }

  return {
    bpm: estimatedBpm,
    offset: Number(bestOffset.toFixed(3)),
    peaks: allPeaks,
    vocalPeaks,
    instrumentPeaks,
    energyProfile: normalizedTotal,
    vocalProfile: normalizedVocal,
    bassProfile: normalizedBass,
  };
}

/**
 * Finds the nearest audio peak / vocal onset within a specified tolerance.
 * Ideal for Magnetic Peak Snapping.
 */
export function getNearestPeak(
  time: number,
  peaks: AudioPeak[],
  tolerance = 0.055
): AudioPeak | null {
  if (!peaks || peaks.length === 0) return null;

  let closest: AudioPeak | null = null;
  let minDiff = Infinity;

  for (let i = 0; i < peaks.length; i++) {
    const diff = Math.abs(peaks[i].time - time);
    if (diff < minDiff && diff <= tolerance) {
      minDiff = diff;
      closest = peaks[i];
    }
  }

  return closest;
}

/**
 * Intelligent Grid / Peak Snapping calculator.
 * Supports:
 * - 'grid': Standard BPM subdivisions (1/4, 1/8, 1/2, 1/16, etc.)
 * - 'peak': Magnetic snap to closest audio peak / vocal transient
 * - 'hybrid': Grid snap with magnetic peak assist when near a real song transient
 */
export function getMagneticSnappedTime(
  time: number,
  peaks: AudioPeak[],
  bpm: number,
  offset: number,
  snapDivision: number,
  mode: 'grid' | 'peak' | 'hybrid' = 'hybrid'
): { snappedTime: number; isMagneticPeak: boolean; peakType?: PeakType } {
  const beatSec = 60 / (bpm || 120);
  const stepSec = beatSec / (snapDivision / 4);

  // Standard mathematical grid snap
  const gridTime = Number((Math.round((time - offset) / stepSec) * stepSec + offset).toFixed(3));

  if (mode === 'grid' || !peaks || peaks.length === 0) {
    return { snappedTime: gridTime, isMagneticPeak: false };
  }

  const nearest = getNearestPeak(time, peaks, 0.045);

  if (mode === 'peak') {
    if (nearest) {
      return {
        snappedTime: nearest.time,
        isMagneticPeak: true,
        peakType: nearest.type,
      };
    }
    return { snappedTime: gridTime, isMagneticPeak: false };
  }

  // Hybrid Mode: If near an audio transient peak within 40ms, snap magnetically; else align to grid
  if (nearest && Math.abs(nearest.time - time) <= 0.04) {
    return {
      snappedTime: nearest.time,
      isMagneticPeak: true,
      peakType: nearest.type,
    };
  }

  return { snappedTime: gridTime, isMagneticPeak: false };
}

/**
 * Generates an intelligent, musical auto-beat chart that:
 * 1. STRICT GRID ALIGNMENT: 100% mathematically locked to BPM and subdivisions (zero jitter).
 * 2. MUSICAL PHRASING & SONG SECTIONS: Intro, Verse, Chorus, Bridge, Outro dynamic intensity.
 * 3. ERGONOMIC 4-LANE MANIA: Pure 2-hand balance (Left 0/1, Right 2/3), stairs, rolls, anti-jack safety.
 * 4. CLEAN VOCAL & PERCUSSION HARMONY: Matches melody syllables while driving rhythm with kicks & claps.
 * 5. QUANTIZED HOLDS: Musical sustain durations with safety release margins.
 */
export function generateAutoChart(
  songId: string,
  audioDuration: number,
  beatAnalysis: BeatAnalysisResult,
  difficulty: DifficultyLevel,
  config: AutoBeatConfig = {}
): Chart {
  const {
    preset = 'balanced',
    prioritizeVocals = preset === 'vocal' || preset === 'balanced',
    includeHolds = true,
    gridSnapDivision = 'auto',
  } = config;

  const { bpm, offset, energyProfile, vocalProfile, bassProfile } = beatAnalysis;
  const beatInterval = 60 / (bpm || 120);
  const notes: Note[] = [];

  const totalBeats = Math.floor((audioDuration - offset) / beatInterval);
  const totalMeasures = Math.ceil(totalBeats / 4);
  let noteIdCounter = 1;

  // Lane cooldown tracker (prevents unplayable jacks and overlapping holds)
  const laneCooldownUntil = [0, 0, 0, 0];

  // Minimum time (seconds) between notes on the exact same lane
  const minLaneCooldown =
    difficulty === 'Easy'
      ? 0.42
      : difficulty === 'Medium'
      ? 0.22
      : difficulty === 'Hard'
      ? 0.12
      : 0.07;

  // Hand balance tracking
  let leftHandCount = 0;
  let rightHandCount = 0;
  let lastUsedLane = -1;
  let patternFlowStep = 0;

  // Measure-by-measure structure mapping
  for (let m = 0; m < totalMeasures; m++) {
    const measureStartTime = offset + m * 4 * beatInterval;
    if (measureStartTime > audioDuration - 0.5) break;

    // Measure progress within song (0.0 to 1.0)
    const progress = m / Math.max(1, totalMeasures);

    // Audio energy in this measure
    const frameIdx = Math.floor(measureStartTime / 0.01);
    const overallEnergy = energyProfile && energyProfile.length > frameIdx ? energyProfile[frameIdx] : 0.5;
    const vocalEnergy = vocalProfile && vocalProfile.length > frameIdx ? vocalProfile[frameIdx] : 0.3;
    const bassEnergy = bassProfile && bassProfile.length > frameIdx ? bassProfile[frameIdx] : 0.4;

    // Detect musical section
    const isIntro = progress < 0.12;
    const isOutro = progress > 0.88;
    const isChorus = (progress >= 0.42 && progress <= 0.68) || overallEnergy > 0.65;
    const isBridge = progress >= 0.68 && progress <= 0.82 && !isChorus;
    const isVerse = !isIntro && !isOutro && !isChorus && !isBridge;

    // Choose measure motif pattern
    // 0: Alternating Hands (0->2->1->3), 1: Stair Up (0->1->2->3), 2: Stair Down (3->2->1->0), 3: Wave (0->1->2->1)
    const motif = m % 4;

    // Iterate through the 4 beats of the measure
    for (let beatInMeasure = 0; beatInMeasure < 4; beatInMeasure++) {
      const currentBeatIndex = m * 4 + beatInMeasure;
      const beatTime = currentBeatIndex * beatInterval;
      if (beatTime > audioDuration - 0.3) break;

      const isDownbeat = beatInMeasure === 0;
      const isHalfMeasure = beatInMeasure === 2;

      // Determine beat density / subdivision based on difficulty and section
      let subSteps = 1; // 1 note per beat (1/4 note) by default

      if (gridSnapDivision === 2) {
        subSteps = 1;
      } else if (gridSnapDivision === 8) {
        subSteps = 2;
      } else if (gridSnapDivision === 16) {
        subSteps = 4;
      } else if (gridSnapDivision === 6) {
        subSteps = 3;
      } else {
        // Auto / Dynamic intelligent density
        if (difficulty === 'Easy') {
          // Easy: Quarter notes or half notes, never faster
          subSteps = (isDownbeat || isHalfMeasure) ? 1 : (isChorus && overallEnergy > 0.6 ? 1 : 0);
        } else if (difficulty === 'Medium') {
          // Medium: Solid 1/4 groove, 1/8 on chorus or strong vocal moments
          if (isChorus || (prioritizeVocals && vocalEnergy > 0.48) || preset === 'mania_stream') {
            subSteps = (beatInMeasure % 2 === 1 && Math.random() < 0.7) ? 2 : 1;
          } else if (isIntro || isOutro) {
            subSteps = (isDownbeat || isHalfMeasure) ? 1 : 0;
          } else {
            subSteps = 1;
          }
        } else if (difficulty === 'Hard') {
          // Hard: Full 1/8 groove, 1/16 fills on climax
          if (isChorus) {
            subSteps = (beatInMeasure === 3 && overallEnergy > 0.75) ? 4 : 2;
          } else if (isVerse) {
            subSteps = (vocalEnergy > 0.4 || bassEnergy > 0.5) ? 2 : 1;
          } else if (isBridge) {
            subSteps = 1;
          } else {
            subSteps = 2;
          }
        } else {
          // Expert: Dense 1/8 and 1/16 streams
          if (isChorus || preset === 'mania_stream') {
            subSteps = (overallEnergy > 0.65 || vocalEnergy > 0.5) ? 4 : 2;
          } else {
            subSteps = 2;
          }
        }
      }

      if (subSteps === 0) continue;

      const subDuration = beatInterval / subSteps;

      for (let s = 0; s < subSteps; s++) {
        // 100% mathematically exact grid time
        const noteTime = Number((beatTime + s * subDuration).toFixed(3));
        if (noteTime > audioDuration - 0.25) break;

        const isExactDownbeat = isDownbeat && s === 0;
        const isOffbeat = s > 0;

        // Skip off-beats on low energy quiet sections in Easy/Medium
        if (difficulty === 'Easy' && isOffbeat) continue;
        if (difficulty === 'Medium' && isOffbeat && (isIntro || isOutro || isBridge) && Math.random() < 0.5) {
          continue;
        }

        // Determine Primary Lane (Ergonomic 4-lane flow)
        let primaryLane: 0 | 1 | 2 | 3 = 0;

        if (motif === 1 && (difficulty === 'Hard' || difficulty === 'Expert')) {
          // Stair Up: 0 -> 1 -> 2 -> 3
          primaryLane = (patternFlowStep % 4) as 0 | 1 | 2 | 3;
        } else if (motif === 2 && (difficulty === 'Hard' || difficulty === 'Expert')) {
          // Stair Down: 3 -> 2 -> 1 -> 0
          primaryLane = (3 - (patternFlowStep % 4)) as 0 | 1 | 2 | 3;
        } else if (motif === 3) {
          // Wave / In-Out: 0 -> 2 -> 1 -> 3
          const waveOrder: (0 | 1 | 2 | 3)[] = [0, 2, 1, 3];
          primaryLane = waveOrder[patternFlowStep % 4];
        } else {
          // Alternating Left / Right Hands: Smooth trill & hand balance
          const preferLeft = leftHandCount <= rightHandCount;
          if (preferLeft) {
            primaryLane = (lastUsedLane === 0 ? 1 : 0) as 0 | 1;
          } else {
            primaryLane = (lastUsedLane === 3 ? 2 : 3) as 2 | 3;
          }
        }
        patternFlowStep++;

        // Anti-Jack & Cooldown Check: If primary lane is on cooldown, find the best alternate lane
        if (noteTime < laneCooldownUntil[primaryLane]) {
          const availableLanes = ([0, 1, 2, 3] as const).filter(
            (l) => noteTime >= laneCooldownUntil[l]
          );

          if (availableLanes.length > 0) {
            // Pick opposite hand if available
            const oppositeLanes = availableLanes.filter((l) =>
              primaryLane <= 1 ? l >= 2 : l <= 1
            );
            primaryLane = (
              oppositeLanes.length > 0
                ? oppositeLanes[Math.floor(Math.random() * oppositeLanes.length)]
                : availableLanes[Math.floor(Math.random() * availableLanes.length)]
            ) as 0 | 1 | 2 | 3;
          } else {
            // All lanes currently busy (e.g. holds), skip note safely to avoid overlap
            continue;
          }
        }

        // Check for Intelligent Hold Note (quantized to exact musical beats)
        let holdDuration: number | undefined = undefined;
        const canHold =
          includeHolds &&
          difficulty !== 'Easy' &&
          !isOffbeat &&
          (isBridge || isVerse || isIntro) &&
          (vocalEnergy > 0.4 || isDownbeat);

        if (canHold && Math.random() < (difficulty === 'Medium' ? 0.25 : 0.35)) {
          // Quantized hold lengths: 1 beat (standard) or 2 beats (half measure)
          const holdBeats = (isBridge || isIntro) ? 2.0 : 1.0;
          holdDuration = Number((holdBeats * beatInterval).toFixed(3));
        }

        // Place Main Note
        notes.push({
          id: `note_${noteIdCounter++}`,
          lane: primaryLane,
          time: noteTime,
          ...(holdDuration ? { duration: holdDuration } : {}),
        });

        // Update cooldowns & stats
        laneCooldownUntil[primaryLane] = noteTime + (holdDuration || 0) + minLaneCooldown;
        lastUsedLane = primaryLane;
        if (primaryLane <= 1) leftHandCount++;
        else rightHandCount++;

        // Chords / Jumps (Simultaneous 2-finger hits on major impact beats)
        // STRICT RULE: Must be 1 Left Hand + 1 Right Hand note (e.g. 0+3 outer split or 1+2 inner split)
        const canPlaceJump =
          !holdDuration &&
          isExactDownbeat &&
          (isChorus || bassEnergy > 0.65 || (preset === 'drum_bass' && (isDownbeat || isHalfMeasure))) &&
          difficulty !== 'Easy';

        if (canPlaceJump) {
          const secondHandLanes = primaryLane <= 1 ? ([2, 3] as const) : ([0, 1] as const);
          const validSecondLanes = secondHandLanes.filter(
            (l) => noteTime >= laneCooldownUntil[l]
          );

          if (validSecondLanes.length > 0) {
            // Symmetrical split: if primary is 0, prefer 3; if primary is 1, prefer 2
            const symmetricLane = (3 - primaryLane) as 0 | 1 | 2 | 3;
            const secondLane = validSecondLanes.includes(symmetricLane)
              ? symmetricLane
              : validSecondLanes[0];

            notes.push({
              id: `note_${noteIdCounter++}`,
              lane: secondLane,
              time: noteTime,
            });

            laneCooldownUntil[secondLane] = noteTime + minLaneCooldown;
            if (secondLane <= 1) leftHandCount++;
            else rightHandCount++;
          }
        }
      }
    }
  }

  // Chronological sort
  notes.sort((a, b) => a.time - b.time);

  // Final validation pass: Guarantee zero overlap and zero micro-gaps
  const sanitizedNotes: Note[] = [];
  const finalLaneOccupied = [-1, -1, -1, -1];

  for (const n of notes) {
    if (n.time >= finalLaneOccupied[n.lane]) {
      sanitizedNotes.push(n);
      finalLaneOccupied[n.lane] = n.time + (n.duration || 0) + 0.05;
    }
  }

  return {
    id: `chart_${songId}_${difficulty.toLowerCase()}_${Date.now()}`,
    songId,
    difficulty,
    bpm,
    offset,
    notes: sanitizedNotes,
    creator: 'BeatPulse AI Smart Engine v4.0',
    createdAt: Date.now(),
  };
}
