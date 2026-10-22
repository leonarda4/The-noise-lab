import { useRef } from "react";
import type { PresetTab, SavedPreset } from "../types";
import { PresetCard } from "./PresetCard";

interface SavedPresetsPanelProps {
  activeTabId: string;
  allTabId: string;
  allPresets: SavedPreset[];
  isLoading: boolean;
  isOpen: boolean;
  isShowingAllTab: boolean;
  onCreateTab: () => void;
  onAssignTab: (id: string, tabId?: string) => void;
  onToggle: () => void;
  onSelectTab: (tabId: string) => void;
  onRestore: (preset: SavedPreset) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  presets: SavedPreset[];
  tabs: PresetTab[];
}

export function SavedPresetsPanel({
  activeTabId,
  allTabId,
  allPresets,
  isLoading,
  isOpen,
  isShowingAllTab,
  onCreateTab,
  onAssignTab,
  onDelete,
  onExport,
  onImport,
  onRename,
  onRestore,
  onSelectTab,
  onToggle,
  presets,
  tabs,
}: SavedPresetsPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const tabCounts = allPresets.reduce<Record<string, number>>((counts, preset) => {
    if (!preset.tabId) {
      return counts;
    }

    counts[preset.tabId] = (counts[preset.tabId] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <section className={`preset-folder ${isOpen ? "is-open" : "is-closed"}`}>
      <button
        aria-expanded={isOpen}
        aria-busy={isLoading}
        className="folder-tab"
        disabled={isLoading}
        onClick={onToggle}
        type="button"
      >
        <span>{isLoading ? "Loading presets…" : "Saved presets"}</span>
        {!isLoading && <span className="folder-tab-count">{allPresets.length}</span>}
      </button>

      <div className="folder-card">
        <div className="folder-toolbar">
          <div
            aria-label="Saved preset tabs"
            className="drawer-tab-strip"
            role="tablist"
          >
            <button
              aria-selected={isShowingAllTab}
              className={`drawer-tab ${isShowingAllTab ? "is-active" : ""}`}
              onClick={() => onSelectTab(allTabId)}
              role="tab"
              type="button"
            >
              <span>All</span>
              <span className="drawer-tab-count">{allPresets.length}</span>
            </button>

            {tabs.map((tab) => (
              <button
                aria-selected={activeTabId === tab.id}
                className={`drawer-tab ${activeTabId === tab.id ? "is-active" : ""}`}
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                role="tab"
                type="button"
              >
                <span>{tab.name}</span>
                <span className="drawer-tab-count">{tabCounts[tab.id] ?? 0}</span>
              </button>
            ))}

            <button
              className="drawer-tab drawer-tab-new"
              onClick={onCreateTab}
              type="button"
            >
              New tab
            </button>
          </div>

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

        {presets.length ? (
          <div className="folder-presets">
            <div className="preset-grid-drawer">
              {presets.map((preset) => (
                <PresetCard
                  key={preset.id}
                  onAssignTab={onAssignTab}
                  onDelete={onDelete}
                  onRename={onRename}
                  onRestore={onRestore}
                  preset={preset}
                  tabs={tabs}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <p>{isShowingAllTab ? "No presets saved yet." : "No presets in this tab yet."}</p>
            <span>
              {isShowingAllTab
                ? "Capture a combination once the field settles into something useful."
                : "Save while this tab is active to drop new presets into it."}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
