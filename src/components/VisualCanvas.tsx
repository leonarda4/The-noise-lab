import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import {
  BLEND_MODE_TO_INDEX,
  getColorStops,
  GRADIENT_TYPE_TO_INDEX,
  MOVEMENT_TO_INDEX,
  NOISE_TYPE_TO_INDEX,
} from "../config";
import { fragmentShaderSource, vertexShaderSource } from "../shaders/visualShader";
import type { ColorConfig, GradientConfig, NoiseConfig } from "../types";

interface VisualCanvasProps {
  colorConfig: ColorConfig;
  noiseConfig: NoiseConfig;
  gradientConfig: GradientConfig;
  paused: boolean;
  captureSnapshotRef?: MutableRefObject<(() => string | undefined) | null>;
}

interface RendererState {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  positionBuffer: WebGLBuffer;
  positionLocation: number;
  uniformLocations: Record<string, WebGLUniformLocation | null>;
}

const UNIFORM_NAMES = [
  "u_resolution",
  "u_time",
  "u_noiseType",
  "u_gradientType",
  "u_movementType",
  "u_blendMode",
  "u_paletteCount",
  "u_palette",
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

const hexToRgb = (hex: string): [number, number, number] => {
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

export function VisualCanvas({
  colorConfig,
  gradientConfig,
  noiseConfig,
  paused,
  captureSnapshotRef,
}: VisualCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<RendererState | null>(null);
    const frameRef = useRef<number>();
    const timeOriginRef = useRef<number>(performance.now());
    const lastElapsedRef = useRef<number>(0);
    const noiseConfigRef = useRef(noiseConfig);
    const gradientConfigRef = useRef(gradientConfig);
    const colorConfigRef = useRef(colorConfig);
    const resizeObserverRef = useRef<ResizeObserver>();
    const fpsSampleRef = useRef({ lastTick: performance.now(), frames: 0 });

    const [status, setStatus] = useState("Initializing WebGL visual system.");
    const [fps, setFps] = useState(0);

    noiseConfigRef.current = noiseConfig;
    gradientConfigRef.current = gradientConfig;
    colorConfigRef.current = colorConfig;

    const renderFrame = (elapsed: number) => {
      const canvas = canvasRef.current;
      const renderer = rendererRef.current;
      if (!canvas || !renderer) {
        return;
      }

      const { gl, program, uniformLocations } = renderer;
      const width = canvas.width;
      const height = canvas.height;
      if (!width || !height) {
        return;
      }

      gl.viewport(0, 0, width, height);
      gl.useProgram(program);

      setUniform2f(gl, uniformLocations.u_resolution, width, height);
      setUniform1f(gl, uniformLocations.u_time, elapsed);

      setUniform1i(gl, uniformLocations.u_noiseType, NOISE_TYPE_TO_INDEX[noiseConfigRef.current.type]);
      setUniform1i(
        gl,
        uniformLocations.u_gradientType,
        GRADIENT_TYPE_TO_INDEX[gradientConfigRef.current.type],
      );
      setUniform1i(
        gl,
        uniformLocations.u_movementType,
        MOVEMENT_TO_INDEX[gradientConfigRef.current.movement],
      );
      setUniform1i(
        gl,
        uniformLocations.u_blendMode,
        BLEND_MODE_TO_INDEX[colorConfigRef.current.blendMode],
      );

      const rawColors = [...getColorStops(colorConfigRef.current)];
      const paletteCount = Math.min(rawColors.length, 5);
      const colors = [...rawColors];
      while (colors.length < 5) {
        colors.push(colors[colors.length - 1] ?? "#ffffff");
      }
      const paletteData = new Float32Array(colors.slice(0, 5).flatMap(hexToRgb));
      if (uniformLocations.u_palette) {
        gl.uniform3fv(uniformLocations.u_palette, paletteData);
      }
      setUniform1i(gl, uniformLocations.u_paletteCount, paletteCount);

      const noise = noiseConfigRef.current.params;
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
      setUniform1f(gl, uniformLocations.u_turbulenceStrength, noise.turbulenceStrength);
      setUniform1f(gl, uniformLocations.u_sharpness, noise.sharpness);
      setUniform1f(gl, uniformLocations.u_ridgeSharpness, noise.ridgeSharpness);
      setUniform1f(gl, uniformLocations.u_compression, noise.compression);
      setUniform1f(gl, uniformLocations.u_flowStrength, noise.flowStrength);
      setUniform1f(
        gl,
        uniformLocations.u_particleDistortionStrength,
        noise.particleDistortionStrength,
      );
      setUniform1f(gl, uniformLocations.u_swirlAmount, noise.swirlAmount);
      setUniform1f(gl, uniformLocations.u_directionInstability, noise.directionInstability);
      setUniform1f(gl, uniformLocations.u_baseScale, noise.baseScale);
      setUniform1f(gl, uniformLocations.u_warpScale, noise.warpScale);
      setUniform1f(gl, uniformLocations.u_warpStrength, noise.warpStrength);
      setUniform1f(gl, uniformLocations.u_warpSpeed, noise.warpSpeed);
      setUniform1f(gl, uniformLocations.u_iterations, noise.iterations);
      setUniform1f(gl, uniformLocations.u_cellDensity, noise.cellDensity);
      setUniform1f(gl, uniformLocations.u_edgeSoftness, noise.edgeSoftness);
      setUniform1f(gl, uniformLocations.u_jitter, noise.jitter);
      setUniform1f(gl, uniformLocations.u_invert, noise.invert);
      setUniform1f(gl, uniformLocations.u_borderThickness, noise.borderThickness);
      setUniform1f(gl, uniformLocations.u_fragmentation, noise.fragmentation);
      setUniform1f(gl, uniformLocations.u_grainDensity, noise.grainDensity);
      setUniform1f(gl, uniformLocations.u_ditherStrength, noise.ditherStrength);

      const gradient = gradientConfigRef.current.params;
      setUniform1f(gl, uniformLocations.u_gradientScale, gradient.gradientScale);
      setUniform1f(gl, uniformLocations.u_movementSpeed, gradient.movementSpeed);
      setUniform1f(gl, uniformLocations.u_displacementStrength, gradient.displacementStrength);
      setUniform2f(gl, uniformLocations.u_center, gradient.centerX, gradient.centerY);
      setUniform1f(gl, uniformLocations.u_rotation, gradient.rotation);
      setUniform1f(gl, uniformLocations.u_softness, gradient.softness);
      setUniform1f(gl, uniformLocations.u_bandCount, gradient.bandCount);
      setUniform1f(gl, uniformLocations.u_meshWarp, gradient.meshWarp);
      setUniform1f(gl, uniformLocations.u_fragmentAmount, gradient.fragmentAmount);

      const color = colorConfigRef.current.params;
      setUniform1f(gl, uniformLocations.u_blendStrength, color.blendStrength);
      setUniform1f(gl, uniformLocations.u_saturation, color.saturation);
      setUniform1f(gl, uniformLocations.u_brightness, color.brightness);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const captureSnapshot = () => {
      const canvas = canvasRef.current;
      if (!canvas || !canvas.width || !canvas.height) {
        return undefined;
      }

      renderFrame(lastElapsedRef.current);

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

      return snapshotCanvas.toDataURL("image/jpeg", 0.88);
    };

    if (captureSnapshotRef) {
      captureSnapshotRef.current = captureSnapshot;
    }

    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const bounds = canvas.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.round(bounds.width * dpr));
      const nextHeight = Math.max(1, Math.round(bounds.height * dpr));
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }
      renderFrame(lastElapsedRef.current);
    };

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      try {
        const gl = canvas.getContext("webgl", {
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: true,
        });

        if (!gl) {
          setStatus("WebGL is unavailable in this browser.");
          return;
        }

        const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
        const positionBuffer = gl.createBuffer();
        if (!positionBuffer) {
          throw new Error("Failed to allocate fullscreen vertex buffer.");
        }

        const positionLocation = gl.getAttribLocation(program, "a_position");
        if (positionLocation < 0) {
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

        rendererRef.current = {
          gl,
          program,
          positionBuffer,
          positionLocation,
          uniformLocations,
        };

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
        resizeObserverRef.current?.disconnect();
        window.removeEventListener("resize", resizeCanvas);

        const renderer = rendererRef.current;
        if (renderer) {
          const { gl, program, positionBuffer } = renderer;
          gl.deleteBuffer(positionBuffer);
          gl.deleteProgram(program);
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
      if (paused) {
        if (frameRef.current) {
          cancelAnimationFrame(frameRef.current);
        }
        renderFrame(lastElapsedRef.current);
        return;
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
      renderFrame(lastElapsedRef.current);
    }, [colorConfig, gradientConfig, noiseConfig]);

    return (
      <div className="visual-canvas-shell">
        <canvas className="visual-canvas" ref={canvasRef} />
        <div className="canvas-error">
          {status} {fps ? `• ${fps} fps` : ""}
        </div>
      </div>
    );
}
