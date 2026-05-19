import { randomUUID } from "node:crypto";
import { objectStorageClient, ObjectStorageService } from "./objectStorage";

const svc = new ObjectStorageService();

function parsePath(p: string): { bucketName: string; objectName: string } {
  const path = p.startsWith("/") ? p : `/${p}`;
  const parts = path.split("/");
  return { bucketName: parts[1]!, objectName: parts.slice(2).join("/") };
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
