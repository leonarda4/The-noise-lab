import {
  cloneColorConfig,
  cloneGradientConfig,
  cloneNoiseConfig,
  COLOR_PARAM_KEYS,
  COLORWAY_BY_ID,
  DEFAULT_COLOR_CONFIG,
  DEFAULT_GRADIENT_CONFIG,
  DEFAULT_NOISE_CONFIG,
  GRADIENT_LABELS,
  GRADIENT_PARAM_KEYS,
  MAX_COLOR_STOPS,
  MIN_COLOR_STOPS,
  MOVEMENT_OPTIONS,
  NOISE_LABELS,
  NOISE_PARAM_KEYS,
} from "../config";
import type {
  BlendMode,
  ColorConfig,
  ColorParamKey,
  ColorwayId,
  GradientConfig,
  GradientMovement,
  GradientParamKey,
  GradientType,
  NoiseConfig,
  NoiseParamKey,
  NoiseType,
  PresetLibrary,
  PresetTab,
  SavedPreset,
} from "../types";
import publishedPresetsUrl from "../../data/presets.json?url";

const PRESETS_STORAGE_KEY = "emotional-noise-lab:favourites";
const PRESET_SCHEMA_VERSION = 3;
export const repoPresetSyncEnabled = import.meta.env.DEV;

type PublishedPresetIds = {
  presets: string[];
  tabs: string[];
};

let publishedPresetIds: PublishedPresetIds = { presets: [], tabs: [] };

type SavePresetsResult = "full" | "without-thumbnails" | "failed";

type RecordLike = Record<string, unknown>;

const MOVEMENT_VALUES = new Set(
  MOVEMENT_OPTIONS.map((option) => option.value),
);
const BLEND_MODE_VALUES = new Set<BlendMode>([
  "normal",
  "multiply",
  "screen",
  "overlay",
  "difference",
  "mask",
  "displace",
]);

type LegacyGradientPresetShape = {
  type?: unknown;
  movement?: unknown;
  colorwayId?: unknown;
  customStops?: unknown;
  editedStops?: unknown;
  blendMode?: unknown;
  params?: unknown;
};

const isRecord = (value: unknown): value is RecordLike =>
  typeof value === "object" && value !== null;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const stripPresetThumbnail = (preset: SavedPreset): SavedPreset => {
  const { thumbnail: _thumbnail, ...rest } = preset;
  return rest;
};

const stripPresetThumbnails = (presets: SavedPreset[]): SavedPreset[] =>
  presets.map(stripPresetThumbnail);

const emptyPresetLibrary = (): PresetLibrary => ({
  tabs: [],
  presets: [],
});

const normalizeParams = <TKey extends string>(
  keys: TKey[],
  source: unknown,
  target: Record<TKey, number>,
) => {
  if (!isRecord(source)) {
    return;
  }

  for (const key of keys) {
    const value = source[key];
    if (isFiniteNumber(value)) {
      target[key] = value;
    }
  }
};

const normalizeNoiseType = (value: unknown): NoiseType | undefined =>
  typeof value === "string" && value in NOISE_LABELS
    ? (value as NoiseType)
    : undefined;

const normalizeGradientType = (value: unknown): GradientType | undefined =>
  typeof value === "string" && value in GRADIENT_LABELS
    ? (value as GradientType)
    : undefined;

const normalizeMovement = (value: unknown): GradientMovement | undefined =>
  typeof value === "string" && MOVEMENT_VALUES.has(value as GradientMovement)
    ? (value as GradientMovement)
    : undefined;

const normalizeColorway = (value: unknown): ColorwayId | undefined =>
  typeof value === "string" && value in COLORWAY_BY_ID
    ? (value as ColorwayId)
    : undefined;

const normalizeBlendMode = (value: unknown): BlendMode | undefined =>
  typeof value === "string" && BLEND_MODE_VALUES.has(value as BlendMode)
    ? (value as BlendMode)
    : undefined;

const normalizeNoiseConfig = (value: unknown): NoiseConfig => {
  const next = cloneNoiseConfig(DEFAULT_NOISE_CONFIG);

  if (!isRecord(value)) {
    return next;
  }

  const normalizedType = normalizeNoiseType(value.type);
  if (normalizedType) {
    next.type = normalizedType;
  }

  normalizeParams(
    NOISE_PARAM_KEYS as NoiseParamKey[],
    value.params,
    next.params,
  );

  return next;
};

const normalizeGradientConfig = (value: unknown): GradientConfig => {
  const next = cloneGradientConfig(DEFAULT_GRADIENT_CONFIG);

  if (!isRecord(value)) {
    return next;
  }

  const normalizedType = normalizeGradientType(value.type);
  if (normalizedType) {
    next.type = normalizedType;
  }

  const normalizedMovement = normalizeMovement(value.movement);
  if (normalizedMovement) {
    next.movement = normalizedMovement;
  }

  normalizeParams(
    GRADIENT_PARAM_KEYS as GradientParamKey[],
    value.params,
    next.params,
  );

  return next;
};

const normalizeColorConfig = (
  value: unknown,
  legacyGradient?: unknown,
): ColorConfig => {
  const next = cloneColorConfig(DEFAULT_COLOR_CONFIG);
  const source = isRecord(value) ? value : undefined;
  const legacy = isRecord(legacyGradient)
    ? (legacyGradient as LegacyGradientPresetShape)
    : undefined;

  const normalizedColorway = normalizeColorway(
    source?.colorwayId ?? legacy?.colorwayId,
  );
  if (normalizedColorway) {
    next.colorwayId = normalizedColorway;
  }

  const customStops = source?.customStops ?? legacy?.customStops;
  if (isStringArray(customStops) && customStops.length >= MIN_COLOR_STOPS) {
    next.customStops = customStops.slice(0, MAX_COLOR_STOPS);
  }

  const editedStops = source?.editedStops ?? legacy?.editedStops;
  if (isStringArray(editedStops) && editedStops.length >= MIN_COLOR_STOPS) {
    next.editedStops = editedStops.slice(0, MAX_COLOR_STOPS);
  }

  const normalizedBlendMode = normalizeBlendMode(
    source?.blendMode ?? legacy?.blendMode,
  );
  if (normalizedBlendMode) {
    next.blendMode = normalizedBlendMode;
  }

  normalizeParams(
    COLOR_PARAM_KEYS as ColorParamKey[],
    legacy?.params,
    next.params,
  );
  normalizeParams(
    COLOR_PARAM_KEYS as ColorParamKey[],
    source?.params,
    next.params,
  );

  return next;
};

const normalizePresetTab = (value: unknown): PresetTab | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.createdAt !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    name: value.name,
    createdAt: value.createdAt,
  };
};

const normalizePresetTabs = (value: unknown): PresetTab[] => {
  if (!isRecord(value) || !Array.isArray(value.tabs)) {
    return [];
  }

  return value.tabs.map(normalizePresetTab).filter(Boolean) as PresetTab[];
};

const normalizePreset = (
  value: unknown,
  validTabIds?: Set<string>,
): SavedPreset | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.createdAt !== "string"
  ) {
    return null;
  }

  const noise = normalizeNoiseConfig(value.noise);
  const gradient = normalizeGradientConfig(value.gradient);
  const color = normalizeColorConfig(value.color, value.gradient);

  return {
    id: value.id,
    name: value.name,
    createdAt: value.createdAt,
    noise,
    gradient,
    color,
    tabId:
      typeof value.tabId === "string" &&
      (!validTabIds || validTabIds.has(value.tabId))
        ? value.tabId
        : undefined,
    thumbnail: typeof value.thumbnail === "string" ? value.thumbnail : undefined,
  };
};

const normalizePresetLibrary = (value: unknown): PresetLibrary => {
  const tabs = normalizePresetTabs(value);
  const validTabIds = new Set(tabs.map((tab) => tab.id));
  const source = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.presets)
      ? value.presets
      : [];

  return {
    tabs,
    presets: source
      .map((preset) => normalizePreset(preset, validTabIds))
      .filter(Boolean) as SavedPreset[],
  };
};

export const loadPresets = (): PresetLibrary => {
  publishedPresetIds = { presets: [], tabs: [] };
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) {
      return emptyPresetLibrary();
    }
    const parsed: unknown = JSON.parse(raw);
    if (isRecord(parsed) && isRecord(parsed.publishedPresetIds)) {
      const ids = parsed.publishedPresetIds;
      publishedPresetIds = {
        presets: isStringArray(ids.presets) ? ids.presets : [],
        tabs: isStringArray(ids.tabs) ? ids.tabs : [],
      };
    }
    return normalizePresetLibrary(parsed);
  } catch {
    return emptyPresetLibrary();
  }
};

export const mergePublishedPresets = (
  publishedLibrary: PresetLibrary,
  cachedLibrary: PresetLibrary,
): PresetLibrary => {
  const seenPresetIds = new Set(publishedPresetIds.presets);
  const seenTabIds = new Set(publishedPresetIds.tabs);
  const cachedPresetIds = new Set(cachedLibrary.presets.map((preset) => preset.id));
  const cachedTabIds = new Set(cachedLibrary.tabs.map((tab) => tab.id));
  const publishedById = new Map(
    publishedLibrary.presets.map((preset) => [preset.id, preset]),
  );
  const tabs = [
    ...cachedLibrary.tabs,
    ...publishedLibrary.tabs.filter(
      (tab) => !cachedTabIds.has(tab.id) && !seenTabIds.has(tab.id),
    ),
  ];
  const validTabIds = new Set(tabs.map((tab) => tab.id));
  const presets = [
    ...cachedLibrary.presets.map((preset) => ({
      ...preset,
      thumbnail: preset.thumbnail ?? publishedById.get(preset.id)?.thumbnail,
    })),
    ...publishedLibrary.presets.filter(
      (preset) => !cachedPresetIds.has(preset.id) && !seenPresetIds.has(preset.id),
    ),
  ].map((preset) =>
    preset.tabId && !validTabIds.has(preset.tabId)
      ? { ...preset, tabId: undefined }
      : preset,
  );

  // Remember every published ID so deletions survive reloads, while future
  // deployments can introduce new presets without replacing browser edits.
  publishedPresetIds = {
    presets: [...new Set([...seenPresetIds, ...publishedById.keys()])],
    tabs: [...new Set([...seenTabIds, ...publishedLibrary.tabs.map((tab) => tab.id)])],
  };

  return { tabs, presets };
};

export { type SavePresetsResult };

export const savePresets = (library: PresetLibrary): SavePresetsResult => {
  const payload = repoPresetSyncEnabled
    ? library
    : { ...library, publishedPresetIds };
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(payload));
    return "full";
  } catch {
    try {
      localStorage.setItem(
        PRESETS_STORAGE_KEY,
        JSON.stringify({
          ...payload,
          presets: stripPresetThumbnails(library.presets),
        }),
      );
      return "without-thumbnails";
    } catch {
      return "failed";
    }
  }
};

export const loadSharedPresets = async (): Promise<PresetLibrary | null> => {
  try {
    const response = await fetch(
      repoPresetSyncEnabled ? "/api/presets" : publishedPresetsUrl,
      repoPresetSyncEnabled ? { cache: "no-store" } : undefined,
    );
    if (!response.ok) {
      return null;
    }
    const payload = await response.json();
    return normalizePresetLibrary(payload);
  } catch {
    return null;
  }
};

export const syncRepoPresets = async (library: PresetLibrary) => {
  if (!repoPresetSyncEnabled) {
    return false;
  }

  try {
    const response = await fetch("/api/presets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: PRESET_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        tabs: library.tabs,
        presets: library.presets,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
};

export const exportPresets = (library: PresetLibrary) => {
  const payload = JSON.stringify(
    {
      version: PRESET_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      tabs: library.tabs,
      presets: library.presets,
    },
    null,
    2,
  );

  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "emotional-noise-presets.json";
  link.click();
  URL.revokeObjectURL(url);
};

export const importPresetsFromText = (text: string): PresetLibrary => {
  const parsed = JSON.parse(text);
  const library = normalizePresetLibrary(parsed);
  if (!library.tabs.length && !library.presets.length) {
    throw new Error("Expected a preset payload with presets or tabs.");
  }
  return library;
};
