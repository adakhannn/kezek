import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),mod=require('../apps/web/node_modules/next/dist/compiled/@next/font/dist/fontkit').default,fontFromBuffer=mod.default||mod;
const dir='C:/projects/kezek/test-results/closure-c57-font-source';
const results=[];
for(const file of ['Geist.ttf','GeistMono.ttf','C54-Geist-latin.woff2','C54-GeistMono-latin.woff2']){
 const bytes=fs.readFileSync(path.join(dir,file)),font=fontFromBuffer(bytes);
 results.push({file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),gitBlobSha:createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex'),family:font.familyName,subfamily:font.subfamilyName,version:font.version,axes:font.variationAxes,unitsPerEm:font.unitsPerEm,ascent:font.ascent,descent:font.descent,lineGap:font.lineGap,
 missingRuKy:[...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюяӨөҮүҢң'].filter(c=>!font.hasGlyphForCodePoint(c.codePointAt(0))),
 latinAdvances:[...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'].map(c=>font.glyphForCodePoint(c.codePointAt(0)).advanceWidth)});
}
const comparisons=[[0,2],[1,3]].map(([a,b])=>({family:results[a].family,sameVersion:results[a].version===results[b].version,sameLatinAdvances:JSON.stringify(results[a].latinAdvances)===JSON.stringify(results[b].latinAdvances),sameVerticalMetrics:['unitsPerEm','ascent','descent','lineGap'].every(k=>results[a][k]===results[b][k])}));
const result={utc:new Date().toISOString(),results,comparisons};
fs.writeFileSync(path.join(dir,'inspection.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result,null,2));
