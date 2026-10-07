import React, { useState } from 'react';
import {
  Layers,
  FileCode,
  Download,
  Upload,
  Copy,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { Song, DifficultyLevel, Note } from '../../../types';

interface SubPageDifficultyJsonProps {
  song: Song;
  selectedDifficulty: DifficultyLevel;
  bpm: number;
  offset: number;
  notes: Note[];
  isLocked: boolean;
  onSelectDifficulty: (diff: DifficultyLevel) => void;
  onExportJSON: () => void;
  onTriggerImportJSON: () => void;
  onImportChartJson?: (songId: string, jsonString: string) => Promise<void>;
  onAddDifficulty?: (songId: string, diffName: string) => void;
  onRenameDifficulty?: (songId: string, oldDiff: string, newDiff: string) => void;
  onDeleteDifficulty?: (songId: string, diffName: string) => void;
  onDuplicateDifficulty?: (songId: string, sourceDiffName: string, newDiffName: string) => void;
  onUpdateNotes: (notes: Note[]) => void;
  onClose: () => void;
}

export const SubPageDifficultyJson: React.FC<SubPageDifficultyJsonProps> = ({
  song,
  selectedDifficulty,
  bpm,
  offset,
  notes,
  isLocked,
  onSelectDifficulty,
  onExportJSON,
  onTriggerImportJSON,
  onImportChartJson,
  onAddDifficulty,
  onDeleteDifficulty,
  onDuplicateDifficulty,
  onUpdateNotes,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [newDiffInput, setNewDiffInput] = useState<string>('');
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [deleteConfirmDiff, setDeleteConfirmDiff] = useState<string | null>(null);
  const [pasteJsonText, setPasteJsonText] = useState<string>('');
  const [showPasteArea, setShowPasteArea] = useState<boolean>(false);

  const availableDiffs = song.charts ? Object.keys(song.charts) : ['Easy', 'Medium', 'Hard', 'Expert'];

  const handleCopyJSON = async () => {
    try {
      const payload = {
        songTitle: song.title,
        songArtist: song.artist,
        difficulty: selectedDifficulty,
        bpm,
        offset,
        notes,
      };
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setFeedback({ type: 'success', message: 'Partitur JSON berhasil disalin ke papan klip!' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFeedback({ type: 'error', message: 'Gagal menyalin ke papan klip browser.' });
    }
  };

  const handleAddNewDifficulty = () => {
    const trimmed = newDiffInput.trim();
    if (!trimmed) return;
    if (availableDiffs.includes(trimmed)) {
      setFeedback({ type: 'error', message: `Difficulty "${trimmed}" sudah ada.` });
      return;
    }
    if (onAddDifficulty) {
      onAddDifficulty(song.id, trimmed);
      setFeedback({ type: 'success', message: `Difficulty "${trimmed}" berhasil dibuat.` });
      setNewDiffInput('');
      setIsAdding(false);
      onSelectDifficulty(trimmed as DifficultyLevel);
    }
  };

  const handleDuplicate = () => {
    const targetName = `${selectedDifficulty}_Copy`;
    if (onDuplicateDifficulty) {
      onDuplicateDifficulty(song.id, selectedDifficulty, targetName);
      setFeedback({ type: 'success', message: `Berhasil menduplikasi "${selectedDifficulty}" ke "${targetName}".` });
      onSelectDifficulty(targetName as DifficultyLevel);
    }
  };

  const handleDelete = (diff: string) => {
    if (availableDiffs.length <= 1) {
      setFeedback({ type: 'error', message: 'Tidak dapat menghapus slot terakhir lagu.' });
      return;
    }
    if (onDeleteDifficulty) {
      onDeleteDifficulty(song.id, diff);
      setFeedback({ type: 'success', message: `Difficulty "${diff}" berhasil dihapus.` });
      setDeleteConfirmDiff(null);
      const remaining = availableDiffs.filter((d) => d !== diff);
      if (remaining.length > 0) {
        onSelectDifficulty(remaining[0] as DifficultyLevel);
      }
    }
  };

  const handleApplyPastedJson = async () => {
    if (!pasteJsonText.trim()) return;
    try {
      const parsed = JSON.parse(pasteJsonText);
      if (!parsed || !Array.isArray(parsed.notes)) {
        throw new Error('Format JSON tidak memiliki array `notes` yang valid.');
      }
      if (onImportChartJson) {
        await onImportChartJson(song.id, pasteJsonText);
        setFeedback({ type: 'success', message: 'Partitur JSON berhasil diterapkan!' });
        setShowPasteArea(false);
        setPasteJsonText('');
      } else {
        onUpdateNotes(parsed.notes);
        setFeedback({ type: 'success', message: `Berhasil memuat ${parsed.notes.length} note dari JSON!` });
        setShowPasteArea(false);
        setPasteJsonText('');
      }
    } catch (e: any) {
      setFeedback({ type: 'error', message: e?.message || 'JSON tidak valid.' });
    }
  };

  // Draft backup check
  const draftKey = `BEATPULSE_CHART_DRAFT_${song.id}_${selectedDifficulty}`;
  const draftRaw = typeof window !== 'undefined' ? localStorage.getItem(draftKey) : null;
  const draftObj = draftRaw ? JSON.parse(draftRaw) : null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 text-sm font-medium border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Bagian 1: Pengaturan Slot Difficulty */}
      <section className="space-y-3 pb-6 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Slot Tingkat Kesulitan (Difficulty)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih, tambah, duplikat, atau kelola slot bagan nada lagu ini.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDuplicate}
              disabled={isLocked}
              className="h-8 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 border border-slate-200 shadow-xs"
              title="Duplikasi slot chart aktif saat ini"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Duplikat</span>
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              disabled={isLocked}
              className="h-8 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Slot</span>
            </button>
          </div>
        </div>

        {/* Input tambah slot */}
        {isAdding && (
          <div className="p-3.5 rounded-2xl bg-white border border-indigo-200 flex items-center gap-2 animate-in fade-in shadow-xs">
            <input
              type="text"
              placeholder="Nama difficulty baru (misal: Master, Chaos)..."
              value={newDiffInput}
              onChange={(e) => setNewDiffInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddNewDifficulty()}
              className="flex-1 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-sm text-slate-900 outline-none focus:border-indigo-500"
              autoFocus
            />
            <button
              type="button"
              onClick={handleAddNewDifficulty}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 cursor-pointer"
            >
              Simpan
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setNewDiffInput('');
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs hover:bg-slate-200 cursor-pointer"
            >
              Batal
            </button>
          </div>
        )}

        {/* Daftar slot */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {availableDiffs.map((diff) => {
            const isCurrent = diff === selectedDifficulty;
            const diffChart = song.charts?.[diff];
            const noteCount = isCurrent ? notes.length : diffChart?.notes?.length || 0;

            return (
              <div
                key={diff}
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                  isCurrent
                    ? 'bg-indigo-50/90 border-indigo-300 ring-1 ring-indigo-300 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectDifficulty(diff as DifficultyLevel)}
                  className="flex-1 text-left flex items-center gap-3 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-black text-indigo-600">
                    {diff.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>{diff}</span>
                      {isCurrent && (
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold border border-indigo-200">
                          Aktif
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      {noteCount} note terdaftar
                    </div>
                  </div>
                </button>

                {availableDiffs.length > 1 && (
                  <div>
                    {deleteConfirmDiff === diff ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDelete(diff)}
                          className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer"
                        >
                          Hapus
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmDiff(null)}
                          className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-[11px] hover:bg-slate-200 cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmDiff(diff)}
                        disabled={isLocked}
                        className="w-8 h-8 rounded-xl bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition-colors flex items-center justify-center cursor-pointer disabled:opacity-40 shadow-xs"
                        title="Hapus slot difficulty ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Bagian 2: Manajemen Berkas Partitur JSON */}
      <section className="space-y-3 pb-6 border-b border-slate-200">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileCode className="w-4 h-4 text-emerald-600" />
            <span>Manajemen Berkas Partitur JSON</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Ekspor chart ke berkas .json, impor berkas chart eksternal, atau tempel kode JSON langsung.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={onExportJSON}
            className="p-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-emerald-300 text-left transition-all cursor-pointer group shadow-xs"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Download className="w-4 h-4" />
            </div>
            <div className="text-sm font-bold text-slate-900 group-hover:text-emerald-600">
              Unduh Berkas JSON
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Simpan partitur {selectedDifficulty} (.json) ke perangkat.
            </p>
          </button>

          <button
            type="button"
            onClick={onTriggerImportJSON}
            disabled={isLocked}
            className="p-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-sky-300 text-left transition-all cursor-pointer group disabled:opacity-50 shadow-xs"
          >
            <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Upload className="w-4 h-4" />
            </div>
            <div className="text-sm font-bold text-slate-900 group-hover:text-sky-600">
              Impor File JSON
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Muat berkas partitur .json dari komputer/ponsel.
            </p>
          </button>

          <button
            type="button"
            onClick={handleCopyJSON}
            className="p-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-300 text-left transition-all cursor-pointer group shadow-xs"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </div>
            <div className="text-sm font-bold text-slate-900 group-hover:text-indigo-600">
              {copied ? 'Tersalin!' : 'Salin JSON ke Klip'}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Salin seluruh struktur data partitur ke clipboard.
            </p>
          </button>
        </div>

        {/* Toggle tempel kode JSON */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowPasteArea((p) => !p)}
            className="text-xs text-slate-500 hover:text-indigo-600 underline cursor-pointer font-medium"
          >
            {showPasteArea ? 'Sembunyikan Editor Tempel JSON' : 'Tempel Teks JSON Secara Manual'}
          </button>

          {showPasteArea && (
            <div className="mt-2 space-y-2 p-3.5 rounded-2xl bg-white border border-slate-200 animate-in fade-in shadow-xs">
              <textarea
                rows={5}
                placeholder="Tempelkan struktur data JSON chart di sini..."
                value={pasteJsonText}
                onChange={(e) => setPasteJsonText(e.target.value)}
                className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-mono text-xs text-slate-900 outline-none focus:border-indigo-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleApplyPastedJson}
                  disabled={!pasteJsonText.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer disabled:opacity-40 shadow-xs"
                >
                  Terapkan JSON
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Bagian 3: Cadangan Partitur Lokal */}
      <section className="space-y-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-amber-600" />
            <span>Cadangan Lokal (Local Draft Backup)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Snapshot otomatis yang tersimpan di penyimpanan lokal browser untuk mencegah kehilangan data.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center justify-between gap-4 shadow-xs">
          <div className="space-y-0.5">
            <div className="text-sm font-bold text-slate-800">
              {draftObj ? 'Cadangan Draf Lokal Ditemukan' : 'Tidak Ada Cadangan Draf Terpisah'}
            </div>
            <div className="text-xs text-slate-500 font-mono">
              {draftObj
                ? `Terakhir disimpan: ${new Date(draftObj.timestamp || 0).toLocaleTimeString()} (${draftObj.notes?.length || 0} note)`
                : 'Partitur Anda saat ini sudah tersinkronisasi dengan penyimpanan utama.'}
            </div>
          </div>

          {draftObj && (
            <button
              type="button"
              onClick={() => {
                if (draftObj.notes) {
                  onUpdateNotes(draftObj.notes);
                  setFeedback({ type: 'success', message: 'Berhasil memulihkan partitur dari cadangan draf lokal!' });
                }
              }}
              className="h-9 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all cursor-pointer shrink-0 shadow-xs"
            >
              Pulihkan Draf
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
