import type { PhotoExportFormat } from "../types";

interface ExportPanelProps {
  width: number;
  height: number;
  maxDimension: number;
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
const RESOLUTION_SCALES = [1, 1.5, 2, 3, 4, 6] as const;
const DEFAULT_RESOLUTION_BASE_EDGE = 1080;

const matchesAspectRatio = (
  leftWidth: number,
  leftHeight: number,
  rightWidth: number,
  rightHeight: number,
) => leftWidth * rightHeight === leftHeight * rightWidth;

const getResolutionBaseSize = (width: number, height: number) => {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const presetMatch = EXPORT_PRESETS.find((preset) =>
    matchesAspectRatio(preset.width, preset.height, safeWidth, safeHeight));

  if (presetMatch) {
    return {
      width: presetMatch.width,
      height: presetMatch.height,
    };
  }

  if (safeWidth <= safeHeight) {
    return {
      width: DEFAULT_RESOLUTION_BASE_EDGE,
      height: Math.round(
        (DEFAULT_RESOLUTION_BASE_EDGE * safeHeight) / safeWidth,
      ),
    };
  }

  return {
    width: Math.round((DEFAULT_RESOLUTION_BASE_EDGE * safeWidth) / safeHeight),
    height: DEFAULT_RESOLUTION_BASE_EDGE,
  };
};

const buildResolutionOptions = (
  width: number,
  height: number,
  maxDimension: number,
) => {
  const baseSize = getResolutionBaseSize(width, height);
  const options: { value: string; label: string; width: number; height: number }[] = [];

  for (const scale of RESOLUTION_SCALES) {
    const scaledWidth = Math.round(baseSize.width * scale);
    const scaledHeight = Math.round(baseSize.height * scale);

    if (scaledWidth > maxDimension || scaledHeight > maxDimension) {
      continue;
    }

    const value = `${scaledWidth}x${scaledHeight}`;
    if (options.some((option) => option.value === value)) {
      continue;
    }

    options.push({
      value,
      label: `${scaledWidth} × ${scaledHeight}`,
      width: scaledWidth,
      height: scaledHeight,
    });
  }

  return options;
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
  maxDimension,
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
  const resolutionOptions = buildResolutionOptions(width, height, maxDimension);
  const selectedResolutionValue =
    resolutionOptions.find(
      (option) => option.width === width && option.height === height,
    )?.value ?? "custom";

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
        <div className="panel-block">
          <span className="control-label">Aspect presets</span>
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

        <div className="panel-block">
          <label className="control-card control-card--select">
            <div className="control-row">
              <span className="control-label">Resolution</span>
              <span className="control-value">{width} × {height}</span>
            </div>
            <select
              className="control-select"
              onChange={(event) => {
                const option = resolutionOptions.find(
                  (entry) => entry.value === event.target.value,
                );

                if (option) {
                  onApplyPreset(option.width, option.height);
                }
              }}
              value={selectedResolutionValue}
            >
              {resolutionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
              <option value="custom">Custom</option>
            </select>
          </label>
        </div>

        <div className="panel-block export-input-grid">
          <label className="export-field">
            <span className="control-label">Width</span>
            <input
              className="export-number-input"
              inputMode="numeric"
              max={maxDimension}
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
              max={maxDimension}
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
