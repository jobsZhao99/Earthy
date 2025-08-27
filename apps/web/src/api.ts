export const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
