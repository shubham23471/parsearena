import type {
  AllResultsResponse,
  JobMetadata,
  JobStatus,
  ParseRequest,
  ParseResult,
  ParseTriggerResponse,
  ParserInfo,
  UploadResponse
} from "@/types";

const DEFAULT_API_URL = "http://localhost:8000";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;

type Method = "GET" | "POST";

async function request<T>(
  path: string,
  init?: {
    method?: Method;
    body?: BodyInit;
    headers?: HeadersInit;
  }
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: init?.method ?? "GET",
    body: init?.body,
    headers: init?.headers
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

type UploadProgressHandler = (percent: number) => void;

export async function uploadPdfWithProgress(
  file: File,
  onProgress?: UploadProgressHandler
): Promise<UploadResponse> {
  return new Promise<UploadResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    xhr.open("POST", `${API_BASE_URL}/api/v1/upload`);

    xhr.upload.onprogress = (event: ProgressEvent<EventTarget>) => {
      if (!event.lengthComputable || !onProgress) {
        return;
      }
      const percent = Math.round((event.loaded / event.total) * 100);
      onProgress(percent);
    };

    xhr.onerror = () => {
      reject(new Error("Upload failed due to a network error."));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const payload = JSON.parse(xhr.responseText) as UploadResponse;
        resolve(payload);
        return;
      }
      reject(new Error(xhr.responseText || `Upload failed with status ${xhr.status}`));
    };

    xhr.send(formData);
  });
}

export async function uploadPdf(file: File): Promise<UploadResponse> {
  return uploadPdfWithProgress(file);
}

export async function getJob(jobId: string): Promise<JobMetadata> {
  return request<JobMetadata>(`/api/v1/jobs/${jobId}`);
}

export async function triggerParse(
  jobId: string,
  parsers: string[]
): Promise<ParseTriggerResponse> {
  const payload: ParseRequest = { parsers };
  return request<ParseTriggerResponse>(
    `/api/v1/jobs/${jobId}/parse`,
    {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  return request<JobStatus>(`/api/v1/jobs/${jobId}/status`);
}

export async function getParseResult(jobId: string, parser: string): Promise<ParseResult> {
  return request<ParseResult>(`/api/v1/jobs/${jobId}/results/${parser}`);
}

export async function getAllResults(jobId: string): Promise<AllResultsResponse> {
  return request<AllResultsResponse>(`/api/v1/jobs/${jobId}/results`);
}

export async function getParsers(): Promise<ParserInfo[]> {
  return request<ParserInfo[]>(`/api/v1/parsers`);
}
