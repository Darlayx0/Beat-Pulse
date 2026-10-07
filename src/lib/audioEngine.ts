declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

let ytApiPromise: Promise<void> | null = null;

export function loadYouTubeAPI(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT && typeof window.YT.Player === 'function') {
    return Promise.resolve();
  }
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve) => {
    let resolved = false;
    const done = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };

    const existingScript = document.getElementById('youtube-iframe-api');
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.onerror = () => done();
      document.body.appendChild(tag);
    }

    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevReady) {
        try { prevReady(); } catch (e) {}
      }
      done();
    };

    const interval = setInterval(() => {
      if (window.YT && typeof window.YT.Player === 'function') {
        clearInterval(interval);
        done();
      }
    }, 100);

    // Timeout safety after 2.5 seconds
    setTimeout(() => {
      clearInterval(interval);
      done();
    }, 2500);
  });

  return ytApiPromise;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private currentSourceNode: AudioBufferSourceNode | null = null;
  private bgmGainNode: GainNode | null = null;
  private sfxGainNode: GainNode | null = null;

  private activeAudioBuffer: AudioBuffer | null = null;
  private startTime: number = 0;
  private pauseOffset: number = 0;
  private isPlaying: boolean = false;
  private playbackRate: number = 1.0;

  private bgmVolume: number = 0.8;
  private sfxVolume: number = 0.9;

  // YouTube Player Integration & Hybrid Audio Clock
  private isYouTubeMode: boolean = false;
  private ytPlayer: any = null;
  private ytReady: boolean = false;
  private currentYtVideoId: string | null = null;
  private ytAnchorTime: number = 0;
  private ytAnchorPerf: number = 0;
  private ytLastCheckPerf: number = 0;
  private ytIsBuffering: boolean = false;
  private ytLoadSequence: number = 0;
  private ytStateListeners: Set<(state: 'ready' | 'playing' | 'paused' | 'buffering' | 'ended' | 'error', details?: any) => void> = new Set();

  public getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      try {
        this.ctx.resume().catch(() => {});
      } catch {}
    }
    return this.ctx;
  }

  public setVolumes(bgmVol: number, sfxVol: number) {
    this.bgmVolume = bgmVol;
    this.sfxVolume = sfxVol;

    if (this.bgmGainNode && this.ctx) {
      this.bgmGainNode.gain.setValueAtTime(this.bgmVolume, this.ctx.currentTime);
    }
    if (this.sfxGainNode && this.ctx) {
      this.sfxGainNode.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }
    if (this.isYouTubeMode && this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.setVolume(this.bgmVolume * 100);
      } catch (e) {
        // Safe catch
      }
    }
  }

  public getBGMVolume(): number {
    return this.bgmVolume;
  }

  public getSFXVolume(): number {
    return this.sfxVolume;
  }

  public setPlaybackRate(rate: number) {
    const newRate = Math.max(0.25, Math.min(2.0, rate));
    if (this.isPlaying && this.currentSourceNode && this.ctx) {
      const currentTime = this.getCurrentTime();
      this.playbackRate = newRate;
      this.currentSourceNode.playbackRate.setValueAtTime(newRate, this.ctx.currentTime);
      this.startTime = this.ctx.currentTime - (currentTime / newRate);
    } else {
      this.playbackRate = newRate;
    }
  }

  public getPlaybackRate(): number {
    return this.playbackRate;
  }

  private decodeNative(ctx: AudioContext, buffer: ArrayBuffer): Promise<AudioBuffer> {
    return new Promise((resolve, reject) => {
      if (!buffer || buffer.byteLength === 0) {
        reject(new Error('ArrayBuffer audio kosong (0 bytes).'));
        return;
      }
      try {
        let isSettled = false;
        const res = ctx.decodeAudioData(
          buffer,
          (decoded) => {
            if (!isSettled) {
              isSettled = true;
              resolve(decoded);
            }
          },
          (err) => {
            if (!isSettled) {
              isSettled = true;
              reject(err || new Error('decodeAudioData native failed'));
            }
          }
        );
        if (res && typeof (res as any).then === 'function') {
          (res as any).then(
            (decoded: AudioBuffer) => {
              if (!isSettled) {
                isSettled = true;
                resolve(decoded);
              }
            },
            (err: any) => {
              if (!isSettled) {
                isSettled = true;
                reject(err);
              }
            }
          );
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  public async decodeAudioData(arrayBuffer: ArrayBuffer, mimeTypeHint?: string): Promise<AudioBuffer> {
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error('Data audio biner kosong atau tidak valid.');
    }
    const ctx = this.getContext();

    // Stage 1: Native Web Audio API decode using fresh sliced ArrayBuffer copy
    try {
      return await this.decodeNative(ctx, arrayBuffer.slice(0));
    } catch (err) {
      console.warn('AudioEngine: Primary decodeAudioData failed, trying candidate MIME hints:', err);
    }

    // Stage 2: Rewrap fresh arrayBuffer with explicitly enforced candidate MIME types
    const candidateTypes = [
      mimeTypeHint,
      'audio/mp3',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/webm',
      'video/webm',
      'audio/m4a',
      'audio/aac',
      'audio/flac',
      'audio/webm;codecs=opus',
      'audio/webm;codecs=vorbis',
    ].filter(Boolean) as string[];

    for (const type of candidateTypes) {
      try {
        const blob = new Blob([arrayBuffer.slice(0)], { type });
        const freshBuffer = await blob.arrayBuffer();
        const decoded = await this.decodeNative(ctx, freshBuffer);
        if (decoded) {
          console.log(`AudioEngine: Successfully decoded audio buffer using MIME hint "${type}"`);
          return decoded;
        }
      } catch (e) {
        // Try next candidate
      }
    }

    throw new Error('Gagal mendekode file audio lokal. Pastikan format file (MP3, WAV, OGG, WEBM, M4A) berisi stream audio yang valid.');
  }

  public addYouTubeListener(cb: (state: 'ready' | 'playing' | 'paused' | 'buffering' | 'ended' | 'error', details?: any) => void) {
    this.ytStateListeners.add(cb);
    return () => this.ytStateListeners.delete(cb);
  }

  public removeYouTubeListener(cb: (state: 'ready' | 'playing' | 'paused' | 'buffering' | 'ended' | 'error', details?: any) => void) {
    this.ytStateListeners.delete(cb);
  }

  private notifyYouTubeState(state: 'ready' | 'playing' | 'paused' | 'buffering' | 'ended' | 'error', details?: any) {
    this.ytStateListeners.forEach((cb) => {
      try {
        cb(state, details);
      } catch (err) {
        console.warn('Error in YouTube state listener:', err);
      }
    });
  }

  public destroyYouTubePlayer() {
    this.ytLoadSequence++;
    this.isYouTubeMode = false;
    this.ytReady = false;
    this.currentYtVideoId = null;
    this.ytAnchorTime = 0;
    this.ytAnchorPerf = 0;
    this.ytLastCheckPerf = 0;
    this.ytIsBuffering = false;

    if (this.ytPlayer) {
      try {
        if (typeof this.ytPlayer.stopVideo === 'function') {
          this.ytPlayer.stopVideo();
        }
      } catch (e) {}
      try {
        if (typeof this.ytPlayer.destroy === 'function') {
          this.ytPlayer.destroy();
        }
      } catch (e) {
        // Safe catch iframe removeChild DOMException
      }
      this.ytPlayer = null;
    }
  }

  public getIsYouTubeMode(): boolean {
    return this.isYouTubeMode;
  }

  public isYouTubePlaying(): boolean {
    if (!this.isYouTubeMode || !this.ytPlayer) return false;
    try {
      if (typeof this.ytPlayer.getPlayerState === 'function') {
        return this.ytPlayer.getPlayerState() === 1;
      }
    } catch {}
    return false;
  }

  public getYouTubeDuration(): number {
    if (this.isYouTubeMode && this.ytPlayer && this.ytReady) {
      try {
        if (typeof this.ytPlayer.getDuration === 'function') {
          const d = this.ytPlayer.getDuration();
          if (typeof d === 'number' && !isNaN(d) && isFinite(d) && d > 0) {
            return d;
          }
        }
      } catch {}
    }
    return 0;
  }

  public async loadYouTubeTrack(videoId: string): Promise<void> {
    // 1. If already in YouTube mode with the exact same video ID, just reset position
    if (this.isYouTubeMode && this.currentYtVideoId === videoId && this.ytPlayer && this.ytReady) {
      this.stopBGM();
      try {
        if (typeof this.ytPlayer.seekTo === 'function') {
          this.ytPlayer.seekTo(0, true);
        }
      } catch (e) {}
      return;
    }

    // 2. If YouTube player already exists in the persistent DOM host, switch video cleanly without reloading iframe
    if (this.ytPlayer && typeof this.ytPlayer.cueVideoById === 'function') {
      this.stopBGM();
      this.isYouTubeMode = true;
      this.currentYtVideoId = videoId;
      this.ytReady = false;
      this.ytAnchorTime = 0;
      this.ytAnchorPerf = performance.now();
      this.ytLastCheckPerf = performance.now();
      this.ytIsBuffering = false;

      try {
        this.ytPlayer.cueVideoById({ videoId, startSeconds: 0 });
        this.ytReady = true;
        this.notifyYouTubeState('ready');
        return;
      } catch (e) {
        console.warn('cueVideoById failed, recreating player:', e);
      }
    }

    this.stopBGM();
    this.destroyYouTubePlayer();

    this.isYouTubeMode = true;
    this.currentYtVideoId = videoId;
    this.ytReady = false;
    this.ytAnchorTime = 0;
    this.ytAnchorPerf = performance.now();
    this.ytLastCheckPerf = performance.now();
    this.ytIsBuffering = false;

    const seq = ++this.ytLoadSequence;

    try {
      await loadYouTubeAPI();
    } catch {
      return;
    }

    if (seq !== this.ytLoadSequence || !this.isYouTubeMode) return;

    let targetEl = document.getElementById('beatpulse-yt-player-host');
    if (!targetEl) {
      let wrapper = document.getElementById('beatpulse-yt-wrapper');
      if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = 'beatpulse-yt-wrapper';
        wrapper.className = 'fixed inset-0 pointer-events-none -z-50 opacity-0 overflow-hidden';
        document.body.appendChild(wrapper);
      }
      targetEl = document.createElement('div');
      targetEl.id = 'beatpulse-yt-player-host';
      targetEl.className = 'w-full h-full min-w-[320px] min-h-[240px]';
      wrapper.appendChild(targetEl);
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      const timer = setTimeout(() => {
        finish();
      }, 4000);

      try {
        if (!window.YT || typeof window.YT.Player !== 'function') {
          clearTimeout(timer);
          finish();
          return;
        }

        const playerVarsConfig: any = {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          enablejsapi: 1,
          iv_load_policy: 3,
        };

        try {
          this.ytPlayer = new window.YT.Player(targetEl, {
            videoId: videoId,
            playerVars: playerVarsConfig,
            events: {
              onReady: (event: any) => {
                if (seq === this.ytLoadSequence && this.isYouTubeMode) {
                  this.ytReady = true;
                  try {
                    event.target.setVolume(Math.round(this.bgmVolume * 100));
                    event.target.unMute();
                  } catch (e) {}

                  this.notifyYouTubeState('ready');

                  // If playback was already triggered before onReady finished
                  if (this.isPlaying) {
                    try {
                      const seekTime = Math.max(0, this.pauseOffset || this.ytAnchorTime || 0);
                      event.target.unMute();
                      event.target.setVolume(Math.round(this.bgmVolume * 100));
                      event.target.seekTo(seekTime, true);
                      event.target.playVideo();
                      this.stopFallbackBuffer();
                    } catch (e) {}
                  }
                }
                clearTimeout(timer);
                finish();
              },
              onError: (event: any) => {
                const errorCode = event?.data;
                console.warn('YouTube Player Error:', errorCode);
                if (seq === this.ytLoadSequence) {
                  this.ytReady = false;
                  this.notifyYouTubeState('error', errorCode);
                  // Emergency fallback: start fallback synth audio so user can still play the song!
                  if (this.isPlaying && this.activeAudioBuffer) {
                    this.playFallbackBuffer(this.getCurrentTime());
                  }
                }
                clearTimeout(timer);
                finish();
              },
              onStateChange: (event: any) => {
                if (seq !== this.ytLoadSequence || !this.isYouTubeMode) return;
                try {
                  if (window.YT && event && event.data !== undefined) {
                    const state = event.data;
                    if (state === window.YT.PlayerState.PLAYING) {
                      this.isPlaying = true;
                      this.ytIsBuffering = false;

                      // Anchor the clock immediately upon playing
                      let cur = 0;
                      if (this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
                        cur = this.ytPlayer.getCurrentTime() || 0;
                      }
                      this.ytAnchorTime = cur;
                      this.ytAnchorPerf = performance.now();
                      this.ytLastCheckPerf = performance.now();

                      // YouTube successfully playing, kill synth fallback audio
                      this.stopFallbackBuffer();
                      this.notifyYouTubeState('playing');
                    } else if (state === window.YT.PlayerState.BUFFERING) {
                      this.ytIsBuffering = true;
                      // Freeze anchor at current calculated time during buffering
                      const curCalc = this.getCurrentTime();
                      this.ytAnchorTime = curCalc;
                      this.ytAnchorPerf = performance.now();
                      this.notifyYouTubeState('buffering');
                    } else if (state === window.YT.PlayerState.PAUSED) {
                      this.isPlaying = false;
                      this.ytIsBuffering = false;
                      this.pauseOffset = this.getCurrentTime();
                      this.notifyYouTubeState('paused');
                    } else if (state === window.YT.PlayerState.ENDED) {
                      this.isPlaying = false;
                      this.ytIsBuffering = false;
                      this.notifyYouTubeState('ended');
                    }
                  }
                } catch (e) {}
              },
            },
          });
        } catch (ytErr) {
          console.warn('YT.Player constructor failed safely:', ytErr);
          clearTimeout(timer);
          finish();
        }
      } catch (err) {
        console.warn('Error creating YT.Player:', err);
        clearTimeout(timer);
        finish();
      }
    });
  }

  public resumeIfBlocked() {
    if (this.isYouTubeMode && this.ytPlayer) {
      try {
        this.ytPlayer.unMute();
        this.ytPlayer.setVolume(Math.round(this.bgmVolume * 100));
        if (this.isPlaying) {
          if (typeof this.ytPlayer.getPlayerState === 'function') {
            const st = this.ytPlayer.getPlayerState();
            // -1 = unstarted, 0 = ended, 1 = playing, 2 = paused, 3 = buffering, 5 = cued
            if (st !== 1 && st !== 3) {
              this.ytPlayer.playVideo();
            }
          } else {
            this.ytPlayer.playVideo();
          }
        }
      } catch (e) {}
    }
  }

  public loadBuffer(buffer: AudioBuffer | null) {
    this.stopBGM();
    this.destroyYouTubePlayer();
    this.activeAudioBuffer = buffer;
    this.pauseOffset = 0;
  }

  public clearActiveBuffer() {
    this.stopBGM();
    this.destroyYouTubePlayer();
    this.activeAudioBuffer = null;
    this.pauseOffset = 0;
  }

  public setFallbackBuffer(buffer: AudioBuffer | null) {
    this.activeAudioBuffer = buffer;
  }

  public prepareYouTubeForCountdown(offset: number = 0) {
    if (this.isYouTubeMode && this.ytPlayer && this.ytReady) {
      try {
        const safeOffset = Math.max(0, offset);
        this.ytPlayer.unMute();
        this.ytPlayer.setVolume(Math.round(this.bgmVolume * 100));
        this.ytPlayer.seekTo(safeOffset, true);
      } catch (e) {}
    }
  }

  public playBGM(offset: number = 0, rate?: number): number {
    const safeOffset = Math.max(0, offset);

    if (this.isYouTubeMode) {
      this.pauseOffset = safeOffset;
      this.ytAnchorTime = safeOffset;
      this.ytAnchorPerf = performance.now();
      this.ytLastCheckPerf = performance.now();
      this.isPlaying = true;

      let ytStarted = false;
      if (this.ytPlayer && this.ytReady) {
        try {
          this.ytPlayer.unMute();
          this.ytPlayer.setVolume(Math.round(this.bgmVolume * 100));
          this.ytPlayer.seekTo(safeOffset, true);
          this.ytPlayer.playVideo();
          ytStarted = true;
          this.stopFallbackBuffer();
        } catch (err) {
          console.warn('YouTube playVideo error:', err);
        }
      }

      // If YouTube is not yet ready or starting, keep audible fallback running
      if (!ytStarted && this.activeAudioBuffer) {
        this.playFallbackBuffer(safeOffset, rate);
      }

      return safeOffset;
    }

    return this.playFallbackBuffer(safeOffset, rate);
  }

  private playFallbackBuffer(offset: number, rate?: number): number {
    if (!this.activeAudioBuffer) return 0;
    // Don't play synth fallback when YouTube is actively playing
    if (this.isYouTubeMode && this.ytReady && this.ytPlayer && !this.ytIsBuffering) {
      try {
        const state = typeof this.ytPlayer.getPlayerState === 'function' ? this.ytPlayer.getPlayerState() : -1;
        if (state === 1) return 0; // Already playing
      } catch (e) {}
    }

    const ctx = this.getContext();

    if (rate !== undefined) {
      this.playbackRate = Math.max(0.25, Math.min(2.0, rate));
    }

    this.stopFallbackBuffer();

    const source = ctx.createBufferSource();
    source.buffer = this.activeAudioBuffer;
    source.playbackRate.value = this.playbackRate;

    const bgmGain = ctx.createGain();
    // Keep audible so player hears audio guide if YouTube takes time to buffer
    bgmGain.gain.value = this.bgmVolume;

    source.connect(bgmGain);
    bgmGain.connect(ctx.destination);

    this.currentSourceNode = source;
    this.bgmGainNode = bgmGain;

    const safeOffset = Math.max(0, Math.min(offset, this.activeAudioBuffer.duration));
    this.startTime = ctx.currentTime - (safeOffset / this.playbackRate);
    this.pauseOffset = safeOffset;

    source.start(0, safeOffset);
    this.isPlaying = true;

    source.onended = () => {
      if (this.currentSourceNode === source) {
        this.isPlaying = false;
      }
    };

    return safeOffset;
  }

  private stopFallbackBuffer() {
    if (this.currentSourceNode) {
      try {
        this.currentSourceNode.stop();
        this.currentSourceNode.disconnect();
      } catch {}
      this.currentSourceNode = null;
    }
  }

  public pauseBGM() {
    if (this.isYouTubeMode) {
      const cur = this.getCurrentTime();
      this.pauseOffset = cur;
      this.ytAnchorTime = cur;
      this.ytAnchorPerf = performance.now();
      if (this.ytPlayer && this.ytReady) {
        try {
          if (typeof this.ytPlayer.pauseVideo === 'function') {
            this.ytPlayer.pauseVideo();
          }
        } catch (e) {}
      }
      this.stopFallbackBuffer();
      this.isPlaying = false;
      return;
    }

    if (!this.isPlaying) return;
    const current = this.getCurrentTime();
    this.stopBGM();
    this.pauseOffset = current;
  }

  public stopBGM() {
    if (this.isYouTubeMode) {
      this.pauseOffset = 0;
      this.ytAnchorTime = 0;
      this.ytAnchorPerf = performance.now();
      if (this.ytPlayer && this.ytReady) {
        try {
          if (typeof this.ytPlayer.pauseVideo === 'function') {
            this.ytPlayer.pauseVideo();
          }
          if (typeof this.ytPlayer.seekTo === 'function') {
            this.ytPlayer.seekTo(0, true);
          }
        } catch (e) {}
      }
      this.stopFallbackBuffer();
      this.isPlaying = false;
      return;
    }

    this.stopFallbackBuffer();
    this.isPlaying = false;
  }

  public getCurrentTime(): number {
    if (this.isYouTubeMode && this.ytReady && this.ytPlayer) {
      if (!this.isPlaying) {
        return isNaN(this.pauseOffset) ? 0 : Math.max(0, this.pauseOffset);
      }

      if (this.ytIsBuffering) {
        return isNaN(this.ytAnchorTime) ? 0 : Math.max(0, this.ytAnchorTime);
      }

      const now = performance.now();
      // Periodically check drift against YouTube reported time without causing frame stutter
      if (now - this.ytLastCheckPerf > 100) {
        this.ytLastCheckPerf = now;
        try {
          if (typeof this.ytPlayer.getCurrentTime === 'function') {
            const reported = this.ytPlayer.getCurrentTime();
            if (typeof reported === 'number' && !isNaN(reported) && isFinite(reported) && reported >= 0) {
              const expected = this.ytAnchorTime + ((now - this.ytAnchorPerf) / 1000) * this.playbackRate;
              const drift = Math.abs(reported - expected);
              // Re-anchor if drift exceeds 80ms (e.g. after scrubbing or packet delay)
              if (drift > 0.08) {
                this.ytAnchorTime = reported;
                this.ytAnchorPerf = now;
              }
            }
          }
        } catch (e) {}
      }

      const elapsed = ((performance.now() - this.ytAnchorPerf) / 1000) * this.playbackRate;
      const computed = this.ytAnchorTime + elapsed;
      return isNaN(computed) || !isFinite(computed) ? 0 : Math.max(0, computed);
    }

    if (!this.isPlaying) {
      return isNaN(this.pauseOffset) ? 0 : Math.max(0, Math.min(10000, this.pauseOffset));
    }
    if (!this.ctx) return 0;
    const computed = (this.ctx.currentTime - this.startTime) * this.playbackRate;
    return isNaN(computed) || !isFinite(computed) ? 0 : Math.max(0, computed);
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public seek(timeInSeconds: number) {
    const safeTime = Math.max(0, timeInSeconds);
    if (this.isYouTubeMode) {
      this.pauseOffset = safeTime;
      this.ytAnchorTime = safeTime;
      this.ytAnchorPerf = performance.now();
      this.ytLastCheckPerf = performance.now();
      if (this.ytPlayer && this.ytReady) {
        try {
          this.ytPlayer.seekTo(safeTime, true);
        } catch (e) {}
      }
      return;
    }

    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.playBGM(safeTime);
    } else {
      this.pauseOffset = Math.max(0, Math.min(safeTime, this.activeAudioBuffer?.duration || 0));
    }
  }

  // Synthesize Hitsound
  public playHitsound(type: 'tap' | 'hold' | 'perfect' | 'holdEnd' = 'tap') {
    if (this.sfxVolume <= 0) return;
    const ctx = this.getContext();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const now = ctx.currentTime;

    if (type === 'holdEnd') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1100, now);
      osc.frequency.exponentialRampToValueAtTime(1600, now + 0.07);

      gain.gain.setValueAtTime(this.sfxVolume * 0.85, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    } else if (type === 'perfect') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.08);

      gain.gain.setValueAtTime(this.sfxVolume * 0.8, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    } else if (type === 'hold') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.05);

      gain.gain.setValueAtTime(this.sfxVolume * 0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.04);

      gain.gain.setValueAtTime(this.sfxVolume * 0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  // Metronome tick
  public playMetronomeTick(accent: boolean = false) {
    if (this.sfxVolume <= 0) return;
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const now = ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(accent ? 1500 : 1000, now);

    gain.gain.setValueAtTime(this.sfxVolume * 0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  // Extract waveform array
  public extractWaveform(audioBuffer: AudioBuffer, samples: number = 200): number[] {
    if (!audioBuffer) return new Array(samples).fill(0.1);
    const rawData = audioBuffer.getChannelData(0);
    const blockSize = Math.floor(rawData.length / samples);
    if (blockSize <= 0) return new Array(samples).fill(0.1);

    const waveform: number[] = [];

    for (let i = 0; i < samples; i++) {
      const blockStart = blockSize * i;
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(rawData[blockStart + j] || 0);
      }
      waveform.push(sum / blockSize);
    }

    const maxVal = Math.max(...waveform) || 1;
    return waveform.map((val) => val / maxVal);
  }
}

export const audioEngine = new AudioEngine();

export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  const writeString = (v: DataView, offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      v.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + dataLength, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * blockAlign, true);
  /* block align */
  view.setUint16(32, blockAlign, true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, dataLength, true);

  // Cache channel data arrays ONCE
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  const pcmData = new Int16Array(arrayBuffer, 44, buffer.length * numChannels);
  let pcmIndex = 0;
  const len = buffer.length;

  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      pcmData[pcmIndex++] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}
