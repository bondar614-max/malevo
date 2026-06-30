import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { objectStorageClient, ObjectStorageService } from "./objectStorage";

const svc = new ObjectStorageService();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function publicDir(): string {
  if (__dirname.endsWith(path.join("src", "lib"))) {
    return path.resolve(__dirname, "..", "..", "public");
  }
  return path.resolve(__dirname, "..", "public");
}

function parsePath(p: string): { bucketName: string; objectName: string } {
  const path = p.startsWith("/") ? p : `/${p}`;
  const parts = path.split("/");
  return { bucketName: parts[1]!, objectName: parts.slice(2).join("/") };
}

function extensionFor(contentType: string): string {
  switch (contentType) {
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "image/webp": return "webp";
    case "image/gif": return "gif";
    default: return "bin";
  }
}

async function uploadBufferToLocalPublic(
  buf: Buffer,
  contentType: string,
  subfolder: string,
): Promise<string> {
  const safeSubfolder = subfolder.replace(/[^a-z0-9_-]/gi, "_");
  const filename = `${randomUUID()}.${extensionFor(contentType)}`;
  const dir = path.join(publicDir(), safeSubfolder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), buf);
  return `/api/static/${safeSubfolder}/${filename}`;
}

/**
 * Uploads a buffer to the private object dir under a subfolder and returns
 * a serving path like `/api/storage/objects/<entityId>` suitable for
 * storing in the DB and rendering in <img src>.
 */
export async function uploadBufferToStorage(
  buf: Buffer,
  contentType: string,
  subfolder: string,
): Promise<string> {
  if (!process.env.PRIVATE_OBJECT_DIR) {
    return uploadBufferToLocalPublic(buf, contentType, subfolder);
  }
  const dir = svc.getPrivateObjectDir();
  const entityId = `${subfolder}/${randomUUID()}`;
  const fullPath = `${dir.replace(/\/$/, "")}/${entityId}`;
  const { bucketName, objectName } = parsePath(fullPath);
  await objectStorageClient
    .bucket(bucketName)
    .file(objectName)
    .save(buf, { contentType, resumable: false });
  return `/api/storage/objects/${entityId}`;
}

/** True for any URL we already serve from our own storage. */
export function isLocalStorageUrl(url: string): boolean {
  return url.startsWith("/api/storage/objects/") || url.startsWith("/api/static/");
}

/**
 * Reads the bytes of an object we previously stored, given its serving path
 * (e.g. `/api/storage/objects/admin/<uuid>`). Returns the buffer plus its
 * content type so the caller can re-upload it elsewhere (e.g. to kie.ai).
 */
export async function downloadStorageObject(
  servingUrl: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  if (servingUrl.startsWith("/api/static/")) {
    const relative = servingUrl.slice("/api/static/".length);
    const filePath = path.resolve(publicDir(), relative);
    const root = publicDir();
    if (!filePath.startsWith(root)) {
      throw new Error("Invalid static object url");
    }
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType =
      ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
      ext === ".webp" ? "image/webp" :
      ext === ".gif" ? "image/gif" :
      "image/png";
    return { buffer, contentType };
  }
  const prefix = "/api/storage";
  if (!servingUrl.startsWith(`${prefix}/objects/`)) {
    throw new Error("Not a storage object url");
  }
  const objectPath = servingUrl.slice(prefix.length);
  const file = await svc.getObjectEntityFile(objectPath);
  const [metadata] = await file.getMetadata();
  const [buffer] = await file.download();
  const contentType = (metadata.contentType as string | undefined) ?? "image/png";
  return { buffer, contentType };
}
