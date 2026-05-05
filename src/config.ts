import type {
  BlendMode,
  ColorConfig,
  ColorwayDefinition,
  ControlDefinition,
  GradientConfig,
  GradientMovement,
  GradientParamKey,
  GradientParamValues,
  GradientType,
  NoiseConfig,
  NoiseDefinition,
  NoiseParamKey,
  NoiseParamValues,
  ColorParamKey,
  ColorParamValues,
  SelectOption,
} from "./types";

const range = <TKey extends string>(
  key: TKey,
  label: string,
  min: number,
  max: number,
  step: number,
  helperText?: string,
) => ({
  key,
  kind: "range" as const,
  label,
  min,
  max,
  step,
  helperText,
});

const toggle = <TKey extends string>(
  key: TKey,
  label: string,
  helperText?: string,
) => ({
  key,
  kind: "toggle" as const,
  label,
  helperText,
});

export const NOISE_LABELS: Record<string, string> = {
  white: "White Noise",
  value: "Value Noise",
  perlin: "Perlin Noise",
  simplex: "Simplex Noise",
  fbm: "fBm / Fractal",
  turbulence: "Turbulence",
  ridge: "Ridge Noise",
  curl: "Curl / Flow Field",
  domainWarp: "Domain Warp",
  worley: "Worley / Cellular",
  voronoi: "Voronoi",
  blueGrain: "Blue-Noise Grain",
};

export const GRADIENT_LABELS: Record<string, string> = {
  linear: "Linear",
  radial: "Radial",
  conic: "Conic",
  mesh: "Mesh",
  noiseDisplaced: "Noise-Displaced",
  fragmentedRadial: "Fragmented Radial",
  band: "Band Gradient",
};

export const MOVEMENT_OPTIONS: SelectOption<GradientMovement>[] = [
  { value: "static", label: "Static" },
  { value: "expand", label: "Expanding from Centre" },
  { value: "contract", label: "Contracting to Centre" },
  { value: "moveLeft", label: "Move Left" },
  { value: "moveRight", label: "Move Right" },
  { value: "moveUp", label: "Move Up" },
  { value: "moveDown", label: "Move Down" },
  { value: "rotateCw", label: "Rotate Clockwise" },
  { value: "rotateCcw", label: "Rotate Counter-Clockwise" },
  { value: "pulse", label: "Pulse" },
  { value: "drift", label: "Drift" },
];

export const BLEND_MODE_OPTIONS: SelectOption<BlendMode>[] = [
  { value: "normal", label: "Normal" },
  { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" },
  { value: "overlay", label: "Overlay" },
  { value: "difference", label: "Difference" },
  { value: "mask", label: "Mask" },
  { value: "displace", label: "Displace" },
];

export const COLORWAYS: ColorwayDefinition[] = [
  {
    key: "joy",
    label: "Joy",
    description: "Soft light and optimistic lift.",
    colors: ["#f7e26b", "#ff8cb7", "#8ce4ff", "#c9b7ff", "#fff8d2"],
  },
  {
    key: "sadness",
    label: "Sadness",
    description: "Muted cold tones with suspended motion.",
    colors: ["#6984c7", "#9ca3b2", "#c8c0dd", "#7f9388", "#eef2ff"],
  },
  {
    key: "anger",
    label: "Anger",
    description: "High contrast heat with clipped highlights.",
    colors: ["#ff4338", "#15090a", "#ff3ca8", "#ffffff", "#8f1118"],
  },
  {
    key: "fear",
    label: "Fear",
    description: "Acidic unease and unstable edges.",
    colors: ["#d7ff32", "#11331a", "#050505", "#ff7f23", "#7d9b0f"],
  },
  {
    key: "determination",
    label: "Determination",
    description: "Forward energy with crisp highlights.",
    colors: ["#173fbe", "#fa5c22", "#7f3eff", "#fefefe", "#2e88ff"],
  },
  {
    key: "neutralStudy",
    label: "Neutral Study",
    description: "Monochrome material study.",
    colors: ["#050505", "#e8dfd4", "#878787", "#292929", "#f5f0ea"],
  },
  {
    key: "custom",
    label: "Custom",
    description: "Manually edit 3 to 5 stops.",
    colors: ["#5be4ff", "#ff6fae", "#fff2c6", "#7c65ff"],
  },
];

export const NOISE_DEFAULT_PARAMS: NoiseParamValues = {
  scale: 1.15,
  speed: 0.35,
  intensity: 0.8,
  contrast: 1.1,
  opacity: 0.92,
  seed: 12,
  timeInfluence: 0.75,
  grainSize: 0.55,
  flickerAmount: 0.3,
  threshold: 0.48,
  cellSize: 1.1,
  smoothness: 0.72,
  blur: 0.2,
  amplitude: 0.65,
  directionX: 0.55,
  directionY: -0.2,
  octaves: 4,
  lacunarity: 2.05,
  gain: 0.5,
  turbulenceStrength: 0.75,
  sharpness: 0.55,
  ridgeSharpness: 0.64,
  compression: 0.46,
  flowStrength: 0.7,
  particleDistortionStrength: 0.58,
  swirlAmount: 0.65,
  directionInstability: 0.35,
  baseScale: 1,
  warpScale: 1.3,
  warpStrength: 0.72,
  warpSpeed: 0.38,
  iterations: 3,
  cellDensity: 0.65,
  edgeSoftness: 0.35,
  jitter: 0.6,
  invert: 0,
  borderThickness: 0.22,
  fragmentation: 0.35,
  grainDensity: 0.55,
  ditherStrength: 0.4,
};

export const GRADIENT_DEFAULT_PARAMS: GradientParamValues = {
  gradientScale: 1.12,
  movementSpeed: 0.45,
  displacementStrength: 0.6,
  centerX: 0.5,
  centerY: 0.5,
  rotation: 0.15,
  softness: 0.65,
  bandCount: 5,
  meshWarp: 0.55,
  fragmentAmount: 0.42,
};

export const COLOR_DEFAULT_PARAMS: ColorParamValues = {
  blendStrength: 0.8,
  saturation: 1,
  brightness: 1,
};

export const SHARED_NOISE_CONTROLS: ControlDefinition<NoiseParamKey>[] = [
  range("scale", "Scale", 0.2, 3.5, 0.01),
  range("speed", "Speed", 0, 2.5, 0.01),
  range("intensity", "Intensity", 0, 1.5, 0.01),
  range("contrast", "Contrast", 0.2, 2.5, 0.01),
  range("opacity", "Opacity", 0, 1, 0.01),
  range("seed", "Seed", 0, 100, 1),
  range("timeInfluence", "Time Influence", 0, 1.5, 0.01),
];

export const NOISE_DEFINITIONS: NoiseDefinition[] = [
  {
    key: "white",
    label: NOISE_LABELS.white,
    description: "Fast, restless grain driven by hash-based randomness.",
    emotionalHint: "Useful for agitation, memory fragments, or unstable tension.",
    controls: [
      range("grainSize", "Grain Size", 0.05, 1.5, 0.01),
      range("flickerAmount", "Flicker Amount", 0, 1, 0.01),
      range("threshold", "Threshold", 0, 1, 0.01),
      range("opacity", "Opacity", 0, 1, 0.01),
      ...SHARED_NOISE_CONTROLS.filter((control) => control.key !== "opacity"),
    ],
  },
  {
    key: "value",
    label: NOISE_LABELS.value,
    description: "Smoothed lattice noise with soft transitions.",
    emotionalHint: "Useful for hesitant calm, melancholy drift, or blurred interior space.",
    controls: [
      range("cellSize", "Cell Size", 0.2, 3.5, 0.01),
      range("smoothness", "Smoothness", 0, 1, 0.01),
      range("speed", "Speed", 0, 2, 0.01),
      range("blur", "Blur", 0, 1, 0.01),
      ...SHARED_NOISE_CONTROLS.filter(
        (control) =>
          !["speed"].includes(control.key),
      ),
    ],
  },
  {
    key: "perlin",
    label: NOISE_LABELS.perlin,
    description: "Gradient noise with rolling, evolving organic flow.",
    emotionalHint: "Useful for momentum, body memory, and atmospheric motion.",
    controls: [
      range("scale", "Scale", 0.2, 3.5, 0.01),
      range("speed", "Speed", 0, 2.5, 0.01),
      range("amplitude", "Amplitude", 0, 1.5, 0.01),
      ...SHARED_NOISE_CONTROLS.filter(
        (control) =>
          !["scale", "speed"].includes(control.key),
      ),
    ],
  },
  {
    key: "simplex",
    label: NOISE_LABELS.simplex,
    description: "Smooth, less grid-like field for fluid textural motion.",
    emotionalHint: "Useful for uncertainty that still feels elegant or breathable.",
    controls: [
      range("scale", "Scale", 0.2, 3.5, 0.01),
      range("speed", "Speed", 0, 2.5, 0.01),
      range("amplitude", "Amplitude", 0, 1.5, 0.01),
      ...SHARED_NOISE_CONTROLS.filter(
        (control) =>
          !["scale", "speed"].includes(control.key),
      ),
    ],
  },
  {
    key: "fbm",
    label: NOISE_LABELS.fbm,
    description: "Layered fractal noise with nested detail.",
    emotionalHint: "Useful for emotional depth, layered thought, or slow complexity.",
    controls: [
      range("scale", "Scale", 0.2, 3.5, 0.01),
      range("speed", "Speed", 0, 2.5, 0.01),
      range("octaves", "Octaves", 1, 7, 1),
      range("lacunarity", "Lacunarity", 1.2, 3.5, 0.01),
      range("gain", "Gain", 0.1, 0.9, 0.01),
      range("amplitude", "Amplitude", 0, 1.5, 0.01),
      ...SHARED_NOISE_CONTROLS.filter(
        (control) =>
          !["scale", "speed"].includes(control.key),
      ),
    ],
  },
  {
    key: "turbulence",
    label: NOISE_LABELS.turbulence,
    description: "Absolute fractal folds with storm-like breakups.",
    emotionalHint: "Useful for anxiety, rupture, pressure, and heightened transitions.",
    controls: [
      range("scale", "Scale", 0.2, 3.5, 0.01),
      range("speed", "Speed", 0, 2.5, 0.01),
      range("turbulenceStrength", "Turbulence Strength", 0, 1.5, 0.01),
      range("sharpness", "Sharpness", 0, 1, 0.01),
      range("threshold", "Threshold", 0, 1, 0.01),
      ...SHARED_NOISE_CONTROLS.filter(
        (control) =>
          !["scale", "speed"].includes(control.key),
      ),
    ],
  },
  {
    key: "ridge",
    label: NOISE_LABELS.ridge,
    description: "Inverted, sharpened fractal ridges with compressed peaks.",
    emotionalHint: "Useful for grit, resolve, brittle confidence, or sharp restraint.",
    controls: [
      range("scale", "Scale", 0.2, 3.5, 0.01),
      range("ridgeSharpness", "Ridge Sharpness", 0, 1, 0.01),
      range("contrast", "Contrast", 0.2, 2.5, 0.01),
      range("compression", "Compression", 0, 1, 0.01),
      range("speed", "Speed", 0, 2.5, 0.01),
      ...SHARED_NOISE_CONTROLS.filter(
        (control) =>
          !["scale", "contrast", "speed"].includes(control.key),
      ),
    ],
  },
  {
    key: "curl",
    label: NOISE_LABELS.curl,
    description: "Vector field curl that bends the image into flowing eddies.",
    emotionalHint: "Useful for obsession, surrender, breath, and embodied circulation.",
    controls: [
      range("flowStrength", "Flow Strength", 0, 1.5, 0.01),
      range(
        "particleDistortionStrength",
        "Particle Distortion",
        0,
        1.5,
        0.01,
      ),
      range("swirlAmount", "Swirl Amount", 0, 1.5, 0.01),
      range("speed", "Speed", 0, 2.5, 0.01),
      range(
        "directionInstability",
        "Flow Instability",
        0,
        1,
        0.01,
      ),
      ...SHARED_NOISE_CONTROLS.filter(
        (control) =>
          !["speed"].includes(control.key),
      ),
    ],
  },
  {
    key: "domainWarp",
    label: NOISE_LABELS.domainWarp,
    description: "A base field continuously bent by another moving field.",
    emotionalHint: "Useful for unease, dream logic, or dramatic emotional inflection.",
    controls: [
      range("baseScale", "Base Scale", 0.2, 3.5, 0.01),
      range("warpScale", "Warp Scale", 0.2, 3.5, 0.01),
      range("warpStrength", "Warp Strength", 0, 1.5, 0.01),
      range("warpSpeed", "Warp Speed", 0, 2, 0.01),
      range("iterations", "Iterations", 1, 5, 1),
      ...SHARED_NOISE_CONTROLS,
    ],
  },
  {
    key: "worley",
    label: NOISE_LABELS.worley,
    description: "Cellular distances that produce membranes and edge fields.",
    emotionalHint: "Useful for isolation, fracture, nervous topology, or tension maps.",
    controls: [
      range("cellDensity", "Cell Density", 0.1, 1.5, 0.01),
      range("edgeSoftness", "Edge Softness", 0, 1, 0.01),
      range("jitter", "Jitter", 0, 1, 0.01),
      toggle("invert", "Invert"),
      range("speed", "Speed", 0, 2.5, 0.01),
      ...SHARED_NOISE_CONTROLS.filter(
        (control) =>
          !["speed"].includes(control.key),
      ),
    ],
  },
  {
    key: "voronoi",
    label: NOISE_LABELS.voronoi,
    description: "Cell borders and fragmented territories with animated seams.",
    emotionalHint: "Useful for conflict, partition, fragility, and unstable belonging.",
    controls: [
      range("cellDensity", "Cell Density", 0.1, 1.5, 0.01),
      range("borderThickness", "Border Thickness", 0, 1, 0.01),
      range("jitter", "Jitter", 0, 1, 0.01),
      range("fragmentation", "Fragmentation", 0, 1, 0.01),
      range("speed", "Speed", 0, 2.5, 0.01),
      ...SHARED_NOISE_CONTROLS.filter(
        (control) =>
          !["speed"].includes(control.key),
      ),
    ],
  },
  {
    key: "blueGrain",
    label: NOISE_LABELS.blueGrain,
    description: "Dithered, more evenly distributed grain with a digital finish.",
    emotionalHint: "Useful for restraint, precision, subtle tension, or archival texture.",
    controls: [
      range("grainDensity", "Grain Density", 0.1, 1.5, 0.01),
      range("grainSize", "Grain Size", 0.05, 1.5, 0.01),
      range("ditherStrength", "Dither Strength", 0, 1, 0.01),
      range("opacity", "Opacity", 0, 1, 0.01),
      ...SHARED_NOISE_CONTROLS.filter(
        (control) =>
          !["opacity"].includes(control.key),
      ),
    ],
  },
];

export const GRADIENT_CONTROLS: ControlDefinition<GradientParamKey>[] = [
  range("gradientScale", "Gradient Scale", 0.25, 2.5, 0.01),
  range("movementSpeed", "Movement Speed", 0, 2.5, 0.01),
  range("displacementStrength", "Displacement Strength", 0, 1.5, 0.01),
  range("centerX", "Center X", 0, 1, 0.01),
  range("centerY", "Center Y", 0, 1, 0.01),
  range("rotation", "Rotation", -3.14, 3.14, 0.01),
  range("softness", "Softness", 0, 1, 0.01),
];

export const COLOR_CONTROLS: ControlDefinition<ColorParamKey>[] = [
  range("blendStrength", "Blend Strength", 0, 1.5, 0.01),
  range("saturation", "Saturation", 0, 2, 0.01),
  range("brightness", "Brightness", 0.2, 1.8, 0.01),
];

export const GRADIENT_TYPE_EXTRA_CONTROLS: Record<
  GradientType,
  ControlDefinition<GradientParamKey>[]
> = {
  linear: [],
  radial: [],
  conic: [],
  mesh: [range("meshWarp", "Mesh Warp", 0, 1.5, 0.01)],
  noiseDisplaced: [range("meshWarp", "Noise Warp", 0, 1.5, 0.01)],
  fragmentedRadial: [
    range("fragmentAmount", "Fragment Amount", 0, 1.5, 0.01),
  ],
  band: [range("bandCount", "Band Count", 2, 12, 1)],
};

export const DEFAULT_NOISE_CONFIG: NoiseConfig = {
  type: "fbm",
  params: { ...NOISE_DEFAULT_PARAMS },
};

export const DEFAULT_GRADIENT_CONFIG: GradientConfig = {
  type: "mesh",
  movement: "drift",
  params: { ...GRADIENT_DEFAULT_PARAMS },
};

export const DEFAULT_COLOR_CONFIG: ColorConfig = {
  colorwayId: "joy",
  customStops: [...COLORWAYS.find((colorway) => colorway.key === "custom")!.colors],
  blendMode: "displace",
  params: { ...COLOR_DEFAULT_PARAMS },
};

export const NOISE_TYPE_TO_INDEX: Record<NoiseConfig["type"], number> = {
  white: 0,
  value: 1,
  perlin: 2,
  simplex: 3,
  fbm: 4,
  turbulence: 5,
  ridge: 6,
  curl: 7,
  domainWarp: 8,
  worley: 9,
  voronoi: 10,
  blueGrain: 11,
};

export const GRADIENT_TYPE_TO_INDEX: Record<GradientType, number> = {
  linear: 0,
  radial: 1,
  conic: 2,
  mesh: 3,
  noiseDisplaced: 4,
  fragmentedRadial: 5,
  band: 6,
};

export const MOVEMENT_TO_INDEX: Record<GradientMovement, number> = {
  static: 0,
  expand: 1,
  contract: 2,
  moveLeft: 3,
  moveRight: 4,
  moveUp: 5,
  moveDown: 6,
  rotateCw: 7,
  rotateCcw: 8,
  pulse: 9,
  drift: 10,
};

export const BLEND_MODE_TO_INDEX: Record<BlendMode, number> = {
  normal: 0,
  multiply: 1,
  screen: 2,
  overlay: 3,
  difference: 4,
  mask: 5,
  displace: 6,
};

export const COLORWAY_BY_ID = Object.fromEntries(
  COLORWAYS.map((colorway) => [colorway.key, colorway]),
) as Record<ColorwayDefinition["key"], ColorwayDefinition>;

export const NOISE_OPTIONS: SelectOption<NoiseConfig["type"]>[] =
  NOISE_DEFINITIONS.map((definition) => ({
    value: definition.key,
    label: definition.label,
  }));

export const GRADIENT_OPTIONS: SelectOption<GradientType>[] = Object.entries(
  GRADIENT_LABELS,
).map(([value, label]) => ({
  value: value as GradientType,
  label,
}));

export const COLORWAY_OPTIONS: SelectOption<ColorwayDefinition["key"]>[] =
  COLORWAYS.map((colorway) => ({
    value: colorway.key,
    label: colorway.label,
  }));

export const getNoiseDefinition = (type: NoiseConfig["type"]) =>
  NOISE_DEFINITIONS.find((definition) => definition.key === type)!;

export const getColorStops = (color: ColorConfig) =>
  color.colorwayId === "custom"
    ? color.customStops
    : COLORWAY_BY_ID[color.colorwayId].colors;

export const getGradientControls = (type: GradientType) => [
  ...GRADIENT_CONTROLS,
  ...GRADIENT_TYPE_EXTRA_CONTROLS[type],
];

export const createNoiseConfig = (
  type: NoiseConfig["type"],
  previous?: NoiseConfig,
): NoiseConfig => {
  const prev = previous?.params ?? NOISE_DEFAULT_PARAMS;
  return {
    type,
    params: {
      ...NOISE_DEFAULT_PARAMS,
      scale: prev.scale,
      speed: prev.speed,
      intensity: prev.intensity,
      contrast: prev.contrast,
      opacity: prev.opacity,
      seed: prev.seed,
      timeInfluence: prev.timeInfluence,
      directionX: prev.directionX,
      directionY: prev.directionY,
    },
  };
};

export const createGradientConfig = (
  type: GradientType,
  previous?: GradientConfig,
): GradientConfig => {
  const prev = previous ?? DEFAULT_GRADIENT_CONFIG;
  return {
    ...prev,
    type,
    params: {
      ...GRADIENT_DEFAULT_PARAMS,
      ...prev.params,
    },
  };
};

export const createColorConfig = (previous?: ColorConfig): ColorConfig => {
  const prev = previous ?? DEFAULT_COLOR_CONFIG;
  return {
    colorwayId: prev.colorwayId,
    customStops: prev.customStops.length >= 3
      ? [...prev.customStops.slice(0, 5)]
      : [...DEFAULT_COLOR_CONFIG.customStops],
    blendMode: prev.blendMode,
    params: {
      ...COLOR_DEFAULT_PARAMS,
      ...prev.params,
    },
  };
};

export const cloneNoiseConfig = (noise: NoiseConfig): NoiseConfig => ({
  type: noise.type,
  params: { ...noise.params },
});

export const cloneGradientConfig = (
  gradient: GradientConfig,
): GradientConfig => ({
  type: gradient.type,
  movement: gradient.movement,
  params: { ...gradient.params },
});

export const cloneColorConfig = (color: ColorConfig): ColorConfig => ({
  colorwayId: color.colorwayId,
  customStops: [...color.customStops],
  blendMode: color.blendMode,
  params: { ...color.params },
});

export const formatPresetLabel = (
  noiseType: NoiseConfig["type"],
  gradientType: GradientType,
  timestamp: string,
) => {
  const date = new Date(timestamp);
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${NOISE_LABELS[noiseType]} + ${GRADIENT_LABELS[gradientType]} ${hours}:${minutes}`;
};

export const NOISE_PARAM_KEYS = Object.keys(
  NOISE_DEFAULT_PARAMS,
) as NoiseParamKey[];
export const GRADIENT_PARAM_KEYS = Object.keys(
  GRADIENT_DEFAULT_PARAMS,
) as GradientParamKey[];
export const COLOR_PARAM_KEYS = Object.keys(
  COLOR_DEFAULT_PARAMS,
) as ColorParamKey[];
