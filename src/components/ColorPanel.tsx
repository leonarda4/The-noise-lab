import {
  BLEND_MODE_OPTIONS,
  COLOR_CONTROLS,
  COLORWAYS,
} from "../config";
import type {
  BlendMode,
  ColorConfig,
  ColorParamKey,
  ColorwayId,
} from "../types";
import { ParameterControl } from "./ParameterControl";

interface ColorPanelProps {
  colorConfig: ColorConfig;
  onColorwayChange: (colorwayId: ColorwayId) => void;
  onBlendModeChange: (blendMode: BlendMode) => void;
  onParamChange: (key: ColorParamKey, value: number) => void;
  onCustomStopChange: (index: number, value: string) => void;
  onAddCustomStop: () => void;
  onRemoveCustomStop: (index: number) => void;
  isOpen?: boolean;
  onToggle?: () => void;
}

export function ColorPanel({
  colorConfig,
  onAddCustomStop,
  onBlendModeChange,
  onColorwayChange,
  onCustomStopChange,
  onParamChange,
  onRemoveCustomStop,
  isOpen = true,
  onToggle,
}: ColorPanelProps) {
  return (
    <section className={`control-panel color-panel ${isOpen ? "is-open" : "is-collapsed"}`}>
      <button
        aria-expanded={isOpen}
        className="panel-tab"
        onClick={onToggle}
        type="button"
      >
        <span>Color</span>
        <span className="panel-tab-caret" aria-hidden="true" />
      </button>

      <div className="panel-surface">
        <div className="panel-block">
          <div className="colorway-grid">
            {COLORWAYS.map((colorway) => (
              <button
                className={`colorway-card ${colorway.key === colorConfig.colorwayId ? "is-selected" : ""}`}
                key={colorway.key}
                onClick={() => onColorwayChange(colorway.key)}
                type="button"
              >
                <div className="colorway-copy">
                  <span>{colorway.label}</span>
                </div>
                <div className="colorway-swatches">
                  {colorway.colors.map((color) => (
                    <span
                      className="colorway-swatch"
                      key={`${colorway.key}-${color}`}
                      style={{ background: color }}
                    />
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        {colorConfig.colorwayId === "custom" ? (
          <div className="panel-block custom-stops">
            <div className="section-heading-row">
              <span className="control-label">Custom stops</span>
              <span>{colorConfig.customStops.length} / 5</span>
            </div>

            <div className="custom-stop-stack">
              {colorConfig.customStops.map((stop, index) => (
                <div className="custom-stop-row" key={`${stop}-${index}`}>
                  <input
                    className="color-input"
                    onChange={(event) => onCustomStopChange(index, event.target.value)}
                    type="color"
                    value={stop}
                  />
                  <input
                    className="custom-stop-hex"
                    onChange={(event) => onCustomStopChange(index, event.target.value)}
                    type="text"
                    value={stop}
                  />
                  <button
                    className="small-button"
                    disabled={colorConfig.customStops.length <= 3}
                    onClick={() => onRemoveCustomStop(index)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <button
              className="small-button add-stop-button"
              disabled={colorConfig.customStops.length >= 5}
              onClick={onAddCustomStop}
              type="button"
            >
              Add stop
            </button>
          </div>
        ) : null}

        <div className="panel-block">
          <ParameterControl
            definition={{
              key: "blendMode",
              kind: "select",
              label: "Blend mode",
              options: BLEND_MODE_OPTIONS,
            }}
            onChange={(value) => onBlendModeChange(value as BlendMode)}
            value={colorConfig.blendMode}
          />
        </div>

        <div className="panel-block">
          <div className="control-stack">
            {COLOR_CONTROLS.map((control) => (
              <ParameterControl
                definition={control}
                key={control.key}
                onChange={(value) => onParamChange(control.key, Number(value))}
                value={colorConfig.params[control.key]}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
