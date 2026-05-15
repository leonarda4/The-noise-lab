import type { ControlDefinition } from "../types";

interface ParameterControlProps<TKey extends string> {
  definition: ControlDefinition<TKey>;
  value: number | string;
  onChange: (value: number | string) => void;
}

const formatValue = (value: number) => {
  if (Math.abs(value) >= 10 || Number.isInteger(value)) {
    return `${value}`;
  }
  return value.toFixed(2);
};

export function ParameterControl<TKey extends string>({
  definition,
  value,
  onChange,
}: ParameterControlProps<TKey>) {
  if (definition.kind === "toggle") {
    return (
      <label className="control-card control-card--toggle control-toggle">
        <div>
          <div className="control-label">{definition.label}</div>
          {definition.helperText ? (
            <div className="control-helper">{definition.helperText}</div>
          ) : null}
        </div>
        <button
          className={`toggle-button ${Number(value) > 0.5 ? "is-on" : ""}`}
          onClick={() => onChange(Number(value) > 0.5 ? 0 : 1)}
          type="button"
        >
          <span />
        </button>
      </label>
    );
  }

  if (definition.kind === "select") {
    return (
      <label className="control-card control-card--select">
        <div className="control-row">
          <span className="control-label">{definition.label}</span>
        </div>
        <select
          className="control-select"
          onChange={(event) => onChange(event.target.value)}
          value={String(value)}
        >
          {definition.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {definition.helperText ? (
          <div className="control-helper">{definition.helperText}</div>
        ) : null}
      </label>
    );
  }

  return (
    <label className="control-card control-card--range">
      <div className="control-row">
        <span className="control-label">{definition.label}</span>
        <span className="control-value">{formatValue(Number(value))}</span>
      </div>
      <input
        className="control-range"
        max={definition.max}
        min={definition.min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={definition.step}
        type="range"
        value={Number(value)}
      />
      {definition.helperText ? (
        <div className="control-helper">{definition.helperText}</div>
      ) : null}
    </label>
  );
}
