import { useRef } from "react";
import type { SavedPreset } from "../types";
import { PresetCard } from "./PresetCard";

interface SavedPresetsPanelProps {
  favourites: SavedPreset[];
  isOpen: boolean;
  onToggle: () => void;
  onRestore: (preset: SavedPreset) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
}

export function SavedPresetsPanel({
  favourites,
  isOpen,
  onDelete,
  onExport,
  onImport,
  onRename,
  onRestore,
  onToggle,
}: SavedPresetsPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <section className={`floating-panel saved-presets-panel ${isOpen ? "is-open" : "is-collapsed"}`}>
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Saved presets</h2>
        </div>

        <div className="favourites-actions">
          <button className="text-button" onClick={onExport} type="button">
            Export
          </button>
          <button
            className="text-button"
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            Import
          </button>
          <button className="text-button" onClick={onToggle} type="button">
            {isOpen ? "Collapse" : "Expand"}
          </button>
          <input
            accept="application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                onImport(file);
              }
              event.target.value = "";
            }}
            ref={inputRef}
            type="file"
          />
        </div>
      </div>

      {isOpen ? (
        <div className="favourites-scroll">
          {favourites.length ? (
            <div className="preset-grid">
              {favourites.map((preset) => (
                <PresetCard
                  key={preset.id}
                  onDelete={onDelete}
                  onRename={onRename}
                  onRestore={onRestore}
                  preset={preset}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>No presets saved yet.</p>
              <span>Capture a combination once the field settles into something useful.</span>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
