export function affectedRows(result: unknown): number {
  if (!result) return 0;
  const candidate = Array.isArray(result) ? result[0] : result;
  if (candidate && typeof candidate === "object" && "affectedRows" in candidate) {
    const value = (candidate as { affectedRows?: unknown }).affectedRows;
    return typeof value === "number" ? value : 0;
  }
  return 0;
}

