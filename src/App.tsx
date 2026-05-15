import { useEffect, useRef, useState } from "react";
import {
  cloneColorConfig,
  cloneGradientConfig,
  cloneNoiseConfig,
  COLORWAYS,
  createColorConfig,
  createGradientConfig,
  createNoiseConfig,
  DEFAULT_COLOR_CONFIG,
  DEFAULT_GRADIENT_CONFIG,
  DEFAULT_NOISE_CONFIG,
  formatPresetLabel,
} from "./config";
import { ColorPanel } from "./components/ColorPanel";
import { GradientPanel } from "./components/GradientPanel";
import { NoisePanel } from "./components/NoisePanel";
import { SavedPresetsPanel } from "./components/SavedPresetsPanel";
import { VisualCanvas } from "./components/VisualCanvas";
import type {
  BlendMode,
  ColorParamKey,
  ColorwayId,
  GradientMovement,
  GradientParamKey,
  GradientType,
  NoiseParamKey,
  NoiseType,
  SavedPreset,
} from "./types";
import {
  exportPresets,
  importPresetsFromText,
  loadPresets,
  loadRepoPresets,
  savePresets,
  syncRepoPresets,
} from "./utils/presets";
import { randomizeCurrentConfiguration } from "./utils/randomize";

const makePresetId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const mergePresetThumbnails = (
  presets: SavedPreset[],
  cachedPresets: SavedPreset[],
) => {
  const cachedThumbnailsById = new Map(
    cachedPresets
      .filter((preset) => preset.thumbnail)
      .map((preset) => [preset.id, preset.thumbnail]),
  );

  return presets.map((preset) => ({
    ...preset,
    thumbnail: preset.thumbnail ?? cachedThumbnailsById.get(preset.id),
  }));
};

export default function App() {
  const [noiseConfig, setNoiseConfig] = useState(DEFAULT_NOISE_CONFIG);
  const [gradientConfig, setGradientConfig] = useState(DEFAULT_GRADIENT_CONFIG);
  const [colorConfig, setColorConfig] = useState(DEFAULT_COLOR_CONFIG);
  const [favourites, setFavourites] = useState<SavedPreset[]>([]);
  const [paused, setPaused] = useState(false);
  const [presetsDrawerOpen, setPresetsDrawerOpen] = useState(false);
  const [noisePanelOpen, setNoisePanelOpen] = useState(true);
  const [gradientPanelOpen, setGradientPanelOpen] = useState(true);
  const [colorPanelOpen, setColorPanelOpen] = useState(true);
  const [statusMessage, setStatusMessage] = useState(
    "Live controls update the field immediately.",
  );

  const hasPersistedRef = useRef(false);
  const presetsReadyRef = useRef(false);
  const skipNextPresetSyncRef = useRef(true);
  const captureSnapshotRef = useRef<(() => string | undefined) | null>(null);
  const pendingThumbnailPresetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const bootstrapPresets = async () => {
      const cachedPresets = loadPresets();
      const repoPresets = await loadRepoPresets();

      if (isCancelled) {
        return;
      }

      if (repoPresets) {
        setFavourites(mergePresetThumbnails(repoPresets, cachedPresets));
        setStatusMessage(
          `Loaded ${repoPresets.length} preset${repoPresets.length === 1 ? "" : "s"} from repo JSON.`,
        );
      } else {
        setFavourites(cachedPresets);
        if (cachedPresets.length) {
          setStatusMessage(
            "Repo JSON sync unavailable. Loaded cached browser presets instead.",
          );
        }
      }

      presetsReadyRef.current = true;
      skipNextPresetSyncRef.current = true;
    };

    void bootstrapPresets();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!presetsReadyRef.current) {
      return;
    }

    const result = savePresets(favourites);

    if (skipNextPresetSyncRef.current) {
      skipNextPresetSyncRef.current = false;
      hasPersistedRef.current = true;
      return;
    }

    if (!hasPersistedRef.current) {
      hasPersistedRef.current = true;
    }

    if (result === "without-thumbnails") {
      setStatusMessage(
        "Preset saved. Browser storage was tight, so persisted thumbnails were stripped.",
      );
    } else if (result === "failed") {
      setStatusMessage(
        "Preset updated in memory, but browser storage is full. Export JSON if you need to keep it.",
      );
    }

    void (async () => {
      const synced = await syncRepoPresets(favourites);
      if (!synced) {
        setStatusMessage(
          "Preset change saved in-browser, but repo JSON sync failed. Keep the Vite server running to write presets into the repo.",
        );
      }
    })();
  }, [favourites]);

  useEffect(() => {
    const pendingPresetId = pendingThumbnailPresetIdRef.current;
    if (!pendingPresetId) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      const thumbnail = captureSnapshotRef.current?.();
      if (!thumbnail) {
        return;
      }

      setFavourites((previous) =>
        previous.map((preset) =>
          preset.id === pendingPresetId ? { ...preset, thumbnail } : preset,
        ),
      );
      pendingThumbnailPresetIdRef.current = null;
    });

    return () => cancelAnimationFrame(frameId);
  }, [colorConfig, gradientConfig, noiseConfig]);

  const handleNoiseTypeChange = (type: NoiseType) => {
    setNoiseConfig((previous) => createNoiseConfig(type, previous));
  };

  const handleNoiseParamChange = (key: NoiseParamKey, value: number) => {
    setNoiseConfig((previous) => ({
      ...previous,
      params: {
        ...previous.params,
        [key]: value,
      },
    }));
  };

  const handleGradientTypeChange = (type: GradientType) => {
    setGradientConfig((previous) => createGradientConfig(type, previous));
  };

  const handleGradientParamChange = (key: GradientParamKey, value: number) => {
    setGradientConfig((previous) => ({
      ...previous,
      params: {
        ...previous.params,
        [key]: value,
      },
    }));
  };

  const handleMovementChange = (movement: GradientMovement) => {
    setGradientConfig((previous) => ({
      ...previous,
      movement,
    }));
  };

  const handleColorwayChange = (colorwayId: ColorwayId) => {
    setColorConfig((previous) => ({
      ...previous,
      colorwayId,
      customStops:
        colorwayId === "custom"
          ? previous.customStops.length >= 3
            ? previous.customStops
            : [...COLORWAYS.find((colorway) => colorway.key === "custom")!.colors]
          : previous.customStops,
    }));
  };

  const handleBlendModeChange = (blendMode: BlendMode) => {
    setColorConfig((previous) => ({
      ...previous,
      blendMode,
    }));
  };

  const handleColorParamChange = (key: ColorParamKey, value: number) => {
    setColorConfig((previous) => ({
      ...previous,
      params: {
        ...previous.params,
        [key]: value,
      },
    }));
  };

  const handleCustomStopChange = (index: number, value: string) => {
    setColorConfig((previous) => ({
      ...previous,
      customStops: previous.customStops.map((stop, stopIndex) =>
        stopIndex === index ? value : stop,
      ),
    }));
  };

  const handleAddCustomStop = () => {
    setColorConfig((previous) => {
      if (previous.customStops.length >= 5) {
        return previous;
      }

      return {
        ...previous,
        customStops: [...previous.customStops, "#ffffff"],
      };
    });
  };

  const handleRemoveCustomStop = (index: number) => {
    setColorConfig((previous) => {
      if (previous.customStops.length <= 3) {
        return previous;
      }

      return {
        ...previous,
        customStops: previous.customStops.filter((_, stopIndex) => stopIndex !== index),
      };
    });
  };

  const handleRandomize = () => {
    const randomized = randomizeCurrentConfiguration(
      noiseConfig,
      gradientConfig,
      colorConfig,
    );
    setNoiseConfig(randomized.noise);
    setGradientConfig(randomized.gradient);
    setColorConfig(randomized.color);
    setPaused(false);
    setStatusMessage("Current field parameters randomized.");
  };

  const handleReset = () => {
    setNoiseConfig(cloneNoiseConfig(DEFAULT_NOISE_CONFIG));
    setGradientConfig(cloneGradientConfig(DEFAULT_GRADIENT_CONFIG));
    setColorConfig(cloneColorConfig(DEFAULT_COLOR_CONFIG));
    setPaused(false);
    setStatusMessage("Prototype reset to the default study.");
  };

  const handleSaveCurrent = () => {
    const createdAt = new Date().toISOString();
    const thumbnail = captureSnapshotRef.current?.();
    const preset: SavedPreset = {
      id: makePresetId(),
      name: formatPresetLabel(noiseConfig.type, gradientConfig.type, createdAt),
      createdAt,
      noise: cloneNoiseConfig(noiseConfig),
      gradient: cloneGradientConfig(gradientConfig),
      color: cloneColorConfig(colorConfig),
      thumbnail,
    };
    setFavourites((previous) => [preset, ...previous]);
    setStatusMessage(`Saved preset "${preset.name}".`);
    setPresetsDrawerOpen(true);
  };

  const handleRestorePreset = (preset: SavedPreset) => {
    pendingThumbnailPresetIdRef.current = preset.thumbnail ? null : preset.id;
    setNoiseConfig(cloneNoiseConfig(preset.noise));
    setGradientConfig(cloneGradientConfig(preset.gradient));
    setColorConfig(cloneColorConfig(createColorConfig(preset.color)));
    setPaused(false);
    setStatusMessage(`Restored preset "${preset.name}".`);
  };

  const handleRenamePreset = (id: string, name: string) => {
    setFavourites((previous) =>
      previous.map((preset) =>
        preset.id === id ? { ...preset, name } : preset,
      ),
    );
    setStatusMessage("Preset renamed.");
  };

  const handleDeletePreset = (id: string) => {
    setFavourites((previous) => previous.filter((preset) => preset.id !== id));
    setStatusMessage("Preset deleted.");
  };

  const handleExport = () => {
    exportPresets(favourites);
    setStatusMessage("Presets exported as JSON.");
  };

  const handleImport = async (file: File) => {
    try {
      const importedText = await file.text();
      const imported = importPresetsFromText(importedText);
      setFavourites((previous) => {
        const existingIds = new Set(previous.map((preset) => preset.id));
        const normalized = imported.map((preset) => {
          if (!existingIds.has(preset.id)) {
            existingIds.add(preset.id);
            return preset;
          }

          const id = makePresetId();
          existingIds.add(id);
          return {
            ...preset,
            id,
          };
        });
        return [...normalized, ...previous];
      });
      setStatusMessage(
        `Imported ${imported.length} preset${imported.length === 1 ? "" : "s"} and queued repo JSON sync.`,
      );
      setPresetsDrawerOpen(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to import the selected JSON file.";
      setStatusMessage(message);
    }
  };

  return (
    <div className="app-shell">
      <VisualCanvas
        colorConfig={colorConfig}
        captureSnapshotRef={captureSnapshotRef}
        gradientConfig={gradientConfig}
        noiseConfig={noiseConfig}
        paused={paused}
      />

      <header className="app-header">
        <p className="brand-mark">The noise lab</p>

        <div className="control-dock">
          <NoisePanel
            noiseConfig={noiseConfig}
            onParamChange={handleNoiseParamChange}
            onTypeChange={handleNoiseTypeChange}
            isOpen={noisePanelOpen}
            onToggle={() => setNoisePanelOpen((value) => !value)}
          />

          <GradientPanel
            gradientConfig={gradientConfig}
            onGradientTypeChange={handleGradientTypeChange}
            onMovementChange={handleMovementChange}
            onParamChange={handleGradientParamChange}
            isOpen={gradientPanelOpen}
            onToggle={() => setGradientPanelOpen((value) => !value)}
          />

          <ColorPanel
            colorConfig={colorConfig}
            onAddCustomStop={handleAddCustomStop}
            onBlendModeChange={handleBlendModeChange}
            onColorwayChange={handleColorwayChange}
            onCustomStopChange={handleCustomStopChange}
            onParamChange={handleColorParamChange}
            onRemoveCustomStop={handleRemoveCustomStop}
            isOpen={colorPanelOpen}
            onToggle={() => setColorPanelOpen((value) => !value)}
          />
        </div>
      </header>

      <div aria-live="polite" className="visually-hidden">
        {statusMessage}
      </div>

      <SavedPresetsPanel
        favourites={favourites}
        isOpen={presetsDrawerOpen}
        onDelete={handleDeletePreset}
        onExport={handleExport}
        onImport={handleImport}
        onRename={handleRenamePreset}
        onRestore={handleRestorePreset}
        onToggle={() => setPresetsDrawerOpen((value) => !value)}
      />

      <div className="bottom-controls">
        <div className="utility-controls">
          <button className="utility-button" onClick={handleRandomize} type="button">
            Randomize
          </button>
          <button className="utility-button" onClick={handleReset} type="button">
            Reset
          </button>
          <button
            className="utility-button"
            onClick={() => setPaused((value) => !value)}
            type="button"
          >
            {paused ? "Resume" : "Pause"}
          </button>
          <button
            className="utility-button is-emphasized"
            onClick={handleSaveCurrent}
            type="button"
          >
            Save preset
          </button>
        </div>
      </div>
    </div>
  );
}
