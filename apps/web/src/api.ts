const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || "/api";

// 封装一个获取 headers 的函数
function authHeaders(extra: HeadersInit = {}) {
  const token = localStorage.getItem("token");
  // console.log("当前 token =", token); 
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}


// 小工具：把 options 拆出 headers，避免二次覆盖
function withAuthOptions(options: RequestInit = {}) {
  const { headers: extraHeaders, ...rest } = options;
  return {
    ...rest,
    headers: authHeaders(extraHeaders as HeadersInit),
    credentials: "include" as const, // 每次都带上，同步你之前的行为
  };
}

async function handle(res: Response) {
  if (!res.ok) {
    // 统一拦截 401：清理登录态并跳到登录页
    if (res.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      // 不要用 router 以免循环依赖
      if (!location.pathname.includes("/login")) {
        location.href = "/login";
      }
    }
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  // 有些接口 204 没 body
  if (res.status === 204) return null;
  return await res.json();
}


export const api = {
  async get(path: string, options: RequestInit = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "GET",
      ...withAuthOptions(options),
    });
    return handle(res);
  },

  async post(path: string, body: any, options: RequestInit = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      body: JSON.stringify(body),
      ...withAuthOptions(options),
    });
    return handle(res);
  },

  async put(path: string, body: any, options: RequestInit = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PUT",
      body: JSON.stringify(body),
      ...withAuthOptions(options),
    });
    return handle(res);
  },

  async delete(path: string, options: RequestInit = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "DELETE",
      ...withAuthOptions(options),
    });
    return handle(res);
  },

  async getBlob(path: string, options: RequestInit = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "GET",
      ...withAuthOptions(options),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.blob();
  },
};