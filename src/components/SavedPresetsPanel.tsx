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
    <section className={`preset-folder ${isOpen ? "is-open" : "is-closed"}`}>
      <button
        aria-expanded={isOpen}
        className="folder-tab"
        onClick={onToggle}
        type="button"
      >
        <span>Saved presets</span>
        <span className="folder-tab-count">{favourites.length}</span>
      </button>

      <div className="folder-card">
        <div className="folder-toolbar">
          <p className="folder-caption">
            {favourites.length
              ? `${favourites.length} saved stud${favourites.length === 1 ? "y" : "ies"}`
              : "No saved studies yet"}
          </p>

          <div className="drawer-actions">
            <button className="small-button" onClick={onExport} type="button">
              Export
            </button>
            <button
              className="small-button"
              onClick={() => inputRef.current?.click()}
              type="button"
            >
              Import
            </button>
            <button className="small-button" onClick={onToggle} type="button">
              Close
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

        {favourites.length ? (
          <div className="folder-presets">
            <div className="preset-grid-drawer">
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
          </div>
        ) : (
          <div className="empty-state">
            <p>No presets saved yet.</p>
            <span>Capture a combination once the field settles into something useful.</span>
          </div>
        )}
      </div>
    </section>
  );
}
