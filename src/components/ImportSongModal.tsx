import React, { useState, useRef, useMemo } from 'react';
import {
  Upload,
  Music,
  Sparkles,
  AlertCircle,
  Loader2,
  X,
  Link,
  Youtube,
  Check,
  Activity,
  RotateCcw,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { Song } from '../types';
import { audioEngine, audioBufferToWavBlob } from '../lib/audioEngine';
import { detectBpmAndPeaks, generateAutoChart } from '../lib/beatDetector';
import { getChartAccountId } from '../services/chartCloudService';
import { StorageService } from '../services/storageService';
import { authService } from '../services/authService';
import { useNativeDialog } from '../hooks/useNativeDialog';
import {
  extractYouTubeVideoId,
  fetchYouTubeMetadata,
  YouTubeMetadata,
  TapTempoCalculator,
} from '../lib/youtubeHelper';

// Re-export for backward compatibility with existing imports
export { extractYouTubeVideoId };

interface ImportSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSongImported: (song: Song, audioData?: Blob | AudioBuffer) => void;
}

export const ImportSongModal: React.FC<ImportSongModalProps> = ({
  isOpen,
  onClose,
  onSongImported,
}) => {
  const [activeTab, setActiveTab] = useState<'local' | 'youtube'>('youtube');

  // Local File State
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');

  // YouTube State
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isFetchingYtInfo, setIsFetchingYtInfo] = useState(false);
  const [ytMetadata, setYtMetadata] = useState<YouTubeMetadata | null>(null);

  // Tempo & Duration Settings for YouTube Import
  const [customBpm, setCustomBpm] = useState<number>(128);
  const [targetDuration, setTargetDuration] = useState<number>(180); // in seconds
  const [tapCount, setTapCount] = useState<number>(0);
  const [lastTapTime, setLastTapTime] = useState<number>(0);

  // Common Processing State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const tapCalculator = useMemo(() => new TapTempoCalculator(), []);
  const dialogRef = useNativeDialog(isOpen);

  if (!isOpen) return null;

  const handleFileSelect = (selectedFile: File) => {
    const isAudioOrVideoType =
      selectedFile.type.startsWith('audio/') || selectedFile.type.startsWith('video/');
    const hasValidExtension = selectedFile.name.match(
      /\.(mp3|wav|ogg|m4a|flac|webm|aac|mp4|mkv)$/i
    );

    if (!isAudioOrVideoType && !hasValidExtension) {
      setErrorMsg('Harap pilih file audio valid (.mp3, .wav, .ogg, .m4a, .webm, .flac, .aac)');
      return;
    }

    setFile(selectedFile);
    setErrorMsg(null);

    // Auto set title from file name
    const cleanName = selectedFile.name.replace(/\.[^/.]+$/, '');
    const parts = cleanName.split('-');
    if (parts.length >= 2) {
      setArtist(parts[0].trim());
      setTitle(parts.slice(1).join('-').trim());
    } else {
      setTitle(cleanName);
      setArtist('Artis Lokal');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Fetch YouTube Metadata via public oEmbed
  const handleFetchYtMetadata = async (targetUrl?: string) => {
    const urlToFetch = targetUrl || youtubeUrl;
    const videoId = extractYouTubeVideoId(urlToFetch);

    if (!videoId) {
      if (!targetUrl) {
        setErrorMsg('Tautan YouTube tidak valid. Mendukung format: watch?v=..., youtu.be/..., shorts/..., atau 11-karakter ID');
      }
      return;
    }

    try {
      setIsFetchingYtInfo(true);
      setErrorMsg(null);

      const meta = await fetchYouTubeMetadata(urlToFetch);
      setYtMetadata(meta);
      setTitle(meta.title);
      setArtist(meta.author);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal mengambil informasi tautan YouTube.');
    } finally {
      setIsFetchingYtInfo(false);
    }
  };

  const handleYoutubeUrlInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setYoutubeUrl(val);
    const videoId = extractYouTubeVideoId(val);
    if (videoId) {
      handleFetchYtMetadata(val);
    }
  };

  // Handle Tap Tempo
  const handleTapTempo = () => {
    setLastTapTime(Date.now());
    const result = tapCalculator.recordTap();
    setTapCount(result.count);
    if (result.bpm !== null) {
      setCustomBpm(result.bpm);
    }
  };

  const handleResetTapTempo = () => {
    tapCalculator.reset();
    setTapCount(0);
    setCustomBpm(128);
  };

  // Process Local Audio File or YouTube Track
  const handleAnalyzeAndSave = async () => {
    if (activeTab === 'local' && (!file || !title)) return;
    if (activeTab === 'youtube' && (!ytMetadata || !title)) return;

    try {
      setIsAnalyzing(true);
      setErrorMsg(null);
      setAnalysisProgress(15);

      let audioBuffer: AudioBuffer;
      let rawBlob: Blob;

      if (activeTab === 'local' && file) {
        const arrayBuffer = await file.arrayBuffer();
        setAnalysisProgress(40);
        audioBuffer = await audioEngine.decodeAudioData(arrayBuffer, file.type || 'audio/webm');
        rawBlob = file;
      } else {
        // YouTube track: synthesize a lightweight high-precision guide buffer using the user's selected BPM
        setAnalysisProgress(35);
        const ctx = audioEngine.getContext();
        const durationSec = Math.max(30, Math.min(600, targetDuration));
        const sampleRate = 22050; // Optimized 22.05kHz
        const totalSamples = Math.floor(sampleRate * durationSec);
        audioBuffer = ctx.createBuffer(2, totalSamples, sampleRate);

        const leftChannel = audioBuffer.getChannelData(0);
        const rightChannel = audioBuffer.getChannelData(1);

        const effectiveBpm = Math.max(40, Math.min(300, customBpm || 128));
        const beatSec = 60 / effectiveBpm;

        for (let i = 0; i < totalSamples; i++) {
          const t = i / sampleRate;
          const beatPos = (t % beatSec) / beatSec;

          const kick =
            Math.sin(2 * Math.PI * 65 * t * Math.exp(-beatPos * 12)) *
            Math.exp(-beatPos * 8);
          const chord =
            (Math.sin(2 * Math.PI * 220 * t) + Math.sin(2 * Math.PI * 330 * t)) *
            0.15 *
            Math.exp(-beatPos * 3);

          const sampleVal = (kick + chord) * 0.35;
          leftChannel[i] = sampleVal;
          rightChannel[i] = sampleVal;
        }

        // Convert guide buffer to WAV blob for fast local cache
        rawBlob = audioBufferToWavBlob(audioBuffer);
      }

      setAnalysisProgress(60);
      const beatAnalysis = detectBpmAndPeaks(audioBuffer);

      // If YouTube track and user specified BPM, enforce the custom BPM in the analysis
      if (activeTab === 'youtube' && customBpm) {
        beatAnalysis.bpm = customBpm;
      }

      setAnalysisProgress(80);

      const songId = `song_${activeTab}_${Date.now()}`;
      const duration = Number(audioBuffer.duration.toFixed(2));

      // Auto-generate standard difficulty charts (Easy, Medium, Hard, Expert)
      const easyChart = generateAutoChart(songId, duration, beatAnalysis, 'Easy');
      const mediumChart = generateAutoChart(songId, duration, beatAnalysis, 'Medium');
      const hardChart = generateAutoChart(songId, duration, beatAnalysis, 'Hard');
      const expertChart = generateAutoChart(songId, duration, beatAnalysis, 'Expert');

      const colors = [
        'from-rose-600 to-indigo-900',
        'from-purple-600 to-indigo-900',
        'from-cyan-600 to-blue-900',
        'from-amber-600 to-rose-900',
      ];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      const profile = authService.getCurrentProfile();
      const newSong: Song = {
        id: songId,
        title: title.trim(),
        artist: artist.trim() || (activeTab === 'youtube' ? 'YouTube Artist' : 'Artis Lokal'),
        bpm: beatAnalysis.bpm,
        duration,
        isPreset: false,
        coverColor: randomColor,
        userId: getChartAccountId(),
        creator: profile.username || 'BeatPulse User',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        youtubeVideoId: activeTab === 'youtube' && ytMetadata ? ytMetadata.videoId : undefined,
        youtubeUrl: activeTab === 'youtube' && ytMetadata ? ytMetadata.cleanUrl : undefined,
        charts: {
          Easy: easyChart,
          Medium: mediumChart,
          Hard: hardChart,
          Expert: expertChart,
        },
      };

      // Save to IndexedDB & Cloud SQL
      await StorageService.saveSong(newSong, rawBlob);

      setAnalysisProgress(100);
      onSongImported(newSong, rawBlob);
      onClose();
    } catch (err: any) {
      console.error('Import error:', err);
      setErrorMsg(err.message || 'Gagal memproses lagu. Silakan coba lagi.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <dialog ref={dialogRef} aria-label="Impor musik" onCancel={(event) => { event.preventDefault(); onClose(); }} className="bp-legacy-dialog fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200/90 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Impor Musik Baru</h2>
              <p className="text-xs text-slate-500">Tambah lagu dari tautan YouTube atau file lokal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tab Selector (YouTube Link vs File Lokal) */}
        <div className="p-2 bg-slate-50 border-b border-slate-200 flex gap-1">
          <button
            onClick={() => {
              setActiveTab('youtube');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'youtube'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Youtube className="w-4 h-4 text-rose-600" />
            <span>YouTube Link</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('local');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'local'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-4 h-4 text-indigo-600" />
            <span>File Audio Lokal</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* TAB 1: YOUTUBE LINK */}
          {activeTab === 'youtube' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Tautan YouTube (Watch, Shorts, Embed, youtu.be)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Link className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={youtubeUrl}
                      onChange={handleYoutubeUrlInput}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full min-h-[44px] bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white rounded-xl pl-9 pr-3 py-2 text-sm text-slate-900 outline-none transition-colors"
                    />
                  </div>
                  <button
                    disabled={!youtubeUrl || isFetchingYtInfo}
                    onClick={() => handleFetchYtMetadata()}
                    className="px-4 py-2.5 min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all flex-shrink-0"
                  >
                    {isFetchingYtInfo ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Youtube className="w-4 h-4" />
                    )}
                    <span>Muat Info</span>
                  </button>
                </div>
              </div>

              {/* YouTube Video Info Preview */}
              {ytMetadata && (
                <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-2xl flex items-center gap-3">
                  <img
                    src={ytMetadata.thumbnailUrl}
                    alt={ytMetadata.title}
                    className="w-20 h-14 object-cover rounded-xl border border-rose-200 flex-shrink-0 bg-slate-900"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      // Fallback thumbnail if high resolution unavailable
                      (e.currentTarget as HTMLImageElement).src = `https://img.youtube.com/vi/${ytMetadata.videoId}/hqdefault.jpg`;
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-slate-900 truncate">{ytMetadata.title}</p>
                      <a
                        href={ytMetadata.cleanUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-rose-600 transition-colors"
                        title="Buka di YouTube"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    <p className="text-[11px] text-rose-700 font-semibold truncate mt-0.5">
                      {ytMetadata.author}
                    </p>
                    <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-medium">
                      ID: {ytMetadata.videoId}
                    </span>
                  </div>
                  <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-700 flex-shrink-0">
                    <Check className="w-4 h-4" />
                  </div>
                </div>
              )}

              {/* BPM Tap Tempo & Configuration Tool for YouTube */}
              {ytMetadata && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-slate-900">Kalibrasi Tempo (BPM)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handleResetTapTempo}
                        className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-200 transition-colors"
                        title="Reset Tap Tempo"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Interactive Tap Tempo Button */}
                    <button
                      type="button"
                      onClick={handleTapTempo}
                      className={`min-h-[44px] px-3 py-2.5 rounded-xl border flex flex-col items-center justify-center transition-all active:scale-95 cursor-pointer ${
                        Date.now() - lastTapTime < 250
                          ? 'bg-indigo-600 text-white border-indigo-600 scale-98 shadow-sm'
                          : 'bg-white text-indigo-700 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/50'
                      }`}
                    >
                      <span className="text-xs font-bold">Ketuk Irama (Tap Tempo)</span>
                      <span className="text-[10px] opacity-80">
                        {tapCount > 1 ? `${tapCount} ketukan terdeteksi` : 'Ketuk sesuai ritme lagu'}
                      </span>
                    </button>

                    {/* Numeric BPM Input */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>Nilai BPM</span>
                        <span className="text-indigo-600 font-bold">{customBpm} BPM</span>
                      </div>
                      <input
                        type="number"
                        min="50"
                        max="260"
                        value={customBpm}
                        onChange={(e) => setCustomBpm(Number(e.target.value) || 128)}
                        className="w-full min-h-[44px] bg-white border border-slate-200 focus:border-indigo-600 rounded-xl px-3 py-2 text-sm text-center font-bold text-slate-900 outline-none"
                      />
                    </div>
                  </div>

                  {/* Target Duration Selector */}
                  <div>
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 mb-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Durasi Chart Permainan</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: '1.5 Mnt', sec: 90 },
                        { label: '2 Mnt', sec: 120 },
                        { label: '3 Mnt', sec: 180 },
                        { label: '4 Mnt', sec: 240 },
                      ].map((item) => (
                        <button
                          key={item.sec}
                          type="button"
                          onClick={() => setTargetDuration(item.sec)}
                          className={`min-h-[40px] py-1.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                            targetDuration === item.sec
                              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LOCAL AUDIO FILE */}
          {activeTab === 'local' && (
            <>
              {!file ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 rounded-2xl p-8 text-center cursor-pointer transition-all group min-h-[160px] flex flex-col items-center justify-center"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*,video/webm,video/mp4,.mp3,.wav,.ogg,.m4a,.webm,.flac,.aac,.mkv"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  />
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 group-hover:bg-indigo-50 text-slate-600 group-hover:text-indigo-600 flex items-center justify-center mx-auto mb-3 transition-colors">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    Klik atau tarik file audio ke sini
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Mendukung format MP3, WAV, OGG, M4A, WEBM, FLAC
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200">
                      <Music className="w-5 h-5" />
                    </div>
                    <div className="truncate">
                      <p className="text-sm font-semibold text-slate-800 truncate">{file.name}</p>
                      <p className="text-xs text-slate-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setFile(null)}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 underline min-h-[44px] px-2 flex items-center"
                  >
                    Ganti
                  </button>
                </div>
              )}
            </>
          )}

          {/* Title & Artist Inputs */}
          {((activeTab === 'local' && file) || (activeTab === 'youtube' && ytMetadata)) && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Judul Lagu
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Masukkan Judul Lagu"
                  className="w-full min-h-[44px] bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl px-4 py-2 text-sm text-slate-900 outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Nama Artis / Musisi
                </label>
                <input
                  type="text"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  placeholder="Masukkan Nama Artis"
                  className="w-full min-h-[44px] bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl px-4 py-2 text-sm text-slate-900 outline-none transition-colors"
                />
              </div>

              {/* Info banner */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5">
                  <p className="font-semibold text-indigo-950">Chart Otomatis 4 Kesulitan</p>
                  <p className="text-indigo-700">
                    Sistem akan menyusun chart Easy, Medium, Hard, dan Expert secara sinkron dengan ritme musik.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Progress Bar */}
          {isAnalyzing && (
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs font-medium text-slate-600">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  Menganalisis ritme & menyinkronkan data...
                </span>
                <span className="font-bold text-slate-800">{analysisProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div
                  className="h-full bg-indigo-600 transition-all duration-300"
                  style={{ width: `${analysisProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            Batal
          </button>
          <button
            disabled={
              isAnalyzing ||
              (activeTab === 'local' && (!file || !title)) ||
              (activeTab === 'youtube' && (!ytMetadata || !title))
            }
            onClick={handleAnalyzeAndSave}
            className="px-5 py-2.5 min-h-[44px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Sparkles className="w-4 h-4 text-indigo-300" />
            <span>Sinkron & Simpan</span>
          </button>
        </div>
      </div>
    </dialog>
  );
};
