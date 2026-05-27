"use client";

import { ThemeToggle } from "@/components/theme-toggle";

export function HomeHeader() {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">ParseArena</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Compare parser output quality on your own PDF documents.
        </p>
      </div>
      <ThemeToggle />
    </header>
  );
}
