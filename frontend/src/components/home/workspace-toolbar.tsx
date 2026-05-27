"use client";

import { ViewModeToggle } from "@/components/view-mode-toggle";
import type { Dispatch, SetStateAction } from "react";
import type { ViewMode } from "@/types";

type WorkspaceToolbarProps = {
  isExtraLargeViewport: boolean;
  isLargeViewport: boolean;
  linkedScrollingEnabled: boolean;
  onToggleShortcutHelp: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  setLinkedScrollingEnabled: Dispatch<SetStateAction<boolean>>;
  shortcutHelpOpen: boolean;
  viewMode: ViewMode;
};

export function WorkspaceToolbar({
  isExtraLargeViewport,
  isLargeViewport,
  linkedScrollingEnabled,
  onToggleShortcutHelp,
  onViewModeChange,
  setLinkedScrollingEnabled,
  shortcutHelpOpen,
  viewMode
}: WorkspaceToolbarProps) {
  return (
    <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 text-sm text-muted-foreground">
      <div className="flex flex-wrap items-center gap-2">
        <ViewModeToggle
          viewMode={viewMode}
          onChange={onViewModeChange}
          isLargeViewport={isLargeViewport}
          isExtraLargeViewport={isExtraLargeViewport}
        />
        <button
          type="button"
          onClick={onToggleShortcutHelp}
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-border text-xs hover:bg-muted/40"
          aria-label="Show keyboard shortcuts"
          title="Keyboard shortcuts"
        >
          ?
        </button>
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={linkedScrollingEnabled}
          onChange={(event) => {
            setLinkedScrollingEnabled(event.target.checked);
          }}
          className="h-3.5 w-3.5 accent-foreground"
        />
        Linked Scrolling
      </label>
      {shortcutHelpOpen && (
        <div className="absolute right-0 top-11 z-10 w-72 rounded-md border border-border bg-background p-3 text-xs text-muted-foreground shadow-lg">
          <p className="mb-2 font-medium text-foreground">Keyboard Shortcuts</p>
          <p>`1`-`n`: switch parser tab (Tab mode)</p>
          <p>`[` / `]`: previous or next parser</p>
          <p>`v` then `t` / `s` / `c`: switch view mode</p>
          <p>`l`: toggle linked scrolling</p>
          <p>`?`: toggle this help</p>
        </div>
      )}
    </div>
  );
}
