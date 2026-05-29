"use client";

import { useCallback, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

type UseSyncedPdfPageOptions = {
  linkedScrollingEnabled: boolean;
  pdfPageCount: number;
};

type UseSyncedPdfPageResult = {
  activePdfPage: number;
  setActivePdfPage: Dispatch<SetStateAction<number>>;
  scrollSourceId: string | null;
  handlePageChange: (page: number, sourceId: string) => void;
};

const SCROLL_LOCK_DURATION_MS = 800;

export function useSyncedPdfPage({
  linkedScrollingEnabled,
  pdfPageCount
}: UseSyncedPdfPageOptions): UseSyncedPdfPageResult {
  const [activePdfPage, setActivePdfPage] = useState(1);
  const [scrollSourceId, setScrollSourceId] = useState<string | null>(null);
  
  // Use refs to avoid stale closures in the callback
  const scrollSourceRef = useRef<string | null>(null);
  const lockTimeoutRef = useRef<number | null>(null);
  const lastPageRef = useRef<number>(1);

  const handlePageChange = useCallback(
    (page: number, sourceId: string): void => {
      if (!linkedScrollingEnabled) {
        return;
      }

      const normalizedPage = Math.min(Math.max(page, 1), Math.max(pdfPageCount, 1));
      
      // Skip if same page
      if (normalizedPage === lastPageRef.current) {
        return;
      }

      // If another source owns the scroll lock, ignore this update
      if (scrollSourceRef.current !== null && scrollSourceRef.current !== sourceId) {
        return;
      }

      // Set this source as the scroll owner
      scrollSourceRef.current = sourceId;
      setScrollSourceId(sourceId);
      
      lastPageRef.current = normalizedPage;
      setActivePdfPage(normalizedPage);

      // Clear any existing timeout
      if (lockTimeoutRef.current !== null) {
        window.clearTimeout(lockTimeoutRef.current);
      }

      // Release scroll lock after delay
      lockTimeoutRef.current = window.setTimeout(() => {
        scrollSourceRef.current = null;
        setScrollSourceId(null);
        lockTimeoutRef.current = null;
      }, SCROLL_LOCK_DURATION_MS);
    },
    [linkedScrollingEnabled, pdfPageCount]
  );

  return { activePdfPage, setActivePdfPage, scrollSourceId, handlePageChange };
}
