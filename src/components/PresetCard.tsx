import { useState } from "react";
import type { SavedPreset } from "../types";
import { approximatePresetBackground } from "../utils/randomize";

interface PresetCardProps {
  preset: SavedPreset;
  onRestore: (preset: SavedPreset) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function PresetCard({
  preset,
  onDelete,
  onRename,
  onRestore,
}: PresetCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(preset.name);

  const createdAt = new Date(preset.createdAt).toLocaleString();

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
      <button
        className="preset-preview"
        onClick={() => onRestore(preset)}
        style={
          preset.thumbnail
            ? undefined
            : { background: approximatePresetBackground(preset.gradient, preset.color) }
        }
        type="button"
      >
        {preset.thumbnail ? <img alt={preset.name} src={preset.thumbnail} /> : null}
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

        <p className="preset-meta">
          {preset.noise.type} • {preset.gradient.type} • {preset.color.colorwayId}
        </p>
        <p className="preset-date">{createdAt}</p>

        <div className="preset-actions">
          <button className="small-button" onClick={() => onRestore(preset)} type="button">
            Load
          </button>
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
