import { ArrowUpRight, AudioLines, Plus } from "lucide-react";

export function LibraryHero({
  songCount,
  chartCount,
  onImport,
}: {
  songCount: number;
  chartCount: number;
  onImport: () => void;
}) {
  return (
    <section className="bp-hero" aria-labelledby="library-title">
      <div className="bp-hero__copy">
        <span className="bp-eyebrow">
          <span className="bp-status-dot" /> PUSTAKA MUSIKMU
        </span>
        <h1 id="library-title">
          Temukan <span>ritmemu.</span>
        </h1>
        <p>
          Musik pilihanmu, tantangan versimu.
          <br />
          Pilih lagu, ikuti ketukan, dan buat rekor baru.
        </p>
        <button
          type="button"
          className="bp-button bp-button--primary"
          onClick={onImport}
          aria-haspopup="dialog"
        >
          <Plus size={18} /> Impor musik <ArrowUpRight size={17} />
        </button>
      </div>
      <div className="bp-hero__visual">
        <div className="bp-hero__graphic" aria-hidden="true">
          <div className="bp-hero__rings" />
          <AudioLines className="bp-hero__music" strokeWidth={1.4} />
          <span className="bp-hero__graphic-label">FEEL THE BEAT.</span>
          <div className="bp-hero__meter">
            {[
              10, 24, 16, 38, 26, 56, 36, 70, 48, 80, 62, 92, 70, 86, 46, 74,
              58, 40, 60, 32, 48, 24, 36, 14,
            ].map((height, index) => (
              <i key={index} style={{ height: `${height}%` }} />
            ))}
          </div>
        </div>
        <dl className="bp-hero__stats">
          <div>
            <dt>Lagu di pustaka</dt>
            <dd>{songCount.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Chart tersedia</dt>
            <dd>{chartCount.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Mode bermain</dt>
            <dd>
              4 <span>lane</span>
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
