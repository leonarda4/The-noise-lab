import { useEffect, useMemo, useRef, useState } from "react";
import {
  BLEND_MODE_OPTIONS,
  COLOR_CONTROLS,
  COLORWAYS,
  MAX_COLOR_STOPS,
  MIN_COLOR_STOPS,
  getColorStops,
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
  onStopChange: (index: number, value: string) => void;
  onAddCustomStop: () => void;
  onRemoveStop: (index: number) => void;
  isOpen?: boolean;
  onToggle?: () => void;
}

type SwapTarget = {
  colorwayId: ColorwayId;
  index: number;
};

type SortableColor = {
  brightness: number;
  hue: number;
  isNeutral: boolean;
  value: string;
};

const uniqueColors = (colors: string[]) => {
  const seen = new Set<string>();

  return colors.filter((color) => {
    const normalized = color.toLowerCase();
    if (seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
};

const parseHexColor = (value: string) => {
  const normalized = value.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    return null;
  }

  return {
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16),
  };
};

const getSortableColor = (value: string): SortableColor => {
  const rgb = parseHexColor(value);
  if (!rgb) {
    return {
      brightness: Number.POSITIVE_INFINITY,
      hue: Number.POSITIVE_INFINITY,
      isNeutral: true,
      value,
    };
  }

  const red = rgb.red / 255;
  const green = rgb.green / 255;
  const blue = rgb.blue / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta > 0) {
    if (max === red) {
      hue = ((green - blue) / delta) % 6;
    } else if (max === green) {
      hue = (blue - red) / delta + 2;
    } else {
      hue = (red - green) / delta + 4;
    }

    hue *= 60;
    if (hue < 0) {
      hue += 360;
    }
  }

  return {
    brightness: max,
    hue,
    isNeutral: delta < 0.035,
    value,
  };
};

const sortColorsByHueAndBrightness = (colors: string[]) =>
  colors
    .map(getSortableColor)
    .sort((left, right) => {
      if (left.isNeutral !== right.isNeutral) {
        return left.isNeutral ? 1 : -1;
      }

      if (!left.isNeutral && left.hue !== right.hue) {
        return left.hue - right.hue;
      }

      if (left.brightness !== right.brightness) {
        return right.brightness - left.brightness;
      }

      return left.value.localeCompare(right.value);
    })
    .map((color) => color.value);

export function ColorPanel({
  colorConfig,
  onAddCustomStop,
  onBlendModeChange,
  onColorwayChange,
  onStopChange,
  onParamChange,
  onRemoveStop,
  isOpen = true,
  onToggle,
}: ColorPanelProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const panelSurfaceRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef(new Map<ColorwayId, HTMLDivElement>());
  const [swapTarget, setSwapTarget] = useState<SwapTarget | null>(null);
  const [swapPanelTop, setSwapPanelTop] = useState<number | null>(null);
  const activeStops = getColorStops(colorConfig);
  const hasEditedStops = colorConfig.editedStops.length >= MIN_COLOR_STOPS;
  const activeSwapIndex =
    swapTarget?.colorwayId === colorConfig.colorwayId ? swapTarget.index : null;
  const activeColorwayId = swapTarget?.colorwayId ?? colorConfig.colorwayId;
  const activeColorway =
    COLORWAYS.find((colorway) => colorway.key === activeColorwayId) ?? null;
  const activeRowStops =
    activeColorwayId === colorConfig.colorwayId
      ? activeStops
      : activeColorway?.key === "custom"
        ? colorConfig.customStops
        : activeColorway?.colors ?? [];
  const activeSwapColor =
    activeSwapIndex !== null ? activeRowStops[activeSwapIndex] ?? null : null;

  useEffect(() => {
    if (!isOpen) {
      setSwapTarget(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!swapTarget || !isOpen) {
      setSwapPanelTop(null);
      return;
    }

    const updateSwapPanelPosition = () => {
      const surfaceNode = panelSurfaceRef.current;
      const rowNode = rowRefs.current.get(swapTarget.colorwayId);

      if (!surfaceNode || !rowNode) {
        setSwapPanelTop(null);
        return;
      }

      const surfaceRect = surfaceNode.getBoundingClientRect();
      const rowRect = rowNode.getBoundingClientRect();
      setSwapPanelTop(rowRect.top - surfaceRect.top + 22);
    };

    updateSwapPanelPosition();

    const scrollNode = scrollContainerRef.current;
    scrollNode?.addEventListener("scroll", updateSwapPanelPosition, { passive: true });
    window.addEventListener("resize", updateSwapPanelPosition);

    return () => {
      scrollNode?.removeEventListener("scroll", updateSwapPanelPosition);
      window.removeEventListener("resize", updateSwapPanelPosition);
    };
  }, [isOpen, swapTarget]);

  useEffect(() => {
    if (activeSwapIndex !== null && activeSwapIndex >= activeStops.length) {
      setSwapTarget(null);
    }
  }, [activeStops.length, activeSwapIndex]);

  useEffect(() => {
    if (!swapTarget) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const panelNode = panelRef.current;
      if (panelNode && event.target instanceof Node && !panelNode.contains(event.target)) {
        setSwapTarget(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSwapTarget(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [swapTarget]);

  const swapLibrary = useMemo(
    () =>
      sortColorsByHueAndBrightness(
        uniqueColors([
          ...COLORWAYS.flatMap((colorway) => colorway.colors),
          ...colorConfig.customStops,
          ...activeStops,
        ]),
      ),
    [activeStops, colorConfig.customStops],
  );

  const handleColorwaySelect = (colorwayId: ColorwayId) => {
    if (colorConfig.colorwayId !== colorwayId) {
      onColorwayChange(colorwayId);
    }
    setSwapTarget(null);
  };

  const handleSwatchPress = (colorwayId: ColorwayId, index: number) => {
    if (colorConfig.colorwayId !== colorwayId) {
      onColorwayChange(colorwayId);
    }
    setSwapTarget((previous) =>
      previous?.colorwayId === colorwayId && previous.index === index
        ? null
        : { colorwayId, index },
    );
  };

  const handleSwapColor = (value: string) => {
    if (activeSwapIndex === null) {
      return;
    }

    onStopChange(activeSwapIndex, value);
  };

  const handleResetEditedStops = () => {
    onColorwayChange(colorConfig.colorwayId);
    setSwapTarget(null);
  };

  const handleRemoveSelectedStop = () => {
    if (activeSwapIndex === null) {
      return;
    }

    onRemoveStop(activeSwapIndex);
    setSwapTarget(null);
  };

  const setColorwayRowRef = (colorwayId: ColorwayId, node: HTMLDivElement | null) => {
    if (node) {
      rowRefs.current.set(colorwayId, node);
      return;
    }

    rowRefs.current.delete(colorwayId);
  };

  return (
    <section
      className={`control-panel color-panel ${isOpen ? "is-open" : "is-collapsed"}`}
      ref={panelRef}
    >
      <button
        aria-expanded={isOpen}
        className="panel-tab"
        onClick={onToggle}
        type="button"
      >
        <span>Color</span>
        <span className="panel-tab-caret" aria-hidden="true" />
      </button>

      <div className="panel-surface" ref={panelSurfaceRef}>
        <div className="color-panel-scroll" ref={scrollContainerRef}>
          <div className="panel-block">
            <div className="colorway-list">
              {COLORWAYS.map((colorway) => {
                const isSelected = colorway.key === colorConfig.colorwayId;
                const rowStops = isSelected
                  ? activeStops
                  : colorway.key === "custom"
                    ? colorConfig.customStops
                    : colorway.colors;
                const canRemoveSelectedStop =
                  isSelected &&
                  activeSwapIndex !== null &&
                  rowStops.length > MIN_COLOR_STOPS;
                const stopCountLabel =
                  colorway.key === "custom"
                    ? `${rowStops.length} / ${MAX_COLOR_STOPS} stops`
                    : `${rowStops.length} stops`;
                const isSwapOpen =
                  isSelected &&
                  swapTarget?.colorwayId === colorway.key &&
                  activeSwapIndex !== null;

                return (
                  <div
                    className={`colorway-row ${
                      isSelected ? "is-selected" : ""
                    } ${isSwapOpen ? "is-swap-open" : ""}`}
                    key={colorway.key}
                    ref={(node) => setColorwayRowRef(colorway.key, node)}
                  >
                    <button
                      className="colorway-row-button"
                      onClick={() => handleColorwaySelect(colorway.key)}
                      type="button"
                    >
                      <span className="control-label colorway-row-label">
                        {colorway.label}
                      </span>
                      {isSelected && hasEditedStops ? (
                        <span className="colorway-row-status">Override</span>
                      ) : null}
                    </button>

                    <div className="colorway-swatches">
                      {rowStops.map((color, index) => (
                        <button
                          aria-label={`Edit ${colorway.label} color ${index + 1}`}
                          aria-pressed={isSwapOpen && activeSwapIndex === index}
                          className={`colorway-swatch-button ${
                            isSwapOpen && activeSwapIndex === index ? "is-active" : ""
                          }`}
                          key={`${colorway.key}-${index}-${color}`}
                          onClick={() => handleSwatchPress(colorway.key, index)}
                          type="button"
                        >
                          <span
                            className="colorway-swatch"
                            style={{ background: color }}
                          />
                        </button>
                      ))}
                    </div>

                    {isSelected ? (
                      <div className="custom-stop-toolbar">
                        <span className="custom-stop-count">{stopCountLabel}</span>
                        <div className="drawer-actions">
                          {colorway.key === "custom" ? (
                            <button
                              className="small-button"
                              disabled={rowStops.length >= MAX_COLOR_STOPS}
                              onClick={onAddCustomStop}
                              type="button"
                            >
                              Add stop
                            </button>
                          ) : null}
                          {hasEditedStops ? (
                            <button
                              className="text-button"
                              onClick={handleResetEditedStops}
                              type="button"
                            >
                              Clear override
                            </button>
                          ) : null}
                          <button
                            className="small-button"
                            disabled={!canRemoveSelectedStop}
                            onClick={handleRemoveSelectedStop}
                            type="button"
                          >
                            Remove selected
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

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

        {swapTarget &&
        activeColorway &&
        activeSwapColor &&
        activeSwapIndex !== null &&
        swapPanelTop !== null ? (
          <div
            className="color-swap-panel color-swap-panel--floating"
            style={{ top: `${swapPanelTop}px` }}
          >
            <div className="color-swap-header">
              <span className="control-label">Swap color {activeSwapIndex + 1}</span>
              {hasEditedStops ? (
                <button
                  className="text-button"
                  onClick={handleResetEditedStops}
                  type="button"
                >
                  Clear override
                </button>
              ) : null}
            </div>

            <div className="color-swap-current">
              <span
                className="color-swap-preview"
                style={{ background: activeSwapColor }}
              />
              <span className="color-swap-value">{activeSwapColor}</span>
              <input
                aria-label={`Pick color for ${activeColorway.label} stop ${
                  activeSwapIndex + 1
                }`}
                className="color-input"
                onChange={(event) => handleSwapColor(event.target.value)}
                type="color"
                value={activeSwapColor}
              />
            </div>

            <div className="color-swap-library">
              {swapLibrary.map((color) => (
                <button
                  aria-label={`Use ${color}`}
                  className={`swap-library-swatch ${
                    color.toLowerCase() === activeSwapColor.toLowerCase()
                      ? "is-selected"
                      : ""
                  }`}
                  key={`${activeColorway.key}-${activeSwapIndex}-${color}`}
                  onClick={() => handleSwapColor(color)}
                  type="button"
                >
                  <span style={{ background: color }} />
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
