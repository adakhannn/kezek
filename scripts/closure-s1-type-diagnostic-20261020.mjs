// One bounded cold TypeScript diagnostic on already copied C04 source; no compile retry or network.
import path from 'node:path';
import { spawn } from 'node:child_process';
if (Date.now() >= Date.parse('2026-10-20T12:15:00Z')) throw Error('Scenario window expired');
const cwd = 'C:/projects/kezek/test-results/closure-s1-20261020-f003-fontread-v2/build/apps/web';
const env = {};
for (const [key,value] of Object.entries(process.env)) if (['systemroot','windir','comspec','path','pathext','temp','tmp','processor_architecture','number_of_processors'].includes(key.toLowerCase())) env[key] = value;
env.NODE_OPTIONS = '--max-old-space-size=2048 --require=C:/projects/kezek/scripts/closure-s1-build-network.cjs';
const startedUtc = new Date().toISOString();
const child = spawn(process.execPath,[path.join(cwd,'node_modules/typescript/bin/tsc'),'-p','tsconfig.json','--noEmit','--incremental','false','--extendedDiagnostics'],{cwd,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
console.log(JSON.stringify({event:'cold-types-start',startedUtc,pid:child.pid,reason:'C04 compilation succeeded but fresh build type-check stage timed out; distinguish cold checker from build-only stall',noNetworkOrCredentials:true}));
child.stdout.on('data',bytes=>process.stdout.write(bytes));
child.stderr.on('data',bytes=>process.stderr.write(bytes));
let timedOut=false;
const timer=setTimeout(()=>{timedOut=true;spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});},90000);
child.on('close',(exitCode,signal)=>{clearTimeout(timer);console.log(JSON.stringify({event:'cold-types-finished',startedUtc,finishedUtc:new Date().toISOString(),exitCode,signal,timedOut,pid:child.pid}));process.exitCode=exitCode===0&&!timedOut?0:1;});
