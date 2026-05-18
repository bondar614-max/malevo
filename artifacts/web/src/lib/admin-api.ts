const TOKEN_KEY = "photogen_admin_token";
const USER_KEY = "photogen_admin_user";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): AdminUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as AdminUser; } catch { return null; }
}

export function setStoredUser(u: AdminUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(u));
}

const API_BASE = "/api";

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function adminLogin(email: string, password: string): Promise<{ token: string; user: AdminUser }> {
  const data = await apiFetch<{ token: string; user: AdminUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  setStoredUser(data.user);
  return data;
}
