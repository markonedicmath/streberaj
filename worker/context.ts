import { AsyncLocalStorage } from "node:async_hooks";
export interface Env { DB: any; ASSETS: { fetch(request: Request): Promise<Response> }; WORKER_SELF_REFERENCE: { fetch(request: Request): Promise<Response> }; APP_URL: string; CRON_SECRET: string; [key: string]: any }
export interface Scope { request: Request; env: Env; responseCookies: string[]; session?: { actorId: string; email: string }; snapshot?: any; fullHistory?: boolean; authOnly?: boolean; syncMetadata?: boolean; writeScope?: "profile" | "messages" }
export const scope = new AsyncLocalStorage<Scope>();
export function context() { const current = scope.getStore(); if (!current) throw new Error("Nedostaje kontekst zahteva."); return current; }
export function profile(label:string,start:number,extra:Record<string,unknown>={}){if(context().env.NATIVE_PROFILE==="1")console.log("native-profile",{label,ms:Math.round((performance.now()-start)*100)/100,...extra});}
