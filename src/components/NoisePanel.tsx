import {
  getNoiseDefinition,
  NOISE_OPTIONS,
  SHARED_NOISE_CONTROLS,
} from "../config";
import type { NoiseConfig, NoiseParamKey, NoiseType } from "../types";
import { ParameterControl } from "./ParameterControl";

interface NoisePanelProps {
  noiseConfig: NoiseConfig;
  onTypeChange: (type: NoiseType) => void;
  onParamChange: (key: NoiseParamKey, value: number) => void;
}

const SHARED_NOISE_KEYS = new Set(
  SHARED_NOISE_CONTROLS.map((control) => control.key),
);

export function NoisePanel({
  noiseConfig,
  onParamChange,
  onTypeChange,
}: NoisePanelProps) {
  const definition = getNoiseDefinition(noiseConfig.type);
  const sharedControls = definition.controls.filter((control) =>
    SHARED_NOISE_KEYS.has(control.key),
  );
  const specificControls = definition.controls.filter(
    (control) => !SHARED_NOISE_KEYS.has(control.key),
  );

  return (
    <section className="floating-panel noise-panel">
      <div className="panel-header">
        <h2 className="panel-title">Noise</h2>
      </div>

      <div className="panel-block">
        <ParameterControl
          definition={{
            key: "noiseType",
            kind: "select",
            label: "Noise type",
            options: NOISE_OPTIONS,
          }}
          onChange={(value) => onTypeChange(value as NoiseType)}
          value={noiseConfig.type}
        />
      </div>

      <div className="panel-block">
        <div className="control-stack">
          {sharedControls.map((control) => (
            <ParameterControl
              definition={control}
              key={control.key}
              onChange={(value) => onParamChange(control.key, Number(value))}
              value={noiseConfig.params[control.key]}
            />
          ))}
        </div>
      </div>

      {specificControls.length ? (
        <div className="panel-block">
          <div className="control-stack">
            {specificControls.map((control) => (
              <ParameterControl
                definition={control}
                key={control.key}
                onChange={(value) => onParamChange(control.key, Number(value))}
                value={noiseConfig.params[control.key]}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
