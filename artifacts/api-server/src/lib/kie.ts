import { logger } from "./logger";

const KIE_BASE = "https://api.kie.ai";
const KIE_UPLOAD_BASE = "https://kieai.redpandaai.co";

function apiKey(): string {
  const k = process.env["KIE_AI_API_KEY"];
  if (!k) throw new Error("KIE_AI_API_KEY is not configured");
  return k;
}

/** fetch with a hard timeout so background chains can never hang indefinitely. */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

export interface KieUploadResult {
  url: string;
}

export interface KieChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

type KieChatContent = string | Array<{ type?: string; text?: string }>;

interface KieChatResponse {
  code?: number;
  msg?: string;
  message?: string;
  choices?: Array<{ message?: { content?: KieChatContent } }>;
  data?: {
    choices?: Array<{ message?: { content?: KieChatContent } }>;
    content?: string;
    response?: string;
    text?: string;
  };
}

function kieChatUrls(model: string): string[] {
  const encoded = encodeURIComponent(model);
  return [
    `${KIE_BASE}/api/v1/${encoded}/v1/chat/completions`,
    `${KIE_BASE}/${encoded}/v1/chat/completions`,
  ];
}

function normalizeKieContent(content: KieChatContent | undefined): string | null {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const text = content.map((part) => part.text ?? "").join("").trim();
    return text || null;
  }
  return null;
}

function extractKieChatText(json: KieChatResponse): string | null {
  return (
    normalizeKieContent(json.choices?.[0]?.message?.content) ??
    normalizeKieContent(json.data?.choices?.[0]?.message?.content) ??
    json.data?.content ??
    json.data?.response ??
    json.data?.text ??
    null
  );
}

function parseJsonMaybe(text: string): KieChatResponse | null {
  try {
    return JSON.parse(text) as KieChatResponse;
  } catch {
    return null;
  }
}

export async function kieCreateChatCompletion(input: {
  model: string;
  messages: KieChatMessage[];
  maxCompletionTokens?: number;
}): Promise<string> {
  const model = input.model.startsWith("kie:") ? input.model.slice("kie:".length) : input.model;
  const key = apiKey();
  const body = JSON.stringify({
    messages: input.messages,
    response_format: { type: "json_object" },
    max_completion_tokens: input.maxCompletionTokens ?? 1200,
  });

  let lastError = "";
  const urls = kieChatUrls(model);
  for (const [index, url] of urls.entries()) {
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body,
    }, 120_000);
    const text = await res.text();
    const json = parseJsonMaybe(text);
    const serviceCode = json?.code;
    const serviceMessage = json?.msg ?? json?.message;
    const isNotFound = res.status === 404 || serviceCode === 404;

    if (isNotFound && index < urls.length - 1) {
      lastError = `${res.status} ${serviceMessage ?? text.slice(0, 180)}`;
      continue;
    }
    if (!res.ok) {
      throw new Error(`kie chat failed: ${res.status} ${text.slice(0, 220)}`);
    }
    if (typeof serviceCode === "number" && serviceCode !== 0 && serviceCode !== 200) {
      throw new Error(`kie chat failed: ${serviceCode} ${serviceMessage ?? text.slice(0, 180)}`);
    }

    const content = json ? extractKieChatText(json) : null;
    if (content) return content;
    throw new Error(`kie chat returned no text${lastError ? `; previous endpoint failed: ${lastError}` : ""}`);
  }
  throw new Error(`kie chat failed${lastError ? `: ${lastError}` : ""}`);
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

  const res = await fetchWithTimeout(
    `${KIE_UPLOAD_BASE}/api/file-stream-upload`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey()}` },
      body: form,
    },
    120_000,
  );
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

/**
 * Submit a Nano Banana Pro task. With image URLs it runs image-to-image;
 * with an empty list it runs pure text-to-image. Returns the taskId for polling.
 */
export async function kieCreateNanoBananaProTask(input: KieCreateTaskInput): Promise<string> {
  const inner: Record<string, unknown> = {
    prompt: input.prompt,
    aspect_ratio: input.aspectRatio ?? "auto",
    resolution: input.resolution ?? "2K",
    output_format: "png",
  };
  if (input.imageUrls.length > 0) {
    inner["image_input"] = input.imageUrls;
  }
  const body = {
    model: "nano-banana-pro",
    input: inner,
  };
  const res = await fetchWithTimeout(
    `${KIE_BASE}/api/v1/jobs/createTask`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    60_000,
  );
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
  const res = await fetchWithTimeout(
    `${KIE_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
    { headers: { Authorization: `Bearer ${apiKey()}` } },
    30_000,
  );
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
