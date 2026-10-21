/* 製裝方法 → 製裝台：仿遊戲的倉庫＋背包。
   右鍵拿通貨 → 左鍵點裝備套用（Shift 連續用）；左鍵拿起／放下裝備；Ctrl＋左鍵在背包和倉庫間快速移動。
   規則在 craft-engine.js；存檔一律透過 window.CraftStorage（存檔是一整個物件，這裡只動自己的欄位）。
   index.html 在第一次打開「製裝方法」分頁時才載入這支（在 craft-data.js、craft-engine.js 之後）。 */
(function(){
"use strict";
const CE=window.CraftEngine, D=window.CRAFT_DATA, St=window.CraftStorage||null;
const root=document.getElementById("kbench");
if(!CE||!D||!root) return;
const E=CE.create(D);

/* ── 設定 ── */
const COLS=12, ROWS=12, UNDO_MAX=50, FLASH_MS=2000;
/* 通貨放在「一般」頁的第幾格（stash_layouts.json 裡 CURRENCY_PAGE 那張背景的 i，由上到下、由左到右） */
const CURRENCY_PAGE="stash_page_A";
const CURRENCY_SLOT={transmute:10,alt:11,annul:12,exalt:14,regal:16,alch:17,chaos:18,aug:23,divine:29,scour:35};
/* 擺設用的通貨：模擬器還不支援，只放圖示（右鍵拿不起來）。
   某顆做成可用時，把它從這裡搬到 CURRENCY_SLOT（並在 craft-engine.js 的 CURRENCIES 加上規則）。
   機會石、瓦爾寶珠：Kalandralang 沒有實作，規則先不做。 */
const DECOR_SLOT={scrollfrag:0,wisdom:1,portal:2,whetstone:6,scrap:7,bauble:8,gcp:9,chance:13,mirror:15,
  blessed:19,transshard:20,altshard:21,chaosshard:22,mirrorshard:24,exaltshard:26,alchshard:27,regalshard:28,
  annulshard:30,jeweller:31,fusing:32,chrom:33,sacred:36,deck:37,vaal:38,fracture:39,fractureshard:40,
  binding:41,regret:43,unmaking:44};
/* 通貨頁的三個子分頁；按鈕在每一頁都放在同一個相對位置（以 1254 寬計算） */
const CUR_SUBS=[
  {k:"general",zh:"一般",bg:CURRENCY_PAGE,box:[150,14,418,75]},
  {k:"atlas",zh:"輿圖",bg:"stash_currency_general",box:[483,14,752,75]},
  {k:"league",zh:"聯盟",bg:"stash_page_B",box:[818,14,1086,75]},
];
const TAB_COLORS=["#7a1f1f","#7a4a1f","#6b6a1f","#2f6b2f","#1f6b66","#1f4f7a","#4a2f7a","#6b1f5a","#3a3a3a"];
const IMG="img/craft/";
const GROUP_ZH={weapon:"武器",armour:"護甲",jewellery:"飾品"};

const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
/* 詞綴語言（index.html 的 window.CraftLang；中文沒有翻譯的會自動顯示英文） */
const L=()=>window.CraftLang?window.CraftLang.get():"zh";
const nameCount={};
E.bases.forEach(b=>nameCount[b.n]=(nameCount[b.n]||0)+1);
/* 同名底材（例如三種雙玉戒指）用固有詞綴區分 */
const baseLabel=(b,lang)=>{
  lang=lang||L();
  const n=E.baseName(b.i,lang);
  return nameCount[b.n]>1&&b.imp.length?n+"（"+E.implicitLines(b.i,lang).join("、")+"）":n;
};
/* 搜尋：中文、英文都找得到 */
const baseHay=b=>(baseLabel(b,"zh")+"\n"+baseLabel(b,"en")).toLowerCase();
const sizeOf=item=>{ const b=E.bases[item.b]; return {w:b.w||1,h:b.h||1}; };

/* ── 狀態 ── */
const S={
  inv:[],                 // [{id,x,y,item}]
  tabs:[],                // [{id,name,color,items:[…]}]
  used:{},                // 通貨使用次數
  active:"currency",      // "currency" 或倉庫頁 id
  curSub:"general",
  held:null,              // {kind:"cur",k} 或 {kind:"item",e,from:{cid,x,y},snap}
  undo:[],
  layouts:null,
  ready:false,
};
const cont=cid=>cid==="inv"?S.inv:(S.tabs.find(t=>t.id===cid)||{}).items||null;

/* ── 存檔 ── */
function validItem(it){
  if(!it||typeof it!=="object") return null;
  const b=it.b|0, lv=it.lv|0, r=it.r|0;
  if(!(b>=0&&b<E.bases.length)||!(lv>=1&&lv<=100)||!(r>=0&&r<=2)||!Array.isArray(it.mods)) return null;
  const mods=[];
  for(const x of it.mods){
    if(!x||!(x.m>=0&&x.m<E.mods.length)||!Array.isArray(x.v)) return null;
    mods.push({m:x.m|0,v:x.v.map(Number)});
  }
  return {b,lv,r,mods};
}
function fits(list,x,y,w,h,ignore){
  if(x<0||y<0||x+w>COLS||y+h>ROWS) return false;
  return !list.some(e=>e!==ignore&&overlap(e,x,y,w,h));
}
function overlap(e,x,y,w,h){
  const s=sizeOf(e.item);
  return e.x<x+w&&x<e.x+s.w&&e.y<y+h&&y<e.y+s.h;
}
/* 第一個放得下的位置（照遊戲：由上到下、再由左到右） */
function firstFit(list,w,h){
  for(let x=0;x<=COLS-w;x++) for(let y=0;y<=ROWS-h;y++) if(fits(list,x,y,w,h)) return {x,y};
  return null;
}
function readEntries(arr){
  const out=[];
  if(!Array.isArray(arr)) return out;
  for(const e of arr){
    const item=validItem(e&&e.item); if(!item) continue;
    const s=sizeOf(item);
    let x=e.x|0, y=e.y|0;
    if(!fits(out,x,y,s.w,s.h)){ const p=firstFit(out,s.w,s.h); if(!p) continue; x=p.x; y=p.y; }
    out.push({id:typeof e.id==="string"?e.id:uid(),x,y,item});
  }
  return out;
}
/* 讀檔：格式不對（例如第一階段的存檔測試文字）就當作空倉庫 */
function fromSave(d){
  const ok=d&&typeof d==="object"&&d.v===2;
  S.inv=ok?readEntries(d.inventory):[];
  S.tabs=ok&&Array.isArray(d.tabs)?d.tabs.filter(t=>t&&typeof t==="object").map(t=>({
    id:typeof t.id==="string"?t.id:uid(),
    name:String(t.name||"倉庫頁").slice(0,20),
    color:/^#[0-9a-f]{6}$/i.test(t.color)?t.color:TAB_COLORS[0],
    items:readEntries(t.items),
  })):[];
  S.used={};
  if(ok&&d.currencyUsed&&typeof d.currencyUsed==="object")
    for(const c of CE.CURRENCIES){ const n=d.currencyUsed[c.k]|0; if(n>0) S.used[c.k]=n; }
  if(!S.tabs.length) S.tabs.push({id:uid(),name:"暫存區",color:TAB_COLORS[0],items:[]});
  S.active=ok&&(d.activeTab==="currency"||S.tabs.some(t=>t.id===d.activeTab))?d.activeTab:"currency";
}
/* 存檔時：拿在游標上的裝備當作還在原位 */
function toSave(){
  const inv=S.inv.slice(), tabs=S.tabs.map(t=>({id:t.id,name:t.name,color:t.color,items:t.items.slice()}));
  const h=S.held;
  if(h&&h.kind==="item"){
    const list=h.from.cid==="inv"?inv:(tabs.find(t=>t.id===h.from.cid)||{}).items||inv;
    const s=sizeOf(h.e.item);
    let p=fits(list,h.from.x,h.from.y,s.w,s.h)?{x:h.from.x,y:h.from.y}:firstFit(list,s.w,s.h);
    let target=list;
    if(!p){ target=inv; p=firstFit(inv,s.w,s.h); }
    if(p) target.push({...h.e,x:p.x,y:p.y});
  }
  const strip=e=>({id:e.id,x:e.x,y:e.y,item:e.item});
  return {v:2,inventory:inv.map(strip),tabs:tabs.map(t=>({...t,items:t.items.map(strip)})),
    currencyUsed:{...S.used},activeTab:S.active};
}
let saveTimer=null, doc={};   // doc：上一次讀到的整份存檔（其他欄位例如 prices 原樣保留）
function merged(cur){
  if(!cur||typeof cur!=="object"||Array.isArray(cur)) cur={};
  const next={...cur,...toSave()};
  delete next.text;   // 第一階段「存檔測試」留下的欄位
  return next;
}
function save(){
  if(!St||!S.ready) return;
  clearTimeout(saveTimer);
  saveTimer=setTimeout(async()=>{
    saveTimer=null;
    try{ doc=(await St.load())||{}; }catch(e){}
    doc=merged(doc);
    St.save(doc);
  },100);   // 本機很快就存；上傳雲端由 CraftStorage 等停止操作 5 秒後再合併
}
/* 離開頁面前（CraftStorage 要補同步）：還沒交出去的改動，用目前最新的整份存檔合併後馬上存 */
window.addEventListener("craftstorage:beforeflush",e=>{
  if(!saveTimer||!St||!S.ready) return;
  clearTimeout(saveTimer); saveTimer=null;
  doc=merged(e.detail&&e.detail.current||doc); St.save(doc);
});
/* 使用者在衝突視窗選了「用雲端的」：整份換掉 */
/* 切換中／EN：重畫格子（圖示的替代文字）和說明框 */
window.addEventListener("craftlang",()=>{ if(S.ready){ drawAll(); refreshTip(); } });
window.addEventListener("craftstorage:data",e=>{
  dropHeld(true);
  fromSave(e.detail);
  S.undo=[];
  drawAll(); refreshTip();
});

/* ── 上一步：每個動作前存一份快照（只含物品和通貨次數，不含分頁名稱和顏色） ── */
function snapshot(){
  const c=e=>({id:e.id,x:e.x,y:e.y,item:E.clone(e.item)});
  return {inv:S.inv.map(c),tabs:Object.fromEntries(S.tabs.map(t=>[t.id,t.items.map(c)])),used:{...S.used}};
}
function pushUndo(snap,label){
  S.undo.push({snap:snap||snapshot(),label});
  if(S.undo.length>UNDO_MAX) S.undo.shift();
  drawUndo();
}
function undo(){
  if(S.held&&S.held.kind==="item") returnHeld();
  const u=S.undo.pop(); if(!u) { flash("沒有可以退回的動作"); return; }
  S.inv=u.snap.inv;
  for(const t of S.tabs) if(u.snap.tabs[t.id]) t.items=u.snap.tabs[t.id];
  S.used=u.snap.used;
  flash("已退回："+u.label,true);
  drawAll(); refreshTip(); save();
}

/* ── 骨架 ── */
root.innerHTML=`
<div class="kb">
  <section class="kb-stash" aria-label="倉庫">
    <img class="kb-head" src="${IMG}stash_header.webp" alt="倉庫" draggable="false">
    <div class="kb-strip" id="kb-strip" role="tablist" aria-label="倉庫分頁"></div>
    <div class="kb-page" id="kb-page"></div>
    <div class="kb-curbar" id="kb-curbar"></div>
  </section>
  <nav class="kb-list" id="kb-list" aria-label="倉庫分頁清單"></nav>
  <section class="kb-inv" aria-label="背包">
    <div class="kb-invbar"><span class="t">背包</span>
      <button class="kb-btn" id="kb-vendor">底材商人</button>
      <button class="kb-btn" id="kb-undo" title="Ctrl+Z">上一步</button></div>
    <div class="kb-grid" id="kb-inv" data-cid="inv"></div>
    <div class="kb-discard" id="kb-discard">丟棄（把裝備放進來）</div>
    <div class="kb-hint">右鍵點通貨拿起 → 左鍵點裝備套用；按住 Shift 可以一直用；右鍵或 Esc 放下。<br>
      左鍵拿起裝備、再點一格放下；Ctrl＋左鍵在背包和倉庫間快速移動；按住 Alt 看詞綴範圍；Ctrl+Z 上一步。</div>
  </section>
</div>
<div class="kb-cursor" id="kb-cursor"></div>
<div class="kb-tip" id="kb-tip" hidden></div>`;
const $=id=>document.getElementById(id);
const pageEl=$("kb-page"), invEl=$("kb-inv"), cursorEl=$("kb-cursor"), tipEl=$("kb-tip");

/* ── 圖示：載入失敗就換成灰色方框＋名稱 ── */
function iconHTML(src,label){
  return `<img src="${esc(src)}" alt="${esc(label)}" draggable="false" data-label="${esc(label)}">`;
}
root.addEventListener("error",e=>{
  const im=e.target;
  if(!(im instanceof HTMLImageElement)||!im.dataset.label) return;
  const box=document.createElement("div");
  box.className="kb-noimg"; box.textContent=im.dataset.label;
  im.replaceWith(box);
},true);
const itemIcon=item=>{ const b=E.bases[item.b]; return iconHTML(IMG+"items/"+b.ic,E.baseName(item.b,L())); };
const curIcon=k=>iconHTML(IMG+"items/"+((D.curIcons||{})[k]||k+".png"),CE.CUR[k].zh);

/* ── 畫面 ── */
function drawAll(){ drawStrip(); drawPage(); drawList(); drawGrid(invEl,S.inv); drawCursor(); drawUndo(); }
function drawUndo(){ $("kb-undo").disabled=!S.undo.length; }

function tabStyle(t){ return t?`--tc:${t.color}`:""; }
function drawStrip(){
  const chips=[`<button class="kb-chip" role="tab" data-tab="currency" aria-selected="${S.active==="currency"}">通貨</button>`]
    .concat(S.tabs.map(t=>`<button class="kb-chip" role="tab" data-tab="${esc(t.id)}" aria-selected="${S.active===t.id}" style="${tabStyle(t)}">${esc(t.name)}</button>`));
  $("kb-strip").innerHTML=chips.join("");
  const on=$("kb-strip").querySelector('[aria-selected="true"]');
  if(on) on.scrollIntoView({block:"nearest",inline:"nearest"});
}
function drawPage(){
  if(S.active==="currency"){ drawCurrencyPage(); return; }
  const t=S.tabs.find(x=>x.id===S.active);
  pageEl.innerHTML=`<div class="kb-grid" id="kb-tabgrid" data-cid="${esc(t.id)}"></div>`;
  drawGrid($("kb-tabgrid"),t.items);
  $("kb-curbar").innerHTML=`<span>${esc(t.name)}：${t.items.length} 件</span>`;
}
function drawCurrencyPage(){
  const sub=CUR_SUBS.find(s=>s.k===S.curSub)||CUR_SUBS[0];
  const L=S.layouts&&S.layouts[sub.bg];
  const W=L?L.width:1254, H=L?L.height:1254;
  const pct=(v,t)=>(v/t*100).toFixed(3)+"%";
  let h=`<div class="kb-cur" style="background-image:url(${IMG}${sub.bg}.webp)">`;
  h+=CUR_SUBS.map(s=>{
    const [x0,y0,x1,y1]=s.box;
    return `<button class="kb-sub" data-sub="${s.k}" style="left:${pct(x0,1254)};top:${pct(y0,1254)};width:${pct(x1-x0,1254)};height:${pct(y1-y0,1254)};background-image:url(${IMG}subtab_${s.k===sub.k?"selected":"normal"}.webp)">${s.zh}</button>`;
  }).join("");
  if(sub.k==="general"&&L){
    const at=sl=>`left:${pct(sl.x,W)};top:${pct(sl.y,H)};width:${pct(sl.w,W)};height:${pct(sl.h,H)}`;
    for(const c of CE.CURRENCIES){
      const sl=L.slots.find(s=>s.i===CURRENCY_SLOT[c.k]); if(!sl) continue;
      const held=S.held&&S.held.kind==="cur"&&S.held.k===c.k;
      h+=`<div class="kb-slot${held?" held":""}" data-cur="${c.k}" style="${at(sl)}">
        ${curIcon(c.k)}${S.used[c.k]?`<span class="kb-n">${S.used[c.k]}</span>`:""}</div>`;
    }
    for(const [k,i] of Object.entries(DECOR_SLOT)){
      const sl=L.slots.find(s=>s.i===i), d=(D.decor||{})[k];
      if(!sl||!d||CE.CUR[k]) continue;
      h+=`<div class="kb-slot kb-decor" data-decor="${k}" style="${at(sl)}">${iconHTML(IMG+"items/"+d.ic,d.zh)}</div>`;
    }
  }
  h+=`</div>`;
  pageEl.innerHTML=h;
  // 背景不是正方形時，頁面高度跟著比例
  pageEl.style.height=L?`calc(var(--grid) * ${H/W})`:"";
  const total=Object.values(S.used).reduce((a,b)=>a+b,0);
  $("kb-curbar").innerHTML=sub.k==="general"
    ?`<span>右上角數字＝已經用了幾次（共 ${total} 次）</span><button class="kb-btn" id="kb-zero"${total?"":" disabled"}>歸零</button>`
    :`<span>${sub.zh}：之後會用到，目前是空的</span>`;
}
function drawGrid(el,list){
  const cell="var(--cell)";
  el.innerHTML=list.map(e=>{
    const s=sizeOf(e.item);
    return `<div class="kb-item r${e.item.r}" data-id="${esc(e.id)}" style="left:calc(${cell} * ${e.x});top:calc(${cell} * ${e.y});width:calc(${cell} * ${s.w});height:calc(${cell} * ${s.h})">${itemIcon(e.item)}</div>`;
  }).join("")+`<div class="kb-prev" hidden></div>`;
}
function drawList(){
  const cnt=t=>t.items.length?`<span class="cnt">${t.items.length}</span>`:"";
  $("kb-list").innerHTML=
    `<div class="kb-row" data-tab="currency" aria-selected="${S.active==="currency"}"><span class="nm">通貨</span></div>`+
    S.tabs.map(t=>`<div class="kb-row" data-tab="${esc(t.id)}" draggable="true" aria-selected="${S.active===t.id}" style="${tabStyle(t)}">
      <span class="grip" aria-hidden="true">⋮⋮</span><span class="nm">${esc(t.name)}</span>${cnt(t)}
      <button data-act="edit" aria-label="改名和顏色" title="改名、選顏色">✎</button>
      <button data-act="del" aria-label="刪除" title="刪除（只能刪空的頁）">×</button></div>`).join("")+
    `<button class="kb-btn" id="kb-newtab">＋ 新增倉庫頁</button>`;
}

/* ── 游標上的東西 ── */
let mouse={x:-999,y:-999};
function cellPx(){ return invEl.getBoundingClientRect().width/COLS||40; }
function drawCursor(){
  const h=S.held;
  if(!h){ cursorEl.style.display="none"; document.body.style.cursor=""; return; }
  const c=cellPx();
  if(h.kind==="cur"){
    cursorEl.innerHTML=curIcon(h.k);
    cursorEl.style.width=cursorEl.style.height=c+"px";
  }else{
    const s=sizeOf(h.e.item);
    cursorEl.innerHTML=itemIcon(h.e.item);
    cursorEl.style.width=c*s.w+"px"; cursorEl.style.height=c*s.h+"px";
  }
  cursorEl.style.display="block";
  moveCursor();
}
function moveCursor(){
  if(!S.held) return;
  const w=cursorEl.offsetWidth, h=cursorEl.offsetHeight;
  cursorEl.style.transform=`translate(${mouse.x-w/2}px,${mouse.y-h/2}px)`;
}

/* 拿著裝備時的放置預覽：以游標所在位置為中心 */
function placement(gridEl,list,cx,cy){
  const r=gridEl.getBoundingClientRect(), c=r.width/COLS;
  const s=sizeOf(S.held.e.item);
  const x=clamp(Math.round((cx-r.left)/c-s.w/2),0,COLS-s.w), y=clamp(Math.round((cy-r.top)/c-s.h/2),0,ROWS-s.h);
  const hits=list.filter(e=>overlap(e,x,y,s.w,s.h));
  return {x,y,w:s.w,h:s.h,hits,ok:hits.length<=1};
}
function clearPreviews(){ root.querySelectorAll(".kb-prev").forEach(p=>p.hidden=true); }
function showPreview(gridEl,p){
  const el=gridEl.querySelector(".kb-prev"); if(!el) return;
  el.hidden=false;
  el.className="kb-prev "+(!p.ok?"bad":p.hits.length?"swap":"ok");
  el.style.cssText=`left:calc(var(--cell) * ${p.x});top:calc(var(--cell) * ${p.y});width:calc(var(--cell) * ${p.w});height:calc(var(--cell) * ${p.h})`;
}

/* ── 提示：游標旁邊顯示 2 秒 ── */
let flashEl=null, flashTimer=null;
function flash(text,good){
  if(!flashEl){ flashEl=document.createElement("div"); root.appendChild(flashEl); }
  flashEl.className="kb-flash"+(good?" good":"");
  flashEl.textContent=text;
  flashEl.style.display="block";
  const w=flashEl.offsetWidth, h=flashEl.offsetHeight;
  flashEl.style.left=clamp(mouse.x+16,8,innerWidth-w-8)+"px";
  flashEl.style.top=clamp(mouse.y+18,8,innerHeight-h-8)+"px";
  clearTimeout(flashTimer);
  flashTimer=setTimeout(()=>{ flashEl.style.display="none"; },FLASH_MS);
}

/* ── 說明框（之後換成仿遊戲版本時，只要換掉這兩個函式） ── */
function itemName(it){
  const b=E.bases[it.b];
  if(L()==="zh") return [E.baseName(it.b,"zh")];   // 中文：只顯示底材名稱，不組魔法／稀有物品的名字
  if(it.r===E.MAGIC){
    const p=it.mods.find(x=>E.mods[x.m].pre), s=it.mods.find(x=>!E.mods[x.m].pre);
    return [(p?E.mods[p.m].n+" ":"")+b.n+(s?" "+E.mods[s.m].n:"")];
  }
  if(it.r===E.RARE) return ["稀有物品",b.n];
  return [b.n];
}
function itemTooltipHTML(it,detail){
  const b=E.bases[it.b], c=E.counts(it), max=E.maxSide(it);
  const mods=it.mods.slice().sort((x,y)=>(E.mods[y.m].pre-E.mods[x.m].pre));
  const lang=L(), zh=lang==="zh";
  /* 按住 Alt：中文底下用小字灰色附英文原文，方便對照英文攻略 */
  const lines=(zl,el)=>zl.map((t,i)=>`<div>${esc(t)}${detail&&zh&&el[i]&&el[i]!==t?`<div class="ken">${esc(el[i])}</div>`:""}</div>`).join("");
  const rows=mods.map(x=>{
    const m=E.mods[x.m], t=E.tierOf(it.b,x.m);
    const big=detail?`<div class="kbig">${esc(m.n)}・${m.pre?"前綴":"後綴"} T${t}／共 ${E.tierCount(it.b,x.m)} 階・範圍 ${esc(E.modRange(x.m,lang).join(" / "))}</div>`:"";
    return `<div class="kmod"><span class="ktag ${m.pre?"p":"s"}">${m.pre?"前":"後"} T${t}</span>
      <span class="ktxt">${lines(E.render(x.m,x.v,lang),E.render(x.m,x.v,"en"))}${big}</span></div>`;
  }).join("");
  const imp=lines(E.implicitLines(it.b,lang),E.implicitLines(it.b,"en"));
  return `<div class="kcard r${it.r}">
    <div class="kname">${itemName(it).map(esc).join("<br>")}</div>
    <div class="kbody">
      <div class="kmeta">${esc(D.classes[b.c].zh)}・${CE.RARITY_ZH[it.r]}・物品等級 ${it.lv}${detail?"":`　<small>（按住 Alt 看範圍${L()==="zh"?"和英文原文":""}）</small>`}</div>
      ${b.imp.length?`<div class="kimp">${imp}</div><div class="ksep"></div>`:""}
      ${rows||`<div class="kempty">沒有詞綴</div>`}
      ${it.r?`<div class="kcnt">前綴 ${c.p}/${max}・後綴 ${c.s}/${max}</div>`:""}
    </div></div>`;
}
function decorTooltipHTML(k){
  const d=(D.decor||{})[k]||{zh:k,en:""};
  return `<div class="kb-curtip"><b>${esc(d.zh)}</b><em>${esc(d.en)}</em><em>模擬器尚未支援</em></div>`;
}
function currencyTooltipHTML(k){
  const c=CE.CUR[k];
  return `<div class="kb-curtip"><b>${esc(c.zh)}</b><em>${esc(c.en)}</em>${esc(c.desc)}
    <em>${S.held&&S.held.kind==="cur"&&S.held.k===k?"已拿在游標上":"按右鍵拿起"}・已用 ${S.used[k]||0} 次</em></div>`;
}
let tipTarget=null, altDown=false;
function showTip(html){
  tipEl.innerHTML=html; tipEl.hidden=false; placeTip();
}
function hideTip(){ tipEl.hidden=true; tipTarget=null; }
function placeTip(){
  if(tipEl.hidden) return;
  const w=tipEl.offsetWidth, h=tipEl.offsetHeight;
  let x=mouse.x+18, y=mouse.y+18;
  if(x+w>innerWidth-8) x=mouse.x-w-18;
  if(y+h>innerHeight-8) y=innerHeight-h-8;
  tipEl.style.left=clamp(x,8,Math.max(8,innerWidth-w-8))+"px";
  tipEl.style.top=clamp(y,8,Math.max(8,innerHeight-h-8))+"px";
}
function refreshTip(){
  if(!tipTarget){ hideTip(); return; }
  if(tipTarget.cur) showTip(currencyTooltipHTML(tipTarget.cur));
  else if(tipTarget.decor) showTip(decorTooltipHTML(tipTarget.decor));
  else{
    const e=findEntry(tipTarget.cid,tipTarget.id);
    if(e) showTip(itemTooltipHTML(e.item,altDown)); else hideTip();
  }
}
function findEntry(cid,id){ const l=cont(cid); return l?l.find(e=>e.id===id):null; }

/* ── 動作 ── */
function pickCurrency(k){
  if(S.held&&S.held.kind==="item"){ flash("先把手上的裝備放下"); return; }
  S.held={kind:"cur",k};
  drawCursor(); if(S.active==="currency") drawCurrencyPage();
}
function dropHeld(silent){
  if(!S.held) return;
  if(S.held.kind==="item") returnHeld();
  S.held=null;
  drawCursor(); clearPreviews();
  if(S.active==="currency") drawCurrencyPage();
  if(!silent) refreshTip();
}
/* 拿著的裝備放回原位（原位被佔就放原本那一頁的第一個空位，再不行就背包） */
function returnHeld(){
  const h=S.held; if(!h||h.kind!=="item") return;
  const s=sizeOf(h.e.item);
  let list=cont(h.from.cid)||S.inv;
  let p=fits(list,h.from.x,h.from.y,s.w,s.h)?{x:h.from.x,y:h.from.y}:firstFit(list,s.w,s.h);
  if(!p){ list=S.inv; p=firstFit(list,s.w,s.h); }
  if(!p){ flash("放不回去：空間不足"); return; }
  list.push({...h.e,x:p.x,y:p.y});
  S.held=null;
  drawAll();
}
function applyCurrency(cid,e,keep){
  const k=S.held.k, c=CE.CUR[k];
  const err=E.check(e.item,k);
  if(err){ flash(c.zh+"："+err.replace(/^這顆/,"")); return; }
  const snap=snapshot();
  const r=E.apply(e.item,k);
  if(!r.ok){ flash(c.zh+"："+r.err); return; }
  e.item=r.item;
  S.used[k]=(S.used[k]||0)+1;
  pushUndo(snap,c.zh);
  if(!keep){ S.held=null; drawCursor(); }
  redrawContainer(cid);
  if(S.active==="currency") drawCurrencyPage();
  tipTarget={cid,id:e.id}; refreshTip();
  save();
}
function pickItem(cid,e){
  const list=cont(cid);
  const snap=snapshot();
  list.splice(list.indexOf(e),1);
  S.held={kind:"item",e,from:{cid,x:e.x,y:e.y},snap};
  hideTip();
  redrawContainer(cid); drawCursor();
}
function placeHeld(cid,gridEl){
  const list=cont(cid), h=S.held;
  const p=placement(gridEl,list,mouse.x,mouse.y);
  if(!p.ok){ flash("這裡放不下（會蓋到兩件以上的裝備）"); return; }
  const snap=h.snap||snapshot();
  list.push({...h.e,x:p.x,y:p.y});
  if(p.hits.length===1){
    // 剛好只蓋到一件：互換，那件跑到游標上
    const other=p.hits[0];
    list.splice(list.indexOf(other),1);
    S.held={kind:"item",e:other,from:{cid,x:other.x,y:other.y},snap:null};
    pushUndo(snap,"互換裝備");
  }else{
    S.held=null;
    pushUndo(snap,"移動裝備");
  }
  clearPreviews();
  redrawContainer(cid); drawCursor(); drawList();
  save();
}
function quickMove(cid,e){
  let to;
  if(cid==="inv"){
    if(S.active==="currency"){ flash("先打開一個一般倉庫頁"); return; }
    to=S.active;
  }else to="inv";
  const dst=cont(to), s=sizeOf(e.item), p=firstFit(dst,s.w,s.h);
  if(!p){ flash("空間不足"); return; }
  const snap=snapshot();
  const src=cont(cid);
  src.splice(src.indexOf(e),1);
  dst.push({...e,x:p.x,y:p.y});
  pushUndo(snap,"移動裝備");
  hideTip(); drawAll(); save();
}
function redrawContainer(cid){
  if(cid==="inv") drawGrid(invEl,S.inv);
  else if(S.active===cid) drawGrid($("kb-tabgrid"),cont(cid));
  drawList();
}

/* ── 滑鼠 ── */
function gridOf(target){ return target.closest&&target.closest(".kb-grid"); }
function entryAt(gridEl,cid,cx,cy){
  const r=gridEl.getBoundingClientRect(), c=r.width/COLS;
  const x=Math.floor((cx-r.left)/c), y=Math.floor((cy-r.top)/c);
  return cont(cid).find(e=>{ const s=sizeOf(e.item); return x>=e.x&&x<e.x+s.w&&y>=e.y&&y<e.y+s.h; })||null;
}
document.addEventListener("mousemove",ev=>{
  mouse={x:ev.clientX,y:ev.clientY};
  if(!S.ready||root.offsetParent===null) return;
  moveCursor();
  const g=gridOf(ev.target);
  if(S.held&&S.held.kind==="item"){
    clearPreviews();
    if(g){ showPreview(g,placement(g,cont(g.dataset.cid),ev.clientX,ev.clientY)); }
    hideTip();
    return;
  }
  // 說明框
  const slot=ev.target.closest&&ev.target.closest(".kb-slot");
  if(slot&&root.contains(slot)){
    const k=slot.dataset.cur||slot.dataset.decor, kind=slot.dataset.cur?"cur":"decor";
    if(!tipTarget||tipTarget[kind]!==k){ tipTarget={[kind]:k}; refreshTip(); } else placeTip();
    return;
  }
  if(g){
    const e=entryAt(g,g.dataset.cid,ev.clientX,ev.clientY);
    if(e){
      if(!tipTarget||tipTarget.id!==e.id){ tipTarget={cid:g.dataset.cid,id:e.id}; refreshTip(); } else placeTip();
      return;
    }
  }
  if(tipTarget) hideTip();
});
/* 製裝台自己處理完的右鍵不再往上傳（處理時格子會重畫，下面 document 那層會誤判成「點在外面」） */
root.addEventListener("contextmenu",ev=>{
  const decor=ev.target.closest(".kb-decor");
  if(decor){ ev.preventDefault(); ev.stopPropagation(); flash("模擬器尚未支援"); return; }   // 擺設：拿不起來
  const slot=ev.target.closest(".kb-slot");
  if(slot){ ev.preventDefault(); ev.stopPropagation(); pickCurrency(slot.dataset.cur); refreshTip(); return; }
  if(S.held){ ev.preventDefault(); ev.stopPropagation(); if(S.held.kind==="cur") dropHeld(); }
});
/* 拿著通貨時，在製裝台以外的地方按右鍵也是放下 */
document.addEventListener("contextmenu",ev=>{
  if(S.held&&S.held.kind==="cur"&&!root.contains(ev.target)){ ev.preventDefault(); dropHeld(); }
});
root.addEventListener("click",ev=>{
  if(ev.button!==0) return;
  const t=ev.target;
  // 分頁籤、清單、通貨子分頁
  const chip=t.closest(".kb-chip, .kb-row");
  if(chip&&!t.closest("button[data-act]")){ setActive(chip.dataset.tab); return; }
  const act=t.closest("button[data-act]");
  if(act){ const row=act.closest(".kb-row"); if(act.dataset.act==="edit") editTab(row.dataset.tab); else deleteTab(row.dataset.tab); return; }
  const sub=t.closest(".kb-sub");
  if(sub){ S.curSub=sub.dataset.sub; drawCurrencyPage(); return; }
  if(t.closest("#kb-newtab")){ editTab(null); return; }
  if(t.closest("#kb-zero")){ S.used={}; drawCurrencyPage(); save(); flash("已歸零",true); return; }
  if(t.closest("#kb-undo")){ undo(); return; }
  if(t.closest("#kb-vendor")){ openVendor(); return; }
  if(t.closest(".kb-decor")){ flash("模擬器尚未支援"); return; }
  if(t.closest(".kb-slot")){ flash("按右鍵拿起通貨"); return; }
  if(t.closest("#kb-discard")){ discardHeld(); return; }
  const g=gridOf(t);
  if(!g) return;
  const cid=g.dataset.cid;
  if(S.held&&S.held.kind==="item"){ placeHeld(cid,g); return; }
  const e=entryAt(g,cid,ev.clientX,ev.clientY);
  if(!e) return;
  if(S.held&&S.held.kind==="cur"){ applyCurrency(cid,e,ev.shiftKey); return; }
  if(ev.ctrlKey||ev.metaKey){ quickMove(cid,e); return; }
  pickItem(cid,e);
});

/* ── 鍵盤 ── */
function benchVisible(){ return root.offsetParent!==null; }
document.addEventListener("keydown",ev=>{
  if(!S.ready||!benchVisible()) return;
  if(ev.target.closest&&ev.target.closest("input,textarea,select,[contenteditable]")) return;
  if(root.querySelector(".kb-veil")) return;
  if(ev.key==="Escape"&&S.held){ ev.preventDefault(); dropHeld(); return; }
  if((ev.ctrlKey||ev.metaKey)&&!ev.shiftKey&&(ev.key==="z"||ev.key==="Z")){ ev.preventDefault(); undo(); return; }
  if(ev.key==="Alt"){ ev.preventDefault(); if(!altDown){ altDown=true; refreshTip(); } }
});
document.addEventListener("keyup",ev=>{ if(ev.key==="Alt"&&altDown){ ev.preventDefault(); altDown=false; refreshTip(); } });
window.addEventListener("blur",()=>{ if(altDown){ altDown=false; refreshTip(); } });

/* ── 分頁 ── */
function setActive(id){
  if(id!=="currency"&&!S.tabs.some(t=>t.id===id)) return;
  S.active=id; hideTip();
  drawStrip(); drawPage(); drawList(); save();
}
function editTab(id){
  const t=id?S.tabs.find(x=>x.id===id):null;
  let color=t?t.color:TAB_COLORS[S.tabs.length%TAB_COLORS.length];
  const m=modal(`<h3>${t?"改名、選顏色":"新增倉庫頁"}</h3>
    <label class="klab" for="kb-tname">名稱</label>
    <input type="text" id="kb-tname" maxlength="20" value="${esc(t?t.name:"倉庫頁 "+(S.tabs.length+1))}">
    <div class="klab">顏色（清單那一列的底色）</div>
    <div class="kb-colors">${TAB_COLORS.map(c=>`<button type="button" data-c="${c}" style="background:${c}" aria-pressed="${c===color}" aria-label="顏色 ${c}"></button>`).join("")}</div>
    <div class="acts"><button class="kb-btn" data-x>取消</button><button class="kb-btn pri" data-ok>${t?"確定":"建立"}</button></div>`);
  const input=m.el.querySelector("#kb-tname");
  input.focus(); input.select();
  m.el.querySelector(".kb-colors").onclick=e=>{
    const b=e.target.closest("button[data-c]"); if(!b) return;
    color=b.dataset.c;
    m.el.querySelectorAll(".kb-colors button").forEach(x=>x.setAttribute("aria-pressed",x===b));
  };
  const ok=()=>{
    const name=input.value.trim().slice(0,20)||"倉庫頁";
    if(t){ t.name=name; t.color=color; }
    else{ const n={id:uid(),name,color,items:[]}; S.tabs.push(n); S.active=n.id; }
    m.close(); drawStrip(); drawPage(); drawList(); save();
  };
  m.el.querySelector("[data-ok]").onclick=ok;
  m.el.querySelector("[data-x]").onclick=m.close;
  input.onkeydown=e=>{ if(e.key==="Enter") ok(); };
}
function deleteTab(id){
  const t=S.tabs.find(x=>x.id===id); if(!t) return;
  if(t.items.length){
    const m=modal(`<h3>不能刪除「${esc(t.name)}」</h3><p>請先把物品移走（這一頁還有 ${t.items.length} 件）。</p>
      <div class="acts"><button class="kb-btn pri" data-x>知道了</button></div>`);
    m.el.querySelector("[data-x]").onclick=m.close; return;
  }
  const m=modal(`<h3>刪除「${esc(t.name)}」？</h3><p>這一頁是空的，刪除後就不見了。</p>
    <div class="acts"><button class="kb-btn" data-x>取消</button><button class="kb-btn pri" data-ok>刪除</button></div>`);
  m.el.querySelector("[data-x]").onclick=m.close;
  m.el.querySelector("[data-ok]").onclick=()=>{
    S.tabs.splice(S.tabs.indexOf(t),1);
    if(S.active===id) S.active=S.tabs[0]?S.tabs[0].id:"currency";
    m.close(); drawStrip(); drawPage(); drawList(); save();
  };
}
/* 拖曳排序（只有一般倉庫頁可以拖，通貨固定第一個） */
let dragId=null;
const listEl=$("kb-list");
listEl.addEventListener("dragstart",e=>{
  const row=e.target.closest(".kb-row[draggable]"); if(!row) return;
  dragId=row.dataset.tab; row.classList.add("drag");
  e.dataTransfer.effectAllowed="move";
  try{ e.dataTransfer.setData("text/plain",dragId); }catch(x){}
});
listEl.addEventListener("dragover",e=>{
  if(!dragId) return;
  const row=e.target.closest(".kb-row[draggable]");
  listEl.querySelectorAll(".over").forEach(x=>x.classList.remove("over"));
  if(row&&row.dataset.tab!==dragId){ e.preventDefault(); row.classList.add("over"); }
});
listEl.addEventListener("drop",e=>{
  const row=e.target.closest(".kb-row[draggable]");
  if(!dragId||!row) return;
  e.preventDefault();
  const from=S.tabs.findIndex(t=>t.id===dragId);
  const [t]=S.tabs.splice(from,1);
  S.tabs.splice(S.tabs.findIndex(x=>x.id===row.dataset.tab),0,t);
  dragId=null; drawStrip(); drawList(); save();
});
listEl.addEventListener("dragend",()=>{ dragId=null; drawList(); });

/* ── 丟棄 ── */
function discardHeld(){
  if(!S.held||S.held.kind!=="item"){ flash("先拿起要丟棄的裝備，再點這裡"); return; }
  const h=S.held, name=itemName(h.e.item).join(" ");
  $("kb-discard").classList.add("armed");
  const m=modal(`<h3>丟棄這件裝備？</h3><p>${esc(name)}（${esc(CE.RARITY_ZH[h.e.item.r])}）<br>可以用「上一步」找回來。</p>
    <div class="acts"><button class="kb-btn" data-x>取消</button><button class="kb-btn pri" data-ok>丟棄</button></div>`,
    ()=>$("kb-discard").classList.remove("armed"));
  m.el.querySelector("[data-x]").onclick=m.close;
  m.el.querySelector("[data-ok]").onclick=()=>{
    pushUndo(h.snap||snapshot(),"丟棄");
    S.held=null; m.close(); drawAll(); save();
  };
}

/* ── 頁面內的小視窗（不用 alert / confirm） ── */
function modal(inner,onClose,cls){
  const veil=document.createElement("div");
  veil.className="kb-veil";
  veil.innerHTML=`<div class="kb-modal ${cls||""}" role="dialog" aria-modal="true">${inner}</div>`;
  root.appendChild(veil);
  const close=()=>{ veil.remove(); document.removeEventListener("keydown",onKey,true); onClose&&onClose(); };
  const onKey=e=>{ if(e.key==="Escape"){ e.stopPropagation(); close(); } };
  document.addEventListener("keydown",onKey,true);
  veil.addEventListener("mousedown",e=>{ if(e.target===veil) close(); });
  const first=veil.querySelector("[data-ok],[data-x]"); if(first) first.focus();
  return {el:veil.firstElementChild,close};
}

/* ── 底材商人 ── */
const V={cls:"Helmet",b:-1,lv:86};
function openVendor(){
  if(S.held&&S.held.kind==="item") returnHeld();
  const classOpts=Object.entries(GROUP_ZH).map(([g,zh])=>
    `<optgroup label="${zh}">`+Object.entries(D.classes).filter(([,c])=>c.group===g)
      .map(([k,c])=>`<option value="${esc(k)}">${esc(c.zh)}（${esc(k)}）</option>`).join("")+`</optgroup>`).join("");
  const m=modal(`<h3>底材商人</h3>
    <label class="klab" for="kv-cls">物品類別</label><select id="kv-cls">${classOpts}</select>
    <label class="klab" for="kv-q">底材（Base Type）</label><input id="kv-q" type="text" placeholder="搜尋底材…" autocomplete="off">
    <div class="kbases" id="kv-list" role="listbox" aria-label="底材"></div>
    <label class="klab" for="kv-lvn">物品等級（Item Level）</label>
    <div class="klv"><input id="kv-lvr" type="range" min="1" max="86" aria-label="物品等級滑桿"><input id="kv-lvn" type="number" min="1" max="86"></div>
    <div class="msg" id="kv-msg" role="status" aria-live="polite"></div>
    <div class="acts"><button class="kb-btn" data-x>關閉</button><button class="kb-btn pri" data-ok>購買</button></div>`,null,"kb-vendor");
  const q=m.el.querySelector("#kv-q"), list=m.el.querySelector("#kv-list"), cls=m.el.querySelector("#kv-cls"),
    lvr=m.el.querySelector("#kv-lvr"), lvn=m.el.querySelector("#kv-lvn"), msg=m.el.querySelector("#kv-msg");
  const ofClass=()=>E.bases.filter(b=>b.c===V.cls);
  if(V.b<0||E.bases[V.b].c!==V.cls){ const l=ofClass(); V.b=l[l.length-1].i; }
  function drawBases(){
    const s=q.value.trim().toLowerCase();
    const l=ofClass().filter(b=>!s||baseHay(b).includes(s));
    list.innerHTML=l.map(b=>`<button class="kbase" role="option" data-b="${b.i}" aria-selected="${b.i===V.b}">
      <span>${esc(baseLabel(b))}</span><em>${b.w}×${b.h}・${b.lv}</em></button>`).join("")||`<div class="khint">找不到符合的底材。</div>`;
    const on=list.querySelector('[aria-selected="true"]');
    if(on) list.scrollTop=Math.max(0,on.offsetTop-list.clientHeight/2);
  }
  cls.value=V.cls; lvr.value=lvn.value=V.lv;
  cls.onchange=()=>{ V.cls=cls.value; q.value=""; const l=ofClass(); V.b=l[l.length-1].i; drawBases(); };
  q.oninput=drawBases;
  list.onclick=e=>{ const x=e.target.closest(".kbase"); if(!x) return; V.b=+x.dataset.b; drawBases(); };
  const setLv=v=>{ V.lv=clamp(Math.round(+v||1),1,86); lvr.value=lvn.value=V.lv; };
  lvr.oninput=()=>setLv(lvr.value); lvn.onchange=()=>setLv(lvn.value);
  m.el.querySelector("[data-x]").onclick=m.close;
  m.el.querySelector("[data-ok]").onclick=()=>{
    const item=E.make(V.b,V.lv), s=sizeOf(item), p=firstFit(S.inv,s.w,s.h);
    if(!p){ msg.className="msg bad"; msg.textContent="背包已滿"; return; }
    pushUndo(snapshot(),"購買");
    S.inv.push({id:uid(),x:p.x,y:p.y,item});
    drawGrid(invEl,S.inv); save();
    msg.className="msg"; msg.textContent=`已買：${baseLabel(E.bases[V.b])}（物品等級 ${V.lv}），放在背包`;
  };
  drawBases();
}

/* ── 開始 ── */
(async function init(){
  root.querySelector(".kb").style.opacity=".5";
  try{
    const r=await fetch(IMG+"stash_layouts.json");
    S.layouts=r.ok?await r.json():null;
  }catch(e){ S.layouts=null; }
  let d=null;
  try{ d=St?await St.load():null; }catch(e){ d=null; }
  doc=d&&typeof d==="object"&&!Array.isArray(d)?d:{};
  fromSave(d);
  S.ready=true;
  root.querySelector(".kb").style.opacity="";
  drawAll();
  // 第一次使用（自動建立了暫存區）也存一次
  if(!d||d.v!==2) save();
})();
})();
