import {
  getGradientControls,
  GRADIENT_CONTROLS,
  GRADIENT_OPTIONS,
  MOVEMENT_OPTIONS,
} from "../config";
import type {
  GradientConfig,
  GradientMovement,
  GradientParamKey,
  GradientType,
} from "../types";
import { ParameterControl } from "./ParameterControl";

const SHARED_GRADIENT_KEYS = new Set(
  GRADIENT_CONTROLS.map((control) => control.key),
);

interface GradientPanelProps {
  gradientConfig: GradientConfig;
  onGradientTypeChange: (type: GradientType) => void;
  onMovementChange: (movement: GradientMovement) => void;
  onParamChange: (key: GradientParamKey, value: number) => void;
}

export function GradientPanel({
  gradientConfig,
  onGradientTypeChange,
  onMovementChange,
  onParamChange,
}: GradientPanelProps) {
  const controls = getGradientControls(gradientConfig.type);
  const sharedControls = controls.filter((control) =>
    SHARED_GRADIENT_KEYS.has(control.key),
  );
  const typeSpecificControls = controls.filter(
    (control) => !SHARED_GRADIENT_KEYS.has(control.key),
  );

  return (
    <section className="floating-panel gradient-panel">
      <div className="panel-header">
        <h2 className="panel-title">Gradient</h2>
      </div>

      <div className="panel-block">
        <ParameterControl
          definition={{
            key: "gradientType",
            kind: "select",
            label: "Gradient type",
            options: GRADIENT_OPTIONS,
          }}
          onChange={(value) => onGradientTypeChange(value as GradientType)}
          value={gradientConfig.type}
        />
      </div>

      <div className="panel-block">
        <ParameterControl
          definition={{
            key: "movement",
            kind: "select",
            label: "Movement",
            options: MOVEMENT_OPTIONS,
          }}
          onChange={(value) => onMovementChange(value as GradientMovement)}
          value={gradientConfig.movement}
        />
      </div>

      <div className="panel-block">
        <div className="control-stack">
          {sharedControls.map((control) => (
            <ParameterControl
              definition={control}
              key={control.key}
              onChange={(value) => onParamChange(control.key, Number(value))}
              value={gradientConfig.params[control.key]}
            />
          ))}
        </div>
      </div>

      {typeSpecificControls.length ? (
        <div className="panel-block">
          <div className="control-stack">
            {typeSpecificControls.map((control) => (
              <ParameterControl
                definition={control}
                key={control.key}
                onChange={(value) => onParamChange(control.key, Number(value))}
                value={gradientConfig.params[control.key]}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
