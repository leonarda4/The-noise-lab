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
  SavedPreset,
} from "../types";

const PRESETS_STORAGE_KEY = "emotional-noise-lab:favourites";
const PRESET_SCHEMA_VERSION = 2;

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
  blendMode?: unknown;
  params?: unknown;
};

const isRecord = (value: unknown): value is RecordLike =>
  typeof value === "object" && value !== null;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const sanitizePreset = (preset: SavedPreset): SavedPreset => {
  const { thumbnail: _thumbnail, ...rest } = preset;
  return rest;
};

const sanitizePresets = (presets: SavedPreset[]): SavedPreset[] =>
  presets.map(sanitizePreset);

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
  if (isStringArray(customStops) && customStops.length >= 3) {
    next.customStops = customStops.slice(0, 5);
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

const normalizePreset = (value: unknown): SavedPreset | null => {
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
    thumbnail: typeof value.thumbnail === "string" ? value.thumbnail : undefined,
  };
};

export const loadPresets = (): SavedPreset[] => {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return sanitizePresets(parsed.map(normalizePreset).filter(Boolean) as SavedPreset[]);
  } catch {
    return [];
  }
};

const normalizePresets = (value: unknown): SavedPreset[] => {
  const source = Array.isArray(value) ? value : (value as { presets?: unknown[] })?.presets;
  if (!Array.isArray(source)) {
    return [];
  }
  return sanitizePresets(source.map(normalizePreset).filter(Boolean) as SavedPreset[]);
};

export { type SavePresetsResult };

export const savePresets = (presets: SavedPreset[]): SavePresetsResult => {
  const sanitized = sanitizePresets(presets);
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(sanitized));
    return "full";
  } catch {
    try {
      localStorage.setItem(
        PRESETS_STORAGE_KEY,
        JSON.stringify(sanitized),
      );
      return "without-thumbnails";
    } catch {
      return "failed";
    }
  }
};

export const loadRepoPresets = async (): Promise<SavedPreset[] | null> => {
  try {
    const response = await fetch("/api/presets", {
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    const payload = await response.json();
    return normalizePresets(payload);
  } catch {
    return null;
  }
};

export const syncRepoPresets = async (presets: SavedPreset[]) => {
  try {
    const response = await fetch("/api/presets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: PRESET_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        presets: sanitizePresets(presets),
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
};

export const exportPresets = (presets: SavedPreset[]) => {
  const payload = JSON.stringify(
    {
      version: PRESET_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      presets: sanitizePresets(presets),
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

export const importPresetsFromText = (text: string): SavedPreset[] => {
  const parsed = JSON.parse(text);
  const presets = normalizePresets(parsed);
  if (!presets.length) {
    throw new Error("Expected a preset array or { presets: [...] } payload.");
  }
  return presets;
};
