import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  Edit3,
  FileJson,
  Layers,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { Song } from "../../types";
import { MenuDialog } from "./MenuDialog";

export type LibraryDialog =
  | "manage"
  | "add"
  | "rename"
  | "duplicateDifficulty"
  | "reorder"
  | "deleteDifficulty"
  | "duplicateSong"
  | "deleteSong";
export interface ManagementActions {
  add?: (name: string) => void;
  rename?: (name: string) => void;
  duplicateDifficulty?: (name: string) => void;
  reorder?: (order: string[]) => void;
  deleteDifficulty?: () => void;
  duplicateSong?: () => void;
  deleteSong: () => void;
  relink?: () => void;
  importChart?: () => void;
  exportChart: () => void;
}
interface LibraryDialogsProps {
  mode: LibraryDialog;
  song: Song;
  difficulty: string;
  actions: ManagementActions;
  onModeChange: (mode: LibraryDialog) => void;
  onClose: () => void;
}

export function LibraryDialogs({
  mode,
  song,
  difficulty,
  actions,
  onModeChange,
  onClose,
}: LibraryDialogsProps) {
  const [name, setName] = useState(
    mode === "rename"
      ? difficulty
      : mode === "duplicateDifficulty"
        ? `${difficulty} (Salinan)`
        : "",
  );
  const [order, setOrder] = useState(Object.keys(song.charts));
  const [error, setError] = useState("");
  const chart = song.charts[difficulty];
  const difficulties = Object.keys(song.charts);
  const editName =
    mode === "add" || mode === "rename" || mode === "duplicateDifficulty";
  const titles: Record<LibraryDialog, string> = {
    manage: "Kelola lagu",
    add: "Tambah difficulty",
    rename: "Ubah nama difficulty",
    duplicateDifficulty: "Duplikat difficulty",
    reorder: "Atur urutan difficulty",
    deleteDifficulty: "Hapus difficulty?",
    duplicateSong: "Duplikat lagu?",
    deleteSong: "Hapus lagu?",
  };
  const finish = (action?: () => void) => {
    if (action) {
      action();
      onClose();
    }
  };
  const submitName = () => {
    if (mode !== "add" && !chart) {
      setError("Difficulty ini sudah berubah atau dihapus. Tutup dialog dan pilih kembali.");
      return;
    }
    const clean = name.trim();
    if (!clean) {
      setError("Masukkan nama difficulty.");
      return;
    }
    if (
      Object.keys(song.charts).includes(clean) &&
      !(mode === "rename" && clean === difficulty)
    ) {
      setError("Nama ini sudah digunakan. Pilih nama lain.");
      return;
    }
    const action =
      mode === "add"
        ? actions.add
        : mode === "rename"
          ? actions.rename
          : actions.duplicateDifficulty;
    finish(action ? () => action(clean) : undefined);
  };
  const move = (index: number, direction: -1 | 1) => {
    const updated = [...order];
    [updated[index], updated[index + direction]] = [
      updated[index + direction],
      updated[index],
    ];
    setOrder(updated);
  };
  return (
    <MenuDialog
      title={titles[mode]}
      description={song.title}
      onClose={onClose}
      wide={mode === "manage"}
      returnFocusId="library-manage-button"
    >
      {mode === "manage" && (
        <div className="bp-management">
          <section>
            <h3>Lagu & audio</h3>
            <div className="bp-management__list">
              {actions.relink && (
                <button type="button" onClick={() => finish(actions.relink)}>
                  <Upload size={18} />
                  <span>
                    Hubungkan ulang audio
                    <small>Gunakan file audio tanpa mengubah chart.</small>
                  </span>
                </button>
              )}
              {actions.duplicateSong && (
                <button
                  type="button"
                  onClick={() => onModeChange("duplicateSong")}
                >
                  <Copy size={18} />
                  <span>
                    Duplikat lagu
                    <small>Buat salinan lagu dan semua difficulty.</small>
                  </span>
                </button>
              )}
              {actions.importChart && (
                <button
                  type="button"
                  onClick={() => finish(actions.importChart)}
                >
                  <FileJson size={18} />
                  <span>
                    Impor chart JSON
                    <small>Tambahkan chart dari file cadangan.</small>
                  </span>
                </button>
              )}
              {chart && (
                <button
                  type="button"
                  onClick={() => finish(actions.exportChart)}
                >
                  <Download size={18} />
                  <span>
                    Ekspor chart JSON
                    <small>Unduh difficulty {difficulty}.</small>
                  </span>
                </button>
              )}
            </div>
          </section>
          {!song.isPreset && (
            <section>
              <h3>Difficulty {difficulty && <span>· {difficulty}</span>}</h3>
              <div className="bp-management__list">
                {actions.add && (
                  <button type="button" onClick={() => onModeChange("add")}>
                    <Plus size={18} />
                    <span>Tambah difficulty</span>
                  </button>
                )}
                {chart && actions.rename && (
                  <button type="button" onClick={() => onModeChange("rename")}>
                    <Edit3 size={18} />
                    <span>Ubah nama difficulty</span>
                  </button>
                )}
                {chart && actions.duplicateDifficulty && (
                  <button
                    type="button"
                    onClick={() => onModeChange("duplicateDifficulty")}
                  >
                    <Copy size={18} />
                    <span>Duplikat difficulty</span>
                  </button>
                )}
                {difficulties.length > 1 && actions.reorder && (
                  <button type="button" onClick={() => onModeChange("reorder")}>
                    <Layers size={18} />
                    <span>Atur urutan difficulty</span>
                  </button>
                )}
                {chart &&
                  difficulties.length > 1 &&
                  actions.deleteDifficulty && (
                    <button
                      type="button"
                      className="bp-danger-text"
                      onClick={() => onModeChange("deleteDifficulty")}
                    >
                      <Trash2 size={18} />
                      <span>Hapus difficulty terpilih</span>
                    </button>
                  )}
              </div>
            </section>
          )}
          {song.isPreset && (
            <p className="bp-dialog-note">
              Chart preset terkunci. Duplikat lagu untuk membuat versi yang
              dapat diedit.
            </p>
          )}
          {!song.isPreset && (
            <section className="bp-management__danger">
              <button
                type="button"
                className="bp-button bp-button--danger-subtle"
                onClick={() => onModeChange("deleteSong")}
              >
                <Trash2 size={17} /> Hapus lagu
              </button>
            </section>
          )}
        </div>
      )}
      {editName && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitName();
          }}
          className="bp-dialog-form"
        >
          <label htmlFor="difficulty-name">Nama difficulty</label>
          <input
            id="difficulty-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
            placeholder="Contoh: Master, Expert…"
            data-dialog-autofocus
            autoFocus
            aria-invalid={!!error}
            aria-describedby={error ? "difficulty-name-error" : undefined}
          />
          {error && (
            <p
              id="difficulty-name-error"
              className="bp-danger-text"
              role="alert"
            >
              {error}
            </p>
          )}
          <p>
            {mode === "duplicateDifficulty"
              ? `Seluruh note, BPM, dan offset dari ${difficulty} akan disalin.`
              : mode === "add"
                ? "Difficulty baru menggunakan chart pertama sebagai dasar. Sesuaikan ketukan di editor."
                : "Nama baru digunakan untuk difficulty yang sama."}
          </p>
          <div className="bp-dialog-actions">
            <button
              type="button"
              className="bp-button bp-button--secondary"
              onClick={onClose}
            >
              Batal
            </button>
            <button
              type="submit"
              className="bp-button bp-button--primary"
              disabled={!name.trim()}
            >
              {mode === "add" ? "Tambahkan" : "Simpan"}
            </button>
          </div>
        </form>
      )}
      {mode === "reorder" && (
        <>
          <p className="bp-dialog-note">
            Urutan ini menentukan susunan pilihan difficulty.
          </p>
          <div className="bp-reorder">
            {order.map((item, index) => (
              <div key={item}>
                <span>{item}</span>
                <button
                  type="button"
                  className="bp-icon-button"
                  aria-label={`Naikkan ${item}`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp size={18} />
                </button>
                <button
                  type="button"
                  className="bp-icon-button"
                  aria-label={`Turunkan ${item}`}
                  disabled={index === order.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown size={18} />
                </button>
              </div>
            ))}
          </div>
          <div className="bp-dialog-actions">
            <button
              type="button"
              className="bp-button bp-button--secondary"
              onClick={onClose}
            >
              Batal
            </button>
            <button
              type="button"
              className="bp-button bp-button--primary"
              onClick={() =>
                finish(
                  actions.reorder
                    ? () =>
                        actions.reorder!(
                          order.filter((item) => song.charts[item]),
                        )
                    : undefined,
                )
              }
            >
              Simpan urutan
            </button>
          </div>
        </>
      )}
      {(mode === "deleteSong" ||
        mode === "deleteDifficulty" ||
        mode === "duplicateSong") && (
        <>
          <div
            className={`bp-confirm-message ${mode !== "duplicateSong" ? "bp-confirm-message--danger" : ""}`}
          >
            <p>
              {mode === "deleteSong"
                ? "Lagu, seluruh chart, rekor, dan audio lokalnya akan dihapus. Tindakan ini tidak dapat dibatalkan."
                : mode === "deleteDifficulty"
                  ? `Difficulty “${difficulty}” beserta note-nya akan dihapus. Difficulty lain tetap tersedia.`
                  : "Salinan baru dibuat bersama seluruh difficulty dan chart lagu ini."}
            </p>
          </div>
          <div className="bp-dialog-actions">
            <button
              type="button"
              className="bp-button bp-button--secondary"
              data-dialog-autofocus
              autoFocus
              onClick={onClose}
            >
              Batal
            </button>
            <button
              type="button"
              className={`bp-button ${mode === "duplicateSong" ? "bp-button--primary" : "bp-button--danger"}`}
              disabled={
                mode === "deleteDifficulty" &&
                (!chart || difficulties.length <= 1)
              }
              onClick={() =>
                finish(
                  mode === "duplicateSong"
                    ? actions.duplicateSong
                    : mode === "deleteDifficulty"
                      ? actions.deleteDifficulty
                      : actions.deleteSong,
                )
              }
            >
              {mode === "duplicateSong"
                ? "Duplikat lagu"
                : mode === "deleteSong"
                  ? "Hapus lagu"
                  : "Hapus difficulty"}
            </button>
          </div>
        </>
      )}
    </MenuDialog>
  );
}
