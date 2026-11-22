/* Story Spine shell: plan library, local HTML files, private GitHub sync. Also runs inside saved plan files ("file mode"). */
(function(){
"use strict";
const E=window.SpineEditor;
const FILE_MODE=document.body.dataset.mode==="file";
const APP_URL=FILE_MODE?(window.SPINE_APP_URL||""):location.href.split(/[?#]/)[0].replace(/index\.html$/,"");
const FONT_LINK='<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">';
const LOGO='<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#1a1e23"/><path d="M5 24C10 23 12 13 17 9C21 6 23 14 27 21" fill="none" stroke="#d9a54a" stroke-width="2.6" stroke-linecap="round"/><circle cx="5" cy="24" r="2.4" fill="#8d9cb6"/><circle cx="17" cy="9" r="2.4" fill="#e07a6c"/><circle cx="27" cy="21" r="2.4" fill="#5cbfb1"/></svg>';
const FS=typeof window.showOpenFilePicker==="function";
const $=s=>document.querySelector(s);
const esc=E.esc;

const LS={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}},
  del(k){try{localStorage.removeItem(k)}catch(e){}}};
function uid(){return "x"+Math.random().toString(36).slice(2,9)}
function slug(t){return String(t||"").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g,"").trim().replace(/[\s_]+/g,"-").replace(/-+/g,"-").slice(0,40)}
function rel(ts){if(!ts)return "never";const s=Math.round((Date.now()-ts)/1000);if(s<45)return "just now";if(s<3600)return Math.round(s/60)+" min ago";if(s<86400)return Math.round(s/3600)+" h ago";return new Date(ts).toLocaleDateString()}
function device(){const u=navigator.userAgent;return /Android/i.test(u)?"Android phone":/iPhone|iPad/i.test(u)?"iPhone/iPad":/Windows/i.test(u)?"Windows PC":/Mac/i.test(u)?"Mac":"another device"}
function sceneCount(st){let n=0;(st.blocks||[]).forEach(b=>(b.sequences||[]).forEach(q=>n+=(q.scenes||[]).length));return n}

/* ---------- toast / modal ---------- */
function toast(msg,action){const t=document.createElement("div");t.className="toast";t.setAttribute("role","status");
  const s=document.createElement("span");s.textContent=msg;t.appendChild(s);
  if(action){const b=document.createElement("button");b.textContent=action.label;b.onclick=()=>{t.remove();action.fn()};t.appendChild(b)}
  document.querySelectorAll(".toast").forEach(x=>x.remove());document.body.appendChild(t);setTimeout(()=>t.remove(),action?12000:3600)}
function showModal(html){const o=$("#overlay");o.innerHTML=`<div class="modal"><div class="modal-card" role="dialog" aria-modal="true">${html}</div></div>`;
  const first=o.querySelector("input,textarea,button");if(first)first.focus();return o.querySelector(".modal-card")}
function closeModal(){$("#overlay").innerHTML=""}
function arm(btn,fn){if(btn.dataset.armed){fn();return}
  btn.dataset.armed="1";const old=btn.innerHTML;btn.textContent=btn.dataset.confirm||"Confirm";
  setTimeout(()=>{if(btn.isConnected&&btn.dataset.armed){delete btn.dataset.armed;btn.innerHTML=old}},3500)}

/* ---------- plan files (interactive HTML) ---------- */
let assetCache=null;
async function assets(){
  if(assetCache)return assetCache;
  if(FILE_MODE)assetCache={css:$("#spine-css").textContent,editor:$("#spine-editor").textContent,shell:$("#spine-shell").textContent};
  else{const [css,editor,shell]=await Promise.all(["app.css","editor.js","shell.js"].map(u=>fetch(u).then(r=>{if(!r.ok)throw new Error("Couldn't load "+u);return r.text()})));assetCache={css,editor,shell}}
  return assetCache}
async function buildFile(state){
  const a=await assets();
  const json=JSON.stringify(state).replace(/</g,"\\u003c");
  return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,interactive-widget=resizes-content">\n<meta name="generator" content="Story Spine">\n'
    +'<title>'+esc((state.film.title||"Untitled plan")+" · Story Spine")+'</title>\n'+FONT_LINK+'\n<style id="spine-css">'+a.css+'</style>\n</head>\n<body data-mode="file">\n<div id="bar"></div><div id="root"></div><div id="overlay"></div>\n'
    +'<script type="application/json" id="doc-state">'+json+'<\/script>\n'
    +'<script>window.SPINE_APP_URL='+JSON.stringify(APP_URL).replace(/</g,"\\u003c")+';<\/script>\n'
    +'<script id="spine-editor">'+a.editor+'<\/script>\n<script id="spine-shell">'+a.shell+'<\/script>\n</body>\n</html>\n'}
function parsePlanText(text){
  text=String(text).replace(/^\uFEFF/,"").trim();
  if(text.startsWith("{"))return E.normalize(JSON.parse(text));
  const doc=new DOMParser().parseFromString(text,"text/html"),el=doc.getElementById("doc-state");
  if(!el)throw new Error("no plan");
  return E.normalize(JSON.parse(el.textContent))}
function fileNameFor(st){return (slug(st.film.title)||"story-spine-plan")+".html"}
function download(name,text){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type:"text/html"}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500)}

/* file handles live in IndexedDB so "Save" can rewrite the same file later */
const IDB={p:null,open(){if(!this.p)this.p=new Promise((res,rej)=>{const r=indexedDB.open("story-spine",1);r.onupgradeneeded=()=>r.result.createObjectStore("handles");r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});return this.p},
  async run(mode,fn){try{const db=await this.open();return await new Promise(res=>{const tx=db.transaction("handles",mode),st=tx.objectStore("handles"),rq=fn(st);tx.oncomplete=()=>res(rq&&rq.result);tx.onerror=()=>res(null)})}catch(e){return null}},
  get(k){return this.run("readonly",s=>s.get(k))},set(k,v){return this.run("readwrite",s=>s.put(v,k))},del(k){return this.run("readwrite",s=>s.delete(k))}};

async function saveFile(rec,asNew){
  let html;try{html=await buildFile(rec.state)}catch(e){toast(e.message);return false}
  const name=rec.fileName||fileNameFor(rec.state);
  if(FS){
    try{
      let h=asNew?null:await IDB.get(rec.id);
      if(h&&(await h.queryPermission({mode:"readwrite"}))!=="granted"&&(await h.requestPermission({mode:"readwrite"}))!=="granted")h=null;
      if(!h){h=await window.showSaveFilePicker({suggestedName:name,types:[{description:"Story Spine plan (HTML)",accept:{"text/html":[".html"]}}]});await IDB.set(rec.id,h)}
      const w=await h.createWritable();await w.write(html);await w.close();
      rec.fileName=h.name;rec.fileDirty=false;return true}
    catch(e){if(e&&e.name==="AbortError")return false;toast("Couldn't write the file: "+(e&&e.message||e));return false}}
  download(name,html);toast("Downloaded "+name+". Your browser can't overwrite files, so each save is a new download.");return "download"}

/* ---------- file mode: a saved plan opened straight from disk ---------- */
function fileMode(){
  let st=E.normalize(JSON.parse($("#doc-state").textContent));
  const key="spine.file."+st.id,draft=LS.get(key,null);let restored=false;
  if(draft&&(+draft.updatedAt||0)>st.updatedAt){st=E.normalize(draft);restored=true}
  const rec={id:st.id,state:st,fileName:null};
  $("#bar").innerHTML=`<div class="appbar file-banner"><div class="appbar-in"><span class="brand">${LOGO}<span>Story Spine</span></span>
<span class="plan-name">Plan file</span><span class="hint" id="fm-status">${restored?"Showing edits you made earlier in this browser. Save a copy to keep them.":"Edits stay in this browser until you save a copy."}</span>
<div class="bar-actions"><button class="btn sm primary" data-sh="fm-save">${FS?"Save…":"Save a copy"}</button>${/^https:\/\//.test(APP_URL)?`<a class="btn sm" href="${esc(APP_URL)}" target="_blank" rel="noopener">Open the app</a>`:""}</div></div></div>`;
  E.mount($("#root"),st,{onChange(s){rec.state=s;LS.set(key,s);$("#fm-status").textContent="Unsaved edits are kept in this browser. Save to keep them in a file."}});
  rec.state=E.getState();
  const save=async()=>{const ok=await saveFile(rec,true);if(ok===true){$("#fm-status").textContent="Saved to "+rec.fileName;toast("Saved to "+rec.fileName)}};
  document.addEventListener("click",e=>{if(e.target.closest('[data-sh="fm-save"]'))save()});
  document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="s"){e.preventDefault();save()}if(e.key==="Escape")E.closeDrawer()});
  document.title=(st.film.title||"Untitled plan")+" · Story Spine";
}

/* ---------- app mode: local library ---------- */
const cache=new Map();
const Store={
  ids(){return LS.get("spine.idx",[])},
  get(id){if(cache.has(id))return cache.get(id);const r=LS.get("spine.p."+id,null);if(r)cache.set(id,r);return r},
  put(r){cache.set(r.id,r);const ids=this.ids();if(!ids.includes(r.id)){ids.push(r.id);LS.set("spine.idx",ids)}
    if(!LS.set("spine.p."+r.id,r))toast("This device is out of storage space for plans. Delete an old plan or save to a file.")},
  del(id){cache.delete(id);LS.del("spine.p."+id);LS.set("spine.idx",this.ids().filter(x=>x!==id))},
  all(){return this.ids().map(id=>this.get(id)).filter(Boolean)}};
let cur=null,mounted=false,persistT=null;
function persistSoon(){clearTimeout(persistT);persistT=setTimeout(flush,300)}
function flush(){clearTimeout(persistT);persistT=null;if(cur)Store.put(cur)}
function newRec(st,extra){return Object.assign({id:st.id,state:st,dirty:true,remotePath:null,remoteSha:null,fileName:null,fileDirty:false,syncedAt:0},extra||{})}

function openPlan(id){
  flush();const r=Store.get(id);if(!r)return;cur=r;LS.set("spine.cur",id);
  if(!mounted){E.mount($("#root"),r.state,{onChange:onEdit});mounted=true}else E.setState(r.state);
  r.state=E.getState();renderBar();renderLibrary();document.title=(r.state.film.title||"Untitled plan")+" · Story Spine"}
function onEdit(st){cur.state=st;cur.dirty=true;if(cur.fileName)cur.fileDirty=true;persistSoon();scheduleSync(30000);renderBar();
  document.title=(st.film.title||"Untitled plan")+" · Story Spine"}
function createPlan(st){const r=newRec(st);Store.put(r);openPlan(r.id);scheduleSync(2000);return r}
function removeLocal(id){Store.del(id);IDB.del(id);
  if(cur&&cur.id===id){cur=null;const next=Store.all().sort((a,b)=>b.state.updatedAt-a.state.updatedAt)[0];if(next)openPlan(next.id);else createPlan(E.blankState())}
  else renderLibrary()}

async function openFile(){
  if(FS){let h;try{[h]=await window.showOpenFilePicker({types:[{description:"Story Spine plan",accept:{"text/html":[".html",".htm"],"application/json":[".json"]}}]})}catch(e){return}
    const f=await h.getFile();await importText(await f.text(),f.name,h)}
  else{const inp=document.createElement("input");inp.type="file";inp.accept=".html,.htm,.json,text/html,application/json";
    inp.onchange=async()=>{const f=inp.files[0];if(f)await importText(await f.text(),f.name,null)};inp.click()}}
async function importText(text,name,handle){
  let st;try{st=parsePlanText(text)}catch(e){toast((name?name+" doesn't":"That text doesn't")+" contain a Story Spine plan.");return}
  let r=Store.get(st.id),note="";
  if(r){if(st.updatedAt>r.state.updatedAt){r.state=st;r.dirty=true}else if(st.updatedAt<r.state.updatedAt)note=" (this device has newer edits, so those are shown)"}
  else r=newRec(st);
  if(handle&&/\.html?$/i.test(name)){r.fileName=name;r.fileDirty=false;await IDB.set(r.id,handle)}
  Store.put(r);openPlan(r.id);scheduleSync(1500);toast("Opened "+(name||"plan")+note)}

async function saveAction(){
  flush();const done=[];
  if(cur.fileName&&FS){const ok=await saveFile(cur,false);if(ok===true)done.push(cur.fileName);Store.put(cur)}
  if(ghReady()){await syncNow();if(!syncErr)done.push("GitHub")}
  if(!cur.fileName&&!ghReady()){const ok=await saveFile(cur,false);Store.put(cur);if(ok===true)done.push(cur.fileName)}
  renderBar();if(done.length)toast("Saved to "+done.join(" and "))}

/* ---------- GitHub sync ---------- */
function ghCfg(){return LS.get("spine.gh",null)}
function ghReady(){const c=ghCfg();return !!(c&&c.owner&&c.repo&&c.token)}
const NAME_RE=/^[A-Za-z0-9_.-]+$/,DIR_RE=/^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*$/;
const encPath=p=>p.split("/").map(encodeURIComponent).join("/");
async function gh(cfg,path,opt){
  opt=opt||{};
  const r=await fetch("https://api.github.com/repos/"+cfg.owner+"/"+cfg.repo+path,{method:opt.method||"GET",cache:"no-store",
    headers:Object.assign({Authorization:"Bearer "+cfg.token,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"},opt.body?{"Content-Type":"application/json"}:{}),
    body:opt.body?JSON.stringify(opt.body):undefined});
  if(r.status===404&&opt.allow404)return null;
  if(!r.ok){let msg="";try{msg=(await r.json()).message||""}catch(e){}const err=new Error(msg||"HTTP "+r.status);err.status=r.status;throw err}
  return r.status===204?{}:r.json()}
function ghErr(e){
  if(!navigator.onLine)return "You're offline.";
  if(e.status===401)return "GitHub rejected the token. Paste a new one in sync settings.";
  if(e.status===403)return /rate limit/i.test(e.message)?"GitHub's rate limit was reached. Try again in a few minutes.":"The token can't write to that repository. Check its Contents permission.";
  if(e.status===404)return "Repository not found. Check the owner and name, and that the token includes it.";
  if(e.status===409||e.status===422)return "A plan changed on GitHub at the same moment. Sync again.";
  return e.message&&e.message!=="Failed to fetch"?e.message:"Couldn't reach GitHub."}
function b64enc(str){const bytes=new TextEncoder().encode(str);let bin="";for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));return btoa(bin)}
function b64dec(b){const bin=atob(String(b).replace(/\s/g,""));return new TextDecoder().decode(Uint8Array.from(bin,c=>c.charCodeAt(0)))}
async function listRemote(c){const res=await gh(c,"/contents/"+encPath(c.dir),{allow404:true});const m=new Map();
  if(Array.isArray(res))res.forEach(f=>{if(f.type==="file"&&/\.html$/i.test(f.name))m.set(f.path,f.sha)});return m}
async function getRemote(c,path){const f=await gh(c,"/contents/"+encPath(path));
  let content=f.content;if(!content&&f.sha)content=(await gh(c,"/git/blobs/"+f.sha)).content;
  return {state:parsePlanText(b64dec(content)),sha:f.sha}}
async function putRemote(c,path,html,sha,message){const res=await gh(c,"/contents/"+encPath(path),{method:"PUT",body:Object.assign({message,content:b64enc(html)},sha?{sha}:{})});return res.content.sha}
const idTail=id=>String(id).replace(/[^a-z0-9]/gi,"").slice(-6).toLowerCase();
function pathFor(c,r){return c.dir+"/"+(slug(r.state.film.title)||"plan")+"-"+idTail(r.id)+".html"}

let syncing=false,syncAgain=false,syncErr="",syncT=null,lastSync=LS.get("spine.lastSync",0);
function scheduleSync(ms){if(!ghReady())return;clearTimeout(syncT);syncT=setTimeout(()=>syncNow(),ms)}
async function pushRec(c,r,sha){
  if(!r.remotePath)r.remotePath=pathFor(c,r);
  const snap=r.state.updatedAt,title=r.state.film.title||"Untitled plan";
  const html=await buildFile(r.state);
  const newSha=await putRemote(c,r.remotePath,html,sha,(sha?"Update":"Add")+" “"+title+"” from "+device());
  r.remoteSha=newSha;r.syncedAt=Date.now();if(r.state.updatedAt===snap)r.dirty=false;Store.put(r)}
function adopt(r,state,sha){state.id=r.id;r.state=state;r.remoteSha=sha;r.dirty=false;r.syncedAt=Date.now();if(r.fileName)r.fileDirty=true;Store.put(r);
  if(cur&&cur.id===r.id){E.setState(state);r.state=E.getState();toast("“"+(state.film.title||"Untitled plan")+"” was updated from another device.")}}
async function keepBoth(c,r,remote){
  const copy=E.clone(r.state);copy.id=uid();copy.updatedAt=Date.now();copy.film.title=(copy.film.title||"Untitled plan")+" (copy from "+device()+")";
  const cr=newRec(copy);Store.put(cr);
  adopt(r,remote.state,remote.sha);
  await pushRec(c,cr,null);
  toast("This plan was also changed on another device. Both versions are kept; yours is “"+copy.film.title+"”.");
  return cr}
async function syncNow(){
  if(!ghReady())return;
  if(!navigator.onLine){renderBar();return}
  if(syncing){syncAgain=true;return}
  const c=ghCfg();syncing=true;syncErr="";renderBar();flush();
  try{
    const remote=await listRemote(c);
    const tomb=LS.get("spine.tomb",[]);
    for(const p of tomb){if(remote.has(p)){await gh(c,"/contents/"+encPath(p),{method:"DELETE",body:{message:"Delete "+p.split("/").pop()+" from "+device(),sha:remote.get(p)}});remote.delete(p)}}
    LS.set("spine.tomb",[]);
    const byTail=new Map();for(const p of remote.keys()){const m=p.match(/-([a-z0-9]{6})\.html$/i);if(m)byTail.set(m[1].toLowerCase(),p)}
    const seen=new Set();
    for(const r of Store.all().slice()){
      if(!r.remotePath&&byTail.has(idTail(r.id))){r.remotePath=byTail.get(idTail(r.id));r.remoteSha=null}
      if(!r.remotePath){await pushRec(c,r,null);seen.add(r.remotePath);continue}
      seen.add(r.remotePath);const rs=remote.get(r.remotePath);
      if(!rs){if(r.dirty||!r.remoteSha){r.remoteSha=null;await pushRec(c,r,null)}else removeLocal(r.id)}
      else if(rs===r.remoteSha){if(r.dirty)await pushRec(c,r,rs)}
      else{const rem=await getRemote(c,r.remotePath);
        if(r.dirty&&r.remoteSha===null&&JSON.stringify(rem.state.blocks)===JSON.stringify(r.state.blocks)){r.remoteSha=rem.sha;await pushRec(c,r,rem.sha)}
        else if(r.dirty){const cr=await keepBoth(c,r,rem);seen.add(cr.remotePath)}
        else adopt(r,rem.state,rem.sha)}}
    for(const [p,sha] of remote){
      if(seen.has(p))continue;
      const rem=await getRemote(c,p);
      if(Store.get(rem.state.id))rem.state.id=uid();
      Store.put(newRec(rem.state,{dirty:false,remotePath:p,remoteSha:sha,syncedAt:Date.now()}))}
    lastSync=Date.now();LS.set("spine.lastSync",lastSync)}
  catch(e){syncErr=ghErr(e)}
  finally{syncing=false;renderBar();renderLibrary();if(syncAgain){syncAgain=false;syncNow()}}}

async function deletePlan(){
  const r=cur;if(!r)return;
  if(r.remotePath){const t=LS.get("spine.tomb",[]);t.push(r.remotePath);LS.set("spine.tomb",t)}
  const title=r.state.film.title||"Untitled plan";
  removeLocal(r.id);toast("Deleted “"+title+"”."+(r.remotePath?" Its history stays in your GitHub repository.":""));
  if(ghReady())syncNow()}

/* ---------- app UI ---------- */
function renderBarShell(){
  $("#bar").innerHTML=`<div class="appbar"><div class="appbar-in">
<button class="btn sm" data-sh="library" aria-label="Your plans">☰ Plans</button>
<span class="brand">${LOGO}<span>Story Spine</span></span>
<span class="plan-name" id="plan-name"></span>
<button class="sync-pill" id="sync-pill" data-sh="pill"><i></i><span></span></button>
<div class="bar-actions">
  <button class="btn sm primary" data-sh="save" title="Save (Ctrl+S)">Save</button>
  <div class="menu"><button class="btn sm" data-sh="menu" aria-expanded="false">File</button>
    <div class="menu-pop" id="file-menu" hidden>
      <button data-sh="new">New blank plan</button>
      <button data-sh="new-example">New plan from example</button>
      <hr>
      <button data-sh="open-file">Open file… <kbd>Ctrl+O</kbd></button>
      <button data-sh="save-file">Save to file <kbd>Ctrl+S</kbd></button>
      <button data-sh="save-as">Save as new file…</button>
      <hr>
      <button data-sh="paste-json">Paste plan JSON…</button>
      <button data-sh="copy-json">Copy plan as JSON</button>
      <hr>
      <button data-sh="settings">GitHub sync settings…</button>
      <button data-sh="delete" data-confirm="Click again to delete this plan">Delete this plan</button>
    </div></div>
</div></div></div>`}
function renderBar(){
  if(FILE_MODE||!cur||!$("#plan-name"))return;
  $("#plan-name").textContent=(cur.state.film.title||"Untitled plan")+(cur.fileName?"  ·  "+cur.fileName+(cur.fileDirty?" (not saved to file)":""):"");
  const pill=$("#sync-pill"),label=pill.querySelector("span");let cls="",txt;
  const pending=Store.all().some(r=>r.dirty);
  if(!ghReady())txt="Sync off · set up";
  else if(syncing){cls="busy";txt="Syncing…"}
  else if(!navigator.onLine){cls="pending";txt="Offline · saved on this device"}
  else if(syncErr){cls="err";txt=syncErr}
  else if(pending){cls="pending";txt="Changes waiting to sync"}
  else{cls="ok";txt="Synced "+rel(lastSync)}
  pill.className="sync-pill "+cls;label.textContent=txt;pill.title=ghReady()?"Sync with GitHub now":"Set up GitHub sync"}
function planText(o){return typeof o==="string"?o:Array.isArray(o)?o.map(planText).join("\n"):o&&typeof o==="object"?Object.keys(o).filter(k=>k!=="id"&&k!=="kind").map(k=>planText(o[k])).join("\n"):""}
function markText(text,T){const re=new RegExp("("+T.map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|")+")","gi");return String(text).split(re).map((p,i)=>i%2?"<mark>"+esc(p)+"</mark>":esc(p)).join("")}
function libSnippet(text,T){const lines=text.split("\n").filter(l=>T.some(t=>l.toLowerCase().includes(t)));if(!lines.length)return "";
  const l=lines[0].replace(/\s+/g," "),i=Math.max(0,l.toLowerCase().indexOf(T.find(t=>l.toLowerCase().includes(t)))-30);
  return (i>0?"…":"")+markText(l.slice(i,i+90),T)+(l.length>i+90?"…":"")+(lines.length>1?` <span class="more">+${lines.length-1} more</span>`:"")}
function renderLibrary(){
  const lib=$("#library");if(!lib||lib.hidden)return;
  const all=Store.all().sort((a,b)=>b.state.updatedAt-a.state.updatedAt);
  const qv=($("#lib-search")||{}).value||"",T=qv.toLowerCase().split(/\s+/).filter(Boolean);
  const recs=T.length?all.filter(r=>{const t=planText(r.state).toLowerCase();return T.every(x=>t.includes(x))}):all;
  lib.querySelector(".tc").textContent=T.length?`${recs.length} of ${all.length} match`:`${all.length} on this device`;
  lib.querySelector(".lib-list").innerHTML=recs.length?recs.map(r=>`<button class="lib-item${cur&&cur.id===r.id?" cur":""}" data-sh="pick" data-id="${esc(r.id)}"><b>${T.length?markText(r.state.film.title||"Untitled plan",T):esc(r.state.film.title||"Untitled plan")}</b>
${T.length?`<span class="lib-snip">${libSnippet(planText(r.state),T)}</span>`:""}
<span class="lib-meta"><span>${sceneCount(r.state)} scenes</span><span>edited ${rel(r.state.updatedAt)}</span>${r.fileName?`<span class="tag">${esc(r.fileName)}</span>`:""}${ghReady()?(r.dirty?'<span class="tag pending">not synced</span>':r.remotePath?'<span class="tag ok">synced</span>':""):""}</span></button>`).join("")
    :`<p class="empty">No plans contain “${esc(qv)}”.</p>`}
function toggleLibrary(show){const lib=$("#library"),scrim=$("#scrim");lib.hidden=!show;scrim.hidden=!show;
  if(!show)return;
  lib.innerHTML=`<div class="dr-h"><div><div class="dr-tag">Your plans</div><div class="tc"></div></div><button class="x big" data-sh="lib-close" aria-label="Close">×</button></div>
<div class="lib-actions"><button class="btn sm primary" data-sh="new">New plan</button><button class="btn sm" data-sh="open-file">Open file…</button>${ghReady()?`<button class="btn sm" data-sh="pill">Sync now</button>`:`<button class="btn sm" data-sh="settings">Set up sync</button>`}</div>
<div class="search-box lib-search-box"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M13 13l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><input id="lib-search" type="search" placeholder="Search all plans" autocomplete="off" spellcheck="false" aria-label="Search all plans"></div>
<div class="lib-list"></div>`;
  $("#lib-search").addEventListener("input",renderLibrary);
  $("#lib-search").addEventListener("keydown",e=>{if(e.key==="Enter"){const b=lib.querySelector(".lib-item");if(b){e.preventDefault();b.click()}}});
  renderLibrary();const b=lib.querySelector(".lib-item.cur")||lib.querySelector(".lib-item");if(b)b.focus()}

function settingsModal(){
  const c=ghCfg()||{},host=location.hostname.match(/^([A-Za-z0-9-]+)\.github\.io$/);
  const owner=c.owner||(host?host[1]:""),repo=c.repo||"story-spine-plans",dir=c.dir||"plans";
  const card=showModal(`<h3>GitHub sync</h3>
<p>Each plan is saved as an interactive HTML file in a private GitHub repository, so this app shows the same plans on your PC and your phone. Set it up once on each device.</p>
<ol><li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com/settings/personal-access-tokens/new</a>.</li>
<li>Under <b>Repository access</b>, choose <b>Only select repositories</b> and pick your plans repository.</li>
<li>Under <b>Permissions → Repository permissions</b>, set <b>Contents</b> to <b>Read and write</b>. Leave everything else as it is.</li>
<li>Generate the token and paste it below.</li></ol>
<div class="row2"><label class="fld"><span>GitHub username</span><input id="gh-owner" value="${esc(owner)}" autocomplete="off" spellcheck="false"></label><label class="fld"><span>Folder</span><input id="gh-dir" value="${esc(dir)}" spellcheck="false"></label></div>
<label class="fld"><span>Private repository</span><input id="gh-repo" value="${esc(repo)}" autocomplete="off" spellcheck="false"></label>
<label class="fld"><span>Token</span><input id="gh-token" type="password" value="${esc(c.token||"")}" autocomplete="off" spellcheck="false" placeholder="github_pat_…"></label>
<p>The token is stored only in this app on this device. Keep it limited to the plans repository.</p>
<div id="gh-note"></div>
<div class="modal-actions">${ghReady()?'<button class="btn danger" data-sh="gh-off" data-confirm="Click again to turn off sync">Turn off sync</button>':""}<button class="btn" data-sh="modal-close">Cancel</button><button class="btn primary" data-sh="gh-save">Check and save</button></div>`);
  return card}
async function saveSettings(){
  const v=id=>$("#"+id).value.trim(),note=$("#gh-note");
  const cfg={owner:v("gh-owner"),repo:v("gh-repo"),dir:v("gh-dir").replace(/^\/+|\/+$/g,"")||"plans",token:v("gh-token")};
  const say=(m,cls)=>{note.className="note "+(cls||"");note.textContent=m};
  if(!NAME_RE.test(cfg.owner)||!NAME_RE.test(cfg.repo))return say("Enter your GitHub username and the repository name (letters, numbers, dashes).","err");
  if(!DIR_RE.test(cfg.dir))return say("The folder name can only use letters, numbers, dashes and slashes.","err");
  if(!cfg.token)return say("Paste the token you generated.","err");
  say("Checking with GitHub…");
  try{const info=await gh(cfg,"");
    if(!info.private)return say("That repository is public, so anyone could read your plans. Make it private on GitHub first.","err");
    if(info.permissions&&info.permissions.push===false)return say("The token can read but not write. Set Contents to Read and write.","err");
    LS.set("spine.gh",cfg);closeModal();toast("Sync is on. Syncing your plans now.");renderBar();syncNow()}
  catch(e){say(ghErr(e),"err")}}
function jsonModal(mode){
  if(mode==="copy"){const txt=JSON.stringify(cur.state,null,2);
    const fallback=()=>{showModal(`<h3>Plan JSON</h3><p>Select all and copy.</p><textarea class="json" id="json-ta" spellcheck="false"></textarea><div class="modal-actions"><button class="btn" data-sh="modal-close">Close</button></div>`);const ta=$("#json-ta");ta.value=txt;ta.select()};
    try{navigator.clipboard.writeText(txt).then(()=>toast("Plan copied as JSON."),fallback)}catch(e){fallback()}return}
  showModal(`<h3>Paste a plan</h3><p>Paste JSON copied from Story Spine or from the claude.ai version (More → Copy plan as JSON). It opens as a plan in your library.</p><textarea class="json" id="json-ta" spellcheck="false"></textarea><div class="modal-actions"><button class="btn" data-sh="modal-close">Cancel</button><button class="btn primary" data-sh="json-ok">Add plan</button></div>`)}

function appMode(){
  renderBarShell();
  const side=document.createElement("div");side.innerHTML='<div class="scrim" id="scrim" hidden data-sh="lib-close"></div><aside class="library" id="library" hidden aria-label="Your plans"></aside>';
  document.body.append(...side.childNodes);
  if(!Store.ids().length){const st=E.exampleState();Store.put(newRec(st))}
  const want=LS.get("spine.cur",null);openPlan(Store.get(want)?want:Store.ids()[0]);
  assets().catch(()=>{});
  try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}

  document.addEventListener("click",async e=>{
    const menu=$("#file-menu");if(menu&&!e.target.closest(".menu"))menu.hidden=true;
    const a=e.target.closest("[data-sh]");if(!a)return;const act=a.dataset.sh;
    if(a.closest("#file-menu")&&act!=="delete")menu.hidden=true;
    if(act==="menu"){menu.hidden=!menu.hidden;a.setAttribute("aria-expanded",String(!menu.hidden));const sf=menu.querySelector('[data-sh="save-file"]');sf.firstChild.textContent=cur.fileName?"Save to "+cur.fileName+" ":"Save to file "}
    else if(act==="library")toggleLibrary(true);
    else if(act==="lib-close")toggleLibrary(false);
    else if(act==="pick"){openPlan(a.dataset.id);toggleLibrary(false)}
    else if(act==="new"){toggleLibrary(false);createPlan(E.blankState())}
    else if(act==="new-example")createPlan(E.exampleState());
    else if(act==="open-file"){toggleLibrary(false);openFile()}
    else if(act==="save")saveAction();
    else if(act==="save-file"){const ok=await saveFile(cur,false);Store.put(cur);renderBar();if(ok===true)toast("Saved to "+cur.fileName)}
    else if(act==="save-as"){const ok=await saveFile(cur,true);Store.put(cur);renderBar();if(ok===true)toast("Saved to "+cur.fileName)}
    else if(act==="copy-json")jsonModal("copy");
    else if(act==="paste-json")jsonModal("paste");
    else if(act==="json-ok"){try{const st=parsePlanText($("#json-ta").value);if(Store.get(st.id))st.id=uid();st.updatedAt=Date.now();closeModal();createPlan(st);toast("Plan added.")}catch(err){toast("That text isn't a Story Spine plan. Check you pasted all of it.")}}
    else if(act==="settings"){toggleLibrary(false);settingsModal()}
    else if(act==="gh-save")saveSettings();
    else if(act==="gh-off")arm(a,()=>{LS.del("spine.gh");closeModal();renderBar();toast("Sync is off on this device. Your plans stay here and on GitHub.")});
    else if(act==="modal-close")closeModal();
    else if(act==="pill"){if(ghReady())syncNow();else settingsModal()}
    else if(act==="delete")arm(a,()=>{menu.hidden=true;deletePlan()});
  });
  $("#overlay").addEventListener("click",e=>{if(e.target.classList.contains("modal"))closeModal()});
  document.addEventListener("keydown",e=>{
    const k=e.key.toLowerCase();
    if((e.ctrlKey||e.metaKey)&&k==="s"){e.preventDefault();saveAction()}
    else if((e.ctrlKey||e.metaKey)&&k==="o"){e.preventDefault();openFile()}
    else if(e.key==="Escape"){if($("#overlay").innerHTML)closeModal();else if(!$("#library").hidden)toggleLibrary(false);else E.closeDrawer()}});

  window.addEventListener("online",()=>{renderBar();syncNow()});
  window.addEventListener("offline",renderBar);
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="hidden"){flush();if(ghReady()&&Store.all().some(r=>r.dirty))syncNow()}
    else if(Date.now()-lastSync>20000)syncNow()});
  window.addEventListener("pagehide",flush);
  setInterval(renderBar,30000);
  setTimeout(syncNow,600);

  if("serviceWorker" in navigator&&(location.protocol==="https:"||location.hostname==="localhost"||location.hostname==="127.0.0.1")){
    let wantReload=false;
    navigator.serviceWorker.register("sw.js").then(reg=>{
      const offer=w=>toast("A new version of Story Spine is ready.",{label:"Reload",fn:()=>{wantReload=true;flush();w.postMessage("skip-waiting")}});
      if(reg.waiting&&navigator.serviceWorker.controller)offer(reg.waiting);
      reg.addEventListener("updatefound",()=>{const w=reg.installing;if(w)w.addEventListener("statechange",()=>{if(w.state==="installed"&&navigator.serviceWorker.controller)offer(w)})})}).catch(()=>{});
    navigator.serviceWorker.addEventListener("controllerchange",()=>{if(wantReload)location.reload()})}
}

if(FILE_MODE)fileMode();else appMode();
})();
