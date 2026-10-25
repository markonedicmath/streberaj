import { context } from "./context";
export async function cookies() {
  const current = context();
  const values = new Map<string,string>();
  for (const item of (current.request.headers.get("cookie") ?? "").split(";")) {
    const index = item.indexOf("=");
    if (index > 0) { try { values.set(item.slice(0,index).trim(),decodeURIComponent(item.slice(index+1))); } catch {} }
  }
  function set(name: string, value: string, options: any = {}) {
    let cookie = `${name}=${encodeURIComponent(value)}; Path=${options.path ?? "/"}`;
    if (options.httpOnly) cookie += "; HttpOnly";
    if (options.secure) cookie += "; Secure";
    if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
    if (options.maxAge !== undefined) cookie += `; Max-Age=${options.maxAge}`;
    current.responseCookies.push(cookie); values.set(name,value);
  }
  return { get: (name: string) => values.has(name) ? { name,value:values.get(name)! } : undefined,
    has: (name: string) => values.has(name), getAll: () => [...values].map(([name,value])=>({name,value})), set,
    delete: (name: string) => set(name,"",{maxAge:0,httpOnly:true,secure:true,sameSite:"lax"}) };
}
