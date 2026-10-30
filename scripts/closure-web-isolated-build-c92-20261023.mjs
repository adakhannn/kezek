import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

const repo='C:/projects/kezek',run=repo+'/docs/verification/runs/2026-10-23-web-resume-2';
const parent=path.resolve(repo,'test-results/closure-web-20261023-c92-b876ccbde0a8'),dest=path.resolve(parent,'build');
const logFile=run+'/c92-build-raw.txt';
if(path.dirname(dest)!==parent||fs.existsSync(dest)||fs.existsSync(logFile))throw Error('Requires new exact C92 directory/log; no retry/overwrite');
const ledger=JSON.parse(fs.readFileSync(repo+'/docs/WEB_VERIFICATION_LEDGER.json'));
if(ledger.candidate.id!=='dev-20261023-WEB-b876ccbde0a8')throw Error('Wrong current candidate');
const sha=b=>createHash('sha256').update(b).digest('hex');
const paths=JSON.parse(fs.readFileSync(repo+'/'+ledger.candidate.sourceBoundary.pathsFile));
const expected='b876ccbde0a87655431e32b2f6677b45b40c51376f0d3833f0434dafc4eab29a';
if(paths.length!==1684||sha(JSON.stringify(paths.map(f=>[f,sha(fs.readFileSync(repo+'/'+f))])))!==expected)throw Error('Source changed before copy');
const selection=['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','apps/web/package.json','apps/web/pnpm-lock.yaml','apps/web/tsconfig.json','apps/web/next.config.ts','apps/web/postcss.config.mjs','apps/web/next-env.d.ts','apps/web/src','apps/web/public','packages/core-domain/package.json','packages/core-domain/tsconfig.json','packages/core-domain/src','packages/shared-client/package.json','packages/shared-client/tsconfig.json','packages/shared-client/src'];
const entries=[];
function copy(relative){
 const source=path.join(repo,relative),target=path.join(dest,relative),stat=fs.lstatSync(source),name=path.basename(relative);
 if(stat.isSymbolicLink()||name.startsWith('.env')||['.git','.next','node_modules','test-results'].includes(name))throw Error('Excluded copy path: '+relative);
 if(stat.isDirectory()){fs.mkdirSync(target,{recursive:true});for(const child of fs.readdirSync(source).sort())copy(path.join(relative,child));}
 else if(stat.isFile()){fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);entries.push([relative.replaceAll('\\','/'),sha(fs.readFileSync(target))]);}
 else throw Error('Unsupported source path');
}
for(const f of selection)copy(f);
const copied=new Map(entries),fingerprint=sha(JSON.stringify(paths.map(f=>[f,copied.get(f)])));
if(entries.length!==1684||paths.some(f=>!copied.has(f))||fingerprint!==expected)throw Error('Exact copy differs');
for(const f of ['node_modules','apps/web/node_modules','packages/core-domain/node_modules','packages/shared-client/node_modules']){
 if(fs.existsSync(path.join(repo,f)))fs.symlinkSync(path.join(repo,f),path.join(dest,f),'junction');
}
const env={},allow=new Set(['systemroot','windir','comspec','path','pathext','temp','tmp','processor_architecture','number_of_processors']);
for(const[k,v]of Object.entries(process.env))if(allow.has(k.toLowerCase()))env[k]=v;
Object.assign(env,{NODE_ENV:'production',CI:'1',NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:'--max-old-space-size=2048 --require='+repo+'/scripts/closure-web-offline-guard-c92-20261023.cjs',NEXT_PUBLIC_SUPABASE_URL:'https://closure-c92.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'not-a-real-credential',NEXT_PUBLIC_SITE_URL:'https://closure-c92.invalid',SUPABASE_SERVICE_ROLE_KEY:'',SENTRY_AUTH_TOKEN:'',SENTRY_ORG:'',SENTRY_PROJECT:'',NEXT_PUBLIC_SENTRY_DSN:'',SENTRY_DSN:''});
const cwd=path.join(dest,'apps/web'),startedUtc=new Date().toISOString();
const prepared={event:'prepared',startedUtc,dest,copiedFiles:entries.length,copyFingerprint:fingerprint,noEnvFiles:true,coldNextCache:true,defaultCompiler:true,dummyBackend:true,limitation:'Node TCP/fetch restriction except exact PostCSS IPC; not OS firewall or LIVE/deployed-production PASS'};
fs.writeFileSync(logFile,JSON.stringify(prepared)+'\n',{flag:'wx'});console.log(JSON.stringify(prepared));
const child=spawn(process.execPath,[path.join(cwd,'node_modules/next/dist/bin/next'),'build'],{cwd,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
const started={event:'spawned',pid:child.pid,utc:new Date().toISOString()};fs.appendFileSync(logFile,JSON.stringify(started)+'\n');console.log(JSON.stringify(started));
for(const stream of[child.stdout,child.stderr])stream.on('data',b=>{process.stdout.write(b);fs.appendFileSync(logFile,b);});
let timedOut=false;
const stopOwned=()=>{if(child.pid)spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});};
const timer=setTimeout(()=>{timedOut=true;stopOwned();},240000);
process.once('SIGINT',stopOwned);process.once('SIGTERM',stopOwned);
child.on('error',e=>{const event={event:'spawn-error',message:String(e),utc:new Date().toISOString()};console.error(JSON.stringify(event));fs.appendFileSync(logFile,JSON.stringify(event)+'\n');});
child.on('close',(exitCode,signal)=>{clearTimeout(timer);const result={event:'finished',startedUtc,finishedUtc:new Date().toISOString(),exitCode,signal,timedOut,pid:child.pid,dest};fs.appendFileSync(logFile,JSON.stringify(result)+'\n');console.log(JSON.stringify(result));process.exitCode=exitCode===0&&!timedOut?0:1;});
