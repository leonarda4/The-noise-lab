import type { PhotoExportFormat } from "../types";

interface ExportPanelProps {
  width: number;
  height: number;
  durationSeconds: number;
  photoFormat: PhotoExportFormat;
  isExportingPhoto: boolean;
  isExportingVideo: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  onWidthChange: (value: number) => void;
  onHeightChange: (value: number) => void;
  onDurationChange: (value: number) => void;
  onPhotoFormatChange: (value: PhotoExportFormat) => void;
  onApplyPreset: (width: number, height: number) => void;
  onExportPhoto: () => void;
  onExportVideo: () => void;
}

const EXPORT_PRESETS = [
  { label: "1:1", width: 1080, height: 1080 },
  { label: "4:5", width: 1080, height: 1350 },
  { label: "3:4", width: 1200, height: 1600 },
  { label: "16:9", width: 1920, height: 1080 },
  { label: "9:16", width: 1080, height: 1920 },
] as const;

const formatAspectRatio = (width: number, height: number) => {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));

  const gcd = (left: number, right: number): number =>
    right ? gcd(right, left % right) : left;

  const divisor = gcd(safeWidth, safeHeight);
  const reducedWidth = safeWidth / divisor;
  const reducedHeight = safeHeight / divisor;

  if (reducedWidth <= 32 && reducedHeight <= 32) {
    return `${reducedWidth}:${reducedHeight}`;
  }

  return `${(safeWidth / safeHeight).toFixed(2)}:1`;
};

const handleNumberInput = (
  rawValue: string,
  onChange: (value: number) => void,
) => {
  const value = Number.parseInt(rawValue, 10);
  if (Number.isFinite(value)) {
    onChange(value);
  }
};

const handleDecimalInput = (
  rawValue: string,
  onChange: (value: number) => void,
) => {
  const value = Number.parseFloat(rawValue);
  if (Number.isFinite(value)) {
    onChange(value);
  }
};

export function ExportPanel({
  width,
  height,
  durationSeconds,
  photoFormat,
  isExportingPhoto,
  isExportingVideo,
  isOpen = true,
  onToggle,
  onWidthChange,
  onHeightChange,
  onDurationChange,
  onPhotoFormatChange,
  onApplyPreset,
  onExportPhoto,
  onExportVideo,
}: ExportPanelProps) {
  const isBusy = isExportingPhoto || isExportingVideo;
  const aspectRatioLabel = formatAspectRatio(width, height);

  return (
    <section className={`control-panel export-panel ${isOpen ? "is-open" : "is-collapsed"}`}>
      <button
        aria-expanded={isOpen}
        className="panel-tab"
        onClick={onToggle}
        type="button"
      >
        <span>Export</span>
        <span className="panel-tab-caret" aria-hidden="true" />
      </button>

      <div className="panel-surface">
        <div className="panel-block export-preview-card">
          <div className="section-heading-row">
            <span className="control-label">Preview crop</span>
            <span>{aspectRatioLabel}</span>
          </div>
          <p className="control-helper export-preview-copy">
            The centered frame on the canvas matches the exported crop.
          </p>
          <div className="export-dimension-pill">
            {width} × {height}
          </div>
        </div>

        <div className="panel-block">
          <div className="section-heading-row">
            <span className="control-label">Aspect presets</span>
            <span>Quick sizes</span>
          </div>
          <div className="aspect-preset-grid">
            {EXPORT_PRESETS.map((preset) => (
              <button
                className="small-button aspect-preset-button"
                key={preset.label}
                onClick={() => onApplyPreset(preset.width, preset.height)}
                type="button"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="panel-block export-input-grid">
          <label className="export-field">
            <span className="control-label">Width</span>
            <input
              className="export-number-input"
              inputMode="numeric"
              min={64}
              onChange={(event) =>
                handleNumberInput(event.target.value, onWidthChange)}
              step={1}
              type="number"
              value={width}
            />
          </label>

          <label className="export-field">
            <span className="control-label">Height</span>
            <input
              className="export-number-input"
              inputMode="numeric"
              min={64}
              onChange={(event) =>
                handleNumberInput(event.target.value, onHeightChange)}
              step={1}
              type="number"
              value={height}
            />
          </label>
        </div>

        <div className="panel-block">
          <label className="control-card control-card--select">
            <div className="control-row">
              <span className="control-label">Photo format</span>
            </div>
            <select
              className="control-select"
              onChange={(event) =>
                onPhotoFormatChange(event.target.value as PhotoExportFormat)}
              value={photoFormat}
            >
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
            </select>
            <div className="control-helper">Still exports use the selected size exactly.</div>
          </label>
        </div>

        <div className="panel-block">
          <label className="control-card control-card--range export-duration-card">
            <div className="control-row">
              <span className="control-label">Video duration</span>
              <span className="control-value">{durationSeconds.toFixed(1)}s</span>
            </div>
            <input
              className="export-number-input"
              inputMode="decimal"
              min={1}
              onChange={(event) =>
                handleDecimalInput(event.target.value, onDurationChange)}
              step={0.5}
              type="number"
              value={durationSeconds}
            />
            <div className="control-helper">
              Video downloads as WebM or MP4, depending on browser support.
            </div>
          </label>
        </div>

        <div className="panel-block export-actions">
          <button
            className="small-button"
            disabled={isBusy}
            onClick={onExportPhoto}
            type="button"
          >
            {isExportingPhoto ? "Exporting photo..." : "Export photo"}
          </button>
          <button
            className="small-button"
            disabled={isBusy}
            onClick={onExportVideo}
            type="button"
          >
            {isExportingVideo ? "Recording video..." : "Export video"}
          </button>
        </div>
      </div>
    </section>
  );
}
