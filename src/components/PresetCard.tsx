import { useState } from "react";
import { getColorwayLabel } from "../config";
import type { PresetTab, SavedPreset } from "../types";

interface PresetCardProps {
  preset: SavedPreset;
  tabs: PresetTab[];
  onAssignTab: (id: string, tabId?: string) => void;
  onRestore: (preset: SavedPreset) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function PresetCard({
  tabs,
  onAssignTab,
  preset,
  onDelete,
  onRename,
  onRestore,
}: PresetCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(preset.name);

  const createdAt = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(preset.createdAt));

  const submitRename = () => {
    const nextName = draftName.trim();
    if (!nextName) {
      setDraftName(preset.name);
      setIsEditing(false);
      return;
    }
    onRename(preset.id, nextName);
    setIsEditing(false);
  };

  return (
    <article className="preset-card">
      <button className="preset-preview" onClick={() => onRestore(preset)} type="button">
        {preset.thumbnail ? (
          <img alt={preset.name} src={preset.thumbnail} />
        ) : (
          <span className="preset-preview-placeholder">Open to refresh snapshot</span>
        )}
      </button>

      <div className="preset-body">
        {isEditing ? (
          <div className="preset-edit-row">
            <input
              className="preset-name-input"
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  submitRename();
                }
              }}
              value={draftName}
            />
            <button className="small-button" onClick={submitRename} type="button">
              Save
            </button>
          </div>
        ) : (
          <button className="preset-title" onClick={() => onRestore(preset)} type="button">
            {preset.name}
          </button>
        )}

        <p className="preset-meta">{preset.noise.type} / {preset.gradient.type}</p>
        <p className="preset-meta">{getColorwayLabel(preset.color.colorwayId)}</p>
        <p className="preset-date">{createdAt}</p>
        <select
          aria-label="Preset tab"
          className="preset-tab-select"
          onChange={(event) =>
            onAssignTab(preset.id, event.target.value || undefined)}
          value={preset.tabId ?? ""}
        >
          <option value="">All</option>
          {tabs.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.name}
            </option>
          ))}
        </select>

        <div className="preset-actions">
          <button
            className="small-button"
            onClick={() => {
              setDraftName(preset.name);
              setIsEditing((value) => !value);
            }}
            type="button"
          >
            {isEditing ? "Cancel" : "Rename"}
          </button>
          <button className="small-button danger" onClick={() => onDelete(preset.id)} type="button">
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}
