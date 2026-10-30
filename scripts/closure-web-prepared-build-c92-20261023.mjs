// Continue the verified C92 source snapshot; no recopy/delete/old compiler retry.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
const repo='C:/projects/kezek',run=repo+'/docs/verification/runs/2026-10-23-web-resume-2',dest=repo+'/test-results/closure-web-20261023-c92-b876ccbde0a8/build',cwd=dest+'/apps/web',log=run+'/c92-build-raw.txt';
if(process.argv[2]!=='--complete-dependencies-and-build')throw Error('Explicit continuation flag required');
if(fs.existsSync(log)||fs.existsSync(cwd+'/.next'))throw Error('Compiler/cache/log already exists; no retry');
const ledger=JSON.parse(fs.readFileSync(repo+'/docs/WEB_VERIFICATION_LEDGER.json')),paths=JSON.parse(fs.readFileSync(repo+'/'+ledger.candidate.sourceBoundary.pathsFile)),sha=b=>createHash('sha256').update(b).digest('hex'),expected='b876ccbde0a87655431e32b2f6677b45b40c51376f0d3833f0434dafc4eab29a';
if(ledger.candidate.id!=='dev-20261023-WEB-b876ccbde0a8'||paths.length!==1684||[repo,dest].some(root=>sha(JSON.stringify(paths.map(f=>[f,sha(fs.readFileSync(root+'/'+f))])))!==expected))throw Error('Prepared/current snapshot changed');
if(path.resolve(fs.realpathSync(dest)).toLowerCase()!==path.resolve(dest).toLowerCase())throw Error('Prepared root is not exact local directory');
for(const relative of ['node_modules','apps/web/node_modules','packages/core-domain/node_modules','packages/shared-client/node_modules']){
 const source=path.resolve(repo,relative),target=path.resolve(dest,relative);
 if(!source.startsWith(path.resolve(repo)+path.sep)||!target.startsWith(path.resolve(dest)+path.sep))throw Error('Junction outside exact roots');
 if(!fs.existsSync(source))continue;
 if(fs.existsSync(target)){
  if(path.resolve(fs.realpathSync(target)).toLowerCase()!==path.resolve(fs.realpathSync(source)).toLowerCase())throw Error('Unexpected existing dependency target');
 }else fs.symlinkSync(source,target,'junction');
 if(path.resolve(fs.realpathSync(target)).toLowerCase()!==path.resolve(fs.realpathSync(source)).toLowerCase())throw Error('Junction verification failed');
}
const env={},allow=new Set(['systemroot','windir','comspec','path','pathext','temp','tmp','processor_architecture','number_of_processors']);
for(const[k,v]of Object.entries(process.env))if(allow.has(k.toLowerCase()))env[k]=v;
Object.assign(env,{NODE_ENV:'production',CI:'1',NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:'--max-old-space-size=2048 --require='+repo+'/scripts/closure-web-offline-guard-c92-20261023.cjs',NEXT_PUBLIC_SUPABASE_URL:'https://closure-c92.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'not-a-real-credential',NEXT_PUBLIC_SITE_URL:'https://closure-c92.invalid',SUPABASE_SERVICE_ROLE_KEY:'',SENTRY_AUTH_TOKEN:'',SENTRY_ORG:'',SENTRY_PROJECT:'',NEXT_PUBLIC_SENTRY_DSN:'',SENTRY_DSN:''});
const startedUtc=new Date().toISOString(),prepared={event:'prepared',startedUtc,dest,copiedFiles:paths.length,copyFingerprint:expected,noEnvFiles:true,coldNextCache:true,completedVerifiedPartialPreparation:true,mainServerUntouched:true,limitation:'Node TCP/fetch deny except exact PostCSS IPC, not OS firewall'};
fs.writeFileSync(log,JSON.stringify(prepared)+'\n',{flag:'wx'});console.log(JSON.stringify(prepared));
const child=spawn(process.execPath,[path.join(cwd,'node_modules/next/dist/bin/next'),'build'],{cwd,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
const start={event:'spawned',pid:child.pid,utc:new Date().toISOString()};fs.appendFileSync(log,JSON.stringify(start)+'\n');console.log(JSON.stringify(start));
for(const stream of[child.stdout,child.stderr])stream.on('data',b=>{process.stdout.write(b);fs.appendFileSync(log,b);});
let timedOut=false;const stopOwned=()=>{if(child.pid)spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});};
const timer=setTimeout(()=>{timedOut=true;stopOwned();},240000);process.once('SIGINT',stopOwned);process.once('SIGTERM',stopOwned);
child.on('error',e=>{const x={event:'spawn-error',message:String(e),utc:new Date().toISOString()};console.error(JSON.stringify(x));fs.appendFileSync(log,JSON.stringify(x)+'\n');});
child.on('close',(exitCode,signal)=>{clearTimeout(timer);const x={event:'finished',startedUtc,finishedUtc:new Date().toISOString(),exitCode,signal,timedOut,pid:child.pid,dest};fs.appendFileSync(log,JSON.stringify(x)+'\n');console.log(JSON.stringify(x));process.exitCode=exitCode===0&&!timedOut?0:1;});
