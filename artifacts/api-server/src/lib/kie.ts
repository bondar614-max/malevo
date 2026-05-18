import { logger } from "./logger";

const KIE_BASE = "https://api.kie.ai";
const KIE_UPLOAD_BASE = "https://kieai.redpandaai.co";

function apiKey(): string {
  const k = process.env["KIE_AI_API_KEY"];
  if (!k) throw new Error("KIE_AI_API_KEY is not configured");
  return k;
}

export interface KieUploadResult {
  url: string;
}

/**
 * Upload a file buffer to kie.ai temporary storage. Files are auto-deleted after 3 days.
 * Returns the public URL we can pass to model endpoints.
 */
export async function kieUploadFile(
  file: Buffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(file)], { type: mimeType });
  form.append("file", blob, filename);
  form.append("uploadPath", "images/photogen");
  form.append("fileName", filename);

  const res = await fetch(`${KIE_UPLOAD_BASE}/api/file-stream-upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: form,
  });
  const json = (await res.json()) as {
    success?: boolean;
    code?: number;
    msg?: string;
    data?: { downloadUrl?: string; fileUrl?: string; url?: string };
  };
  if (!res.ok || (json.code && json.code !== 200) || json.success === false) {
    logger.error({ json }, "kie upload failed");
    throw new Error(`kie upload failed: ${json.msg ?? res.statusText}`);
  }
  const url = json.data?.downloadUrl ?? json.data?.fileUrl ?? json.data?.url;
  if (!url) {
    logger.error({ json }, "kie upload returned no url");
    throw new Error("kie upload returned no url");
  }
  return url;
}

export interface KieCreateTaskInput {
  prompt: string;
  imageUrls: string[];
  aspectRatio?: "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "9:16" | "16:9" | "auto";
  resolution?: "1K" | "2K" | "4K";
}

/** Submit a Nano Banana Pro image-to-image task. Returns the taskId for polling. */
export async function kieCreateNanoBananaProTask(input: KieCreateTaskInput): Promise<string> {
  const body = {
    model: "nano-banana-pro",
    input: {
      prompt: input.prompt,
      image_input: input.imageUrls,
      aspect_ratio: input.aspectRatio ?? "auto",
      resolution: input.resolution ?? "2K",
      output_format: "png",
    },
  };
  const res = await fetch(`${KIE_BASE}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { code?: number; msg?: string; data?: { taskId?: string } };
  if (!res.ok || json.code !== 200 || !json.data?.taskId) {
    logger.error({ json }, "kie createTask failed");
    throw new Error(`kie createTask failed: ${json.msg ?? res.statusText}`);
  }
  return json.data.taskId;
}

export type KieTaskState = "waiting" | "queuing" | "generating" | "success" | "fail";

export interface KieTaskInfo {
  state: KieTaskState;
  resultUrls: string[];
  errorMessage?: string;
  raw: unknown;
}

/** Query a task by ID. Maps kie.ai's record-info response to a simple shape. */
export async function kieGetTask(taskId: string): Promise<KieTaskInfo> {
  const res = await fetch(`${KIE_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  const json = (await res.json()) as {
    code?: number;
    msg?: string;
    data?: {
      state?: string;
      successFlag?: number;
      failCode?: string | null;
      failMsg?: string | null;
      resultJson?: string;
      completeTime?: number | null;
    };
  };
  if (!res.ok || (json.code !== 200 && json.code !== 422)) {
    throw new Error(`kie recordInfo failed: ${json.msg ?? res.statusText}`);
  }
  if (!json.data) {
    return { state: "waiting", resultUrls: [], raw: json };
  }
  const d = json.data;
  // kie.ai uses either textual state ("waiting"/"success"/"fail") or successFlag (0/1/2/3).
  let state: KieTaskState = "generating";
  if (typeof d.state === "string") {
    const s = d.state.toLowerCase();
    if (s === "success" || s === "fail" || s === "waiting" || s === "queuing" || s === "generating") {
      state = s as KieTaskState;
    }
  } else if (typeof d.successFlag === "number") {
    state = d.successFlag === 1 ? "success" : d.successFlag === 2 || d.successFlag === 3 ? "fail" : "generating";
  }

  let resultUrls: string[] = [];
  if (d.resultJson) {
    try {
      const parsed = JSON.parse(d.resultJson) as { resultUrls?: string[]; imageUrls?: string[]; urls?: string[] };
      resultUrls = parsed.resultUrls ?? parsed.imageUrls ?? parsed.urls ?? [];
    } catch {
      /* ignore */
    }
  }
  return {
    state,
    resultUrls,
    errorMessage: d.failMsg ?? undefined,
    raw: json,
  };
}
