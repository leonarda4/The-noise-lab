import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, MutableRefObject } from "react";
import {
  BLEND_MODE_TO_INDEX,
  COLOR_PARAM_KEYS,
  getColorStops,
  getColorwayPrimaryBias,
  GRADIENT_PARAM_KEYS,
  GRADIENT_TYPE_TO_INDEX,
  MOVEMENT_TO_INDEX,
  NOISE_PARAM_KEYS,
  NOISE_TYPE_TO_INDEX,
} from "../config";
import { fragmentShaderSource, vertexShaderSource } from "../shaders/visualShader";
import type {
  ColorConfig,
  ExportSize,
  GradientConfig,
  NoiseConfig,
  PhotoExportRequest,
  VideoExportRequest,
} from "../types";

interface VisualCanvasProps {
  colorConfig: ColorConfig;
  noiseConfig: NoiseConfig;
  gradientConfig: GradientConfig;
  paused: boolean;
  transitionKey: number;
  captureSnapshotRef?: MutableRefObject<(() => string | undefined) | null>;
  capturePresetSnapshotRef?: MutableRefObject<
    | ((
      noiseConfig: NoiseConfig,
      gradientConfig: GradientConfig,
      colorConfig: ColorConfig,
    ) => string | undefined)
    | null
  >;
  exportPhotoRef?: MutableRefObject<
    ((request: PhotoExportRequest) => Promise<void>) | null
  >;
  exportVideoRef?: MutableRefObject<
    ((request: VideoExportRequest) => Promise<void>) | null
  >;
  exportPreviewSize?: ExportSize | null;
}

interface RendererState {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  positionBuffer: WebGLBuffer;
  positionLocation: number;
  uniformLocations: Record<string, WebGLUniformLocation | null>;
}

type RgbColor = [number, number, number];

interface VisualState {
  noiseType: NoiseConfig["type"];
  gradientType: GradientConfig["type"];
  movementType: GradientConfig["movement"];
  movementPhaseBlend: number;
  blendMode: ColorConfig["blendMode"];
  primaryColorBias: number;
  noiseParams: NoiseConfig["params"];
  gradientParams: GradientConfig["params"];
  colorParams: ColorConfig["params"];
  palette: RgbColor[];
  paletteCount: number;
}

interface MorphState {
  from: VisualState;
  to: VisualState;
  startedAt: number;
  durationMs: number;
}

interface PhaseState {
  lastElapsed: number;
  noisePhase: number;
  movementPhase: number;
  gradientPhase: number;
}

interface ExportSurfacePlan {
  renderWidth: number;
  renderHeight: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  targetWidth: number;
  targetHeight: number;
}

interface VideoRecordingFormat {
  mimeType: string;
  extension: "webm" | "mp4";
}

const UNIFORM_NAMES = [
  "u_resolution",
  "u_time",
  "u_noisePhase",
  "u_movementPhase",
  "u_gradientPhase",
  "u_noiseType",
  "u_gradientType",
  "u_movementType",
  "u_blendMode",
  "u_paletteCount",
  "u_palette",
  "u_primaryColorBias",
  "u_noiseScale",
  "u_noiseSpeed",
  "u_noiseIntensity",
  "u_noiseContrast",
  "u_noiseOpacity",
  "u_noiseSeed",
  "u_timeInfluence",
  "u_grainSize",
  "u_flickerAmount",
  "u_threshold",
  "u_cellSize",
  "u_smoothness",
  "u_blur",
  "u_amplitude",
  "u_octaves",
  "u_lacunarity",
  "u_gain",
  "u_turbulenceStrength",
  "u_sharpness",
  "u_ridgeSharpness",
  "u_compression",
  "u_flowStrength",
  "u_particleDistortionStrength",
  "u_swirlAmount",
  "u_directionInstability",
  "u_baseScale",
  "u_warpScale",
  "u_warpStrength",
  "u_warpSpeed",
  "u_iterations",
  "u_cellDensity",
  "u_edgeSoftness",
  "u_jitter",
  "u_invert",
  "u_borderThickness",
  "u_fragmentation",
  "u_grainDensity",
  "u_ditherStrength",
  "u_gradientScale",
  "u_movementSpeed",
  "u_blendStrength",
  "u_displacementStrength",
  "u_center",
  "u_rotation",
  "u_softness",
  "u_saturation",
  "u_brightness",
  "u_bandCount",
  "u_meshWarp",
  "u_fragmentAmount",
] as const;

const GRADIENT_TRANSITION_DURATION_MS = 720;
const VISUAL_MORPH_DURATION_MS = 1100;
const DIRECTIONAL_MOVEMENT_EASE_START = 0.88;
const VIDEO_EXPORT_FRAME_RATE = 60;
const JPEG_EXPORT_QUALITY = 0.92;
const MAX_EXPORT_RENDER_SIZE_FALLBACK = 8192;
const MAX_SHADER_PALETTE_STOPS = 7;
const DIRECTIONAL_MOVEMENT_TYPES = new Set<GradientConfig["movement"]>([
  "moveLeft",
  "moveRight",
  "moveUp",
  "moveDown",
  "drift",
]);

const hexToRgb = (hex: string): RgbColor => {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) {
    return [1, 1, 1];
  }

  const value = Number.parseInt(normalized, 16);
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ];
};

const lerp = (from: number, to: number, amount: number) =>
  from + (to - from) * amount;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const smoothstep01 = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

const delayedMorph = (value: number, start: number, end: number) => {
  if (end <= start) {
    return smoothstep01(value);
  }

  return smoothstep01((value - start) / (end - start));
};

const isDirectionalMovementType = (movementType: GradientConfig["movement"]) =>
  DIRECTIONAL_MOVEMENT_TYPES.has(movementType);

const getNoisePhaseRate = (visualState: VisualState) =>
  Math.max(0.02, visualState.noiseParams.speed)
  * lerp(0.15, 1.4, visualState.noiseParams.timeInfluence);

const getMovementPhaseRate = (visualState: VisualState) =>
  visualState.movementType === "static"
    ? 0
    : (0.25 + visualState.gradientParams.movementSpeed * 0.6)
      * visualState.movementPhaseBlend;

const getGradientPhaseRate = (visualState: VisualState) =>
  visualState.gradientParams.movementSpeed * 0.02;

const buildPalette = (colorConfig: ColorConfig) => {
  const palette = getColorStops(colorConfig)
    .slice(0, MAX_SHADER_PALETTE_STOPS)
    .map((stop) => hexToRgb(stop));
  const paddedPalette = [...palette];
  const paletteCount = Math.min(palette.length, MAX_SHADER_PALETTE_STOPS);

  while (paddedPalette.length < MAX_SHADER_PALETTE_STOPS) {
    const fallback = paddedPalette[paddedPalette.length - 1] ?? [1, 1, 1];
    paddedPalette.push([...fallback] as RgbColor);
  }

  return {
    palette: paddedPalette,
    paletteCount,
  };
};

const buildVisualState = (
  noiseConfig: NoiseConfig,
  gradientConfig: GradientConfig,
  colorConfig: ColorConfig,
): VisualState => {
  const { palette, paletteCount } = buildPalette(colorConfig);

  return {
    noiseType: noiseConfig.type,
    gradientType: gradientConfig.type,
    movementType: gradientConfig.movement,
    movementPhaseBlend: 1,
    blendMode: colorConfig.blendMode,
    primaryColorBias: getColorwayPrimaryBias(colorConfig.colorwayId),
    noiseParams: { ...noiseConfig.params },
    gradientParams: { ...gradientConfig.params },
    colorParams: { ...colorConfig.params },
    palette,
    paletteCount,
  };
};

const cloneVisualState = (state: VisualState): VisualState => ({
  noiseType: state.noiseType,
  gradientType: state.gradientType,
  movementType: state.movementType,
  movementPhaseBlend: state.movementPhaseBlend,
  blendMode: state.blendMode,
  primaryColorBias: state.primaryColorBias,
  noiseParams: { ...state.noiseParams },
  gradientParams: { ...state.gradientParams },
  colorParams: { ...state.colorParams },
  palette: state.palette.map((color) => [...color] as RgbColor),
  paletteCount: state.paletteCount,
});

const clonePhaseState = (state: PhaseState): PhaseState => ({
  lastElapsed: state.lastElapsed,
  noisePhase: state.noisePhase,
  movementPhase: state.movementPhase,
  gradientPhase: state.gradientPhase,
});

const interpolateValues = <TKey extends string>(
  keys: readonly TKey[],
  from: Record<TKey, number>,
  to: Record<TKey, number>,
  getAmount: (key: TKey) => number,
) => {
  const next = {} as Record<TKey, number>;

  for (const key of keys) {
    next[key] = lerp(from[key], to[key], getAmount(key));
  }

  return next;
};

const interpolatePalette = (
  from: RgbColor[],
  to: RgbColor[],
  amount: number,
) =>
  from.map(
    (color, index) =>
      [
        lerp(color[0], to[index][0], amount),
        lerp(color[1], to[index][1], amount),
        lerp(color[2], to[index][2], amount),
      ] as RgbColor,
  );

const interpolateVisualState = (
  from: VisualState,
  to: VisualState,
  amount: number,
): VisualState => {
  const eased = smoothstep01(amount);
  const spatialEased = delayedMorph(amount, 0.72, 1);
  const discreteState = amount < 0.84 ? from : to;
  const movementPhaseBlend = isDirectionalMovementType(discreteState.movementType)
    ? delayedMorph(amount, DIRECTIONAL_MOVEMENT_EASE_START, 1)
    : 1;

  return {
    noiseType: discreteState.noiseType,
    gradientType: discreteState.gradientType,
    movementType: discreteState.movementType,
    movementPhaseBlend,
    blendMode: discreteState.blendMode,
    primaryColorBias: lerp(from.primaryColorBias, to.primaryColorBias, eased),
    noiseParams: interpolateValues(
      NOISE_PARAM_KEYS,
      from.noiseParams,
      to.noiseParams,
      (key) => (key === "seed" ? spatialEased : eased),
    ) as NoiseConfig["params"],
    gradientParams: interpolateValues(
      GRADIENT_PARAM_KEYS,
      from.gradientParams,
      to.gradientParams,
      (key) =>
        key === "centerX" || key === "centerY" || key === "rotation"
          ? 1
          : eased,
    ) as GradientConfig["params"],
    colorParams: interpolateValues(
      COLOR_PARAM_KEYS,
      from.colorParams,
      to.colorParams,
      () => eased,
    ) as ColorConfig["params"],
    palette: interpolatePalette(from.palette, to.palette, eased),
    paletteCount: amount < 0.84 ? from.paletteCount : to.paletteCount,
  };
};

const createShader = (
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) => {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to allocate WebGL shader.");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "Unknown shader compile error.";
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
};

const createProgram = (
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
) => {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();

  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error("Failed to allocate WebGL program.");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? "Unknown program link error.";
    gl.deleteProgram(program);
    throw new Error(log);
  }

  return program;
};

const setUniform1f = (
  gl: WebGLRenderingContext,
  location: WebGLUniformLocation | null,
  value: number,
) => {
  if (location) {
    gl.uniform1f(location, value);
  }
};

const setUniform1i = (
  gl: WebGLRenderingContext,
  location: WebGLUniformLocation | null,
  value: number,
) => {
  if (location) {
    gl.uniform1i(location, value);
  }
};

const setUniform2f = (
  gl: WebGLRenderingContext,
  location: WebGLUniformLocation | null,
  x: number,
  y: number,
) => {
  if (location) {
    gl.uniform2f(location, x, y);
  }
};

const initializeRenderer = (canvas: HTMLCanvasElement): RendererState => {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });

  if (!gl) {
    throw new Error("WebGL is unavailable in this browser.");
  }

  const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
  const positionBuffer = gl.createBuffer();
  if (!positionBuffer) {
    gl.deleteProgram(program);
    throw new Error("Failed to allocate fullscreen vertex buffer.");
  }

  const positionLocation = gl.getAttribLocation(program, "a_position");
  if (positionLocation < 0) {
    gl.deleteBuffer(positionBuffer);
    gl.deleteProgram(program);
    throw new Error("Shader attribute a_position was not found.");
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.useProgram(program);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  const uniformLocations = Object.fromEntries(
    UNIFORM_NAMES.map((name) => [
      name,
      gl.getUniformLocation(program, name === "u_palette" ? "u_palette[0]" : name),
    ]),
  );

  return {
    canvas,
    gl,
    program,
    positionBuffer,
    positionLocation,
    uniformLocations,
  };
};

const destroyRenderer = (renderer: RendererState) => {
  const { gl, program, positionBuffer } = renderer;
  gl.deleteBuffer(positionBuffer);
  gl.deleteProgram(program);
};

const advancePhaseState = (
  phaseState: PhaseState,
  elapsed: number,
  visualState: VisualState,
) => {
  const delta = Math.max(0, elapsed - phaseState.lastElapsed);
  phaseState.lastElapsed = elapsed;

  if (delta > 0) {
    phaseState.noisePhase += delta * getNoisePhaseRate(visualState);
    phaseState.movementPhase += delta * getMovementPhaseRate(visualState);
    phaseState.gradientPhase += delta * getGradientPhaseRate(visualState);
  }

  return phaseState;
};

const renderRendererFrame = (
  renderer: RendererState,
  elapsed: number,
  visualState: VisualState,
  phaseState: PhaseState,
  advancePhase = false,
) => {
  const { canvas, gl, program, uniformLocations } = renderer;
  const width = canvas.width;
  const height = canvas.height;
  if (!width || !height) {
    return;
  }

  const phases = advancePhase
    ? advancePhaseState(phaseState, elapsed, visualState)
    : phaseState;

  gl.viewport(0, 0, width, height);
  gl.useProgram(program);

  setUniform2f(gl, uniformLocations.u_resolution, width, height);
  setUniform1f(gl, uniformLocations.u_time, elapsed);
  setUniform1f(gl, uniformLocations.u_noisePhase, phases.noisePhase);
  setUniform1f(gl, uniformLocations.u_movementPhase, phases.movementPhase);
  setUniform1f(gl, uniformLocations.u_gradientPhase, phases.gradientPhase);

  setUniform1i(
    gl,
    uniformLocations.u_noiseType,
    NOISE_TYPE_TO_INDEX[visualState.noiseType],
  );
  setUniform1i(
    gl,
    uniformLocations.u_gradientType,
    GRADIENT_TYPE_TO_INDEX[visualState.gradientType],
  );
  setUniform1i(
    gl,
    uniformLocations.u_movementType,
    MOVEMENT_TO_INDEX[visualState.movementType],
  );
  setUniform1i(
    gl,
    uniformLocations.u_blendMode,
    BLEND_MODE_TO_INDEX[visualState.blendMode],
  );

  const paletteData = new Float32Array(
    visualState.palette.flatMap((color) => color),
  );
  if (uniformLocations.u_palette) {
    gl.uniform3fv(uniformLocations.u_palette, paletteData);
  }
  setUniform1i(gl, uniformLocations.u_paletteCount, visualState.paletteCount);
  setUniform1f(
    gl,
    uniformLocations.u_primaryColorBias,
    visualState.primaryColorBias,
  );

  const noise = visualState.noiseParams;
  setUniform1f(gl, uniformLocations.u_noiseScale, noise.scale);
  setUniform1f(gl, uniformLocations.u_noiseSpeed, noise.speed);
  setUniform1f(gl, uniformLocations.u_noiseIntensity, noise.intensity);
  setUniform1f(gl, uniformLocations.u_noiseContrast, noise.contrast);
  setUniform1f(gl, uniformLocations.u_noiseOpacity, noise.opacity);
  setUniform1f(gl, uniformLocations.u_noiseSeed, noise.seed);
  setUniform1f(gl, uniformLocations.u_timeInfluence, noise.timeInfluence);
  setUniform1f(gl, uniformLocations.u_grainSize, noise.grainSize);
  setUniform1f(gl, uniformLocations.u_flickerAmount, noise.flickerAmount);
  setUniform1f(gl, uniformLocations.u_threshold, noise.threshold);
  setUniform1f(gl, uniformLocations.u_cellSize, noise.cellSize);
  setUniform1f(gl, uniformLocations.u_smoothness, noise.smoothness);
  setUniform1f(gl, uniformLocations.u_blur, noise.blur);
  setUniform1f(gl, uniformLocations.u_amplitude, noise.amplitude);
  setUniform1f(gl, uniformLocations.u_octaves, noise.octaves);
  setUniform1f(gl, uniformLocations.u_lacunarity, noise.lacunarity);
  setUniform1f(gl, uniformLocations.u_gain, noise.gain);
  setUniform1f(
    gl,
    uniformLocations.u_turbulenceStrength,
    noise.turbulenceStrength,
  );
  setUniform1f(gl, uniformLocations.u_sharpness, noise.sharpness);
  setUniform1f(
    gl,
    uniformLocations.u_ridgeSharpness,
    noise.ridgeSharpness,
  );
  setUniform1f(gl, uniformLocations.u_compression, noise.compression);
  setUniform1f(gl, uniformLocations.u_flowStrength, noise.flowStrength);
  setUniform1f(
    gl,
    uniformLocations.u_particleDistortionStrength,
    noise.particleDistortionStrength,
  );
  setUniform1f(gl, uniformLocations.u_swirlAmount, noise.swirlAmount);
  setUniform1f(
    gl,
    uniformLocations.u_directionInstability,
    noise.directionInstability,
  );
  setUniform1f(gl, uniformLocations.u_baseScale, noise.baseScale);
  setUniform1f(gl, uniformLocations.u_warpScale, noise.warpScale);
  setUniform1f(gl, uniformLocations.u_warpStrength, noise.warpStrength);
  setUniform1f(gl, uniformLocations.u_warpSpeed, noise.warpSpeed);
  setUniform1f(gl, uniformLocations.u_iterations, noise.iterations);
  setUniform1f(gl, uniformLocations.u_cellDensity, noise.cellDensity);
  setUniform1f(gl, uniformLocations.u_edgeSoftness, noise.edgeSoftness);
  setUniform1f(gl, uniformLocations.u_jitter, noise.jitter);
  setUniform1f(gl, uniformLocations.u_invert, noise.invert);
  setUniform1f(
    gl,
    uniformLocations.u_borderThickness,
    noise.borderThickness,
  );
  setUniform1f(gl, uniformLocations.u_fragmentation, noise.fragmentation);
  setUniform1f(gl, uniformLocations.u_grainDensity, noise.grainDensity);
  setUniform1f(gl, uniformLocations.u_ditherStrength, noise.ditherStrength);

  const gradient = visualState.gradientParams;
  setUniform1f(gl, uniformLocations.u_gradientScale, gradient.gradientScale);
  setUniform1f(
    gl,
    uniformLocations.u_movementSpeed,
    gradient.movementSpeed,
  );
  setUniform1f(
    gl,
    uniformLocations.u_displacementStrength,
    gradient.displacementStrength,
  );
  setUniform2f(
    gl,
    uniformLocations.u_center,
    gradient.centerX,
    gradient.centerY,
  );
  setUniform1f(gl, uniformLocations.u_rotation, gradient.rotation);
  setUniform1f(gl, uniformLocations.u_softness, gradient.softness);
  setUniform1f(gl, uniformLocations.u_bandCount, gradient.bandCount);
  setUniform1f(gl, uniformLocations.u_meshWarp, gradient.meshWarp);
  setUniform1f(
    gl,
    uniformLocations.u_fragmentAmount,
    gradient.fragmentAmount,
  );

  const color = visualState.colorParams;
  setUniform1f(gl, uniformLocations.u_blendStrength, color.blendStrength);
  setUniform1f(gl, uniformLocations.u_saturation, color.saturation);
  setUniform1f(gl, uniformLocations.u_brightness, color.brightness);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
};

const createCenteredExportPlan = (
  viewportAspect: number,
  targetWidth: number,
  targetHeight: number,
): ExportSurfacePlan => {
  const targetAspect = targetWidth / targetHeight;

  if (viewportAspect >= targetAspect) {
    const renderHeight = targetHeight;
    const renderWidth = Math.max(
      targetWidth,
      Math.round(renderHeight * viewportAspect),
    );

    return {
      renderWidth,
      renderHeight,
      cropX: Math.round((renderWidth - targetWidth) / 2),
      cropY: 0,
      cropWidth: targetWidth,
      cropHeight: targetHeight,
      targetWidth,
      targetHeight,
    };
  }

  const renderWidth = targetWidth;
  const renderHeight = Math.max(
    targetHeight,
    Math.round(renderWidth / viewportAspect),
  );

  return {
    renderWidth,
    renderHeight,
    cropX: 0,
    cropY: Math.round((renderHeight - targetHeight) / 2),
    cropWidth: targetWidth,
    cropHeight: targetHeight,
    targetWidth,
    targetHeight,
  };
};

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("Canvas export failed."));
    }, type, quality);
  });

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

const padNumber = (value: number) => String(value).padStart(2, "0");

const buildExportFilenameBase = () => {
  const date = new Date();
  return `the-noise-lab-${date.getFullYear()}${padNumber(date.getMonth() + 1)}${padNumber(
    date.getDate(),
  )}-${padNumber(date.getHours())}${padNumber(date.getMinutes())}${padNumber(
    date.getSeconds(),
  )}`;
};

const getSupportedVideoFormat = (): VideoRecordingFormat | null => {
  if (typeof MediaRecorder === "undefined") {
    return null;
  }

  const candidates: VideoRecordingFormat[] = [
    { mimeType: "video/webm;codecs=vp9", extension: "webm" },
    { mimeType: "video/webm;codecs=vp8", extension: "webm" },
    { mimeType: "video/webm", extension: "webm" },
    { mimeType: "video/mp4;codecs=h264", extension: "mp4" },
    { mimeType: "video/mp4;codecs=avc1", extension: "mp4" },
    { mimeType: "video/mp4", extension: "mp4" },
  ];

  return (
    candidates.find((candidate) =>
      MediaRecorder.isTypeSupported(candidate.mimeType),
    ) ?? null
  );
};

const formatAspectRatio = (width: number, height: number) => {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));

  const gcd = (left: number, right: number): number =>
    right ? gcd(right, left % right) : left;

  const divisor = gcd(safeWidth, safeHeight);
  return `${safeWidth / divisor}:${safeHeight / divisor}`;
};

export function VisualCanvas({
  colorConfig,
  gradientConfig,
  noiseConfig,
  paused,
  transitionKey,
  captureSnapshotRef,
  capturePresetSnapshotRef,
  exportPhotoRef,
  exportVideoRef,
  exportPreviewSize,
}: VisualCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<RendererState | null>(null);
  const frameRef = useRef<number>();
  const timeOriginRef = useRef<number>(performance.now());
  const lastElapsedRef = useRef<number>(0);
  const resizeObserverRef = useRef<ResizeObserver>();
  const fpsSampleRef = useRef({ lastTick: performance.now(), frames: 0 });
  const transitionFrameRef = useRef<number>();
  const transitionTimeoutRef = useRef<number>();
  const morphFrameRef = useRef<number>();
  const morphRef = useRef<MorphState | null>(null);
  const hasInitializedMorphRef = useRef(false);
  const lastAnimatedTransitionKeyRef = useRef(0);
  const pausedRef = useRef(paused);
  const phaseStateRef = useRef<PhaseState>({
    lastElapsed: 0,
    noisePhase: 0,
    movementPhase: 0,
    gradientPhase: 0,
  });
  const renderStateRef = useRef(
    buildVisualState(noiseConfig, gradientConfig, colorConfig),
  );

  const [status, setStatus] = useState("Initializing WebGL visual system.");
  const [fps, setFps] = useState(0);
  const [canvasDisplaySize, setCanvasDisplaySize] = useState({ width: 0, height: 0 });
  const [transitionOverlay, setTransitionOverlay] = useState<{
    key: number;
    phase: "idle" | "fading";
    src: string;
  } | null>(null);

  pausedRef.current = paused;

  const updateRenderState = () => {
    const morph = morphRef.current;
    if (!morph) {
      return;
    }

    const elapsed = performance.now() - morph.startedAt;
    const progress = Math.min(1, elapsed / morph.durationMs);

    renderStateRef.current =
      progress >= 1
        ? cloneVisualState(morph.to)
        : interpolateVisualState(morph.from, morph.to, progress);

    if (progress >= 1) {
      morphRef.current = null;
    }
  };

  const renderFrame = (elapsed: number) => {
    updateRenderState();
    renderFrameWithState(elapsed, renderStateRef.current, true);
  };

  const runMorphWhilePaused = () => {
    if (!pausedRef.current || !morphRef.current) {
      morphFrameRef.current = undefined;
      return;
    }

    renderFrame(lastElapsedRef.current);

    if (!pausedRef.current || !morphRef.current) {
      morphFrameRef.current = undefined;
      return;
    }

    morphFrameRef.current = requestAnimationFrame(runMorphWhilePaused);
  };

  const clearTransitionOverlay = () => {
    if (transitionFrameRef.current) {
      cancelAnimationFrame(transitionFrameRef.current);
      transitionFrameRef.current = undefined;
    }
    if (transitionTimeoutRef.current) {
      window.clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = undefined;
    }
    setTransitionOverlay(null);
  };

  const renderFrameWithState = (
    elapsed: number,
    visualState: VisualState,
    advancePhase = false,
  ) => {
    const renderer = rendererRef.current;
    if (!renderer) {
      return;
    }

    renderRendererFrame(
      renderer,
      elapsed,
      visualState,
      phaseStateRef.current,
      advancePhase,
    );
  };

  const renderFrameWithConfig = (
    elapsed: number,
    activeNoiseConfig: NoiseConfig,
    activeGradientConfig: GradientConfig,
    activeColorConfig: ColorConfig,
  ) => {
    renderFrameWithState(
      elapsed,
      buildVisualState(
        activeNoiseConfig,
        activeGradientConfig,
        activeColorConfig,
      ),
    );
  };

  const captureCanvasFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.width || !canvas.height) {
      return undefined;
    }

    return canvas.toDataURL("image/jpeg", 0.9);
  };

  const snapshotCurrentCanvas = (canvas: HTMLCanvasElement) => {
    const aspectRatio = canvas.width / canvas.height;
    const targetWidth = 320;
    const targetHeight = Math.max(1, Math.round(targetWidth / aspectRatio));
    const snapshotCanvas = document.createElement("canvas");
    snapshotCanvas.width = targetWidth;
    snapshotCanvas.height = targetHeight;

    const context = snapshotCanvas.getContext("2d");
    if (!context) {
      return canvas.toDataURL("image/png");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(canvas, 0, 0, targetWidth, targetHeight);

    return snapshotCanvas.toDataURL("image/webp", 0.84);
  };

  const captureSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.width || !canvas.height) {
      return undefined;
    }

    const snapshotState = morphRef.current?.to ?? renderStateRef.current;

    renderFrameWithState(lastElapsedRef.current, snapshotState);
    const thumbnail = snapshotCurrentCanvas(canvas);
    renderFrame(lastElapsedRef.current);

    return thumbnail;
  };

  const capturePresetSnapshot = (
    presetNoiseConfig: NoiseConfig,
    presetGradientConfig: GradientConfig,
    presetColorConfig: ColorConfig,
  ) => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.width || !canvas.height) {
      return undefined;
    }

    renderFrameWithConfig(
      lastElapsedRef.current,
      presetNoiseConfig,
      presetGradientConfig,
      presetColorConfig,
    );
    const thumbnail = snapshotCurrentCanvas(canvas);
    renderFrame(lastElapsedRef.current);
    return thumbnail;
  };

  const getCurrentSceneSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.width || !canvas.height) {
      return null;
    }

    updateRenderState();

    return {
      elapsed: lastElapsedRef.current,
      phaseState: clonePhaseState(phaseStateRef.current),
      visualState: cloneVisualState(renderStateRef.current),
      viewportAspect: canvas.width / canvas.height,
    };
  };

  const assertExportPlanSupported = (plan: ExportSurfacePlan) => {
    const renderer = rendererRef.current;
    const maxSize = renderer
      ? (renderer.gl.getParameter(renderer.gl.MAX_RENDERBUFFER_SIZE) as number)
      : MAX_EXPORT_RENDER_SIZE_FALLBACK;

    if (plan.renderWidth > maxSize || plan.renderHeight > maxSize) {
      throw new Error(
        `Export size is too large for this device. Max render side is ${maxSize}px.`,
      );
    }
  };

  const exportPhoto = async (request: PhotoExportRequest) => {
    const snapshot = getCurrentSceneSnapshot();
    if (!snapshot) {
      throw new Error("Renderer is not ready yet.");
    }

    const plan = createCenteredExportPlan(
      snapshot.viewportAspect,
      request.width,
      request.height,
    );
    assertExportPlanSupported(plan);

    const renderCanvas = document.createElement("canvas");
    renderCanvas.width = plan.renderWidth;
    renderCanvas.height = plan.renderHeight;

    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = request.width;
    outputCanvas.height = request.height;

    const outputContext = outputCanvas.getContext("2d");
    if (!outputContext) {
      throw new Error("2D export canvas could not be created.");
    }

    outputContext.imageSmoothingEnabled = true;
    outputContext.imageSmoothingQuality = "high";

    let exportRenderer: RendererState | null = null;

    try {
      exportRenderer = initializeRenderer(renderCanvas);
      renderRendererFrame(
        exportRenderer,
        snapshot.elapsed,
        snapshot.visualState,
        clonePhaseState(snapshot.phaseState),
      );
      outputContext.drawImage(
        renderCanvas,
        plan.cropX,
        plan.cropY,
        plan.cropWidth,
        plan.cropHeight,
        0,
        0,
        request.width,
        request.height,
      );

      const blob = await canvasToBlob(
        outputCanvas,
        request.format === "png" ? "image/png" : "image/jpeg",
        request.format === "png" ? undefined : JPEG_EXPORT_QUALITY,
      );

      downloadBlob(
        blob,
        `${buildExportFilenameBase()}-${request.width}x${request.height}.${request.format === "png" ? "png" : "jpg"}`,
      );
    } finally {
      if (exportRenderer) {
        destroyRenderer(exportRenderer);
      }
    }
  };

  const exportVideo = async (request: VideoExportRequest) => {
    const snapshot = getCurrentSceneSnapshot();
    if (!snapshot) {
      throw new Error("Renderer is not ready yet.");
    }

    const videoFormat = getSupportedVideoFormat();
    if (!videoFormat) {
      throw new Error("Video export is not supported in this browser.");
    }

    const plan = createCenteredExportPlan(
      snapshot.viewportAspect,
      request.width,
      request.height,
    );
    assertExportPlanSupported(plan);

    const renderCanvas = document.createElement("canvas");
    renderCanvas.width = plan.renderWidth;
    renderCanvas.height = plan.renderHeight;

    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = request.width;
    outputCanvas.height = request.height;

    if (!outputCanvas.captureStream) {
      throw new Error("Canvas stream capture is not supported in this browser.");
    }

    const outputContext = outputCanvas.getContext("2d");
    if (!outputContext) {
      throw new Error("2D export canvas could not be created.");
    }

    outputContext.imageSmoothingEnabled = true;
    outputContext.imageSmoothingQuality = "high";

    let exportRenderer: RendererState | null = null;

    try {
      exportRenderer = initializeRenderer(renderCanvas);
      const exportPhaseState = clonePhaseState(snapshot.phaseState);

      renderRendererFrame(
        exportRenderer,
        snapshot.elapsed,
        snapshot.visualState,
        exportPhaseState,
      );
      outputContext.drawImage(
        renderCanvas,
        plan.cropX,
        plan.cropY,
        plan.cropWidth,
        plan.cropHeight,
        0,
        0,
        request.width,
        request.height,
      );

      const stream = outputCanvas.captureStream(VIDEO_EXPORT_FRAME_RATE);
      const videoTrack = stream.getVideoTracks()[0] as
        | (MediaStreamTrack & { requestFrame?: () => void })
        | undefined;
      if (!videoTrack) {
        throw new Error("Video stream could not be created.");
      }

      const requestCapturedFrame =
        typeof videoTrack.requestFrame === "function"
          ? videoTrack.requestFrame.bind(videoTrack)
          : undefined;
      const recorder = new MediaRecorder(stream, {
        mimeType: videoFormat.mimeType,
      });
      const chunks: BlobPart[] = [];

      const blob = await new Promise<Blob>((resolve, reject) => {
        let frameId = 0;
        let settled = false;
        const startedAt = performance.now();
        const stopTimeoutId = window.setTimeout(() => {
          settle(() =>
            reject(new Error("Video export timed out before recording finished.")));
          if (recorder.state !== "inactive") {
            recorder.stop();
          }
        }, Math.max(8000, request.durationSeconds * 1000 + 4000));

        const cleanup = () => {
          if (frameId) {
            cancelAnimationFrame(frameId);
          }
          window.clearTimeout(stopTimeoutId);
          stream.getTracks().forEach((track) => track.stop());
        };

        const settle = (callback: () => void) => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          callback();
        };

        recorder.ondataavailable = (event) => {
          if (event.data.size) {
            chunks.push(event.data);
          }
        };

        recorder.onerror = () => {
          settle(() => reject(new Error("Video export failed.")));
        };

        recorder.onstop = () => {
          settle(() => resolve(new Blob(chunks, { type: videoFormat.mimeType })));
        };

        const drawExportFrame = (elapsed: number, advancePhase: boolean) => {
          renderRendererFrame(
            exportRenderer!,
            elapsed,
            snapshot.visualState,
            exportPhaseState,
            advancePhase,
          );
          outputContext.drawImage(
            renderCanvas,
            plan.cropX,
            plan.cropY,
            plan.cropWidth,
            plan.cropHeight,
            0,
            0,
            request.width,
            request.height,
          );
          requestCapturedFrame?.();
        };

        const tick = (now: number) => {
          try {
            const progressSeconds = Math.min(
              request.durationSeconds,
              (now - startedAt) / 1000,
            );
            const exportElapsed = snapshot.elapsed + progressSeconds;

            drawExportFrame(exportElapsed, true);

            if (progressSeconds >= request.durationSeconds) {
              if (recorder.state !== "inactive") {
                if (typeof recorder.requestData === "function") {
                  recorder.requestData();
                }
                recorder.stop();
              }
              return;
            }

            frameId = requestAnimationFrame(tick);
          } catch (error) {
            settle(() =>
              reject(
                error instanceof Error
                  ? error
                  : new Error("Video export failed."),
              ));
            if (recorder.state !== "inactive") {
              recorder.stop();
            }
          }
        };

        recorder.start(250);
        drawExportFrame(snapshot.elapsed, false);
        frameId = requestAnimationFrame(tick);
      });

      downloadBlob(
        blob,
        `${buildExportFilenameBase()}-${request.width}x${request.height}-${request.durationSeconds.toFixed(1)}s.${videoFormat.extension}`,
      );
    } finally {
      if (exportRenderer) {
        destroyRenderer(exportRenderer);
      }
    }
  };

  if (captureSnapshotRef) {
    captureSnapshotRef.current = captureSnapshot;
  }

  if (capturePresetSnapshotRef) {
    capturePresetSnapshotRef.current = capturePresetSnapshot;
  }

  if (exportPhotoRef) {
    exportPhotoRef.current = exportPhoto;
  }

  if (exportVideoRef) {
    exportVideoRef.current = exportVideo;
  }

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bounds = canvas.getBoundingClientRect();
    setCanvasDisplaySize((current) =>
      current.width === Math.round(bounds.width)
      && current.height === Math.round(bounds.height)
        ? current
        : {
            width: Math.round(bounds.width),
            height: Math.round(bounds.height),
          },
    );
    const nextWidth = Math.max(1, Math.round(bounds.width * dpr));
    const nextHeight = Math.max(1, Math.round(bounds.height * dpr));
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }
    renderFrame(lastElapsedRef.current);
  };

  useLayoutEffect(() => {
    if (!transitionKey) {
      return;
    }

    const snapshot = captureCanvasFrame();
    if (!snapshot) {
      return;
    }

    clearTransitionOverlay();

    setTransitionOverlay({
      key: transitionKey,
      phase: "idle",
      src: snapshot,
    });

    transitionFrameRef.current = requestAnimationFrame(() => {
      setTransitionOverlay((current) =>
        current && current.key === transitionKey
          ? { ...current, phase: "fading" }
          : current,
      );
    });

    transitionTimeoutRef.current = window.setTimeout(() => {
      setTransitionOverlay((current) =>
        current && current.key === transitionKey ? null : current,
      );
    }, GRADIENT_TRANSITION_DURATION_MS + 120);
  }, [transitionKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    try {
      rendererRef.current = initializeRenderer(canvas);
      resizeCanvas();
      setStatus("Renderer live.");

      resizeObserverRef.current = new ResizeObserver(() => resizeCanvas());
      resizeObserverRef.current.observe(canvas);
      window.addEventListener("resize", resizeCanvas);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to initialize WebGL.";
      setStatus(message);
    }

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      if (morphFrameRef.current) {
        cancelAnimationFrame(morphFrameRef.current);
      }
      if (transitionFrameRef.current) {
        cancelAnimationFrame(transitionFrameRef.current);
      }
      if (transitionTimeoutRef.current) {
        window.clearTimeout(transitionTimeoutRef.current);
      }
      resizeObserverRef.current?.disconnect();
      window.removeEventListener("resize", resizeCanvas);

      const renderer = rendererRef.current;
      if (renderer) {
        destroyRenderer(renderer);
      }
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!captureSnapshotRef) {
      return;
    }

    return () => {
      captureSnapshotRef.current = null;
    };
  }, [captureSnapshotRef]);

  useEffect(() => {
    if (!capturePresetSnapshotRef) {
      return;
    }

    return () => {
      capturePresetSnapshotRef.current = null;
    };
  }, [capturePresetSnapshotRef]);

  useEffect(() => {
    if (!exportPhotoRef) {
      return;
    }

    return () => {
      exportPhotoRef.current = null;
    };
  }, [exportPhotoRef]);

  useEffect(() => {
    if (!exportVideoRef) {
      return;
    }

    return () => {
      exportVideoRef.current = null;
    };
  }, [exportVideoRef]);

  useEffect(() => {
    if (paused) {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      renderFrame(lastElapsedRef.current);

      if (morphRef.current) {
        if (morphFrameRef.current) {
          cancelAnimationFrame(morphFrameRef.current);
        }
        morphFrameRef.current = requestAnimationFrame(runMorphWhilePaused);
      }

      return;
    }

    if (morphFrameRef.current) {
      cancelAnimationFrame(morphFrameRef.current);
      morphFrameRef.current = undefined;
    }

    timeOriginRef.current = performance.now() - lastElapsedRef.current * 1000;

    const tick = (now: number) => {
      const elapsed = (now - timeOriginRef.current) / 1000;
      lastElapsedRef.current = elapsed;
      renderFrame(elapsed);

      fpsSampleRef.current.frames += 1;
      if (now - fpsSampleRef.current.lastTick >= 400) {
        const delta = now - fpsSampleRef.current.lastTick;
        const currentFps = (fpsSampleRef.current.frames / delta) * 1000;
        setFps(Math.round(currentFps));
        fpsSampleRef.current = { lastTick: now, frames: 0 };
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [paused]);

  useEffect(() => {
    const nextState = buildVisualState(noiseConfig, gradientConfig, colorConfig);
    const shouldAnimate = transitionKey !== lastAnimatedTransitionKeyRef.current;

    if (!hasInitializedMorphRef.current) {
      renderStateRef.current = nextState;
      morphRef.current = null;
      hasInitializedMorphRef.current = true;
      renderFrame(lastElapsedRef.current);
      return;
    }

    updateRenderState();

    if (!shouldAnimate) {
      morphRef.current = null;
      renderStateRef.current = nextState;
      clearTransitionOverlay();

      if (morphFrameRef.current) {
        cancelAnimationFrame(morphFrameRef.current);
        morphFrameRef.current = undefined;
      }

      renderFrame(lastElapsedRef.current);
      return;
    }

    lastAnimatedTransitionKeyRef.current = transitionKey;

    if (
      isDirectionalMovementType(renderStateRef.current.movementType)
      || isDirectionalMovementType(nextState.movementType)
    ) {
      phaseStateRef.current.movementPhase = 0;
    }

    morphRef.current = {
      from: cloneVisualState(renderStateRef.current),
      to: nextState,
      startedAt: performance.now(),
      durationMs: VISUAL_MORPH_DURATION_MS,
    };

    renderFrame(lastElapsedRef.current);

    if (pausedRef.current) {
      if (morphFrameRef.current) {
        cancelAnimationFrame(morphFrameRef.current);
      }
      morphFrameRef.current = requestAnimationFrame(runMorphWhilePaused);
    }
  }, [colorConfig, gradientConfig, noiseConfig, transitionKey]);

  const exportPreviewStyle: CSSProperties | undefined = (() => {
    if (!exportPreviewSize || !canvasDisplaySize.width || !canvasDisplaySize.height) {
      return undefined;
    }

    const canvasAspect = canvasDisplaySize.width / canvasDisplaySize.height;
    const exportAspect = exportPreviewSize.width / exportPreviewSize.height;

    if (exportAspect >= canvasAspect) {
      return {
        width: "100%",
        height: `${(canvasAspect / exportAspect) * 100}%`,
      };
    }

    return {
      width: `${(exportAspect / canvasAspect) * 100}%`,
      height: "100%",
    };
  })();

  return (
    <div className="visual-canvas-shell">
      <canvas className="visual-canvas" ref={canvasRef} />
      {transitionOverlay ? (
        <img
          alt=""
          aria-hidden="true"
          className={`visual-canvas-transition ${transitionOverlay.phase === "fading" ? "is-fading" : ""}`}
          draggable={false}
          src={transitionOverlay.src}
        />
      ) : null}
      {exportPreviewSize && exportPreviewStyle ? (
        <div className="visual-export-overlay" aria-hidden="true">
          <div className="visual-export-frame" style={exportPreviewStyle}>
            <div className="visual-export-badge">
              <span>
                {exportPreviewSize.width} × {exportPreviewSize.height}
              </span>
              <span>{formatAspectRatio(exportPreviewSize.width, exportPreviewSize.height)}</span>
            </div>
          </div>
        </div>
      ) : null}
      <div className="canvas-error">
        {status} {fps ? `• ${fps} fps` : ""}
      </div>
    </div>
  );
}
