import { build } from "esbuild";
import path from "node:path";
const root=process.cwd();
await build({ entryPoints:["worker/index.ts"],outfile:".worker/worker.mjs",bundle:true,format:"esm",platform:"node",target:"es2022",minify:true,
  external:["node:*"],define:{"process.env.NODE_ENV":'"production"',"process.env.MANOJLO_AUTH":'"google"'},
  plugins:[{name:"native-runtime",setup(build){
    build.onResolve({filter:/.*/},args=>{
      if(args.path==="server-only")return {path:args.path,namespace:"empty"};
      if(args.path==="next/headers")return {path:path.join(root,"worker/cookies.ts")};
      const resolved=args.path.startsWith("@/")?path.join(root,"src",args.path.slice(2)):args.path.startsWith(".")?path.resolve(args.resolveDir,args.path):"";
      if(resolved===path.join(root,"src/lib/store")||resolved===path.join(root,"src/lib/store.ts"))return {path:path.join(root,"worker/store.ts")};
      if(resolved===path.join(root,"src/lib/auth")||resolved===path.join(root,"src/lib/auth.ts"))return {path:path.join(root,"worker/auth.ts")};
    });
    build.onLoad({filter:/.*/,namespace:"empty"},()=>({contents:""}));
  }}],logLevel:"info" });
