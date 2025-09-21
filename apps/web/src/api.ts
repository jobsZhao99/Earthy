const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || "/api";

export const api = {
  async get(path: string, options: RequestInit = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      method: "GET",
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },

  async post(path: string, body: any, options: RequestInit = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      ...options,
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },

  async delete(path: string, options: RequestInit = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!res.ok) throw new Error(await res.text());
    return null; // DELETE 返回 204 No Content
  },
  async getBlob(path: string, options: RequestInit = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      method: "GET",
      ...options,
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.blob();
  },

  // 可按需添加 put/delete 方法
};
