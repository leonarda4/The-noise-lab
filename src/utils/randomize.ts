import {
  cloneColorConfig,
  cloneGradientConfig,
  cloneNoiseConfig,
  COLOR_CONTROLS,
  COLORWAYS,
  getNoiseDefinition,
  getGradientControls,
} from "../config";
import type { ColorConfig, GradientConfig, NoiseConfig } from "../types";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const randomInRange = (
  min: number,
  max: number,
  step: number,
  rng: () => number,
) => {
  const raw = min + rng() * (max - min);
  const snapped = Math.round(raw / step) * step;
  const precision = `${step}`.includes(".") ? `${step}`.split(".")[1].length : 0;
  return Number(clamp(snapped, min, max).toFixed(precision));
};

const randomColor = (rng: () => number) =>
  `#${Math.floor(rng() * 0xffffff)
    .toString(16)
    .padStart(6, "0")}`;

export const randomizeCurrentConfiguration = (
  noise: NoiseConfig,
  gradient: GradientConfig,
  color: ColorConfig,
) => {
  const rng = Math.random;
  const nextNoise = cloneNoiseConfig(noise);
  const nextGradient = cloneGradientConfig(gradient);
  const nextColor = cloneColorConfig(color);

  for (const control of getNoiseDefinition(noise.type).controls) {
    if (control.kind === "range") {
      nextNoise.params[control.key] = randomInRange(
        control.min,
        control.max,
        control.step,
        rng,
      );
    } else if (control.kind === "toggle") {
      nextNoise.params[control.key] = rng() > 0.5 ? 1 : 0;
    }
  }

  for (const control of getGradientControls(gradient.type)) {
    if (control.kind === "range") {
      nextGradient.params[control.key] = randomInRange(
        control.min,
        control.max,
        control.step,
        rng,
      );
    }
  }

  for (const control of COLOR_CONTROLS) {
    if (control.kind === "range") {
      nextColor.params[control.key] = randomInRange(
        control.min,
        control.max,
        control.step,
        rng,
      );
    }
  }

  const colorwayPool = COLORWAYS.filter((colorway) => colorway.key !== "custom");
  const randomColorway = colorwayPool[Math.floor(rng() * colorwayPool.length)];
  nextColor.colorwayId = randomColorway.key;

  const movementPool = [
    "static",
    "expand",
    "contract",
    "moveLeft",
    "moveRight",
    "moveUp",
    "moveDown",
    "rotateCw",
    "rotateCcw",
    "pulse",
    "drift",
  ] as const;
  nextGradient.movement =
    movementPool[Math.floor(rng() * movementPool.length)];

  const blendModes = [
    "normal",
    "multiply",
    "screen",
    "overlay",
    "difference",
    "mask",
    "displace",
  ] as const;
  nextColor.blendMode =
    blendModes[Math.floor(rng() * blendModes.length)];

  if (color.colorwayId === "custom") {
    nextColor.colorwayId = "custom";
    nextColor.customStops = color.customStops.map(() => randomColor(rng));
  }

  return {
    noise: nextNoise,
    gradient: nextGradient,
    color: nextColor,
  };
};

export const approximatePresetBackground = (
  gradient: GradientConfig,
  color: ColorConfig,
) => {
  const colors =
    color.colorwayId === "custom"
      ? color.customStops
      : COLORWAYS.find((colorway) => colorway.key === color.colorwayId)!.colors;

  if (gradient.type === "radial" || gradient.type === "fragmentedRadial") {
    return `radial-gradient(circle at 35% 35%, ${colors.join(", ")})`;
  }
  if (gradient.type === "conic") {
    return `conic-gradient(from ${gradient.params.rotation}rad, ${colors.join(", ")})`;
  }
  if (gradient.type === "band") {
    return `linear-gradient(120deg, ${colors
      .map((color, index) => `${color} ${index * 20}%`)
      .join(", ")})`;
  }
  return `linear-gradient(135deg, ${colors.join(", ")})`;
};
