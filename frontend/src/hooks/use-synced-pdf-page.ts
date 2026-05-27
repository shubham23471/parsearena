"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

type UseSyncedPdfPageOptions = {
  linkedScrollingEnabled: boolean;
  pdfPageCount: number;
};

type UseSyncedPdfPageResult = {
  activePdfPage: number;
  setActivePdfPage: Dispatch<SetStateAction<number>>;
  handleSyncedPageChange: (page: number, sourceId: string) => void;
};

export function useSyncedPdfPage({
  linkedScrollingEnabled,
  pdfPageCount
}: UseSyncedPdfPageOptions): UseSyncedPdfPageResult {
  const [activePdfPage, setActivePdfPage] = useState(1);
  const activePdfPageRef = useRef<number>(1);
  const scrollingSourceRef = useRef<string | null>(null);
  const scrollingSourceTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    activePdfPageRef.current = activePdfPage;
  }, [activePdfPage]);

  useEffect(() => {
    if (activePdfPage <= pdfPageCount) {
      return;
    }
    setActivePdfPage(Math.max(pdfPageCount, 1));
  }, [activePdfPage, pdfPageCount]);

  useEffect(() => {
    return () => {
      if (scrollingSourceTimeoutRef.current !== null) {
        window.clearTimeout(scrollingSourceTimeoutRef.current);
      }
    };
  }, []);

  const handleSyncedPageChange = useCallback(
    (page: number, sourceId: string): void => {
      if (!linkedScrollingEnabled) {
        return;
      }
      const normalizedPage = Math.min(Math.max(page, 1), Math.max(pdfPageCount, 1));
      if (normalizedPage === activePdfPageRef.current) {
        return;
      }
      if (scrollingSourceRef.current !== null && scrollingSourceRef.current !== sourceId) {
        return;
      }

      scrollingSourceRef.current = sourceId;
      setActivePdfPage(normalizedPage);
      if (scrollingSourceTimeoutRef.current !== null) {
        window.clearTimeout(scrollingSourceTimeoutRef.current);
      }
      scrollingSourceTimeoutRef.current = window.setTimeout(() => {
        scrollingSourceRef.current = null;
      }, 250);
    },
    [linkedScrollingEnabled, pdfPageCount]
  );

  return { activePdfPage, setActivePdfPage, handleSyncedPageChange };
}
