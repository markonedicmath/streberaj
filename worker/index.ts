import { scope,context,profile,type Env } from "./context";
import { createHash } from "node:crypto";
import { readState,transact } from "./store";
import { authenticate,sameOrigin } from "./auth";
import { googleSession } from "../src/lib/google-login";
import { overrideSession } from "../src/lib/override-login";
import * as troubleshoot from "../src/app/api/troubleshoot/route";
import { failure,json } from "../src/lib/http";
import { DomainError,project } from "../src/lib/domain";
import { google,secretEqual } from "../src/lib/google";
import { parseSheets,reconcileSources,type SheetsDocument } from "../src/lib/sheets";
import { boundedBody } from "../src/lib/files";
import { commandResponse } from "./command";
import * as login from "../src/app/auth/login/route";
import * as callback from "../src/app/auth/callback/route";
import * as logout from "../src/app/auth/logout/route";
import * as connect from "../src/app/api/google/connect/route";
import * as googleCallback from "../src/app/api/google/callback/route";
import * as connection from "../src/app/api/google/connection/route";
import * as reset from "../src/app/api/sync/reset/route";
import * as webhook from "../src/app/api/sync/webhook/route";

const routes: Record<string,any> = {
  "/auth/login":login,"/auth/callback":callback,"/auth/logout":logout,
  "/api/google/connect":connect,"/api/google/callback":googleCallback,"/api/google/connection":connection,
  "/api/sync/reset":reset,"/api/sync/webhook":webhook,
  "/api/troubleshoot":troubleshoot,
};
const responses = new Map<string,{revision:number;minute:string;body:string}>();
async function stateResponse(request:Request){
  const state=await readState(),actor=await authenticate(request,state);
  const cacheKey=actor.id+":"+!!context().session?.override;
  const minute=new Date().toISOString().slice(0,16);
  let cached=responses.get(cacheKey);
  if(!cached || cached.revision!==state.revision || cached.minute!==minute){
    const started=performance.now();
    cached={revision:state.revision,minute,body:JSON.stringify(project(state,actor,!!context().session?.override))};
    profile("view",started);
    responses.set(cacheKey,cached);
  }
  const etag=`"${cacheKey}:${state.revision}:${minute}"`;
  const headers={"Cache-Control":"private, no-cache","ETag":etag,"Content-Type":"application/json; charset=utf-8"};
  return request.headers.get("if-none-match")===etag?new Response(null,{status:304,headers}):new Response(cached.body,{headers});
}
async function importWeek(request:Request){
  const current=context();
  if(!secretEqual(request.headers.get("authorization")?.replace(/^Bearer /,"")??null,current.env.CRON_SECRET))throw new DomainError("Nedozvoljen pristup.",403);
  const input=JSON.parse((await boundedBody(request,4096)).toString("utf8"));
  current.syncMetadata=true;
  const initial=await readState();
  if(input.sheet!==initial.sync.spreadsheetId || input.connectionId!==initial.googleConnection?.id)throw new DomainError("Izvor je promenjen tokom uvoza.",409);
  if(typeof input.title!=="string" || !Number.isInteger(input.year))throw new DomainError("Neispravna nedeljna kartica.");
  const query=new URLSearchParams({includeGridData:"true",fields:"sheets(properties(sheetId,title),merges,data(startRow,startColumn,rowData(values(formattedValue,effectiveFormat(backgroundColor)))))",ranges:"'"+input.title.replaceAll("'","''")+"'!A1:O110"});
  const document=await google(initial,"https://sheets.googleapis.com/v4/spreadsheets/"+encodeURIComponent(input.sheet)+"?"+query) as SheetsDocument;
  const parseStarted=performance.now();
  const blocks=parseSheets(document,input.year), ids=new Set(document.sheets.map(tab=>tab.properties.sheetId));
  profile("sheet-parse",parseStarted);
  const cacheId=JSON.stringify([input.connectionId,input.sheet,input.title,input.year]);
  const hash=createHash("sha256").update(JSON.stringify([blocks,initial.sync.colorMap,initial.sync.studentMap,initial.sync.roundDurations])).digest("hex");
  const previous=await current.env.DB.prepare("SELECT hash FROM school_import_cache WHERE id=?").bind(cacheId).first();
  if(previous?.hash===hash)return json({count:blocks.length});
  current.syncMetadata=false;
  await transact(state=>{
    const reconcileStarted=performance.now();
    if(state.sync.spreadsheetId!==input.sheet || state.googleConnection?.id!==input.connectionId)throw new DomainError("Izvor je promenjen tokom uvoza.",409);
    // Only this week's absence can mean deletion; retain all other weeks.
    const keep=state.sourceBlocks.filter(block=>!ids.has(block.sheetId));
    state.sourceBlocks=state.sourceBlocks.filter(block=>ids.has(block.sheetId));
    reconcileSources(state,blocks);
    state.sourceBlocks=[...keep,...state.sourceBlocks].sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:a.desk-b.desk||a.start-b.start||(a.id<b.id?-1:a.id>b.id?1:0));
    profile("sheet-reconcile",reconcileStarted);
  });
  await current.env.DB.prepare("INSERT INTO school_import_cache(id,hash,checked_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET hash=excluded.hash,checked_at=excluded.checked_at").bind(cacheId,hash,new Date().toISOString()).run();
  return json({count:blocks.length});
}
async function synchronize(request:Request){
  const current=context(), authorized=secretEqual(request.headers.get("authorization")?.replace(/^Bearer /,"")??null,current.env.CRON_SECRET);
  if(!authorized){sameOrigin(request);const actor=await authenticate(request);if(actor.role!=="admin")throw new DomainError("Samo administrator može da osveži izvor.",403);}
  current.syncMetadata=true;
  const initial=await readState();
  if(!initial.sync.spreadsheetId)throw new DomainError("Najpre povežite Google tabelu.");
  if(new URL(request.url).searchParams.has("automatic") && initial.sync.lastAttempt && Date.now()-Date.parse(initial.sync.lastAttempt)<50000)return json({count:0,lastSuccess:initial.sync.lastSuccess});
  const claim=await transact(state=>{
    if(state.googleSyncLease && state.googleSyncLease.expires>Date.now())return false;
    state.googleSyncLease={id:crypto.randomUUID(),expires:Date.now()+240000};
    state.sync.lastAttempt=new Date().toISOString();
    return state.googleSyncLease.id;
  });
  if(!claim.result)return json({count:0,lastSuccess:claim.state.sync.lastSuccess});
  try{
    const document=await google(initial,"https://sheets.googleapis.com/v4/spreadsheets/"+encodeURIComponent(initial.sync.spreadsheetId)+"?fields=sheets(properties(sheetId,title))") as SheetsDocument;
    let year=initial.sync.firstYear,lastMonth=0,count=0;
    const weeks:{title:string;year:number}[]=[];
    for(const tab of document.sheets){
      const match=tab.properties.title.match(/^(\d{1,2})\.(\d{1,2})\.?\s*[-–]\s*(\d{1,2})\.(\d{1,2})\.?$/);
      if(!match)continue;
      const month=Number(match[2]);if(lastMonth && month<lastMonth)year++;lastMonth=month;
      weeks.push({title:tab.properties.title,year});
    }
    if(!weeks.length)throw new DomainError("Nema nedeljnih kartica u izvornoj tabeli.");
    for(let offset=0;offset<weeks.length;offset+=3){
      const counts=await Promise.all(weeks.slice(offset,offset+3).map(async week=>{
      const response=await current.env.WORKER_SELF_REFERENCE.fetch(new Request(new URL("/internal/import-week",current.env.APP_URL),{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+current.env.CRON_SECRET},body:JSON.stringify({...week,sheet:initial.sync.spreadsheetId,connectionId:initial.googleConnection?.id})}));
      const result=await response.json() as any;
      if(!response.ok)throw new DomainError(result.error??"Uvoz nedelje nije uspeo.",response.status);
      return result.count;
      }));
      count+=counts.reduce((sum,value)=>sum+value,0);
    }
    const saved=await transact(state=>{state.sync.lastSuccess=new Date().toISOString();state.sync.lastError=null;if(state.googleSyncLease?.id===claim.result)delete state.googleSyncLease;});
    return json({count,lastSuccess:saved.state.sync.lastSuccess});
  }catch(error){
    await transact(state=>{state.sync.lastError=error instanceof DomainError?error.message:"Uvoz nije uspeo; prethodni podaci su sačuvani.";if(state.googleSyncLease?.id===claim.result)delete state.googleSyncLease;}).catch(()=>{});
    throw error;
  }
}
async function handle(request:Request){
  const path=new URL(request.url).pathname,current=context();
  if(path==="/auth/callback")current.authOnly=true;
  if(path.startsWith("/api/google/") || path==="/api/sync")current.syncMetadata=true;
  if(path==="/api/health")return json({ok:true,runtime:"native-worker",storage:"d1-records"});
  if(path==="/internal/import-week")return importWeek(request);
  if(path==="/api/troubleshoot")current.authOnly=true;
  if(path==="/api/demo")return json({error:"Koristite izbor zaposlenog.",},403);
  const internalSync=path==="/api/sync" && secretEqual(request.headers.get("authorization")?.replace(/^Bearer /,"")??null,current.env.CRON_SECRET);
  if(path.startsWith("/api/") && !internalSync && path!=="/api/sync/webhook" && path!=="/api/troubleshoot")current.session=await overrideSession() ?? await googleSession();
  if(path==="/api/state" && request.method==="GET")return stateResponse(request);
  if(path==="/api/command" && request.method==="POST")return commandResponse(request);
  if(path==="/api/sync" && request.method==="POST")return synchronize(request);
  if(path==="/api/sync/reset")current.fullHistory=true;
  const route=routes[path];
  if(route){const handler=route[request.method];return handler?handler(request):json({error:"Metoda nije dozvoljena."},405);}
  return current.env.ASSETS.fetch(request);
}
export default {
  async fetch(request:Request,env:Env){
    return scope.run({request,env,responseCookies:[]},async()=>{
      let response:Response;
      try{response=await handle(request);}catch(error){response=failure(error);}
      const headers=new Headers(response.headers);
      headers.set("X-App-Runtime","native-worker");
      for(const cookie of context().responseCookies)headers.append("Set-Cookie",cookie);
      headers.set("X-Content-Type-Options","nosniff");if(!headers.has("Referrer-Policy"))headers.set("Referrer-Policy","same-origin");headers.set("X-Frame-Options","DENY");
      return new Response(response.body,{status:response.status,headers});
    });
  },
  scheduled(_event:unknown,env:Env,ctx:{waitUntil(p:Promise<unknown>):void}){
    ctx.waitUntil(env.WORKER_SELF_REFERENCE.fetch(new Request(new URL("/api/sync?automatic=1",env.APP_URL),{method:"POST",headers:{Authorization:"Bearer "+env.CRON_SECRET}})).then(async response=>{await response.text();if(!response.ok)throw new Error("Automatski uvoz: "+response.status);}));
  },
};
