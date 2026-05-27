"use client";

import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { ViewMode } from "@/types";

type UseHomeKeyboardShortcutsParams = {
  activeParserTab: string | null;
  isExtraLargeViewport: boolean;
  isLargeViewport: boolean;
  parserTabsForSelection: string[];
  setActiveParserTab: (parserName: string | null) => void;
  setLinkedScrollingEnabled: Dispatch<SetStateAction<boolean>>;
  setShortcutHelpOpen: Dispatch<SetStateAction<boolean>>;
  setViewMode: (mode: ViewMode) => void;
  viewMode: ViewMode;
};

function isTypingInInput(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  const activeElement = document.activeElement;
  if (!activeElement) {
    return false;
  }
  const tag = activeElement.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || activeElement.hasAttribute("contenteditable");
}

export function useHomeKeyboardShortcuts({
  activeParserTab,
  isExtraLargeViewport,
  isLargeViewport,
  parserTabsForSelection,
  setActiveParserTab,
  setLinkedScrollingEnabled,
  setShortcutHelpOpen,
  setViewMode,
  viewMode
}: UseHomeKeyboardShortcutsParams): void {
  const viewShortcutPendingRef = useRef(false);
  const viewShortcutTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (viewShortcutTimerRef.current !== null) {
        window.clearTimeout(viewShortcutTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const switchModeFromShortcut = (mode: ViewMode) => {
      if (mode === "split" && !isExtraLargeViewport) {
        return;
      }
      if (mode === "compare" && !isLargeViewport) {
        return;
      }
      setViewMode(mode);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingInInput()) {
        return;
      }
      if (event.key === "?") {
        event.preventDefault();
        setShortcutHelpOpen((prev) => !prev);
        return;
      }

      if (event.key === "l") {
        event.preventDefault();
        setLinkedScrollingEnabled((prev) => !prev);
        return;
      }

      if (viewShortcutPendingRef.current) {
        const shortcutMap: Record<string, ViewMode> = {
          t: "tab",
          s: "split",
          c: "compare"
        };
        const mode = shortcutMap[event.key.toLowerCase()];
        viewShortcutPendingRef.current = false;
        if (viewShortcutTimerRef.current !== null) {
          window.clearTimeout(viewShortcutTimerRef.current);
        }
        if (mode) {
          event.preventDefault();
          switchModeFromShortcut(mode);
        }
        return;
      }

      if (event.key.toLowerCase() === "v") {
        event.preventDefault();
        viewShortcutPendingRef.current = true;
        if (viewShortcutTimerRef.current !== null) {
          window.clearTimeout(viewShortcutTimerRef.current);
        }
        viewShortcutTimerRef.current = window.setTimeout(() => {
          viewShortcutPendingRef.current = false;
        }, 1200);
        return;
      }

      if (viewMode !== "tab" || parserTabsForSelection.length === 0) {
        return;
      }

      if (/^[1-9]$/.test(event.key)) {
        const parserIndex = Number(event.key) - 1;
        const parserName = parserTabsForSelection[parserIndex];
        if (parserName) {
          event.preventDefault();
          setActiveParserTab(parserName);
        }
        return;
      }

      if (event.key === "[" || event.key === "]") {
        event.preventDefault();
        const currentIndex = activeParserTab ? parserTabsForSelection.indexOf(activeParserTab) : 0;
        const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
        const direction = event.key === "]" ? 1 : -1;
        const nextIndex = (safeCurrentIndex + direction + parserTabsForSelection.length) % parserTabsForSelection.length;
        setActiveParserTab(parserTabsForSelection[nextIndex] ?? null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    activeParserTab,
    isExtraLargeViewport,
    isLargeViewport,
    parserTabsForSelection,
    setActiveParserTab,
    setLinkedScrollingEnabled,
    setShortcutHelpOpen,
    setViewMode,
    viewMode
  ]);
}
