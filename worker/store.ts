import { context,profile } from "./context";
import { DomainError } from "../src/lib/domain";
import { emptyState } from "../src/lib/seed";
import type { SchoolState } from "../src/lib/types";
export const isDemo = () => false;
export const configured = () => false;
export const dataDirectory = () => "/unavailable";
export function service(): any { throw new DomainError("Ova aplikacija koristi Cloudflare D1.",503); }
interface Row { collection:string; id:string; position:number; data:string; revision:number; value?:any }
interface Snapshot { state: SchoolState; rows: Map<string,Row> }
const cached = new Map<string,Snapshot>();
const key = (collection:string,id:string) => collection+"\0"+id;
const mutable = ["employees","students","lessons","rules","payments","handovers","attachments","counters","sourceBlocks","messages","sync","googleConnection"] as const;
export function mutableCopy(state: SchoolState): SchoolState {
  const draft = { ...state, audits:[...state.audits], undoEntries:[...(state.undoEntries??[])], operations:[...(state.operations??[])] };
  for (const collection of mutable) if (state[collection] !== undefined) (draft as any)[collection] = structuredClone(state[collection]);
  return draft;
}
export async function readState(): Promise<SchoolState> {
  const current = context(), db = current.env.DB;
  if(current.syncMetadata || current.authOnly){
    const selection=current.authOnly?"r.collection='employees'":"(r.collection='employees' OR (r.collection='$' AND r.id IN ('sync','googleConnection','googleSyncLease')))";
    const result=await db.prepare(`SELECT r.collection,r.id,r.position,r.data,m.revision FROM school_records r CROSS JOIN app_meta m WHERE m.id=1 AND ${selection}`).all();
    if(!result.results.length)throw new DomainError("Baza nije pripremljena.",503);
    const state={...emptyState(),undoEntries:[],messages:[],operations:[]} as SchoolState;
    const rows=new Map<string,Row>();
    for(const row of result.results){
      const value=JSON.parse(row.data);
      rows.set(key(row.collection,row.id),{...row,value});
      if(row.collection==="$")(state as any)[row.id]=value;
      else ((state as any)[row.collection]??=[]).push(value);
    }
    state.revision=result.results[0].revision;
    current.snapshot={state,rows};
    return state;
  }
  const meta = await db.prepare("SELECT revision FROM app_meta WHERE id=1").first();
  if (!meta) throw new DomainError("Baza nije pripremljena.",503);
  const actor = current.session?.actorId ?? "";
  const pathname=new URL(current.request.url).pathname;
  const writing = pathname === "/api/command";
  const syncing=!current.fullHistory && (pathname==="/api/sync" || pathname.startsWith("/internal/") || pathname==="/api/sync/webhook");
  const viewing=pathname==="/api/state";
  const cacheKey = `${actor}:${writing}:${!!current.fullHistory}:${!!current.authOnly}:${syncing}:${viewing}:${!!current.syncMetadata}:${current.writeScope??"all"}`;
  let snapshot = cached.get(cacheKey);
  if (!snapshot || snapshot.state.revision !== meta.revision) {
    const auditData = current.fullHistory ? "r.data" : `CASE WHEN r.collection='audits' THEN json_set(json_remove(r.data,'$.before','$.after'),'$.before',json(CASE WHEN json_type(r.data,'$.before')='null' THEN 'null' ELSE '{}' END)) ELSE r.data END`;
    const previousRevision=snapshot?.state.revision??-1;
    const undoFilter = current.fullHistory ? "1" : writing
      ? `(r.actor_id=? AND (r.undone=1 OR r.position=(SELECT MAX(position) FROM school_records WHERE collection='undoEntries' AND actor_id=? AND undone=0)))`
      : `r.id IN (SELECT id FROM school_records WHERE collection='undoEntries' AND actor_id=? AND undone=0 ORDER BY position DESC LIMIT 1) OR r.id IN (SELECT id FROM school_records WHERE collection='undoEntries' AND actor_id=? AND undone=1 AND json_extract(data,'$.redoable')=1 ORDER BY position LIMIT 1)`;
    const grouped=!snapshot;
    const columns=grouped?`r.collection,json_group_array(json_array(r.id,r.position,json(${auditData}))) bundle,m.revision`:`r.collection,r.id,r.position,${auditData} data,m.revision`;
    const writeFilter=current.writeScope ? `AND r.collection IN ('$','employees','undoEntries'${current.writeScope==="messages"?",'messages'":""})` : "";
    const sql = `SELECT ${columns} FROM school_records r CROSS JOIN app_meta m WHERE m.id=1 AND (r.updated_revision>? OR r.collection='undoEntries') ${writeFilter} ${current.authOnly ? "AND r.collection='employees'" : ""} ${current.syncMetadata ? "AND r.collection='$' AND r.id IN ('sync','googleConnection','googleSyncLease')" : ""} ${syncing || writing ? "AND r.collection<>'audits'" : ""} AND r.collection<>'operations' ${current.fullHistory ? "" : "AND NOT(r.collection='$' AND r.id='boardResetBackup')"} AND (r.collection<>'undoEntries' OR (${undoFilter})) ${grouped?"GROUP BY r.collection":"ORDER BY r.collection,r.position"}`;
    let statement = db.prepare(sql);
    statement = current.fullHistory?statement.bind(previousRevision):statement.bind(previousRevision,actor,actor);
    const [result,removed,currentMeta] = await db.batch([statement,db.prepare("SELECT collection,id FROM school_archive WHERE revision>?").bind(snapshot?previousRevision:meta.revision),db.prepare("SELECT revision FROM app_meta WHERE id=1")]);
    if (!snapshot && !result.results.length) throw new DomainError("Baza ne sadrži podatke škole.",503);
    const hydrateStarted=performance.now();
    const state = { ...emptyState(), undoEntries:[], messages:[], operations:[] } as SchoolState;
    const rows = new Map<string,Row>(snapshot?.rows);
    for(const row of removed.results)rows.delete(key(row.collection,row.id));
    const incoming:Row[]=grouped?result.results.flatMap((group:any)=>JSON.parse(group.bundle).map(([id,position,value]:any[])=>({collection:group.collection,id,position,value,revision:group.revision}))):result.results;
    for (const row of incoming) {
      const value = grouped?row.value:JSON.parse(row.data);
      rows.set(key(row.collection,row.id),{...row,data:viewing?"":JSON.stringify(value),value});
    }
    for(const row of [...rows.values()].sort((a,b)=>a.position-b.position)){
      const value=row.value;
      if (row.collection==="$") (state as any)[row.id]=value;
      else ((state as any)[row.collection] ??= []).push(value);
    }
    state.revision = currentMeta.results[0].revision;
    snapshot = {state,rows};
    if(cached.size>24) cached.clear();
    cached.set(cacheKey,snapshot);
    profile("hydrate",hydrateStarted,{rows:result.results.length});
  }
  current.snapshot=snapshot;
  let operations: SchoolState["operations"] = [];
  const operationKey=current.request.headers.get("idempotency-key");
  if(writing && operationKey && actor){
    const row=await db.prepare("SELECT data FROM school_records WHERE collection='operations' AND id=?").bind(actor+":"+operationKey).first();
    if(row) operations=[JSON.parse(row.data)];
  }
  return {...snapshot.state,operations};
}
export async function compareAndSwap(state: SchoolState, expected:number) {
  const serializeStarted=performance.now();
  const current=context(), snapshot=current.snapshot as Snapshot;
  if(!snapshot || snapshot.state.revision!==expected) return false;
  const db=current.env.DB, revision=expected+1, token=crypto.randomUUID();
  const guard="EXISTS(SELECT 1 FROM app_meta WHERE id=1 AND write_token=?)";
  const statements=[db.prepare("UPDATE app_meta SET revision=?,write_token=? WHERE id=1 AND revision=?").bind(revision,token,expected)];
  const seen=new Set<string>();
  const changes:any[][]=[],removed:string[][]=[];
  for(const [collection,value] of Object.entries(state)){
    if(collection==="revision" || value===undefined) continue;
    const list=Array.isArray(value)?value:[value];
    for(let index=0;index<list.length;index++){
      const item=list[index], group=Array.isArray(value)?collection:"$";
      const id=group==="$"?collection:collection==="operations"?item.actorId+":"+item.key:item.id;
      const recordKey=key(group,id), old=snapshot.rows.get(recordKey), data=JSON.stringify(item);
      seen.add(recordKey);
      const partial=collection==="undoEntries" || collection==="operations" || collection==="audits";
      const position=partial?(old?.position ?? revision*1000+index):index;
      if(old?.data===data && old.position===position) continue;
      changes.push([group,id,position,data,revision,item?.actorId??null,typeof item?.undone==="boolean"?Number(item.undone):null]);
    }
  }
  for(const [recordKey,row] of snapshot.rows) if(!seen.has(recordKey)){
    removed.push([row.collection,row.id]);
  }
  if(changes.length)statements.push(db.prepare(`INSERT INTO school_records(collection,id,position,data,updated_revision,actor_id,undone) SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]'),json_extract(value,'$[2]'),json_extract(value,'$[3]'),json_extract(value,'$[4]'),json_extract(value,'$[5]'),json_extract(value,'$[6]') FROM json_each(?) WHERE ${guard} ON CONFLICT(collection,id) DO UPDATE SET position=excluded.position,data=excluded.data,updated_revision=excluded.updated_revision,actor_id=excluded.actor_id,undone=excluded.undone`).bind(JSON.stringify(changes),token));
  if(removed.length){
    const selection=`(collection,id) IN (SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]') FROM json_each(?)) AND ${guard}`;
    const ids=JSON.stringify(removed);
    statements.push(db.prepare(`INSERT OR IGNORE INTO school_archive(revision,collection,id,data) SELECT ?,collection,id,data FROM school_records WHERE ${selection}`).bind(revision,ids,token));
    statements.push(db.prepare(`DELETE FROM school_records WHERE ${selection}`).bind(ids,token));
  }
  profile("record-diff",serializeStarted,{changed:changes.length,removed:removed.length});
  const results=await db.batch(statements);
  const saved=results[0].meta.changes===1;
  if(saved)current.snapshot=undefined;
  return saved;
}
export async function transact<T>(fn:(state:SchoolState)=>T,initial?:SchoolState): Promise<{state:SchoolState;result:T}>{
  for(let attempt=0;attempt<8;attempt++){
    const state=attempt===0 && initial?initial:await readState(), draft=mutableCopy(state), result=fn(draft);
    if(await compareAndSwap(draft,state.revision))return {state:{...draft,revision:state.revision+1},result};
  }
  throw new DomainError("Drugi korisnik upravo menja evidenciju. Pokušajte ponovo.",409);
}
