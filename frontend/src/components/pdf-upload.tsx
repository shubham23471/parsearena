"use client";

import { UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

import { uploadPdfWithProgress } from "@/api";
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
    <section className="space-y-6 mx-auto w-full max-w-2xl">
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
          "relative flex w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border-2 border-dashed p-12 text-center transition-colors",
          isDragging ? "border-primary bg-primary/10" : "border-border bg-card",
          disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-muted/40 hover:border-primary/40"
        ].join(" ")}
      >
        <UploadCloud className={`h-12 w-12 ${isDragging ? "text-primary" : "text-muted-foreground"} transition-colors`} />
        <div className="space-y-2">
          <p className="text-lg font-medium text-foreground">Drop PDF here or click to browse</p>
          <p className="text-sm text-muted-foreground">PDF only, up to {MAX_UPLOAD_SIZE_MB}MB</p>
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
        <div className="space-y-3">
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all duration-200 ease-out" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-center text-sm font-medium text-muted-foreground">Uploading... {progress}%</p>
        </div>
      )}

      {error && (
        <p className="text-center text-sm text-red-400">{error}</p>
      )}
    </section>
  );
}
