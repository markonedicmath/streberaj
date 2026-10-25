// One-time cutover. The old chunks and an additional local snapshot are retained.
import {spawnSync} from "node:child_process";
import {mkdirSync,writeFileSync} from "node:fs";
function query(sql){
  const result=spawnSync(process.execPath,["node_modules/wrangler/bin/wrangler.js","d1","execute","streberaj-db","--remote","--json","--command",sql],{encoding:"utf8",maxBuffer:32*1024*1024});
  if(result.status!==0)throw new Error(result.stderr||"D1 zahtev nije uspeo.");
  return JSON.parse(result.stdout)[0].results;
}
if(query("SELECT revision FROM app_meta WHERE id=1").length)throw new Error("Nova baza već sadrži podatke; prenos nije ponovljen.");
query("CREATE TRIGGER IF NOT EXISTS school_legacy_frozen BEFORE UPDATE ON school_meta BEGIN SELECT RAISE(ABORT,'Kratka pauza za prenos baze. Osvežite aplikaciju.'); END");
const rows=query("SELECT m.revision,c.data FROM school_meta m JOIN school_chunks c ON c.revision=m.revision WHERE m.id=1 ORDER BY c.part");
if(!rows.length)throw new Error("Nema podataka u prethodnoj bazi.");
const state=JSON.parse(rows.map(row=>row.data).join(""));state.revision=rows[0].revision;
mkdirSync(".data/backups",{recursive:true});
writeFileSync(`.data/backups/native-cutover-${Date.now()}.json`,JSON.stringify(state),{mode:0o600});
const q=value=>"'"+String(value).replaceAll("'","''")+"'",sql=[];
for(const [name,value] of Object.entries(state)){
  if(name==="revision"||value===undefined)continue;
  const array=Array.isArray(value),list=array?value:[value];
  for(let position=0;position<list.length;position++){
    const item=list[position],collection=array?name:"$",id=array?(name==="operations"?item.actorId+":"+item.key:item.id):name;
    if(typeof id!=="string")throw new Error("Zapis nema identifikator: "+name);
    const data=JSON.stringify(item),actor=item?.actorId?q(item.actorId):"NULL",undone=typeof item?.undone==="boolean"?Number(item.undone):"NULL";
    let start=0,part=0;
    while(start<data.length){
      let end=Math.min(start+16000,data.length);
      const code=data.charCodeAt(end-1);if(end<data.length&&code>=0xd800&&code<=0xdbff)end--;
      const chunk=q(data.slice(start,end));
      if(!part)sql.push(`INSERT INTO school_records(collection,id,position,data,updated_revision,actor_id,undone) VALUES(${q(collection)},${q(id)},${position},${chunk},${state.revision},${actor},${undone});`);
      else sql.push(`UPDATE school_records SET data=data||${chunk} WHERE collection=${q(collection)} AND id=${q(id)};`);
      start=end;part++;
    }
  }
}
sql.push(`INSERT INTO app_meta VALUES(1,${state.revision},'native-cutover');`);
writeFileSync(".data/native-cutover.sql",sql.join("\n"),{mode:0o600});
const result=spawnSync(process.execPath,["node_modules/wrangler/bin/wrangler.js","d1","execute","streberaj-db","--remote","--file",".data/native-cutover.sql"],{encoding:"utf8",maxBuffer:4*1024*1024});
if(result.status!==0){
  query("DROP TRIGGER IF EXISTS school_legacy_frozen");
  throw new Error(result.stderr||"Prenos nije uspeo; stara baza ostaje aktivna.");
}
const summary={revision:state.revision,employees:state.employees.length,students:state.students.length,lessons:state.lessons.length,payments:state.payments.length,handovers:state.handovers.length,records:query("SELECT COUNT(*) count FROM school_records")[0].count};
writeFileSync(".data/native-cutover-summary.json",JSON.stringify(summary,null,2));
console.log("Sačuvani podaci i istorija preneti bez menjanja identifikatora:",summary);
