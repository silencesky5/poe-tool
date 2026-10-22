/* 製裝方法 → 製裝台：仿遊戲的倉庫＋背包＋右側的工藝台／園藝面板。
   右鍵拿通貨 → 左鍵點裝備套用（Shift 連續用）；左鍵拿起／放下裝備；Ctrl＋左鍵在背包和倉庫（或打開的面板的裝備格）間快速移動。
   倉庫分頁列：最右邊「＋」新增；一般倉庫頁按右鍵改名、刪除，拖曳調整順序（通貨、精髓、化石固定在最前面）。
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
/* 通貨頁的三個子分頁（一般、輿圖、聯盟）：官方 3.29 美術圖＋遊戲資料 CurrencyStashTabLayout 的格子
   （craft-data.js 的 curTabs，tools/extract_stash_layout.py 抽出、build_craft_data.py 換算成圖上的位置）。
   「一般」是遊戲的整張背景圖；「輿圖」「聯盟」是官方空白底圖＋官方格框照排列資料組成（遊戲的整張輿圖背景是舊版面）。
   格子裡是模擬器能用的通貨（CraftEngine.CURRENCIES）就能右鍵拿起；其他通貨只放圖示當擺設（右鍵拿不起來）。
   某顆做成可用時，在 craft-engine.js 的 CURRENCIES 加上規則即可，位置照遊戲資料不用另外設定。
   機會石、瓦爾寶珠：Kalandralang 沒有實作，規則先不做。
   隱藏格（遊戲 ShowIfEmpty＝否，例如六分儀）：倉庫裡沒有這個物品時不顯示；模擬器的倉庫只有能用的通貨，
   所以只有能用的通貨在隱藏格時才會出現。 */
const CUR_TABS=D.curTabs||{};
/* 通貨頁的三個子分頁；按鈕在每一頁都放在同一個相對位置（以 1254 寬計算） */
const CUR_SUBS=[
  {k:"general",zh:"一般",box:[150,14,418,75]},
  {k:"atlas",zh:"輿圖",box:[483,14,752,75]},
  {k:"league",zh:"聯盟",box:[818,14,1086,75]},
];
/* 精髓倉庫頁（stash_layouts.json 的 stash_page_D）：位置照遊戲資料的 EssenceStashTabLayout
   （craft-data.js 的 essTab.slots，tools/extract_stash_layout.py 抽出、build_craft_data.py 對到背景圖的格子）。
   遊戲排列表沒有專屬格的精髓（荒蕪精髓）放在通用格；中間的大格（CraftingSlot）留空。
   沒有 essTab（排列表對不齊）時改成依序排列。 */
const ESSENCE_PAGE="stash_page_D";
/* 化石倉庫頁：官方背景圖（DelveTabBackground）＋遊戲資料 DelveStashTabLayout 的格子（craft-data.js 的 delveTab）。
   右鍵點化石＝放進／拿出鑄新儀（最多 4 顆）；右鍵點混沌鑄新儀＝拿起裝好化石的鑄新儀，再左鍵點裝備套用
   （普通物品＝點金效果、稀有物品＝混沌效果）。點金鑄新儀在遊戲裡是隱藏格（3.29 只在無情模式），不顯示。
   鑄新儀要插滿才能用：初階 1、強效 2、強力 3、終極 4 孔，放的化石數要等於點的那一個鑄新儀的孔數。 */
const DELVE_TAB=D.delveTab||null;
const FOSSIL_MODE_KEY="poe-craft-fossil-mode";   // 多顆化石「增加」相加／相乘（這台電腦的偏好）
const fossilMode=()=>{ try{ return localStorage.getItem(FOSSIL_MODE_KEY)==="mul"?"mul":"add"; }catch(e){ return "add"; } };
E.setFossilMode(fossilMode());
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
  active:"currency",      // "currency"、"essence"、"delve" 或倉庫頁 id
  resoSel:[],             // 放進鑄新儀的化石（Metadata 路徑）
  curSub:"general",
  held:null,              // {kind:"cur",k} 或 {kind:"item",e,from:{cid,x,y},snap}
  panel:null,             // 右側面板："bench" 工藝台、"harvest" 園藝，null＝關著
  slot:[],                // 面板的裝備格（最多 1 件，格式和背包一樣 {id,x:0,y:0,item}）
  undo:[],
  layouts:null,
  ready:false,
};
const FIXED_TABS=["currency","essence","delve"];
const cont=cid=>cid==="inv"?S.inv:cid==="slot"?S.slot:(S.tabs.find(t=>t.id===cid)||{}).items||null;

/* ── 存檔 ──
   v3：裝備存底材的 Metadata 路徑和詞綴 id（E.toStored），每季更新資料後編號變了也讀得回來；
       dataVersion 記錄存檔時的遊戲資料版本。
   v2（舊）：存的是編號，讀到時用目前這版資料的編號解讀，下次存檔就以 v3 寫回（本機和雲端都一樣）。
   讀不回來的裝備（例如改版後底材或詞綴被移除）不刪掉，原樣放在 unreadable，之後還能救回。 */
const SAVE_V=3;
let unreadable=[];   // [{at:"inv" 或倉庫頁 id, e:原始資料}]
let newer=false;     // 存檔是更新版網頁存的（v 比 SAVE_V 大）：看不懂就不要覆蓋它
function validItem(it,v){ return v>=3?E.fromStored(it):E.fromIndexed(it); }
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
function readEntries(arr,v,at){
  const out=[];
  if(!Array.isArray(arr)) return out;
  for(const e of arr){
    const item=validItem(e&&e.item,v);
    if(!item){ if(v>=3&&e&&e.item) unreadable.push({at,e}); continue; }
    const s=sizeOf(item);
    let x=e.x|0, y=e.y|0;
    if(!fits(out,x,y,s.w,s.h)){ const p=firstFit(out,s.w,s.h); if(!p) continue; x=p.x; y=p.y; }
    out.push({id:typeof e.id==="string"?e.id:uid(),x,y,item});
  }
  return out;
}
/* 讀檔：格式不對（例如第一階段的存檔測試文字）就當作空倉庫 */
function fromSave(d){
  const v=d&&typeof d==="object"?d.v:0, ok=v===2||v===SAVE_V;
  newer=typeof v==="number"&&v>SAVE_V;
  unreadable=ok&&v>=3&&Array.isArray(d.unreadable)?d.unreadable.slice():[];
  S.inv=ok?readEntries(d.inventory,v,"inv"):[];
  S.tabs=ok&&Array.isArray(d.tabs)?d.tabs.filter(t=>t&&typeof t==="object").map(t=>({
    id:typeof t.id==="string"?t.id:uid(),
    name:String(t.name||"倉庫頁").slice(0,20),
    color:/^#[0-9a-f]{6}$/i.test(t.color)?t.color:TAB_COLORS[0],
    items:readEntries(t.items,v,typeof t.id==="string"?t.id:""),
  })):[];
  S.used={};
  if(ok&&d.currencyUsed&&typeof d.currencyUsed==="object")
    for(const [k,v] of Object.entries(d.currencyUsed)){ const n=v|0; if(n>0&&E.curInfo(k)) S.used[k]=n; }
  if(!S.tabs.length) S.tabs.push({id:uid(),name:"暫存區",color:TAB_COLORS[0],items:[]});
  S.active=ok&&(FIXED_TABS.includes(d.activeTab)||S.tabs.some(t=>t.id===d.activeTab))?d.activeTab:"currency";
  /* 面板的裝備格（舊存檔沒有這兩個欄位＝面板關著、裝備格空著） */
  S.slot=ok&&v>=3?readEntries(d.craftSlot,v,"slot").slice(0,1).map(e=>({...e,x:0,y:0})):[];
  S.panel=ok&&(d.benchPanel==="bench"||d.benchPanel==="harvest")?d.benchPanel:null;
  if(S.slot.length&&!S.panel) S.panel="bench";
}
/* 存檔時：拿在游標上的裝備當作還在原位 */
function toSave(){
  const inv=S.inv.slice(), slot=S.slot.slice(), tabs=S.tabs.map(t=>({id:t.id,name:t.name,color:t.color,items:t.items.slice()}));
  const h=S.held;
  if(h&&h.kind==="item"){
    const list=h.from.cid==="inv"?inv:h.from.cid==="slot"&&!slot.length?slot:(tabs.find(t=>t.id===h.from.cid)||{}).items||inv;
    const s=sizeOf(h.e.item);
    let p=fits(list,h.from.x,h.from.y,s.w,s.h)?{x:h.from.x,y:h.from.y}:firstFit(list,s.w,s.h);
    let target=list;
    if(!p){ target=inv; p=firstFit(inv,s.w,s.h); }
    if(p) target.push({...h.e,x:p.x,y:p.y});
  }
  const strip=e=>({id:e.id,x:e.x,y:e.y,item:E.toStored(e.item)});
  const out={v:SAVE_V,dataVersion:D.version,inventory:inv.map(strip),tabs:tabs.map(t=>({...t,items:t.items.map(strip)})),
    currencyUsed:{...S.used},activeTab:S.active,craftSlot:slot.map(strip),benchPanel:S.panel};
  if(unreadable.length) out.unreadable=unreadable;
  return out;
}
let saveTimer=null, doc={};   // doc：上一次讀到的整份存檔（其他欄位例如 prices 原樣保留）
function merged(cur){
  if(!cur||typeof cur!=="object"||Array.isArray(cur)) cur={};
  const next={...cur,...toSave()};
  if(!unreadable.length) delete next.unreadable;
  delete next.text;   // 第一階段「存檔測試」留下的欄位
  return next;
}
function save(){
  if(!St||!S.ready||newer) return;
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
  if(!saveTimer||!St||!S.ready||newer) return;
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
  return {inv:S.inv.map(c),slot:S.slot.map(c),tabs:Object.fromEntries(S.tabs.map(t=>[t.id,t.items.map(c)])),used:{...S.used}};
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
  S.slot=u.snap.slot||[];
  if(S.slot.length&&!S.panel) S.panel="bench";   // 退回到裝備還在裝備格的時候：把面板打開
  for(const t of S.tabs) if(u.snap.tabs[t.id]) t.items=u.snap.tabs[t.id];
  S.used=u.snap.used;
  flash("已退回："+u.label,true);
  drawAll(); refreshTip(); save();
}

/* ── 骨架 ── */
root.innerHTML=`
<div class="kb-outer"><div class="kb">
  <section class="kb-stash" aria-label="倉庫">
    <img class="kb-head" src="${IMG}stash_header.webp" alt="倉庫" draggable="false">
    <div class="kb-strip" id="kb-strip" role="tablist" aria-label="倉庫分頁"></div>
    <div class="kb-page" id="kb-page"></div>
    <div class="kb-curbar" id="kb-curbar"></div>
  </section>
  <section class="kb-inv" aria-label="背包">
    <div class="kb-invbar"><span class="t">背包</span>
      <button class="kb-btn" id="kb-vendor">底材商人</button>
      <button class="kb-btn" id="kb-craftbench" aria-pressed="false" title="在背包右邊打開工藝台（再按一次關閉）">工藝台</button>
      <button class="kb-btn" id="kb-harvest" aria-pressed="false" title="在背包右邊打開園藝工藝台（豐收；再按一次關閉）">園藝</button>
      <button class="kb-btn" id="kb-undo" title="Ctrl+Z">上一步</button></div>
    <div class="kb-grid" id="kb-inv" data-cid="inv"></div>
    <div class="kb-discard" id="kb-discard">丟棄（把裝備放進來）</div>
    <div class="kb-hint">右鍵點通貨拿起 → 左鍵點裝備套用；按住 Shift 可以一直用；右鍵或 Esc 放下。<br>
      左鍵拿起裝備、再點一格放下；Ctrl＋左鍵在背包和倉庫（面板打開時是裝備格）間快速移動；按住 Alt 看詞綴範圍；Ctrl+Z 上一步。<br>
      倉庫分頁：「＋」新增、右鍵改名或刪除、拖曳調整順序。</div>
  </section>
  <section class="kb-side" id="kb-side" aria-label="工藝台／園藝面板" hidden></section>
</div></div>
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
const curIcon=k=>{ const c=E.curInfo(k); return iconHTML(IMG+"items/"+(c.ic||k+".png"),c.zh); };

/* ── 畫面 ── */
function drawAll(){ drawStrip(); drawPage(); drawGrid(invEl,S.inv); drawPanel(); drawCursor(); drawUndo(); }
function drawUndo(){ $("kb-undo").disabled=!S.undo.length; }

function tabStyle(t){ return t?`--tc:${t.color}`:""; }
/* 分頁列：通貨、精髓、化石固定在最前面；一般倉庫頁可以拖曳排序、右鍵改名／刪除；最右邊「＋」新增 */
function drawStrip(){
  const chips=[`<button class="kb-chip fixed" role="tab" data-tab="currency" aria-selected="${S.active==="currency"}">通貨</button>`,
    `<button class="kb-chip fixed" role="tab" data-tab="essence" aria-selected="${S.active==="essence"}">精髓</button>`,
    `<button class="kb-chip fixed" role="tab" data-tab="delve" aria-selected="${S.active==="delve"}">化石</button>`]
    .concat(S.tabs.map(t=>`<button class="kb-chip" role="tab" draggable="true" data-tab="${esc(t.id)}" aria-selected="${S.active===t.id}" style="${tabStyle(t)}"
      title="右鍵改名或刪除・拖曳調整順序">${esc(t.name)}</button>`))
    .concat(`<button class="kb-chip kb-add" id="kb-newtab" title="新增倉庫頁" aria-label="新增倉庫頁">＋</button>`);
  $("kb-strip").innerHTML=chips.join("");
  const on=$("kb-strip").querySelector('[aria-selected="true"]');
  if(on) on.scrollIntoView({block:"nearest",inline:"nearest"});
}
function drawPage(){
  if(S.active==="currency"){ drawCurrencyPage(); return; }
  if(S.active==="essence"){ drawEssencePage(); return; }
  if(S.active==="delve"){ drawDelvePage(); return; }
  pageEl.style.height="";
  const t=S.tabs.find(x=>x.id===S.active);
  pageEl.innerHTML=`<div class="kb-grid" id="kb-tabgrid" data-cid="${esc(t.id)}"></div>`;
  drawGrid($("kb-tabgrid"),t.items);
  $("kb-curbar").innerHTML=`<span>${esc(t.name)}：${t.items.length} 件</span>`;
}
function drawCurrencyPage(){
  const sub=CUR_SUBS.find(s=>s.k===S.curSub)||CUR_SUBS[0];
  const T=CUR_TABS[sub.k]||null;
  const W=T?T.w:1254, H=T?T.h:1254;
  const pct=(v,t)=>(v/t*100).toFixed(3)+"%";
  let h=`<div class="kb-cur" style="${T?`background-image:url(${IMG}${T.bg})`:""}">`;
  h+=CUR_SUBS.map(s=>{
    const [x0,y0,x1,y1]=s.box;
    return `<button class="kb-sub" data-sub="${s.k}" style="left:${pct(x0,1254)};top:${pct(y0,1254)};width:${pct(x1-x0,1254)};height:${pct(y1-y0,1254)};background-image:url(${IMG}subtab_${s.k===sub.k?"selected":"normal"}.webp)">${s.zh}</button>`;
  }).join("");
  if(T){
    const at=sl=>`left:${pct(sl.x,W)};top:${pct(sl.y,H)};width:${pct(sl.w,W)};height:${pct(sl.h,H)}`;
    for(const sl of T.slots){
      if(sl.kind!=="item"||!sl.k) continue;               // 大格、通用格：美術圖上的空框
      const usable=!!CE.CUR[sl.k], d=(D.decor||{})[sl.k];
      if(sl.hide&&!usable) continue;                       // 隱藏格：倉庫裡沒有就不顯示
      const n=S.used[sl.k]?`<span class="kb-n">${S.used[sl.k]}</span>`:"";
      if(usable){
        const held=S.held&&S.held.kind==="cur"&&S.held.k===sl.k;
        h+=`<div class="kb-slot${held?" held":""}" data-cur="${sl.k}" style="${at(sl)}">${curIcon(sl.k)}${n}</div>`;
      }else if(d){
        h+=`<div class="kb-slot kb-decor" data-decor="${esc(sl.k)}" style="${at(sl)}">${iconHTML(IMG+"items/"+d.ic,d.zh)}${n}</div>`;
      }
    }
  }
  h+=`</div>`;
  pageEl.innerHTML=h;
  // 背景不是正方形時，頁面高度跟著比例
  pageEl.style.height=T?`calc(var(--grid) * ${H/W})`:"";
  const total=Object.values(S.used).reduce((a,b)=>a+b,0);
  $("kb-curbar").innerHTML=`<span>右上角數字＝已經用了幾次（共 ${total} 次）`+
    (T?`・版面照遊戲資料（${esc(T.patch)}）`+(T.composed?"，官方空白底圖＋官方格框組成":""):"・沒有這一頁的排列資料")+
    `</span><button class="kb-btn" id="kb-zero"${total?"":" disabled"}>歸零</button>`;
}
function drawEssencePage(){
  const L=S.layouts&&S.layouts[ESSENCE_PAGE];
  const W=L?L.width:1240, H=L?L.height:1269;
  const pct=(v,t)=>(v/t*100).toFixed(3)+"%";
  const slots=L?L.slots.filter(s=>!s.big).sort((a,b)=>a.i-b.i):[];
  const T=D.essTab, byI=i=>L&&L.slots.find(s=>s.i===i);
  const generic=T?T.generic.slice():[];
  let h=`<div class="kb-cur" style="background-image:url(${IMG}${ESSENCE_PAGE}.webp)">`;
  E.essences.forEach((e,j)=>{
    const sl=T?byI(T.slots[e.id]!==undefined?T.slots[e.id]:generic.shift()):slots[j]; if(!sl) return;
    const held=S.held&&S.held.kind==="cur"&&S.held.k===e.k;
    h+=`<div class="kb-slot${held?" held":""}" data-cur="${esc(e.k)}" style="left:${pct(sl.x,W)};top:${pct(sl.y,H)};width:${pct(sl.w,W)};height:${pct(sl.h,H)}">
      ${curIcon(e.k)}${S.used[e.k]?`<span class="kb-n">${S.used[e.k]}</span>`:""}</div>`;
  });
  h+=`</div>`;
  pageEl.innerHTML=h;
  pageEl.style.height=L?`calc(var(--grid) * ${H/W})`:"";
  const n=E.essences.reduce((a,e)=>a+(S.used[e.k]||0),0);
  $("kb-curbar").innerHTML=`<span>精髓 ${E.essences.length} 種・右上角數字＝已經用了幾次（共 ${n} 次）・`+
    (T?`格子位置照遊戲資料（${esc(T.patch)}）；荒蕪精髓沒有專屬格，放在通用格`:`格子依序排列（沒有遊戲排列資料）`)+`</span>`;
}
function drawDelvePage(){
  const T=DELVE_TAB, W=T?T.w:1264, H=T?T.h:1264;
  const pct=(v,t)=>(v/t*100).toFixed(3)+"%";
  const at=sl=>`left:${pct(sl.x,W)};top:${pct(sl.y,H)};width:${pct(sl.w,W)};height:${pct(sl.h,H)}`;
  let h=`<div class="kb-cur" style="${T?`background-image:url(${IMG}${T.bg})`:""}">`;
  for(const sl of T?T.slots:[]){
    if(sl.hide||!sl.item) continue;                       // 點金鑄新儀（隱藏格）、通用大格
    const f=E.fosById[sl.item];
    if(f){
      const on=S.resoSel.includes(f.id), n=S.used[f.k]?`<span class="kb-n">${S.used[f.k]}</span>`:"";
      h+=`<div class="kb-slot kb-fos${on?" sel":""}${f.why?" off":""}" data-cur="${esc(f.k)}" data-fos="${esc(f.id)}" style="${at(sl)}">${curIcon(f.k)}${n}</div>`;
      continue;
    }
    const r=(D.resonators||[]).find(x=>x.id===sl.item);
    if(r&&r.kind==="c"){
      const rk="res:c"+r.s;
      const held=S.held&&S.held.kind==="cur"&&S.held.k.startsWith("reso:")&&S.resoSel.length===r.s;
      const n=S.used[rk]?`<span class="kb-n">${S.used[rk]}</span>`:"";
      h+=`<div class="kb-slot kb-res${held?" held":""}${S.resoSel.length===r.s?" fit":""}" data-cur="${rk}" data-res="${r.s}" style="${at(sl)}">${iconHTML(IMG+"items/"+r.ic,r.nz)}${n}</div>`;
    }
  }
  h+=`</div>`;
  pageEl.innerHTML=h;
  pageEl.style.height=T?`calc(var(--grid) * ${H/W})`:"";
  const sel=S.resoSel.map(id=>E.fosById[id].nz);
  const m=fossilMode();
  $("kb-curbar").innerHTML=`<span>鑄新儀：${sel.length?esc(sel.join("＋")):"還沒放化石"}（${sel.length}／${E.MAX_FOSSILS}）・右鍵點化石放進去，再右鍵點混沌鑄新儀拿起</span>`+
    `<span class="kb-hint2">${sel.length?"要用 "+sel.length+" 孔的鑄新儀（"+esc((E.resonatorOf("c",sel.length)||{}).nz||"")+"）":""}</span>`+
    `<span class="kb-fmode" title="多顆化石的「增加」效果怎麼疊加：社群推定值，遊戲沒有公布">多顆化石增加：`+
    `<button class="kb-btn${m==="add"?" pri":""}" data-fmode="add">相加</button><button class="kb-btn${m==="mul"?" pri":""}" data-fmode="mul">相乘</button>`+
    `<small>（社群推定值）</small></span>`+(T?"":"<span>沒有化石頁排列資料</span>");
}
function drawGrid(el,list){
  const cell="var(--cell)";
  el.innerHTML=list.map(e=>{
    const s=sizeOf(e.item);
    return `<div class="kb-item r${e.item.r}" data-id="${esc(e.id)}" style="left:calc(${cell} * ${e.x});top:calc(${cell} * ${e.y});width:calc(${cell} * ${s.w});height:calc(${cell} * ${s.h})">${itemIcon(e.item)}</div>`;
  }).join("")+`<div class="kb-prev" hidden></div>`;
}
/* ── 右側面板（工藝台／園藝）：清單在 craft-benchlist.js、craft-harvest.js，這裡管裝備格和套用 ── */
let panelUI=null, panelKind=null;
const sideEl=$("kb-side");
function slotEntry(){ return S.slot[0]||null; }
function costText(c){ return Object.entries(c).map(([k,n])=>(E.curInfo(k)||{zh:k}).zh+" ×"+n.toLocaleString("en-US")).join("、"); }
function drawPanel(){
  if(panelKind!==S.panel){
    if(panelUI) panelUI.close();
    panelUI=null; panelKind=S.panel; sideEl.innerHTML="";
    const e=slotEntry(), common={E,item:e&&e.item,lang:L(),host:sideEl,embed:true,onClose:()=>togglePanel(S.panel)};
    if(S.panel==="bench"&&window.CraftBenchList) panelUI=CraftBenchList.open({...common,onCraft:benchCraft});
    if(S.panel==="harvest"&&window.CraftHarvest) panelUI=CraftHarvest.open({...common,used:()=>S.used,onCraft:harvestCraft});
  }else if(panelUI){ const e=slotEntry(); panelUI.update(e&&e.item); }
  sideEl.hidden=!S.panel;
  root.querySelector(".kb").classList.toggle("paneled",!!S.panel);
  $("kb-craftbench").setAttribute("aria-pressed",S.panel==="bench");
  $("kb-harvest").setAttribute("aria-pressed",S.panel==="harvest");
}
/* 工藝台：每做一項就扣費用、記進「上一步」、存檔 */
function benchCraft(k){
  const e=slotEntry(); if(!e) return;
  const o=E.benchByKey[k], name=o.a==="remove"?"移除工藝詞綴":E.modRange(o.m,L()).join(" / ");
  const snap=snapshot(), r=E.applyBench(e.item,k);
  if(!r.ok){ panelUI.update(e.item,{bad:true,t:r.err}); return; }
  e.item=r.item;
  for(const [c,n] of Object.entries(r.cost)) S.used[c]=(S.used[c]||0)+n;
  pushUndo(snap,"工藝台");
  redrawCurPage(); save(); refreshTip();
  panelUI.update(e.item,{t:"已完成："+name+"（費用 "+costText(r.cost)+"）"});
}
/* 園藝：每賦予一次就記生命力用量 */
function harvestCraft(k){
  const e=slotEntry(); if(!e) return;
  const snap=snapshot(), r=E.apply(e.item,k), name=E.hvText(E.hvByKey[k]);
  if(!r.ok){ panelUI.update(e.item,{bad:true,t:r.err}); return; }
  e.item=r.item;
  const cost=E.harvestCost(k);
  for(const [c,n] of Object.entries(cost)) S.used[c]=(S.used[c]||0)+n;
  pushUndo(snap,"園藝工藝台");
  redrawCurPage(); save(); refreshTip();
  panelUI.update(e.item,{t:"已賦予："+name+"（"+costText(cost)+"）"});
}
/* 按「工藝台」「園藝」：開這一個（另一個會關掉，裝備格的裝備留著）；再按一次＝關閉，裝備移回背包 */
function togglePanel(kind){
  if(S.panel===kind){ closePanel(); return; }
  S.panel=kind; hideTip(); drawPanel(); save();
}
/* 關閉：裝備格的裝備放回背包；背包滿了放到暫存區（沒有就放第一個放得下的倉庫頁） */
function closePanel(){
  if(S.held&&S.held.kind==="item"&&S.held.from.cid==="slot") returnHeld();
  const e=slotEntry();
  if(e){
    const s=sizeOf(e.item);
    let to="inv", p=firstFit(S.inv,s.w,s.h);
    if(!p){
      const tabs=S.tabs.slice().sort((a,b)=>(b.name==="暫存區")-(a.name==="暫存區"));
      for(const t of tabs){ p=firstFit(t.items,s.w,s.h); if(p){ to=t.id; break; } }
    }
    if(!p){ flash("背包和倉庫頁都放不下這件裝備，面板先不關"); return; }
    const snap=snapshot();
    S.slot=[];
    cont(to).push({...e,x:p.x,y:p.y});
    pushUndo(snap,"關閉面板");
    if(to!=="inv") flash("背包滿了，裝備放到「"+S.tabs.find(t=>t.id===to).name+"」",true);
  }
  S.panel=null; hideTip(); drawAll(); save();
}
/* 拿著的裝備放進裝備格（裝備格已有裝備就互換，那件到游標上） */
function placeInSlot(){
  const h=S.held, snap=h.snap||snapshot(), old=slotEntry();
  S.slot=[{...h.e,x:0,y:0}];
  if(old){ S.held={kind:"item",e:old,from:{cid:"slot",x:0,y:0},snap:null}; pushUndo(snap,"互換裝備"); }
  else{ S.held=null; pushUndo(snap,"放進裝備格"); }
  clearPreviews(); drawPanel(); drawCursor(); save();
}
function slotClick(ev){
  const e=slotEntry();
  if(S.held&&S.held.kind==="item"){ placeInSlot(); return; }
  if(!e){ if(!S.held) flash("裝備格是空的：左鍵拿起背包裡的裝備再點這裡，或 Ctrl＋左鍵點背包裡的裝備"); return; }
  if(S.held&&S.held.kind==="cur"){ applyCurrency("slot",e,ev.shiftKey); return; }
  if(ev.ctrlKey||ev.metaKey){ quickMove("slot",e); return; }
  pickItem("slot",e);
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
function clearPreviews(){ root.querySelectorAll(".kb-prev").forEach(p=>p.hidden=true); root.querySelectorAll("[data-kslot].over").forEach(x=>x.classList.remove("over")); }
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
    const src=E.sourceNote(it.b,x.m);
    const big=detail?`<div class="kbig">${esc(E.modName(x.m,lang))}・${m.pre?"前綴":"後綴"} ${src||`T${t}／共 ${E.tierCount(it.b,x.m)} 階`}・範圍 ${esc(E.modRange(x.m,lang).join(" / "))}</div>`:"";
    return `<div class="kmod${m.d?" d"+m.d:""}${m.meta?" meta":""}"><span class="ktag ${m.pre?"p":"s"}">${E.tagLabel(it.b,x.m)}</span>
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
  if(/^x:HarvestSeed/.test(k)) return `<div class="kb-curtip"><b>${esc(d.zh)}</b><em>${esc(d.en)}</em><em>園藝工藝台的費用（按背包上方的「園藝」）・已用 ${S.used[k]||0} 個</em></div>`;
  return `<div class="kb-curtip"><b>${esc(d.zh)}</b><em>${esc(d.en)}</em><em>模擬器尚未支援${S.used[k]?"・工藝台費用已用 "+S.used[k]+" 個":""}</em></div>`;
}
function currencyTooltipHTML(k){
  const c=E.curInfo(k);
  if(k.startsWith("fos:")){
    const f=c.fossil, on=S.resoSel.includes(f.id);
    return `<div class="kb-curtip"><b>${esc(c.zh)}</b><em>${esc(c.en)}</em>${esc((f.desc||[]).join("、"))}
      <em>${f.why?"先不開放（待確認）："+esc(f.why):on?"已放進鑄新儀・右鍵拿出":"右鍵放進鑄新儀"}・已用 ${S.used[k]||0} 個</em></div>`;
  }
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
/* 化石放進／拿出鑄新儀（不能放待確認的化石、不能超過上限） */
function toggleFossil(id){
  const f=E.fosById[id]; if(!f) return;
  if(f.why){ flash(f.nz+"：先不開放（待確認）"); return; }
  const i=S.resoSel.indexOf(id);
  if(i>=0) S.resoSel.splice(i,1);
  else if(S.resoSel.length>=E.MAX_FOSSILS){ flash("鑄新儀最多放 "+E.MAX_FOSSILS+" 顆化石（終極鑄新儀 "+E.MAX_FOSSILS+" 孔）"); return; }
  else S.resoSel.push(id);
  if(S.held&&S.held.kind==="cur"&&S.held.k.startsWith("reso:")) S.held=S.resoSel.length?{kind:"cur",k:E.resoKey(S.resoSel)}:null;
  drawCursor(); drawDelvePage(); refreshTip();
}
function pickCurrency(k){
  if(S.held&&S.held.kind==="item"){ flash("先把手上的裝備放下"); return; }
  S.held={kind:"cur",k};
  drawCursor(); redrawCurPage();
}
function redrawCurPage(){ if(S.active==="currency") drawCurrencyPage(); else if(S.active==="essence") drawEssencePage(); else if(S.active==="delve") drawDelvePage(); }
function dropHeld(silent){
  if(!S.held) return;
  if(S.held.kind==="item") returnHeld();
  S.held=null;
  drawCursor(); clearPreviews();
  redrawCurPage();
  if(!silent) refreshTip();
}
/* 拿著的裝備放回原位（原位被佔就放原本那一頁的第一個空位，再不行就背包） */
function returnHeld(){
  const h=S.held; if(!h||h.kind!=="item") return;
  const s=sizeOf(h.e.item);
  let list=cont(h.from.cid)||S.inv;
  if(h.from.cid==="slot"&&(S.slot.length||!S.panel)) list=S.inv;   // 裝備格只放 1 件
  let p=fits(list,h.from.x,h.from.y,s.w,s.h)?{x:h.from.x,y:h.from.y}:firstFit(list,s.w,s.h);
  if(!p){ list=S.inv; p=firstFit(list,s.w,s.h); }
  if(!p){ flash("放不回去：空間不足"); return; }
  list.push({...h.e,x:p.x,y:p.y});
  S.held=null;
  drawAll();
}
function applyCurrency(cid,e,keep){
  const k=S.held.k, c=E.curInfo(k);
  const err=E.check(e.item,k);
  if(err){ flash(c.zh+"："+err.replace(/^這顆/,"")); return; }
  const snap=snapshot();
  const cost=k.startsWith("reso:")?E.resoCost(e.item,k):{[k]:1};   // 鑄新儀：每顆化石＋鑄新儀各 1 個
  const r=E.apply(e.item,k);
  if(!r.ok){ flash(c.zh+"："+r.err); return; }
  e.item=r.item;
  for(const [ck,n] of Object.entries(cost)) S.used[ck]=(S.used[ck]||0)+n;
  pushUndo(snap,c.zh);
  if(!keep){ S.held=null; drawCursor(); }
  redrawContainer(cid);
  redrawCurPage();
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
  redrawContainer(cid); drawCursor();
  save();
}
function quickMove(cid,e){
  let to;
  if(cid==="inv"&&S.panel){
    if(S.slot.length){ flash("裝備格已經有裝備（先把它拿出來）"); return; }
    to="slot";
  }else if(cid==="inv"){
    if(FIXED_TABS.includes(S.active)){ flash("先打開一個一般倉庫頁"); return; }
    to=S.active;
  }else to="inv";
  const dst=cont(to), s=sizeOf(e.item), p=to==="slot"?{x:0,y:0}:firstFit(dst,s.w,s.h);
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
  else if(cid==="slot") drawPanel();
  else if(S.active===cid) drawGrid($("kb-tabgrid"),cont(cid));
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
  const g=gridOf(ev.target), ks=ev.target.closest&&ev.target.closest("[data-kslot]");
  if(S.held&&S.held.kind==="item"){
    clearPreviews();
    if(g){ showPreview(g,placement(g,cont(g.dataset.cid),ev.clientX,ev.clientY)); }
    if(ks) ks.classList.add("over");
    hideTip();
    return;
  }
  if(ks&&slotEntry()){
    const e=slotEntry();
    if(!tipTarget||tipTarget.id!==e.id){ tipTarget={cid:"slot",id:e.id}; refreshTip(); } else placeTip();
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
  const chip=ev.target.closest(".kb-chip[data-tab]");
  if(chip){ ev.preventDefault(); ev.stopPropagation(); tabMenu(chip.dataset.tab,ev.clientX,ev.clientY); return; }
  const decor=ev.target.closest(".kb-decor");
  if(decor){ ev.preventDefault(); ev.stopPropagation(); flash("模擬器尚未支援"); return; }   // 擺設：拿不起來
  const slot=ev.target.closest(".kb-slot");
  if(slot&&slot.dataset.fos){ ev.preventDefault(); ev.stopPropagation(); toggleFossil(slot.dataset.fos); return; }
  if(slot&&slot.dataset.res){
    ev.preventDefault(); ev.stopPropagation();
    if(!S.resoSel.length){ flash("先右鍵點化石放進鑄新儀"); return; }
    const need=+slot.dataset.res;
    if(S.resoSel.length!==need){ flash("這個鑄新儀有 "+need+" 孔，目前放了 "+S.resoSel.length+" 顆化石（要剛好插滿才能用）"); return; }
    pickCurrency(E.resoKey(S.resoSel)); refreshTip(); return;
  }
  if(slot){ ev.preventDefault(); ev.stopPropagation(); pickCurrency(slot.dataset.cur); refreshTip(); return; }
  if(S.held){ ev.preventDefault(); ev.stopPropagation(); if(S.held.kind!=="item") dropHeld(); }
});
/* 拿著通貨時，在製裝台以外的地方按右鍵也是放下 */
document.addEventListener("contextmenu",ev=>{
  if(S.held&&S.held.kind!=="item"&&!root.contains(ev.target)){ ev.preventDefault(); dropHeld(); }
});
root.addEventListener("click",ev=>{
  if(ev.button!==0) return;
  const t=ev.target;
  // 右側面板：裝備格由這裡處理，清單裡的按鈕由 craft-benchlist.js／craft-harvest.js 自己處理
  if(t.closest("[data-kslot]")){ slotClick(ev); return; }
  if(t.closest("#kb-side")) return;
  // 分頁籤、通貨子分頁
  if(t.closest("#kb-newtab")){ editTab(null); return; }
  const chip=t.closest(".kb-chip[data-tab]");
  if(chip){ setActive(chip.dataset.tab); return; }
  const sub=t.closest(".kb-sub");
  if(sub){ S.curSub=sub.dataset.sub; drawCurrencyPage(); return; }
  const fm=t.closest("[data-fmode]");
  if(fm){ try{ localStorage.setItem(FOSSIL_MODE_KEY,fm.dataset.fmode); }catch(e){} E.setFossilMode(fm.dataset.fmode); drawDelvePage();
    flash("多顆化石的增加效果："+(fm.dataset.fmode==="mul"?"相乘":"相加")+"（社群推定值）",true); return; }
  if(t.closest("#kb-zero")){ S.used={}; drawCurrencyPage(); save(); flash("已歸零",true); return; }
  if(t.closest("#kb-undo")){ undo(); return; }
  if(t.closest("#kb-vendor")){ openVendor(); return; }
  if(t.closest("#kb-craftbench")){ togglePanel("bench"); return; }
  if(t.closest("#kb-harvest")){ togglePanel("harvest"); return; }
  if(t.closest(".kb-decor")){ const k=t.closest(".kb-decor").dataset.decor||"";
    flash(/^x:HarvestSeed/.test(k)?"生命力是園藝工藝台的費用：按背包上方的「園藝」打開面板":"模擬器尚未支援",/^x:HarvestSeed/.test(k)); return; }
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
  if(root.querySelector(".kb-veil,.kbl-veil,.khv-veil,.kb-menu")) return;
  if(ev.key==="Escape"&&S.held){ ev.preventDefault(); dropHeld(); return; }
  if((ev.ctrlKey||ev.metaKey)&&!ev.shiftKey&&(ev.key==="z"||ev.key==="Z")){ ev.preventDefault(); undo(); return; }
  if(ev.key==="Alt"){ ev.preventDefault(); if(!altDown){ altDown=true; refreshTip(); } }
});
document.addEventListener("keyup",ev=>{ if(ev.key==="Alt"&&altDown){ ev.preventDefault(); altDown=false; refreshTip(); } });
window.addEventListener("blur",()=>{ if(altDown){ altDown=false; refreshTip(); } });

/* ── 分頁 ── */
function setActive(id){
  if(!FIXED_TABS.includes(id)&&!S.tabs.some(t=>t.id===id)) return;
  S.active=id; hideTip();
  drawStrip(); drawPage(); save();
}
function editTab(id){
  const t=id?S.tabs.find(x=>x.id===id):null;
  let color=t?t.color:TAB_COLORS[S.tabs.length%TAB_COLORS.length];
  const m=modal(`<h3>${t?"改名、選顏色":"新增倉庫頁"}</h3>
    <label class="klab" for="kb-tname">名稱</label>
    <input type="text" id="kb-tname" maxlength="20" value="${esc(t?t.name:"倉庫頁 "+(S.tabs.length+1))}">
    <div class="klab">顏色（分頁籤的底色）</div>
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
    m.close(); drawStrip(); drawPage(); save();
  };
  m.el.querySelector("[data-ok]").onclick=ok;
  m.el.querySelector("[data-x]").onclick=m.close;
  input.onkeydown=e=>{ if(e.key==="Enter") ok(); };
}
/* 刪除：空的頁直接刪；有裝備的要先確認（裝備會一起刪掉，「上一步」也找不回來）；至少留一個一般倉庫頁 */
function deleteTab(id){
  const t=S.tabs.find(x=>x.id===id); if(!t) return;
  if(S.tabs.length<=1){ flash("至少要留一個一般倉庫頁"); return; }
  const remove=()=>{
    S.tabs.splice(S.tabs.indexOf(t),1);
    if(S.active===id) S.active=S.tabs[0].id;
    hideTip(); drawStrip(); drawPage(); save();
  };
  if(!t.items.length){ remove(); flash("已刪除「"+t.name+"」",true); return; }
  const m=modal(`<h3>刪除「${esc(t.name)}」？</h3><p>這一頁還有 <b>${t.items.length}</b> 件裝備，刪除後會一起消失，<b>不能用「上一步」找回</b>。</p>
    <div class="acts"><button class="kb-btn" data-x>取消</button><button class="kb-btn pri" data-ok>刪除這一頁和裡面的裝備</button></div>`);
  m.el.querySelector("[data-x]").onclick=m.close;
  m.el.querySelector("[data-ok]").onclick=()=>{ m.close(); remove(); };
}
/* 分頁右鍵選單：改名（和顏色）、刪除。通貨、精髓、化石是固定頁，選單只說明不能改 */
let menuEl=null;
function closeMenu(){ if(menuEl){ menuEl.remove(); menuEl=null; document.removeEventListener("mousedown",menuOutside,true); document.removeEventListener("keydown",menuKey,true); } }
function menuOutside(e){ if(menuEl&&!menuEl.contains(e.target)) closeMenu(); }
function menuKey(e){ if(e.key==="Escape"){ e.stopPropagation(); e.preventDefault(); closeMenu(); } }
function tabMenu(id,x,y){
  closeMenu(); hideTip();
  const fixed=FIXED_TABS.includes(id), t=S.tabs.find(q=>q.id===id);
  menuEl=document.createElement("div");
  menuEl.className="kb-menu"; menuEl.setAttribute("role","menu");
  menuEl.innerHTML=fixed
    ?`<div class="kb-menu-note">「${esc({currency:"通貨",essence:"精髓",delve:"化石"}[id])}」是固定頁，不能改名或刪除</div>`
    :`<div class="kb-menu-note">${esc(t.name)}（${t.items.length} 件）</div>
      <button type="button" role="menuitem" data-m="edit">改名、選顏色…</button>
      <button type="button" role="menuitem" data-m="del">刪除${t.items.length?"…":""}</button>`;
  root.appendChild(menuEl);
  const w=menuEl.offsetWidth, h=menuEl.offsetHeight;
  menuEl.style.left=clamp(x,4,innerWidth-w-4)+"px";
  menuEl.style.top=clamp(y,4,innerHeight-h-4)+"px";
  menuEl.onclick=e=>{
    const b=e.target.closest("button[data-m]"); if(!b) return;
    closeMenu();
    if(b.dataset.m==="edit") editTab(id); else deleteTab(id);
  };
  const first=menuEl.querySelector("button"); if(first) first.focus();
  document.addEventListener("mousedown",menuOutside,true);
  document.addEventListener("keydown",menuKey,true);
}
window.addEventListener("blur",closeMenu);
window.addEventListener("scroll",closeMenu,true);
/* 拖曳分頁籤排序（只有一般倉庫頁可以拖；放在目標的左半邊＝插到它前面，右半邊＝後面） */
let dragId=null;
const stripEl=$("kb-strip");
const dropSide=(chip,e)=>{ const r=chip.getBoundingClientRect(); return e.clientX<r.left+r.width/2?"l":"r"; };
function clearDrop(){ stripEl.querySelectorAll(".over-l,.over-r").forEach(x=>x.classList.remove("over-l","over-r")); }
stripEl.addEventListener("dragstart",e=>{
  const chip=e.target.closest(".kb-chip[draggable]"); if(!chip) return;
  dragId=chip.dataset.tab; chip.classList.add("drag"); closeMenu(); hideTip();
  e.dataTransfer.effectAllowed="move";
  try{ e.dataTransfer.setData("text/plain",dragId); }catch(x){}
});
stripEl.addEventListener("dragover",e=>{
  if(!dragId) return;
  const chip=e.target.closest(".kb-chip[draggable]");
  clearDrop();
  if(chip&&chip.dataset.tab!==dragId){ e.preventDefault(); e.dataTransfer.dropEffect="move"; chip.classList.add("over-"+dropSide(chip,e)); }
});
stripEl.addEventListener("drop",e=>{
  const chip=e.target.closest(".kb-chip[draggable]");
  if(!dragId||!chip||chip.dataset.tab===dragId) return;
  e.preventDefault();
  const [t]=S.tabs.splice(S.tabs.findIndex(x=>x.id===dragId),1);
  const i=S.tabs.findIndex(x=>x.id===chip.dataset.tab);
  S.tabs.splice(dropSide(chip,e)==="l"?i:i+1,0,t);
  dragId=null; drawStrip(); save();
});
stripEl.addEventListener("dragend",()=>{ dragId=null; clearDrop(); drawStrip(); });

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
  // 第一次使用（自動建立了暫存區）、或是舊格式（v2）的存檔：以新格式存一次
  if(!d||d.v!==SAVE_V||d.dataVersion!==D.version) save();
})();
})();
