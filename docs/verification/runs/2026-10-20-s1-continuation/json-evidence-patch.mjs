// Preserve existing JSON formatting and unrelated fields; emit, do not write.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
const root='C:/projects/kezek';
const ts=createRequire(path.join(root,'apps/web/package.json'))('typescript');
export function updateJson(file,value,context=3,anchored=false){
 const original=fs.readFileSync(path.join(root,file),'utf8'),before=JSON.parse(original),tree=ts.parseJsonText(file,original),edits=[];
 const indentAt=start=>original.slice(original.lastIndexOf('\n',start-1)+1,start).match(/^\s*/)[0].length;
 function visit(node,a,b){
  if(JSON.stringify(a)===JSON.stringify(b))return;
  if(ts.isObjectLiteralExpression(node)&&Object.keys(a).join('|')===Object.keys(b).join('|')){for(const p of node.properties)visit(p.initializer,a[p.name.text],b[p.name.text]);return;}
  if(ts.isArrayLiteralExpression(node)&&Array.isArray(b)){
   if(a.length===b.length){node.elements.forEach((p,i)=>visit(p,a[i],b[i]));return;}
   if(b.length>a.length&&a.every((v,i)=>JSON.stringify(v)===JSON.stringify(b[i]))){
    const start=a.length?node.elements.at(-1).end:node.getStart(tree)+1,end=node.end-1,indent=indentAt(node.getStart(tree));
    if(original.slice(start,end).trim())throw Error('Unexpected array suffix');
    const child=' '.repeat(indent+2),items=b.slice(a.length).map(v=>child+JSON.stringify(v,null,2).replace(/\n/g,'\n'+child));
    edits.push({start,end,text:(a.length?',':'')+'\n'+items.join(',\n')+'\n'+' '.repeat(indent)});return;
   }
  }
  const start=node.getStart(tree),indent=indentAt(start);edits.push({start,end:node.end,text:JSON.stringify(b,null,2).replace(/\n/g,'\n'+' '.repeat(indent))});
 }
 visit(tree.statements[0].expression,before,value);let after=original;
 for(const e of edits.sort((a,b)=>b.start-a.start))after=after.slice(0,e.start)+e.text+after.slice(e.end);
 if(JSON.stringify(JSON.parse(after))!==JSON.stringify(value))throw Error('JSON patch model mismatch');
 if(after===original)return '';
 const r=spawnSync('git',['-c','core.safecrlf=false','diff','--no-index','--no-ext-diff',`--unified=${context}`,'--',file,'-'],{cwd:root,input:after,encoding:'utf8',windowsHide:true,maxBuffer:12e6});
 if(r.status!==1)throw Error(r.stderr||'Diff failed');
 const lines=r.stdout.split('\n'),sourceLines=original.split('\n');let previousEnd=0;
 return '*** Update File: '+root+'/'+file+'\n'+lines.slice(lines.findIndex(l=>l.startsWith('@@'))).filter(l=>!l.startsWith('\\ No newline')).map(l=>{
  if(!l.startsWith('@@'))return l;
  if(anchored){const m=l.match(/^@@ -(\d+)(?:,(\d+))?/),start=Number(m?.[1])-1,priorEnd=previousEnd;previousEnd=start+Number(m?.[2]??1);for(let i=start-1;i>=priorEnd;i--)if(/^\s*"id"\s*:/.test(sourceLines[i]))return '@@ '+sourceLines[i].trim();}
  return '@@';
 }).join('\n').trimEnd()+'\n';
}
