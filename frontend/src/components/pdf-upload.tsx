"use client";

import { UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

import { uploadPdfWithProgress } from "@/lib/api";
import type { UploadResponse } from "@/types";

const MAX_UPLOAD_SIZE_MB = 50;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

type PdfUploadProps = {
  onUploaded: (response: UploadResponse) => void;
  onUploadStateChange: (status: "idle" | "uploading" | "uploaded" | "error") => void;
  disabled?: boolean;
};

export function PdfUpload({ onUploaded, onUploadStateChange, disabled = false }: PdfUploadProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined): Promise<void> {
    if (!file) {
      return;
    }

    setError(null);

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are allowed.");
      onUploadStateChange("error");
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`File is too large. Max allowed size is ${MAX_UPLOAD_SIZE_MB}MB.`);
      onUploadStateChange("error");
      return;
    }

    try {
      onUploadStateChange("uploading");
      setProgress(0);
      const uploadResponse = await uploadPdfWithProgress(file, setProgress);
      setProgress(100);
      onUploaded(uploadResponse);
      onUploadStateChange("uploaded");
    } catch (uploadError: unknown) {
      const message = uploadError instanceof Error ? uploadError.message : "Upload failed.";
      setError(message);
      onUploadStateChange("error");
    }
  }

  return (
    <section className="space-y-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) {
            setIsDragging(true);
          }
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (disabled) {
            return;
          }
          void handleFile(event.dataTransfer.files[0]);
        }}
        className={[
          "flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition",
          isDragging ? "border-foreground bg-muted/30" : "border-border",
          disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-muted/20"
        ].join(" ")}
      >
        <UploadCloud className="h-8 w-8 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Drop PDF here or click to browse</p>
          <p className="text-xs text-muted-foreground">PDF only, up to {MAX_UPLOAD_SIZE_MB}MB</p>
        </div>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />

      {progress > 0 && progress < 100 && (
        <div className="space-y-2">
          <div className="h-2 w-full overflow-hidden rounded bg-muted">
            <div className="h-full bg-foreground transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">Uploading... {progress}%</p>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </section>
  );
}
