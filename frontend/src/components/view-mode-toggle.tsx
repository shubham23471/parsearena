"use client";

import type { ComponentType } from "react";
import { Columns2, Columns3, GitCompareArrows, SplitSquareHorizontal } from "lucide-react";

import type { ViewMode } from "@/types";

type ViewModeToggleProps = {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
  isLargeViewport: boolean;
  isExtraLargeViewport: boolean;
};

type ModeOption = {
  mode: ViewMode;
  label: string;
  icon: ComponentType<{ className?: string }>;
  enabled: boolean;
  disabledReason?: string;
};

export function ViewModeToggle({
  viewMode,
  onChange,
  isLargeViewport,
  isExtraLargeViewport
}: ViewModeToggleProps) {
  const options: ModeOption[] = [
    {
      mode: "tab",
      label: "Tab",
      icon: Columns2,
      enabled: isLargeViewport,
      disabledReason: "Requires wider screen"
    },
    {
      mode: "split",
      label: "Split",
      icon: Columns3,
      enabled: isExtraLargeViewport,
      disabledReason: "Requires wider screen"
    },
    {
      mode: "compare",
      label: "Compare",
      icon: SplitSquareHorizontal,
      enabled: isLargeViewport,
      disabledReason: "Requires wider screen"
    },
    {
      mode: "diff",
      label: "Diff",
      icon: GitCompareArrows,
      enabled: false,
      disabledReason: "Available in Phase 3.3"
    }
  ];

  return (
    <div className="flex items-center gap-2">
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = option.mode === viewMode;
        const disabledTitle = option.enabled ? option.label : option.disabledReason ?? option.label;

        return (
          <button
            key={option.mode}
            type="button"
            disabled={!option.enabled}
            title={disabledTitle}
            aria-label={option.label}
            onClick={() => {
              onChange(option.mode);
            }}
            className={[
              "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors",
              isActive ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground",
              option.enabled ? "hover:bg-muted/40" : "cursor-not-allowed opacity-60"
            ].join(" ")}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
