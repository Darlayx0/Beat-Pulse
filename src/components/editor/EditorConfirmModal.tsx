import React from 'react';
import { AlertTriangle, ShieldAlert, Check, X } from 'lucide-react';

export interface ConfirmDialogConfig {
  isOpen: boolean;
  title: string;
  description: string;
  impactLevel?: 'low' | 'medium' | 'high' | 'danger';
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export const EditorConfirmModal: React.FC<ConfirmDialogConfig> = ({
  isOpen,
  title,
  description,
  impactLevel = 'high',
  confirmLabel = 'Lanjutkan',
  cancelLabel = 'Batal',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const isDanger = impactLevel === 'danger' || impactLevel === 'high';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        className="bg-white border border-slate-200 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col text-slate-900 ring-1 ring-slate-950/5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        {/* Top Warning Strip */}
        <div className={`p-5 flex items-start gap-3.5 border-b ${isDanger ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
              isDanger
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                : 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
            }`}
          >
            {isDanger ? <ShieldAlert className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div className="space-y-1">
            <h3 id="confirm-dialog-title" className="font-extrabold text-base text-slate-900 leading-tight">
              {title}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Konfirmasi Tindakan Berdampak Besar
            </p>
          </div>
        </div>

        {/* Description Body */}
        <div className="p-5 space-y-3 bg-white">
          <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            {description}
          </p>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 shadow-xs" />
            <span>Tindakan ini dapat dibatalkan melalui fitur <strong>Undo (Ctrl+Z)</strong> di studio.</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold transition-all active:scale-95 cursor-pointer shadow-xs"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
