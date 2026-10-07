import React, { useState } from 'react';
import {
  Save,
  CheckCircle2,
  HardDrive,
  RefreshCw,
  Clock,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

interface SubPageSaveMethodProps {
  saveMode: 'auto' | 'manual';
  onChangeSaveMode: (mode: 'auto' | 'manual') => void;
  onClose: () => void;
}

export const SubPageSaveMethod: React.FC<SubPageSaveMethodProps> = ({
  saveMode,
  onChangeSaveMode,
}) => {
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSelect = (mode: 'auto' | 'manual') => {
    onChangeSaveMode(mode);
    setFeedback(
      mode === 'auto'
        ? 'Mode Auto-Save aktif: Perubahan disimpan otomatis & tombol simpan di header disembunyikan.'
        : 'Mode Manual Save aktif: Tombol simpan ditampilkan di header editor.'
    );
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2">
      {/* Feedback Banner */}
      {feedback && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      <div>
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-indigo-600" />
          <span>Konfigurasi Metode Penyimpanan Partitur</span>
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Tentukan bagaimana perubahan nada, ketukan, dan difficulty disimpan ke database browser dan cloud.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Opsi 1: Auto-Save */}
        <div
          onClick={() => handleSelect('auto')}
          className={`p-5 rounded-3xl border text-left transition-all cursor-pointer relative ${
            saveMode === 'auto'
              ? 'bg-indigo-50/90 border-indigo-300 ring-2 ring-indigo-300/40 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 border border-indigo-200 text-indigo-600 flex items-center justify-center">
              <RefreshCw className="w-5 h-5" />
            </div>
            {saveMode === 'auto' && (
              <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-3 py-1 rounded-full border border-indigo-200">
                Mode Aktif
              </span>
            )}
          </div>

          <h4 className="text-base font-bold text-slate-900">
            Penyimpanan Otomatis (Auto-Save)
          </h4>
          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
            Setiap perubahan nada atau pengaturan akan otomatis disimpan di latar belakang setelah 1,2 detik tanpa interupsi.
          </p>

          <div className="mt-4 pt-4 border-t border-slate-200 space-y-1.5 text-xs text-slate-600">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Tombol simpan di header disembunyikan secara bersih</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Tersinkronisasi otomatis dengan Undo/Redo</span>
            </div>
          </div>
        </div>

        {/* Opsi 2: Manual Save */}
        <div
          onClick={() => handleSelect('manual')}
          className={`p-5 rounded-3xl border text-left transition-all cursor-pointer relative ${
            saveMode === 'manual'
              ? 'bg-amber-50/90 border-amber-300 ring-2 ring-amber-300/40 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-200 text-amber-600 flex items-center justify-center">
              <Save className="w-5 h-5" />
            </div>
            {saveMode === 'manual' && (
              <span className="text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1 rounded-full border border-amber-200">
                Mode Aktif
              </span>
            )}
          </div>

          <h4 className="text-base font-bold text-slate-900">
            Penyimpanan Manual (Manual Save)
          </h4>
          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
            Penyimpanan hanya dieksekusi saat Anda menekan tombol simpan di header atau menekan pintasan keyboard (Ctrl+S).
          </p>

          <div className="mt-4 pt-4 border-t border-slate-200 space-y-1.5 text-xs text-slate-600">
            <div className="flex items-center gap-2 text-amber-700 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Tombol simpan ditampilkan di samping tombol Play Test</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Kontrol penuh atas kapan versi partitur ditulis</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
