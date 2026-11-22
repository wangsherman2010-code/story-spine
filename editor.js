/* Story Spine editor: renders one plan and reports every change through opts.onChange(state). */
window.SpineEditor=(function(){
"use strict";
const ROMAN=["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
const ACTC=["a1","a2","a3","a4"];
const FT=["Interview (SOT)","B-roll","Observational","Archival","Drone","Graphics"];
const AT=["Music","Ambience","SFX","Sync sound","Silence"];

let S=null,root=null,opts={},openId=null,dragId=null,ro=null,query="";
const TOUCH=window.matchMedia&&matchMedia("(hover:none)").matches;
let view=(()=>{try{const v=localStorage.getItem("spine.view");if(v==="list"||v==="wall")return v}catch(e){}return window.innerWidth<700?"list":"wall"})();
const DURQ=[[15,"15s"],[30,"30s"],[60,"1m"],[90,"1:30"],[120,"2m"],[180,"3m"],[300,"5m"]];
const q=s=>root.querySelector(s);

function clone(o){return JSON.parse(JSON.stringify(o))}
function uid(){return "x"+Math.random().toString(36).slice(2,9)}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function fmtDur(sec){sec=Math.max(0,Math.round(sec||0));return Math.floor(sec/60)+":"+String(sec%60).padStart(2,"0")}
function fmtTC(sec){sec=Math.max(0,Math.round(sec||0));return [Math.floor(sec/3600),Math.floor(sec%3600/60),sec%60].map(n=>String(n).padStart(2,"0")).join(":")}
function parseDur(t){const p=String(t).trim().split(":");if(!p.every(x=>/^\d+$/.test(x))||p.length>3)return null;return p.reduce((a,x)=>a*60+(+x),0)}
function words(t){return (String(t||"").trim().match(/\S+/g)||[]).length}

function newScene(){return {id:uid(),title:"",summary:"",location:"",dur:120,intensity:5,beat:"",notes:"",footage:[],audio:[],vo:""}}
function newSeq(){return {id:uid(),title:"",summary:"",scenes:[newScene()]}}
function blankState(){return {v:1,id:uid(),updatedAt:Date.now(),example:false,media:false,film:{title:"",logline:"",director:"",target:60},
  blocks:[{id:uid(),kind:"prologue",title:"",purpose:"",sequences:[newSeq()]},
    {id:uid(),kind:"act",title:"Setup",purpose:"",sequences:[newSeq()]},
    {id:uid(),kind:"act",title:"Confrontation",purpose:"",sequences:[newSeq()]},
    {id:uid(),kind:"act",title:"Resolution",purpose:"",sequences:[newSeq()]},
    {id:uid(),kind:"closing",title:"",purpose:"",sequences:[newSeq()]}]}}
function sc(id,title,summary,location,dur,intensity,beat,extra){return Object.assign(newScene(),{id,title,summary,location,dur,intensity,beat},extra||{})}
function exampleState(){return normalize({v:1,id:uid(),updatedAt:Date.now(),example:true,media:false,
  film:{title:"The Last Crossing",logline:"After 31 years skippering the only ferry to her island, Morag has one season left to decide who takes the wheel, and whether the route survives her.",director:"",target:30},
  blocks:[
   {kind:"prologue",title:"Before dawn",purpose:"Drop the viewer into the ritual before we know whose hands these are.",sequences:[{scenes:[
     sc("s01","Engine room, 5 a.m.","Hands on cold steel, the diesel coughing awake. No faces yet, only sound and breath.","MV Hallaig, engine room",75,3,"Establish ritual and place without explanation.",{footage:[{type:"Observational",desc:"Tight on hands, gauges, condensation",ref:"A001_C004"}],audio:[{type:"Ambience",desc:"Engine start, gulls outside the hull"}]})]}]},
   {kind:"act",title:"The last season",purpose:"Meet Morag, her route and the people who depend on it. Reveal that this is her final year.",sequences:[
     {title:"A working day",summary:"The rhythm of the crossing and its regulars.",scenes:[
       sc("s02","First sailing","Morag at the wheel as the island shrinks behind her. She talks to the boat more than to the crew.","Wheelhouse",150,4,"Introduce protagonist through action."),
       sc("s03","The regulars","The postman, a schoolteacher, a farmer with three sheep. Each has a story about Morag.","Car deck and lounge",180,3,"Show what the ferry means to the community.")]},
     {title:"The letter",summary:"The end is put on paper.",scenes:[
       sc("s04","Retirement notice","She reads the operator's letter aloud at her kitchen table, then folds it very small.","Morag's kitchen",120,6,"Inciting incident."),
       sc("s05","Her daughter's view","Eilidh wants her mother ashore. She also knows the route may close without her.","Harbour wall",150,5,"Personal stakes and the wider threat.")]}]},
   {kind:"act",title:"Holding on",purpose:"The route is threatened and Morag fights for one more year.",sequences:[
     {title:"Storm week",summary:"Weather shows what isolation means.",scenes:[
       sc("s06","Cancelled crossings","Five days of gales. The boat stays tied up and Morag paces the pier.","Pier",120,7,"Rising pressure."),
       sc("s07","Island cut off","Shelves empty at the shop; a medical evacuation by helicopter.","Village shop, helipad",150,8,"External stakes made visible.")]},
     {title:"The meeting",summary:"The community confronts the operator.",scenes:[
       sc("s08","Community hall","Islanders face the operator's manager. Morag stands up to speak and can't finish.","Village hall",210,9,"Confrontation."),
       sc("s09","The decision","The route will run one more year, but only if a licensed skipper is found to replace her.","Village hall",90,10,"Climax and turn.")]}]},
   {kind:"act",title:"Handing over",purpose:"Morag chooses who takes the wheel.",sequences:[
     {title:"The apprentice",summary:"Callum, 24, learns the crossing.",scenes:[
       sc("s10","Teaching Callum","Tides, rocks, the names of every buoy. She's harder on him than she needs to be.","Wheelhouse",180,6,"Passing on knowledge."),
       sc("s11","His first solo","Morag watches from the shore with binoculars, pretending not to.","Headland",150,7,"Letting go.")]}]},
   {kind:"closing",title:"Last crossing",purpose:"Release. Leave the audience with the island and the water.",sequences:[{scenes:[
     sc("s12","Final sailing","The whole island on the pier. She sounds the horn three times.","Pier",180,5,"Emotional payoff.",{audio:[{type:"Music",desc:"Score swells, then drops to wind only"}]}),
     sc("s13","Ashore","Morag on the headland at dawn, watching the ferry leave without her.","Headland",90,2,"Quiet ending that mirrors the prologue.",{vo:"Thirty-one years, and I never once watched her go. She looks smaller from here."})]}]}]})}

function normalize(st){
  st=st&&typeof st==="object"?st:{};
  st.v=1;st.id=st.id||uid();st.updatedAt=+st.updatedAt||Date.now();st.example=!!st.example;st.media=!!st.media;
  st.film=Object.assign({title:"",logline:"",director:"",target:60},st.film||{});
  st.blocks=(Array.isArray(st.blocks)?st.blocks:[]).filter(b=>b&&typeof b==="object");
  st.blocks.forEach(b=>{b.id=b.id||uid();b.kind=["prologue","act","closing"].includes(b.kind)?b.kind:"act";b.title=b.title||"";b.purpose=b.purpose||"";
    b.sequences=Array.isArray(b.sequences)?b.sequences:[];if(!b.sequences.length)b.sequences.push(newSeq());
    b.sequences.forEach(qq=>{qq.id=qq.id||uid();qq.title=qq.title||"";qq.summary=qq.summary||"";
      qq.scenes=(Array.isArray(qq.scenes)?qq.scenes:[]).map(s=>Object.assign(newScene(),s,{footage:Array.isArray(s.footage)?s.footage:[],audio:Array.isArray(s.audio)?s.audio:[],vo:String(s.vo||"")}));
      qq.scenes.forEach(s=>{s.id=s.id||uid();s.footage.forEach(f=>{f.id=f.id||uid();f.ref=f.ref||""});s.audio.forEach(a=>a.id=a.id||uid());s.dur=Math.max(0,+s.dur||0);s.intensity=Math.min(10,Math.max(1,+s.intensity||5))})})});
  if(!st.blocks.length)return blankState();
  return st}

function layout(){
  const blocks=new Map(),scenes=new Map(),list=[];let t=0,actN=0;
  S.blocks.forEach(b=>{
    let label,color;
    if(b.kind==="prologue"){label="Prologue";color="var(--c-pro)"}
    else if(b.kind==="closing"){label="Closing";color="var(--c-clo)"}
    else{actN++;label="Act "+(ROMAN[actN-1]||actN);color="var(--c-"+ACTC[(actN-1)%4]+")"}
    const bi={label,color,start:t,n:actN};
    b.sequences.forEach((qq,qi)=>{qq.scenes.forEach((s,si)=>{
        const num=b.kind==="prologue"?"P."+(si+1):b.kind==="closing"?"C."+(si+1):actN+"."+(qi+1)+"."+(si+1);
        const info={s,b,q:qq,num,start:t,color,blockLabel:label,seqLabel:b.kind==="act"?"Seq "+(qi+1):""};
        scenes.set(s.id,info);list.push(info);t+=s.dur||0})});
    bi.end=t;blocks.set(b.id,bi)});
  return {blocks,scenes,list,total:t}}
function find(id){for(const b of S.blocks)for(const qq of b.sequences){const i=qq.scenes.findIndex(s=>s.id===id);if(i>=0)return {b,q:qq,i,s:qq.scenes[i]}}return null}
function findSeq(id){for(const b of S.blocks){const qq=b.sequences.find(x=>x.id===id);if(qq)return {b,q:qq}}return null}

/* ---------- render ---------- */
function renderShell(){
  root.innerHTML=`<div class="wrap">
<header class="top">
  <div class="top-main">
    <div class="eyebrow">Documentary story spine</div>
    <input class="ghost h-title" id="f-title" value="${esc(S.film.title)}" placeholder="Working title" aria-label="Film title">
    <textarea class="ghost h-log auto" id="f-logline" rows="1" placeholder="Logline: who we follow, what they want, what stands in the way" aria-label="Logline">${esc(S.film.logline)}</textarea>
    <div class="h-meta">
      <label>Director <input class="ghost f-director" id="f-director" value="${esc(S.film.director)}" placeholder="Name"></label>
      <label>Target <input class="ghost f-target" id="f-target" value="${esc(S.film.target)}" inputmode="numeric"> min</label>
      <span class="runtime"></span>
    </div>
  </div>
  <label class="switch" for="f-media"><input type="checkbox" id="f-media"${S.media?" checked":""}><span>Production layer</span><small>footage · audio · VO</small></label>
</header>
<div class="banner-slot"></div>
<div class="search" role="search">
  <div class="search-box"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M13 13l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    <input id="f-search" type="search" value="${esc(query)}" placeholder="Search scenes, notes, footage, audio, VO…" autocomplete="off" spellcheck="false" aria-label="Search this plan">
    <span class="search-count" aria-live="polite"></span><kbd class="search-key">Ctrl F</kbd></div>
  <div class="results" hidden></div>
</div>
<section>
  <div class="panel-h"><h2>Story arc</h2><p class="hint">Each dot is a scene, placed by running time and raised by intensity. Click a dot to edit that scene.</p></div>
  <div class="arc-box"><div class="arc"></div></div>
</section>
<section>
  <div class="panel-h"><h2>Structure</h2><div class="viewtog" role="group" aria-label="Layout"><button data-act="view" data-v="wall">Wall</button><button data-act="view" data-v="list">List</button></div><p class="hint view-hint"></p></div>
  <div class="board-wrap"><div class="board"></div></div>
</section>
</div>
<aside class="drawer" hidden aria-label="Scene editor"></aside>`;
  renderBanner();renderBoard();renderArc();renderDrawer();renderResults();updateRuntime();growAll(root);
  if(ro)ro.disconnect();ro=new ResizeObserver(()=>{renderArc();growAll(root)});ro.observe(q(".arc"));
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>root&&growAll(root));
  bindInner()}

/* ---------- search ---------- */
function terms(){return query.toLowerCase().split(/\s+/).filter(Boolean)}
function sceneFields(s){return [["Title",s.title],["What happens",s.summary],["Location",s.location],["Why it's here",s.beat],["Notes",s.notes],["VO",s.vo],
  ...s.footage.map(f=>["Footage",[f.type,f.desc,f.ref].filter(Boolean).join(" · ")]),...s.audio.map(a=>["Audio",[a.type,a.desc].filter(Boolean).join(" · ")])]}
function hit(fields,T){const all=fields.map(f=>String(f[1]||"").toLowerCase()).join("\n");if(!T.every(t=>all.includes(t)))return null;
  return fields.find(f=>T.some(t=>String(f[1]||"").toLowerCase().includes(t)))}
function mark(text,T){const re=new RegExp("("+T.map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|")+")","gi");
  return String(text).split(re).map((p,i)=>i%2?"<mark>"+esc(p)+"</mark>":esc(p)).join("")}
function snippet(text,T){text=String(text).replace(/\s+/g," ");const low=text.toLowerCase();
  let i=Math.min(...T.map(t=>{const k=low.indexOf(t);return k<0?Infinity:k}));if(!isFinite(i))i=0;
  const a=Math.max(0,i-40),b=Math.min(text.length,i+90);return (a>0?"…":"")+mark(text.slice(a,b),T)+(b<text.length?"…":"")}
function matches(){
  const T=terms();if(!T.length)return null;
  const L=layout(),items=[],ids=new Set(),heads=new Set();
  S.blocks.forEach(b=>{const I=L.blocks.get(b.id);
    const bf=hit([["Title",b.title],["Purpose",b.purpose]],T);
    if(bf){heads.add(b.id);items.push({kind:"block",id:b.id,label:I.label,title:b.title||I.label,field:bf[0],snip:snippet(bf[1],T),color:I.color})}
    b.sequences.forEach((qq,qi)=>{
      if(b.kind==="act"){const qf=hit([["Title",qq.title],["Summary",qq.summary]],T);
        if(qf){heads.add(qq.id);items.push({kind:"seq",id:qq.id,label:I.label+" · Sequence "+(qi+1),title:qq.title||"Sequence "+(qi+1),field:qf[0],snip:snippet(qf[1],T),color:I.color})}}
      qq.scenes.forEach(s=>{const f=hit(sceneFields(s),T);if(!f)return;const info=L.scenes.get(s.id);ids.add(s.id);
        items.push({kind:"scene",id:s.id,label:"Scene "+info.num+" · "+info.blockLabel,title:s.title||"Untitled scene",field:f[0],snip:snippet(f[1],T),color:info.color})})})});
  return {ids,heads,items,T}}
function renderResults(){
  const box=q(".results"),cnt=q(".search-count"),M=matches();
  if(!M){box.hidden=true;box.innerHTML="";cnt.textContent="";return}
  cnt.textContent=M.items.length?M.items.length+(M.items.length===1?" match":" matches"):"No matches";
  box.hidden=false;
  box.innerHTML=M.items.length?M.items.slice(0,100).map(it=>`<button class="res" data-res="${it.kind}" data-id="${it.id}" style="--c:${it.color}"><span class="res-l">${esc(it.label)}</span><span class="res-t">${mark(it.title,M.T)}</span><span class="res-s"><em>${esc(it.field)}</em> ${it.snip}</span></button>`).join("")
    :`<p class="empty">Nothing in this plan matches “${esc(query)}”. Try fewer or different words.</p>`}
function openResult(btn){const id=btn.dataset.id;
  if(btn.dataset.res==="scene"){open(id,true);return}
  const el=root.querySelector(btn.dataset.res==="block"?"#bt-"+id:"#qt-"+id);
  if(el){el.scrollIntoView({block:"center",inline:"center",behavior:"smooth"});el.focus({preventScroll:true})}}

function renderBanner(){q(".banner-slot").innerHTML=S.example?`<div class="banner"><b>Example</b><span>“The Last Crossing” is sample content showing how the spine fills in. Edit it, or start a new plan from the menu.</span><button class="btn sm" data-act="dismiss-example">Hide this note</button></div>`:""}

function cardHTML(s,info,M,list){
  const hl=M?(M.ids.has(s.id)?" hit":" dim"):"";
  const media=S.media?`<div class="chips"><span class="chip${s.footage.length?" on":""}">${s.footage.length} footage</span><span class="chip${s.audio.length?" on":""}">${s.audio.length} audio</span><span class="chip${s.vo.trim()?" on":""}">VO</span></div>`:"";
  const h=!list&&+s.h>0?Math.min(900,Math.max(70,+s.h)):0;
  return `<article class="card${list?" ol-card":""}${openId===s.id?" sel":""}${hl}${h?" sized":""}"${h?` style="height:${h}px"`:""} tabindex="0" role="button"${list?"":' draggable="true"'} data-scene="${s.id}" aria-label="Scene ${info.num}: ${esc(s.title||"Untitled")}">${list?"":'<span class="card-grip" data-grip="card" title="Drag to resize. Double-click to reset." aria-hidden="true"></span>'}
<div class="card-top"><span class="num">${info.num}</span><span class="tc">${fmtTC(info.start)}</span></div>
<div class="card-title">${s.title?esc(s.title):'<span class="ph">Untitled scene</span>'}</div>
${s.summary?`<div class="card-sum">${esc(s.summary)}</div>`:""}
<div class="card-foot"><span class="meter" title="Intensity ${s.intensity}/10"><i style="width:${s.intensity*10}%"></i></span><span class="dur">${fmtDur(s.dur)}</span></div>${media}</article>`}

function blockHead(b,I,acts){const isAct=b.kind==="act";
  return `<header class="blk-h"><div class="blk-tag"><span class="blk-name">${I.label}</span><span class="tc">${fmtTC(I.start)}–${fmtTC(I.end)}</span></div>
<input class="ghost blk-title" id="bt-${b.id}" data-b="${b.id}" data-f="title" value="${esc(b.title)}" placeholder="${isAct?"Act title":"Title"}" aria-label="${I.label} title" enterkeyhint="next">
<textarea class="ghost blk-purpose auto" id="bp-${b.id}" data-b="${b.id}" data-f="purpose" rows="1" placeholder="${isAct?"What this act does for the story":"What this moment does"}" aria-label="${I.label} purpose">${esc(b.purpose)}</textarea>
<div class="blk-actions">${isAct?`<button class="btn sm" data-act="add-seq" data-b="${b.id}">+ Sequence</button>`:""}${isAct&&acts>1?`<button class="btn sm danger" data-act="del-block" data-b="${b.id}" data-confirm="Click again to delete">Delete act</button>`:""}</div></header>`}
function seqHead(b,qq,qi){
  return `<div class="seq-h"><div class="seq-tag"><span>Sequence ${qi+1}</span>${b.sequences.length>1?`<button class="x" data-act="del-seq" data-q="${qq.id}" data-confirm="Delete?" aria-label="Delete sequence">×</button>`:""}</div>
<input class="ghost seq-title" id="qt-${qq.id}" data-q="${qq.id}" data-f="title" value="${esc(qq.title)}" placeholder="Sequence title" aria-label="Sequence title" enterkeyhint="next">
<textarea class="ghost seq-sum auto" id="qs-${qq.id}" data-q="${qq.id}" data-f="summary" rows="1" placeholder="What happens across these scenes" aria-label="Sequence summary">${esc(qq.summary)}</textarea></div>`}
function renderBoard(){
  const L=layout(),M=matches(),wrap=q(".board-wrap"),sl=wrap.scrollLeft,list=view==="list";
  const acts=S.blocks.filter(b=>b.kind==="act").length;let h="";
  wrap.classList.toggle("list",list);
  q(".view-hint").textContent=list?"Tap a scene to edit it. In the editor, use ‹ Prev / Next › (or swipe) to go card by card, and + Scene to add the next one."
    :"Prologue, acts, sequences, scenes. Click a card to open it; drag cards to reorder; drag the right edge of a column or the bottom edge of a card to resize it.";
  root.querySelectorAll('[data-act="view"]').forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.v===view)));
  S.blocks.forEach((b,bi)=>{
    const I=L.blocks.get(b.id),isAct=b.kind==="act";
    h+=`<section class="blk ${b.kind}${list?" ol":""}${M&&M.heads.has(b.id)?" hit-h":""}" style="--c:${I.color}">${blockHead(b,I,acts)}<div class="${list?"ol-body":"seqs"}">`;
    b.sequences.forEach((qq,qi)=>{
      const w=!list&&+qq.w>0?Math.min(640,Math.max(180,+qq.w)):0;
      h+=list?`<div class="ol-seq${M&&M.heads.has(qq.id)?" hit-h":""}">`
        :`<div class="seq${M&&M.heads.has(qq.id)?" hit-h":""}"${w?` style="width:${w}px"`:""}><span class="seq-grip" data-grip="seq" data-q="${qq.id}" title="Drag to resize. Double-click to reset." aria-hidden="true"></span>`;
      if(isAct)h+=seqHead(b,qq,qi);
      h+=`<div class="scenes" data-drop="${qq.id}">${qq.scenes.map(s=>cardHTML(s,L.scenes.get(s.id),M,list)).join("")}<button class="add-scene" data-act="add-scene" data-q="${qq.id}">+ Scene</button></div></div>`});
    h+=`</div></section>`;
    const next=S.blocks[bi+1];
    if(isAct&&(!next||next.kind!=="act"))h+=`<button class="add-act" data-act="add-act" data-after="${b.id}">+ Act</button>`});
  q(".board").innerHTML=h;if(!list)wrap.scrollLeft=sl;growAll(q(".board"))}

function smooth(p){if(p.length<2)return "";let d=`M${p[0][0]},${p[0][1]}`;
  for(let i=0;i<p.length-1;i++){const a=p[i-1]||p[i],b=p[i],c=p[i+1],e=p[i+2]||c;
    d+=` C${(b[0]+(c[0]-a[0])/6).toFixed(1)},${(b[1]+(c[1]-a[1])/6).toFixed(1)} ${(c[0]-(e[0]-b[0])/6).toFixed(1)},${(c[1]-(e[1]-b[1])/6).toFixed(1)} ${c[0]},${c[1]}`}
  return d}
function renderArc(){
  const el=root&&q(".arc");if(!el)return;
  const W=Math.max(300,Math.floor(el.clientWidth)),H=W<640?210:250,m={l:34,r:16,t:50,b:30};
  const L=layout(),eff=s=>Math.max(s.dur||0,20);
  let t=0;const pos=new Map(),bands=[];
  S.blocks.forEach(b=>{const I=L.blocks.get(b.id),b0=t,seqCuts=[];
    b.sequences.forEach((qq,qi)=>{if(qi>0)seqCuts.push(t);qq.scenes.forEach(s=>{pos.set(s.id,[t,eff(s)]);t+=eff(s)})});
    bands.push({b,I,x0:b0,x1:t,seqCuts})});
  const target=(+S.film.target||0)*60,span=Math.max(t,target,60);
  const X=v=>m.l+v/span*(W-m.l-m.r),Y=v=>m.t+(1-v/10)*(H-m.t-m.b),base=H-m.b;
  let g="";
  [0,5,10].forEach(v=>{g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--line)" stroke-dasharray="${v?"2 4":"0"}"/><text x="${m.l-8}" y="${Y(v)+3.5}" text-anchor="end" font-size="10" style="fill:var(--muted)">${v}</text>`});
  g+=`<text transform="translate(10 ${(m.t+base)/2}) rotate(-90)" text-anchor="middle" font-size="9.5" letter-spacing="1.2" style="fill:var(--muted)">INTENSITY</text>`;
  if(target&&t>target)g+=`<rect x="${X(target)}" y="${m.t}" width="${X(t)-X(target)}" height="${base-m.t}" style="fill:var(--warn)" opacity=".08"/>`;
  bands.forEach(({b,I,x0,x1,seqCuts},k)=>{const a=X(x0),z=X(x1),w=z-a;
    g+=`<rect x="${a}" y="${m.t}" width="${Math.max(0,w)}" height="${base-m.t}" style="fill:${I.color}" opacity=".07"/>`;
    g+=`<rect x="${a}" y="${m.t-6}" width="${Math.max(0,w-1)}" height="3" style="fill:${I.color}"/>`;
    if(k>0)g+=`<line x1="${a}" x2="${a}" y1="${m.t-6}" y2="${base}" style="stroke:var(--line)"/>`;
    seqCuts.forEach(c=>{g+=`<line x1="${X(c)}" x2="${X(c)}" y1="${m.t}" y2="${base}" style="stroke:${I.color}" stroke-dasharray="2 3" opacity=".5"/>`});
    if(w>34){const lab=w>70?I.label.toUpperCase():(b.kind==="act"?(ROMAN[I.n-1]||I.n):I.label[0]);
      g+=`<text x="${a+4}" y="${m.t-30}" font-size="10" font-weight="700" letter-spacing="1.3" style="fill:${I.color};font-family:var(--f-display)">${esc(lab)}</text>`;
      const max=Math.floor((w-8)/6.4);let ti=b.title||"";if(ti.length>max)ti=max>3?ti.slice(0,max-1)+"…":"";
      if(ti)g+=`<text x="${a+4}" y="${m.t-15}" font-size="11.5" style="fill:var(--ink)">${esc(ti)}</text>`}});
  const steps=[60,120,300,600,900,1200,1800,3600];const step=steps.find(s=>span/s<=(W<640?5:9))||3600;
  for(let v=0;v<=span+1;v+=step)g+=`<line x1="${X(v)}" x2="${X(v)}" y1="${base}" y2="${base+4}" style="stroke:var(--muted)"/><text x="${X(v)}" y="${base+16}" text-anchor="${v===0?"start":"middle"}" font-size="10" style="fill:var(--muted);font-family:var(--f-mono)">${Math.round(v/60)}′</text>`;
  if(target){const tx=X(target);g+=`<line x1="${tx}" x2="${tx}" y1="${m.t}" y2="${base}" style="stroke:var(--ink)" stroke-dasharray="5 4" opacity=".55"/><text x="${tx-4}" y="${base-6}" text-anchor="end" font-size="10" style="fill:var(--muted);font-family:var(--f-mono)">target ${fmtDur(target)}</text>`}
  const pts=L.list.map(i=>{const [s0,d]=pos.get(i.s.id);return [+X(s0+d/2).toFixed(1),+Y(i.s.intensity).toFixed(1),i]});
  if(pts.length){const p=pts.map(x=>[x[0],x[1]]),d=smooth(p);
    if(p.length>1)g+=`<path d="${d} L${p[p.length-1][0]},${base} L${p[0][0]},${base} Z" style="fill:var(--ink)" opacity=".05"/><path d="${d}" fill="none" style="stroke:var(--ink)" stroke-width="2" stroke-linecap="round"/>`;
    const M=matches();
    pts.forEach(([x,y,i])=>{const sel=i.s.id===openId,on=M&&M.ids.has(i.s.id),off=M&&!on;
      if(on)g+=`<circle cx="${x}" cy="${y}" r="10" fill="none" style="stroke:var(--ink)" stroke-width="1.5"/>`;
      g+=`<circle class="dot" data-scene="${i.s.id}" cx="${x}" cy="${y}" r="${sel?8:5.5}" style="fill:${i.color};stroke:var(--panel)" stroke-width="2"${off?' opacity=".2"':""}><title>${esc(i.num+"  "+(i.s.title||"Untitled scene")+"  ·  intensity "+i.s.intensity+"/10  ·  "+fmtDur(i.s.dur))}</title></circle>`})}
  else g+=`<text x="${W/2}" y="${H/2}" text-anchor="middle" style="fill:var(--muted)">Add a scene to start drawing the arc</text>`;
  el.innerHTML=`<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Story arc: scene intensity over running time">${g}</svg>`}

function segHTML(v){let h="";for(let i=1;i<=10;i++)h+=`<button type="button" data-act="int" data-v="${i}" class="${i<=v?"on":""}" aria-pressed="${i===v}">${i}</button>`;return h}
function voMeta(s){const n=words(s.vo),sec=Math.round(n/150*60),long=s.dur&&sec>s.dur;
  return `<span class="vo-meta${long?" warn":""}">${n} words · ~${fmtDur(sec)} read${long?" · longer than the scene":""}</span>`}
function itemRow(list,it,i){const types=list==="footage"?FT:AT;
  return `<div class="mi" data-list="${list}" data-i="${i}"><select id="${list}-t-${it.id}" data-k="type" aria-label="Type">${types.map(t=>`<option${t===it.type?" selected":""}>${t}</option>`).join("")}</select><input id="${list}-d-${it.id}" data-k="desc" value="${esc(it.desc)}" placeholder="${list==="footage"?"What we see":"What we hear"}" aria-label="Description"><button class="x" data-act="del-item" aria-label="Remove">×</button>${list==="footage"?`<input class="ref" id="${list}-r-${it.id}" data-k="ref" value="${esc(it.ref)}" placeholder="Clip name, file or source" aria-label="Clip reference">`:""}</div>`}
function mediaHTML(s){
  return `<div class="media"><h3>Production layer</h3>
<div class="mlist"><div class="mh"><span>Footage</span><button class="btn sm" data-act="add-item" data-list="footage">+ Footage</button></div>${s.footage.map((it,i)=>itemRow("footage",it,i)).join("")||'<p class="empty">No footage listed yet.</p>'}</div>
<div class="mlist"><div class="mh"><span>Audio</span><button class="btn sm" data-act="add-item" data-list="audio">+ Audio</button></div>${s.audio.map((it,i)=>itemRow("audio",it,i)).join("")||'<p class="empty">No audio listed yet.</p>'}</div>
<div class="mlist"><div class="mh"><span>Voice-over</span><span class="vo-slot">${voMeta(s)}</span></div><textarea id="d-vo" data-f="vo" rows="3" class="vo auto" placeholder="VO script for this scene">${esc(s.vo)}</textarea></div></div>`}
function renderDrawer(focusSel){
  const d=q(".drawer");const f=openId&&find(openId);
  if(!f){openId=null;d.hidden=true;d.innerHTML="";return}
  const s=f.s,L=layout(),info=L.scenes.get(s.id),idx=L.list.indexOf(info),n=L.list.length;
  d.style.setProperty("--c",info.color);d.hidden=false;
  d.innerHTML=`<div class="dr-h"><div><div class="dr-tag">${info.blockLabel}${info.seqLabel?" · "+info.seqLabel:""} · Scene ${info.num}</div><div class="tc d-tc">${fmtTC(info.start)} – ${fmtTC(info.start+(s.dur||0))}</div></div><button class="x big" data-act="close" aria-label="Close editor">×</button></div>
<div class="dr-body">
<label class="fld"><span>Scene title</span><input class="d-title" id="d-title" data-f="title" value="${esc(s.title)}" placeholder="Name the scene" enterkeyhint="next" autocapitalize="sentences"></label>
<label class="fld"><span>What happens</span><textarea id="d-summary" data-f="summary" rows="3" class="auto" placeholder="What the audience sees and learns" autocapitalize="sentences">${esc(s.summary)}</textarea></label>
<div class="row2"><label class="fld"><span>Location</span><input id="d-location" data-f="location" value="${esc(s.location)}" placeholder="Where" enterkeyhint="next"></label><label class="fld"><span>Length</span><input class="d-dur" id="d-dur" data-f="dur" value="${fmtDur(s.dur)}" inputmode="numeric" placeholder="90 or 1:30" title="Seconds (90), or minutes:seconds (1:30)" enterkeyhint="done"><small class="fld-hint">seconds, or m:ss</small></label></div>
<div class="qchips" role="group" aria-label="Quick length">${DURQ.map(([v,t])=>`<button type="button" data-act="dur" data-v="${v}" aria-pressed="${s.dur===v}">${t}</button>`).join("")}</div>
<div class="fld"><span>Intensity <b class="d-int-v">${s.intensity}</b> / 10</span><div class="seg" role="group" aria-label="Intensity">${segHTML(s.intensity)}</div></div>
<label class="fld"><span>Why this scene is here</span><textarea id="d-beat" data-f="beat" rows="2" class="auto" placeholder="Story beat or purpose">${esc(s.beat)}</textarea></label>
<label class="fld"><span>Notes</span><textarea id="d-notes" data-f="notes" rows="2" class="auto" placeholder="Shooting ideas, open questions">${esc(s.notes)}</textarea></label>
${S.media?mediaHTML(s):`<div class="media-off"><p>Footage, audio and voice-over go in the production layer. Turn it on when the structure feels settled.</p><button class="btn sm" data-act="media-on">Turn on production layer</button></div>`}
<div class="dr-actions"><span class="dr-al">Move</span><button class="btn sm" data-act="move" data-dir="-1">← Earlier</button><button class="btn sm" data-act="move" data-dir="1">Later →</button><span class="sp"></span><button class="btn sm danger" data-act="del-scene" data-confirm="Tap again to delete">Delete scene</button></div>
</div>
<nav class="dr-nav" aria-label="Go card by card"><button class="btn" data-act="nav" data-dir="-1"${idx<=0?" disabled":""} aria-label="Previous scene">‹ Prev</button><span class="dr-pos">${idx+1} / ${n}</span><button class="btn" data-act="nav" data-dir="1"${idx>=n-1?" disabled":""} aria-label="Next scene">Next ›</button><button class="btn primary" data-act="add-after" title="Add a new scene right after this one">+ Scene</button></nav>`;
  growAll(d);
  if(focusSel){const el=d.querySelector(focusSel);if(el)el.focus()}}

/* ---------- changes ---------- */
function changed(structural){
  S.updatedAt=Date.now();
  if(structural){renderBoard();renderDrawer()}
  renderArc();updateRuntime();if(query)renderResults();
  if(opts.onChange)opts.onChange(S)}
function updateRuntime(){const L=layout(),tg=(+S.film.target||0)*60,diff=L.total-tg;
  q(".runtime").innerHTML=`Running time ${fmtDur(L.total)}${tg?` · ${diff>0?`<span class="over">${fmtDur(diff)} over</span>`:`${fmtDur(-diff)} under`}`:""} · ${L.list.length} scenes`}
/* Phone Back button closes the editor instead of leaving the app. */
let histPushed=false;
try{if(history.state&&history.state.spineDrawer)history.replaceState(null,"")}catch(e){}
function pushHist(){if(histPushed)return;try{history.pushState({spineDrawer:1},"");histPushed=true}catch(e){}}
function popHist(){if(!histPushed)return;histPushed=false;try{if(history.state&&history.state.spineDrawer)history.back()}catch(e){}}
window.addEventListener("popstate",()=>{if(histPushed){histPushed=false;if(openId){openId=null;renderDrawer();renderBoard();renderArc()}}});
function open(id,scroll,focus){const was=openId;openId=id;if(!was)pushHist();renderBoard();renderArc();
  renderDrawer(focus||(TOUCH?null:"#d-title"));
  if(scroll){const c=root.querySelector(`.card[data-scene="${id}"]`);if(c)c.scrollIntoView({block:"nearest",inline:"center",behavior:"smooth"})}}
function navStep(dir){const L=layout().list,i=L.findIndex(x=>x.s.id===openId),n=L[i+dir];if(n)open(n.s.id,true)}
function addAfter(){const f=find(openId);if(!f)return;const s=newScene();f.q.scenes.splice(f.i+1,0,s);openId=s.id;changed(true);
  const t=q("#d-title");if(t)t.focus();const c=root.querySelector(`.card[data-scene="${s.id}"]`);if(c)c.scrollIntoView({block:"nearest",inline:"center"})}
function closeDrawer(){if(!openId)return false;openId=null;popHist();renderDrawer();renderBoard();renderArc();return true}
function allSeqs(){const out=[];S.blocks.forEach(b=>b.sequences.forEach(x=>out.push(x)));return out}
function moveTo(id,qid,refId,after){const f=find(id),tq=findSeq(qid);if(!f||!tq)return;
  const [s]=f.q.scenes.splice(f.i,1);let idx=tq.q.scenes.length;
  if(refId){const r=tq.q.scenes.findIndex(x=>x.id===refId);if(r>=0)idx=r+(after?1:0)}
  tq.q.scenes.splice(idx,0,s);changed(true)}
function moveStep(dir){const f=find(openId);if(!f)return;const seqs=allSeqs(),qi=seqs.indexOf(f.q);
  if(dir<0){if(f.i>0)f.q.scenes.splice(f.i-1,0,f.q.scenes.splice(f.i,1)[0]);else if(qi>0)seqs[qi-1].scenes.push(f.q.scenes.splice(f.i,1)[0]);else return}
  else{if(f.i<f.q.scenes.length-1)f.q.scenes.splice(f.i+1,0,f.q.scenes.splice(f.i,1)[0]);else if(qi<seqs.length-1)seqs[qi+1].scenes.unshift(f.q.scenes.splice(f.i,1)[0]);else return}
  changed(true)}
function arm(btn,fn){if(btn.dataset.armed){fn();return}
  btn.dataset.armed="1";const old=btn.textContent;btn.textContent=btn.dataset.confirm||"Confirm";
  setTimeout(()=>{if(btn.isConnected&&btn.dataset.armed){delete btn.dataset.armed;btn.textContent=old}},3500)}
function grow(t){t.style.height="auto";t.style.height=t.scrollHeight+2+"px"}
function growAll(r){r.querySelectorAll("textarea.auto").forEach(grow)}

/* ---------- events ---------- */
function onClick(e){
  if(e.target.closest("[data-grip]"))return;
  const dot=e.target.closest(".dot");if(dot){open(dot.dataset.scene,true);return}
  const res=e.target.closest(".res");if(res){openResult(res);return}
  const a=e.target.closest("[data-act]");
  if(!a){const c=e.target.closest(".card");if(c)open(c.dataset.scene);return}
  const act=a.dataset.act;
  if(act==="add-scene"){const f=findSeq(a.dataset.q),s=newScene();f.q.scenes.push(s);if(!openId)pushHist();openId=s.id;changed(true);renderArc();renderDrawer("#d-title")}
  else if(act==="view"){view=a.dataset.v;try{localStorage.setItem("spine.view",view)}catch(err){}renderBoard()}
  else if(act==="nav")navStep(+a.dataset.dir);
  else if(act==="add-after")addAfter();
  else if(act==="int"){const f=find(openId);if(!f)return;f.s.intensity=+a.dataset.v;
    const g=a.parentNode;g.innerHTML=segHTML(f.s.intensity);q(".d-int-v").textContent=f.s.intensity;changed();renderBoard()}
  else if(act==="dur"){const f=find(openId);if(!f)return;f.s.dur=+a.dataset.v;setDurUI(f.s);changed();renderBoard()}
  else if(act==="add-seq"){S.blocks.find(b=>b.id===a.dataset.b).sequences.push(newSeq());changed(true)}
  else if(act==="del-seq")arm(a,()=>{const f=findSeq(a.dataset.q);if(openId&&f.q.scenes.some(s=>s.id===openId))openId=null;f.b.sequences.splice(f.b.sequences.indexOf(f.q),1);changed(true)});
  else if(act==="add-act"){const i=S.blocks.findIndex(b=>b.id===a.dataset.after);S.blocks.splice(i+1,0,{id:uid(),kind:"act",title:"",purpose:"",sequences:[newSeq()]});changed(true)}
  else if(act==="del-block")arm(a,()=>{const i=S.blocks.findIndex(b=>b.id===a.dataset.b);if(openId&&S.blocks[i].sequences.some(x=>x.scenes.some(s=>s.id===openId)))openId=null;S.blocks.splice(i,1);changed(true)});
  else if(act==="del-scene")arm(a,()=>{const f=find(openId);if(f){f.q.scenes.splice(f.i,1);openId=null;popHist();changed(true)}});
  else if(act==="move")moveStep(+a.dataset.dir);
  else if(act==="close")closeDrawer();
  else if(act==="media-on"){S.media=true;q("#f-media").checked=true;changed(true)}
  else if(act==="add-item"){const f=find(openId),list=a.dataset.list,it={id:uid(),type:list==="footage"?FT[1]:AT[0],desc:"",ref:""};f.s[list].push(it);changed();renderBoard();renderDrawer(`#${list}-d-${it.id}`)}
  else if(act==="del-item"){const row=a.closest(".mi"),f=find(openId);f.s[row.dataset.list].splice(+row.dataset.i,1);changed();renderBoard();renderDrawer()}
  else if(act==="dismiss-example"){S.example=false;renderBanner();changed()}
}
function setDurUI(s){const d=q(".drawer"),inp=d.querySelector("#d-dur");if(inp&&document.activeElement!==inp){inp.value=fmtDur(s.dur);inp.classList.remove("bad")}
  const st=layout().scenes.get(s.id).start;d.querySelector(".d-tc").textContent=fmtTC(st)+" – "+fmtTC(st+s.dur);
  d.querySelectorAll('[data-act="dur"]').forEach(b=>b.setAttribute("aria-pressed",String(+b.dataset.v===s.dur)));
  const vs=d.querySelector(".vo-slot");if(vs)vs.innerHTML=voMeta(s)}
function bindInner(){
  const board=q(".board"),drawer=q(".drawer"),search=q("#f-search");
  search.addEventListener("input",()=>{query=search.value;renderResults();renderBoard();renderArc()});
  search.addEventListener("keydown",e=>{
    if(e.key==="Enter"){const first=q(".res");if(first){e.preventDefault();openResult(first)}}
    else if(e.key==="Escape"&&search.value){e.preventDefault();e.stopPropagation();search.value="";query="";renderResults();renderBoard();renderArc()}});
  q(".top").addEventListener("input",e=>{const t=e.target;
    if(t.id==="f-title")S.film.title=t.value;else if(t.id==="f-logline"){S.film.logline=t.value;grow(t)}
    else if(t.id==="f-director")S.film.director=t.value;
    else if(t.id==="f-target"){const v=parseInt(t.value,10);S.film.target=isNaN(v)?0:Math.max(0,v)}
    else return;
    changed()});
  q("#f-media").addEventListener("change",e=>{S.media=e.target.checked;changed(true)});
  board.addEventListener("input",e=>{const t=e.target,k=t.dataset.f;if(!k)return;
    if(t.dataset.b)S.blocks.find(b=>b.id===t.dataset.b)[k]=t.value;else if(t.dataset.q)findSeq(t.dataset.q).q[k]=t.value;
    if(t.tagName==="TEXTAREA")grow(t);changed()});
  drawer.addEventListener("input",e=>{const t=e.target,f=find(openId);if(!f)return;const s=f.s,row=t.closest(".mi");
    if(row){s[row.dataset.list][+row.dataset.i][t.dataset.k]=t.value;changed();renderBoard();return}
    const k=t.dataset.f;if(!k)return;
    if(k==="dur"){const v=parseDur(t.value);t.classList.toggle("bad",v===null);if(v===null)return;s.dur=v;setDurUI(s)}
    else s[k]=t.value;
    const vs=drawer.querySelector(".vo-slot");if(vs&&(k==="vo"||k==="dur"))vs.innerHTML=voMeta(s);
    if(t.tagName==="TEXTAREA")grow(t);
    changed();renderBoard()});
  drawer.addEventListener("change",e=>{if(e.target.id==="d-dur"){const f=find(openId);if(f){e.target.value=fmtDur(f.s.dur);e.target.classList.remove("bad")}}});
  /* Enter on a one-line field moves to the next field, like a phone form. */
  drawer.addEventListener("keydown",e=>{if(e.key!=="Enter"||e.isComposing)return;const nx={"d-title":"#d-summary","d-location":"#d-dur"}[e.target.id];
    if(nx){e.preventDefault();const el=drawer.querySelector(nx);if(el)el.focus()}else if(e.target.id==="d-dur"){e.preventDefault();e.target.blur()}});
  /* Swipe left / right on the editor (outside text fields) to go to the next / previous scene. */
  let sw=null;
  drawer.addEventListener("touchstart",e=>{sw=null;if(e.touches.length!==1||e.target.closest("input,textarea,select,.seg,.qchips"))return;const t=e.touches[0];sw={x:t.clientX,y:t.clientY}},{passive:true});
  drawer.addEventListener("touchend",e=>{if(!sw)return;const t=e.changedTouches[0],dx=t.clientX-sw.x,dy=t.clientY-sw.y;sw=null;
    if(Math.abs(dx)>70&&Math.abs(dy)<Math.abs(dx)*.5)navStep(dx<0?1:-1)},{passive:true});
  let rz=null;
  board.addEventListener("pointerdown",e=>{const g=e.target.closest("[data-grip]");if(!g)return;e.preventDefault();e.stopPropagation();
    const el=g.dataset.grip==="seq"?g.closest(".seq"):g.closest(".card"),r=el.getBoundingClientRect();
    rz={g,el,kind:g.dataset.grip,x:e.clientX,y:e.clientY,w:r.width,h:r.height,moved:false};
    try{g.setPointerCapture(e.pointerId)}catch(err){}el.classList.add("resizing")});
  board.addEventListener("pointermove",e=>{if(!rz)return;const dx=e.clientX-rz.x,dy=e.clientY-rz.y;if(Math.abs(dx)+Math.abs(dy)>2)rz.moved=true;
    if(rz.kind==="seq")rz.el.style.width=Math.round(Math.min(640,Math.max(180,rz.w+dx)))+"px";
    else{rz.el.style.height=Math.round(Math.min(900,Math.max(70,rz.h+dy)))+"px";rz.el.classList.add("sized")}});
  const endRz=()=>{if(!rz)return;const r=rz;rz=null;r.el.classList.remove("resizing");if(!r.moved)return;
    if(r.kind==="seq"){const f=findSeq(r.g.dataset.q);if(f)f.q.w=parseInt(r.el.style.width,10)}
    else{const f=find(r.el.dataset.scene);if(f)f.s.h=parseInt(r.el.style.height,10)}
    changed()};
  board.addEventListener("pointerup",endRz);board.addEventListener("pointercancel",endRz);
  board.addEventListener("dblclick",e=>{const g=e.target.closest("[data-grip]");if(!g)return;e.stopPropagation();
    if(g.dataset.grip==="seq"){const f=findSeq(g.dataset.q);if(f)delete f.q.w}else{const f=find(g.closest(".card").dataset.scene);if(f)delete f.s.h}
    changed(true)});
  board.addEventListener("dragstart",e=>{if(rz){e.preventDefault();return}const c=e.target.closest(".card");if(!c)return;dragId=c.dataset.scene;e.dataTransfer.effectAllowed="move";try{e.dataTransfer.setData("text/plain",dragId)}catch(err){}c.classList.add("dragging")});
  const clearMarks=()=>board.querySelectorAll(".drop-before,.drop-after,.drop-end").forEach(x=>x.classList.remove("drop-before","drop-after","drop-end"));
  board.addEventListener("dragend",()=>{dragId=null;clearMarks();board.querySelectorAll(".dragging").forEach(x=>x.classList.remove("dragging"))});
  board.addEventListener("dragover",e=>{if(!dragId)return;const z=e.target.closest(".scenes");if(!z)return;e.preventDefault();clearMarks();
    const c=e.target.closest(".card");
    if(c&&c.dataset.scene!==dragId){const r=c.getBoundingClientRect();c.classList.add(e.clientY<r.top+r.height/2?"drop-before":"drop-after")}else if(!c)z.classList.add("drop-end")});
  board.addEventListener("drop",e=>{if(!dragId)return;const z=e.target.closest(".scenes");if(!z)return;e.preventDefault();
    const c=e.target.closest(".card");let ref=null,after=false;
    if(c){if(c.dataset.scene===dragId){dragId=null;clearMarks();return}const r=c.getBoundingClientRect();after=e.clientY>=r.top+r.height/2;ref=c.dataset.scene}
    const id=dragId;dragId=null;moveTo(id,z.dataset.drop,ref,after)});
}

function mount(el,state,o){
  if(!root)document.addEventListener("keydown",e=>{
    const k=e.key.toLowerCase(),typing=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement&&document.activeElement.tagName);
    if(((e.ctrlKey||e.metaKey)&&(k==="f"||k==="k"))||(k==="/"&&!typing&&!e.ctrlKey&&!e.metaKey)){
      const i=root&&root.querySelector("#f-search");if(i){e.preventDefault();i.focus();i.select()}}});
  if(root!==el){el.addEventListener("click",onClick);
    el.addEventListener("keydown",e=>{const c=e.target.closest&&e.target.closest(".card");if(c&&(e.key==="Enter"||e.key===" ")&&e.target===c){e.preventDefault();open(c.dataset.scene)}})}
  root=el;opts=o||{};S=normalize(state);openId=null;renderShell()}
function setState(st){S=normalize(st);if(openId)popHist();openId=null;query="";renderShell()}
function getState(){return S}

return {mount,setState,getState,closeDrawer,normalize,blankState,exampleState,clone,esc,fmtDur}
})();
