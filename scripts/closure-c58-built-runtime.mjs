import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
const repo='C:/projects/kezek',run=repo+'/docs/verification/runs/2026-10-20-s1-continuation',dest=repo+'/test-results/closure-s1-20261021-c57-localfonts/build',cwd=dest+'/apps/web';
const ledger=JSON.parse(fs.readFileSync(repo+'/docs/WEB_VERIFICATION_LEDGER.json')),paths=JSON.parse(fs.readFileSync(repo+'/'+ledger.candidate.sourceBoundary.pathsFile)),sha=b=>createHash('sha256').update(b).digest('hex');
// Next updates its generated next-env declaration from dev/types to types.
// Accept only this exact compiler-generated delta; never edit the original source.
const generated='apps/web/next-env.d.ts';
const originalEnv=fs.readFileSync(path.join(repo,generated),'utf8');
const builtEnv=fs.readFileSync(path.join(dest,generated),'utf8');
if(builtEnv!==originalEnv.replace('./.next/dev/types/routes.d.ts','./.next/types/routes.d.ts'))throw Error('Unexpected generated Next declaration');
const builtFingerprint=sha(JSON.stringify(paths.map(f=>[f,sha(fs.readFileSync(path.join(f===generated?repo:dest,f)))])));
if(builtFingerprint!==ledger.candidate.sourceFingerprint)throw Error('Built source differs outside exact generated declaration');
const buildRaw=fs.readFileSync(run+'/c57-build-raw.txt','utf8'),last=JSON.parse(buildRaw.trim().split(/\r?\n/).at(-1));
if(last.exitCode!==0||last.timedOut||!fs.existsSync(cwd+'/.next/BUILD_ID'))throw Error('Requires exact completed standardbuild');
const env={},allow=new Set(['systemroot','windir','comspec','path','pathext','temp','tmp','processor_architecture','number_of_processors']);
for(const[k,v]of Object.entries(process.env))if(allow.has(k.toLowerCase()))env[k]=v;
Object.assign(env,{NODE_ENV:'production',CI:'1',NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:'--require='+repo+'/scripts/closure-s1-offline-guard-c57-20261021.cjs',NEXT_PUBLIC_SUPABASE_URL:'https://closure-s1.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'not-a-real-credential',NEXT_PUBLIC_SITE_URL:'http://127.0.0.1:3107',SUPABASE_SERVICE_ROLE_KEY:'',SENTRY_AUTH_TOKEN:'',SENTRY_ORG:'',SENTRY_PROJECT:'',NEXT_PUBLIC_SENTRY_DSN:'',SENTRY_DSN:''});
const log=run+'/c58-runtime-raw.txt';if(fs.existsSync(log))throw Error('Do not overwrite runtime evidence');
const child=spawn(process.execPath,[path.join(cwd,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3107'],{cwd,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
const start={event:'spawned',utc:new Date().toISOString(),pid:child.pid,candidate:ledger.candidate.id,host:'127.0.0.1',port:3107,watchdogMs:900000,noEnvFiles:true,dummyBackend:true,compilerGeneratedDelta:{file:generated,before:sha(originalEnv),after:sha(builtEnv),onlyChange:'dev/types/routes.d.ts -> types/routes.d.ts'}};
fs.writeFileSync(log,JSON.stringify(start)+'\n',{flag:'wx'});console.log(JSON.stringify(start));
for(const stream of[child.stdout,child.stderr])stream.on('data',b=>{process.stdout.write(b);fs.appendFileSync(log,b);});
const timer=setTimeout(()=>{if(child.pid)spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});},900000);
child.on('close',(exitCode,signal)=>{clearTimeout(timer);const result={event:'finished',utc:new Date().toISOString(),pid:child.pid,exitCode,signal};fs.appendFileSync(log,JSON.stringify(result)+'\n');console.log(JSON.stringify(result));});
