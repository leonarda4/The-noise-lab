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
  getColorStops,
  MAX_COLOR_STOPS,
  MIN_COLOR_STOPS,
} from "./config";
import { ColorPanel } from "./components/ColorPanel";
import { ExportPanel } from "./components/ExportPanel";
import { GradientPanel } from "./components/GradientPanel";
import { NoisePanel } from "./components/NoisePanel";
import { SavedPresetsPanel } from "./components/SavedPresetsPanel";
import { VisualCanvas } from "./components/VisualCanvas";
import type {
  BlendMode,
  ColorParamKey,
  ColorwayId,
  ExportSize,
  GradientMovement,
  GradientParamKey,
  GradientType,
  NoiseParamKey,
  NoiseType,
  PhotoExportFormat,
  PhotoExportRequest,
  PresetLibrary,
  PresetTab,
  SavedPreset,
  VideoExportRequest,
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
const makePresetTabId = () => `tab-${makePresetId()}`;

const THUMBNAIL_BACKFILL_BATCH_SIZE = 4;
const ALL_PRESET_TAB_ID = "__all-presets__";
const EXPORT_DIMENSION_MIN = 64;
const EXPORT_DIMENSION_MAX = 8192;
const EXPORT_DURATION_MIN = 1;
const EXPORT_DURATION_MAX = 60;
const DEFAULT_EXPORT_SIZE: ExportSize = {
  width: 1080,
  height: 1350,
};

const clampExportDimension = (value: number) =>
  Math.max(
    EXPORT_DIMENSION_MIN,
    Math.min(EXPORT_DIMENSION_MAX, Math.round(value)),
  );

const clampExportDuration = (value: number) =>
  Math.max(
    EXPORT_DURATION_MIN,
    Math.min(EXPORT_DURATION_MAX, Math.round(value * 10) / 10),
  );

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

const resolveNextPresetTabName = (tabs: PresetTab[]) => {
  const nextIndex =
    tabs.reduce((highest, tab) => {
      const match = /^Tab (\d+)$/i.exec(tab.name);
      if (!match) {
        return highest;
      }

      return Math.max(highest, Number(match[1]));
    }, 0) + 1;

  return `Tab ${nextIndex}`;
};

const mergePresetLibraries = (
  repoLibrary: PresetLibrary,
  cachedLibrary: PresetLibrary,
): PresetLibrary => {
  const tabsById = new Map(repoLibrary.tabs.map((tab) => [tab.id, tab]));

  for (const cachedTab of cachedLibrary.tabs) {
    if (!tabsById.has(cachedTab.id)) {
      tabsById.set(cachedTab.id, cachedTab);
    }
  }

  const tabs = Array.from(tabsById.values());
  const validTabIds = new Set(tabs.map((tab) => tab.id));

  return {
    tabs,
    presets: mergePresetThumbnails(
      repoLibrary.presets,
      cachedLibrary.presets,
    ).map((preset) =>
      preset.tabId && !validTabIds.has(preset.tabId)
        ? { ...preset, tabId: undefined }
        : preset,
    ),
  };
};

export default function App() {
  const [noiseConfig, setNoiseConfig] = useState(DEFAULT_NOISE_CONFIG);
  const [gradientConfig, setGradientConfig] = useState(DEFAULT_GRADIENT_CONFIG);
  const [colorConfig, setColorConfig] = useState(DEFAULT_COLOR_CONFIG);
  const [visualTransitionKey, setVisualTransitionKey] = useState(0);
  const [favourites, setFavourites] = useState<SavedPreset[]>([]);
  const [presetTabs, setPresetTabs] = useState<PresetTab[]>([]);
  const [activePresetTabId, setActivePresetTabId] = useState(ALL_PRESET_TAB_ID);
  const [paused, setPaused] = useState(false);
  const [presetsDrawerOpen, setPresetsDrawerOpen] = useState(false);
  const [noisePanelOpen, setNoisePanelOpen] = useState(true);
  const [gradientPanelOpen, setGradientPanelOpen] = useState(true);
  const [colorPanelOpen, setColorPanelOpen] = useState(true);
  const [exportPanelOpen, setExportPanelOpen] = useState(false);
  const [exportSize, setExportSize] = useState<ExportSize>(DEFAULT_EXPORT_SIZE);
  const [photoExportFormat, setPhotoExportFormat] =
    useState<PhotoExportFormat>("png");
  const [videoDurationSeconds, setVideoDurationSeconds] = useState(8);
  const [activeExport, setActiveExport] = useState<"photo" | "video" | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    "Live controls update the field immediately.",
  );

  const hasPersistedRef = useRef(false);
  const presetsReadyRef = useRef(false);
  const skipNextPresetSyncRef = useRef(true);
  const captureSnapshotRef = useRef<(() => string | undefined) | null>(null);
  const capturePresetSnapshotRef = useRef<
    | ((
      noise: SavedPreset["noise"],
      gradient: SavedPreset["gradient"],
      color: SavedPreset["color"],
    ) => string | undefined)
    | null
  >(null);
  const pendingThumbnailPresetIdRef = useRef<string | null>(null);
  const favouritesRef = useRef<SavedPreset[]>([]);
  const thumbnailBackfillFrameRef = useRef<number>();
  const thumbnailBackfillActiveRef = useRef(false);
  const exportPhotoRef = useRef<
    ((request: PhotoExportRequest) => Promise<void>) | null
  >(null);
  const exportVideoRef = useRef<
    ((request: VideoExportRequest) => Promise<void>) | null
  >(null);

  favouritesRef.current = favourites;

  useEffect(() => {
    let isCancelled = false;

    const bootstrapPresets = async () => {
      const cachedLibrary = loadPresets();
      const repoLibrary = await loadRepoPresets();

      if (isCancelled) {
        return;
      }

      if (repoLibrary) {
        const mergedLibrary = mergePresetLibraries(repoLibrary, cachedLibrary);

        setFavourites(mergedLibrary.presets);
        setPresetTabs(mergedLibrary.tabs);
        setStatusMessage(
          `Loaded ${mergedLibrary.presets.length} preset${mergedLibrary.presets.length === 1 ? "" : "s"} from repo JSON.`,
        );
      } else {
        setFavourites(cachedLibrary.presets);
        setPresetTabs(cachedLibrary.tabs);
        if (cachedLibrary.presets.length || cachedLibrary.tabs.length) {
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

    const result = savePresets({
      tabs: presetTabs,
      presets: favourites,
    });

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
      const synced = await syncRepoPresets({
        tabs: presetTabs,
        presets: favourites,
      });
      if (!synced) {
        setStatusMessage(
          "Preset change saved in-browser, but repo JSON sync failed. Keep the Vite server running to write presets into the repo.",
        );
      }
    })();
  }, [favourites, presetTabs]);

  useEffect(() => {
    if (activePresetTabId === ALL_PRESET_TAB_ID) {
      return;
    }

    if (!presetTabs.some((tab) => tab.id === activePresetTabId)) {
      setActivePresetTabId(ALL_PRESET_TAB_ID);
    }
  }, [activePresetTabId, presetTabs]);

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

  useEffect(() => {
    return () => {
      if (thumbnailBackfillFrameRef.current) {
        cancelAnimationFrame(thumbnailBackfillFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!presetsReadyRef.current || thumbnailBackfillActiveRef.current) {
      return;
    }

    const missingPresetIds = favourites
      .filter((preset) => !preset.thumbnail)
      .map((preset) => preset.id);

    if (!missingPresetIds.length || !capturePresetSnapshotRef.current) {
      return;
    }

    thumbnailBackfillActiveRef.current = true;
    let restoredCount = 0;
    const queue = [...missingPresetIds];

    const processBatch = () => {
      const capturePresetSnapshot = capturePresetSnapshotRef.current;
      if (!capturePresetSnapshot) {
        thumbnailBackfillActiveRef.current = false;
        return;
      }

      const batchIds = queue.splice(0, THUMBNAIL_BACKFILL_BATCH_SIZE);
      const currentFavourites = favouritesRef.current;
      const refreshed = batchIds
        .map((id) => {
          const preset = currentFavourites.find((entry) => entry.id === id);
          if (!preset || preset.thumbnail) {
            return null;
          }

          const thumbnail = capturePresetSnapshot(
            preset.noise,
            preset.gradient,
            preset.color,
          );

          return thumbnail ? { id, thumbnail } : null;
        })
        .filter(Boolean) as { id: string; thumbnail: string }[];

      if (refreshed.length) {
        restoredCount += refreshed.length;
        const thumbnailsById = new Map(
          refreshed.map(({ id, thumbnail }) => [id, thumbnail]),
        );

        setFavourites((previous) =>
          previous.map((preset) => {
            const thumbnail = thumbnailsById.get(preset.id);
            return thumbnail && !preset.thumbnail
              ? { ...preset, thumbnail }
              : preset;
          }),
        );
      }

      if (queue.length) {
        thumbnailBackfillFrameRef.current = requestAnimationFrame(processBatch);
        return;
      }

      thumbnailBackfillActiveRef.current = false;
      if (restoredCount) {
        setStatusMessage(
          `Refreshed ${restoredCount} preset snapshot${restoredCount === 1 ? "" : "s"} from the live renderer.`,
        );
      }
    };

    thumbnailBackfillFrameRef.current = requestAnimationFrame(processBatch);
  }, [favourites]);

  const visibleFavourites =
    activePresetTabId === ALL_PRESET_TAB_ID
      ? favourites
      : favourites.filter((preset) => preset.tabId === activePresetTabId);

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
      editedStops: [],
      customStops:
        colorwayId === "custom"
          ? previous.customStops.length >= MIN_COLOR_STOPS
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

  const handleColorStopChange = (index: number, value: string) => {
    setColorConfig((previous) => {
      const currentStops = getColorStops(previous);
      if (index < 0 || index >= currentStops.length) {
        return previous;
      }

      const nextStops = currentStops.map((stop, stopIndex) =>
        stopIndex === index ? value : stop,
      );

      if (previous.colorwayId === "custom") {
        return {
          ...previous,
          customStops: nextStops,
          editedStops: [],
        };
      }

      return {
        ...previous,
        editedStops: nextStops,
      };
    });
  };

  const handleAddCustomStop = () => {
    setColorConfig((previous) => {
      if (previous.customStops.length >= MAX_COLOR_STOPS) {
        return previous;
      }

      return {
        ...previous,
        customStops: [
          ...previous.customStops,
          previous.customStops[previous.customStops.length - 1] ?? "#ffffff",
        ],
        editedStops: [],
      };
    });
  };

  const handleRemoveColorStop = (index: number) => {
    setColorConfig((previous) => {
      const currentStops = getColorStops(previous);
      if (
        index < 0 ||
        index >= currentStops.length ||
        currentStops.length <= MIN_COLOR_STOPS
      ) {
        return previous;
      }

      const nextStops = currentStops.filter((_, stopIndex) => stopIndex !== index);

      if (previous.colorwayId !== "custom") {
        return {
          ...previous,
          editedStops: nextStops,
        };
      }

      return {
        ...previous,
        customStops: nextStops,
        editedStops: [],
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
    setVisualTransitionKey((previous) => previous + 1);
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
      tabId:
        activePresetTabId === ALL_PRESET_TAB_ID ? undefined : activePresetTabId,
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
    setVisualTransitionKey((previous) => previous + 1);
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

  const handleAssignPresetTab = (id: string, tabId?: string) => {
    setFavourites((previous) =>
      previous.map((preset) =>
        preset.id === id ? { ...preset, tabId } : preset,
      ),
    );
    setStatusMessage(tabId ? "Preset moved to tab." : "Preset returned to All.");
  };

  const handleCreatePresetTab = () => {
    const tab: PresetTab = {
      id: makePresetTabId(),
      name: resolveNextPresetTabName(presetTabs),
      createdAt: new Date().toISOString(),
    };

    setPresetTabs((previous) => [...previous, tab]);
    setPresetsDrawerOpen(true);
    setStatusMessage(`Created ${tab.name}.`);
  };

  const handleExportWidthChange = (value: number) => {
    setExportSize((previous) => ({
      ...previous,
      width: clampExportDimension(value),
    }));
  };

  const handleExportHeightChange = (value: number) => {
    setExportSize((previous) => ({
      ...previous,
      height: clampExportDimension(value),
    }));
  };

  const handleApplyExportPreset = (width: number, height: number) => {
    setExportSize({
      width: clampExportDimension(width),
      height: clampExportDimension(height),
    });
  };

  const handlePhotoExport = async () => {
    const exportPhoto = exportPhotoRef.current;
    if (!exportPhoto) {
      setStatusMessage("Renderer is not ready yet.");
      return;
    }

    try {
      setActiveExport("photo");
      await exportPhoto({
        ...exportSize,
        format: photoExportFormat,
      });
      setStatusMessage(
        `Exported ${photoExportFormat.toUpperCase()} at ${exportSize.width} × ${exportSize.height}.`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Photo export failed.";
      setStatusMessage(message);
    } finally {
      setActiveExport(null);
    }
  };

  const handleVideoExport = async () => {
    const exportVideo = exportVideoRef.current;
    if (!exportVideo) {
      setStatusMessage("Renderer is not ready yet.");
      return;
    }

    try {
      setActiveExport("video");
      setStatusMessage(
        `Recording ${videoDurationSeconds.toFixed(1)} second video export...`,
      );
      await exportVideo({
        ...exportSize,
        durationSeconds: videoDurationSeconds,
      });
      setStatusMessage(
        `Exported ${videoDurationSeconds.toFixed(1)} second video at ${exportSize.width} × ${exportSize.height}.`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Video export failed.";
      setStatusMessage(message);
    } finally {
      setActiveExport(null);
    }
  };

  const handleExport = () => {
    exportPresets({
      tabs: presetTabs,
      presets: favourites,
    });
    setStatusMessage("Presets exported as JSON.");
  };

  const handleImport = async (file: File) => {
    try {
      const importedText = await file.text();
      const imported = importPresetsFromText(importedText);
      const importedTabs = [...imported.tabs];
      const nextTabs = [...presetTabs];
      const existingTabIds = new Set(presetTabs.map((tab) => tab.id));
      const remappedTabIds = new Map<string, string>();

      for (const tab of importedTabs) {
        const nextId = existingTabIds.has(tab.id) ? makePresetTabId() : tab.id;
        existingTabIds.add(nextId);
        remappedTabIds.set(tab.id, nextId);
        nextTabs.push(nextId === tab.id ? tab : { ...tab, id: nextId });
      }

      setPresetTabs(nextTabs);
      setFavourites((previous) => {
        const existingIds = new Set(previous.map((preset) => preset.id));
        const normalized = imported.presets.map((preset) => {
          const nextPreset = preset.tabId
            ? {
                ...preset,
                tabId: remappedTabIds.get(preset.tabId) ?? preset.tabId,
              }
            : preset;

          if (!existingIds.has(preset.id)) {
            existingIds.add(nextPreset.id);
            return nextPreset;
          }

          const id = makePresetId();
          existingIds.add(id);
          return {
            ...nextPreset,
            id,
          };
        });
        return [...normalized, ...previous];
      });
      setStatusMessage(
        `Imported ${imported.presets.length} preset${imported.presets.length === 1 ? "" : "s"} and ${imported.tabs.length} tab${imported.tabs.length === 1 ? "" : "s"}.`,
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
        capturePresetSnapshotRef={capturePresetSnapshotRef}
        captureSnapshotRef={captureSnapshotRef}
        exportPhotoRef={exportPhotoRef}
        exportPreviewSize={exportPanelOpen ? exportSize : null}
        exportVideoRef={exportVideoRef}
        gradientConfig={gradientConfig}
        noiseConfig={noiseConfig}
        paused={paused}
        transitionKey={visualTransitionKey}
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
            onStopChange={handleColorStopChange}
            onParamChange={handleColorParamChange}
            onRemoveStop={handleRemoveColorStop}
            isOpen={colorPanelOpen}
            onToggle={() => setColorPanelOpen((value) => !value)}
          />

          <ExportPanel
            durationSeconds={videoDurationSeconds}
            height={exportSize.height}
            isExportingPhoto={activeExport === "photo"}
            isExportingVideo={activeExport === "video"}
            isOpen={exportPanelOpen}
            maxDimension={EXPORT_DIMENSION_MAX}
            onApplyPreset={handleApplyExportPreset}
            onDurationChange={(value) =>
              setVideoDurationSeconds(clampExportDuration(value))}
            onExportPhoto={handlePhotoExport}
            onExportVideo={handleVideoExport}
            onHeightChange={handleExportHeightChange}
            onPhotoFormatChange={setPhotoExportFormat}
            onToggle={() => setExportPanelOpen((value) => !value)}
            onWidthChange={handleExportWidthChange}
            photoFormat={photoExportFormat}
            width={exportSize.width}
          />
        </div>
      </header>

      <div aria-live="polite" className="visually-hidden">
        {statusMessage}
      </div>

      <SavedPresetsPanel
        activeTabId={activePresetTabId}
        allTabId={ALL_PRESET_TAB_ID}
        allPresets={favourites}
        isOpen={presetsDrawerOpen}
        isShowingAllTab={activePresetTabId === ALL_PRESET_TAB_ID}
        onAssignTab={handleAssignPresetTab}
        onCreateTab={handleCreatePresetTab}
        onDelete={handleDeletePreset}
        onExport={handleExport}
        onImport={handleImport}
        onRename={handleRenamePreset}
        onRestore={handleRestorePreset}
        onSelectTab={setActivePresetTabId}
        onToggle={() => setPresetsDrawerOpen((value) => !value)}
        presets={visibleFavourites}
        tabs={presetTabs}
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
