import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiRouteRecords } from './generate-api-catalog.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const definitions=JSON.parse(fs.readFileSync(path.join(root,'apps/web/src/config/cronJobs.json'),'utf8'));
const routes=apiRouteRecords();
const paths=new Set();
for(const job of definitions){
    if(paths.has(job.path)||!routes.some(route=>route.route===job.path&&route.methods.includes('GET')))
        throw new Error(`Duplicate or missing GET cron route: ${job.path}`);
    paths.add(job.path);
}
const crons=definitions.map(({path,schedule})=>({path,schedule}));
for(const filename of ['vercel.json','apps/web/vercel.json']){
    const file=path.join(root,filename);
    const existing=JSON.parse(fs.readFileSync(file,'utf8'));
    if(process.argv.includes('--write')){
        fs.writeFileSync(file,JSON.stringify({...existing,crons},null,2)+'\n');
        console.log(`Updated ${filename}`);
    }else if(JSON.stringify(existing.crons)!==JSON.stringify(crons)){
        console.error(`Cron schedule drift in ${filename}; run node scripts/generate-cron-manifests.mjs --write`);
        process.exitCode=1;
    }
}
if(!process.exitCode) console.log(`Cron manifests match ${definitions.length} declared GET jobs.`);
