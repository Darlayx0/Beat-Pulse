import { AudioLines, HardDrive, Search, X, Youtube } from "lucide-react";

export type SourceFilter = "all" | "preset" | "local" | "youtube";
export type SongSort = "default" | "title" | "newest" | "bpm";
const filters = [
  { id: "all", label: "Semua", icon: null },
  { id: "preset", label: "Preset", icon: AudioLines },
  { id: "local", label: "Lokal", icon: HardDrive },
  { id: "youtube", label: "YouTube", icon: Youtube },
] as const;
interface LibraryToolbarProps {
  query: string;
  onQueryChange: (query: string) => void;
  filter: SourceFilter;
  onFilterChange: (filter: SourceFilter) => void;
  sort: SongSort;
  onSortChange: (sort: SongSort) => void;
  counts: Record<SourceFilter, number>;
}

export function LibraryToolbar({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  sort,
  onSortChange,
  counts,
}: LibraryToolbarProps) {
  return (
    <div className="bp-toolbar">
      <div className="bp-search">
        <Search size={19} aria-hidden="true" />
        <label className="sr-only" htmlFor="library-search">
          Cari judul lagu atau artis
        </label>
        <input
          id="library-search"
          type="search"
          placeholder="Cari lagu atau artis…"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        {query && (
          <button
            type="button"
            className="bp-icon-button"
            onClick={() => onQueryChange("")}
            aria-label="Hapus pencarian"
          >
            <X size={18} />
          </button>
        )}
      </div>
      <div className="bp-toolbar__bottom">
        <div
          className="bp-filters"
          role="group"
          aria-label="Filter sumber lagu"
        >
          {filters.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              aria-pressed={filter === id}
              className={`bp-filter ${filter === id ? "bp-filter--active" : ""}`}
              onClick={() => onFilterChange(id)}
            >
              {Icon && <Icon size={15} aria-hidden="true" />}
              <span>{label}</span>
              <span className="bp-filter__count">{counts[id]}</span>
            </button>
          ))}
        </div>
        <div className="bp-sort">
          <label htmlFor="library-sort">Urutkan</label>
          <select
            id="library-sort"
            value={sort}
            onChange={(event) => onSortChange(event.target.value as SongSort)}
          >
            <option value="default">Koleksi utama</option>
            <option value="title">Judul A–Z</option>
            <option value="newest">Terbaru ditambahkan</option>
            <option value="bpm">Tempo terendah</option>
          </select>
        </div>
      </div>
    </div>
  );
}
