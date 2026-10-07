/**
 * YouTube Utility Engine for BeatPulse
 * Handles URL parsing across all YouTube link formats, oEmbed metadata retrieval,
 * and rhythm tap tempo helpers.
 */

export interface YouTubeMetadata {
  videoId: string;
  title: string;
  author: string;
  thumbnailUrl: string;
  embedUrl: string;
  cleanUrl: string;
}

/**
 * Extracts an 11-character YouTube video ID from various URL structures:
 * - Standard watch: https://www.youtube.com/watch?v=VIDEO_ID
 * - Shortened: https://youtu.be/VIDEO_ID
 * - Shorts: https://www.youtube.com/shorts/VIDEO_ID
 * - Embed: https://www.youtube.com/embed/VIDEO_ID
 * - Mobile: https://m.youtube.com/watch?v=VIDEO_ID
 * - Live: https://www.youtube.com/live/VIDEO_ID
 * - Direct ID: VIDEO_ID (11 alphanumeric characters)
 */
export function extractYouTubeVideoId(input: string): string | null {
  if (!input || typeof input !== 'string') return null;

  const trimmed = input.trim();
  // If user entered exactly an 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    // Check if valid URL structure
    const urlObj = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);

    // youtu.be/VIDEO_ID
    if (urlObj.hostname === 'youtu.be' || urlObj.hostname.endsWith('.youtu.be')) {
      const pathnameId = urlObj.pathname.slice(1).split('/')[0].split('?')[0];
      if (/^[a-zA-Z0-9_-]{11}$/.test(pathnameId)) {
        return pathnameId;
      }
    }

    // youtube.com variants
    if (
      urlObj.hostname === 'youtube.com' ||
      urlObj.hostname === 'www.youtube.com' ||
      urlObj.hostname === 'm.youtube.com' ||
      urlObj.hostname === 'music.youtube.com'
    ) {
      // 1. /watch?v=VIDEO_ID
      const vParam = urlObj.searchParams.get('v');
      if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
        return vParam;
      }

      // 2. /shorts/VIDEO_ID, /embed/VIDEO_ID, /live/VIDEO_ID, /v/VIDEO_ID
      const parts = urlObj.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && ['shorts', 'embed', 'live', 'v'].includes(parts[0])) {
        const candidate = parts[1];
        if (/^[a-zA-Z0-9_-]{11}$/.test(candidate)) {
          return candidate;
        }
      }
    }
  } catch {
    // If not a standard URL, fallback to universal regex
  }

  const universalRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/;
  const match = trimmed.match(universalRegex);
  if (match && match[1]) {
    return match[1];
  }

  return null;
}

/**
 * Returns canonical YouTube watch URL
 */
export function getCanonicalYouTubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

/**
 * Returns thumbnail candidate URLs in order of preference
 */
export function getYouTubeThumbnails(videoId: string): { maxRes: string; hq: string; mq: string } {
  return {
    maxRes: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    hq: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    mq: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
  };
}

/**
 * Fetches YouTube video metadata via public oEmbed (no API key required)
 */
export async function fetchYouTubeMetadata(rawInput: string): Promise<YouTubeMetadata> {
  const videoId = extractYouTubeVideoId(rawInput);
  if (!videoId) {
    throw new Error('Format tautan YouTube tidak dikenali. Masukkan URL YouTube atau Video ID valid.');
  }

  const canonicalUrl = getCanonicalYouTubeUrl(videoId);
  const thumbs = getYouTubeThumbnails(videoId);

  try {
    const oembedEndpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`;
    const response = await fetch(oembedEndpoint);

    if (response.ok) {
      const data = await response.json();
      return {
        videoId,
        title: data.title || `YouTube Audio Track (${videoId})`,
        author: data.author_name || 'YouTube Musisi',
        thumbnailUrl: data.thumbnail_url || thumbs.hq,
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
        cleanUrl: canonicalUrl,
      };
    }
  } catch (err) {
    console.warn('[YouTubeHelper] oEmbed request encountered a network or CORS restriction:', err);
  }

  // Graceful fallback if oEmbed is unreachable or CORS blocked
  return {
    videoId,
    title: `YouTube Track (${videoId})`,
    author: 'YouTube',
    thumbnailUrl: thumbs.hq,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
    cleanUrl: canonicalUrl,
  };
}

/**
 * Tap Tempo Calculator
 * Calculates accurate BPM from consecutive tap timestamps (in ms)
 */
export class TapTempoCalculator {
  private taps: number[] = [];
  private maxHistory: number = 8;
  private resetTimeout: number = 2500; // Reset after 2.5 seconds of inactivity

  public recordTap(): { bpm: number | null; count: number } {
    const now = performance.now();

    if (this.taps.length > 0) {
      const lastTap = this.taps[this.taps.length - 1];
      if (now - lastTap > this.resetTimeout) {
        this.taps = [];
      }
    }

    this.taps.push(now);
    if (this.taps.length > this.maxHistory) {
      this.taps.shift();
    }

    if (this.taps.length < 2) {
      return { bpm: null, count: this.taps.length };
    }

    // Calculate delta intervals between consecutive taps
    const intervals: number[] = [];
    for (let i = 1; i < this.taps.length; i++) {
      intervals.push(this.taps[i] - this.taps[i - 1]);
    }

    const averageInterval = intervals.reduce((acc, cur) => acc + cur, 0) / intervals.length;
    const rawBpm = 60000 / averageInterval;
    const clampedBpm = Math.round(Math.max(40, Math.min(300, rawBpm)));

    return { bpm: clampedBpm, count: this.taps.length };
  }

  public reset(): void {
    this.taps = [];
  }
}
