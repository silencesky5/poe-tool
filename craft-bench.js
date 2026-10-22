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
  S.panel=ok&&["bench","harvest","share"].includes(d.benchPanel)?d.benchPanel:null;
  if(S.panel==="share"&&S.slot.length) S.panel="bench";
  if(S.slot.length&&!S.panel) S.panel="bench";
}
/* 存檔時：拿在游標上的裝備當作還在原位 */
function toSave(){
  const inv=S.inv.slice(), slot=S.slot.slice(), tabs=S.tabs.map(t=>({id:t.id,name:t.name,color:t.color,items:t.items.slice()}));
  const h=S.held;
  if(h&&h.kind==="item"&&!h.copyOf){   // 從分享架拿起的複本還沒放下＝還沒複製，不存
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
      <button class="kb-btn" id="kb-share" aria-pressed="false" title="在背包右邊打開公會分享架（再按一次關閉）">公會分享</button>
      <button class="kb-btn" id="kb-undo" title="Ctrl+Z">上一步</button></div>
    <div class="kb-grid" id="kb-inv" data-cid="inv"></div>
    <div class="kb-discard" id="kb-discard">丟棄（把裝備放進來）</div>
    <div class="kb-hint">右鍵點通貨拿起 → 左鍵點裝備套用；按住 Shift 可以一直用；右鍵或 Esc 放下。<br>
      左鍵拿起裝備、再點一格放下；Ctrl＋左鍵在背包和倉庫（面板打開時是裝備格）間快速移動；按住 Alt 看詞綴範圍；Ctrl+Z 上一步。<br>
      倉庫分頁：「＋」新增、右鍵改名或刪除、拖曳調整順序。</div>
  </section>
  <section class="kb-side" id="kb-side" aria-label="工藝台／園藝／公會分享面板" hidden></section>
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
    if(S.panel==="share"){ buildShare(); panelUI={close(){ sideEl.innerHTML=""; },update(){ drawShare(); }}; loadShares(SH.sel); }
  }else if(panelUI){ const e=slotEntry(); panelUI.update(e&&e.item); }
  sideEl.hidden=!S.panel;
  root.querySelector(".kb").classList.toggle("paneled",!!S.panel);
  $("kb-craftbench").setAttribute("aria-pressed",S.panel==="bench");
  $("kb-harvest").setAttribute("aria-pressed",S.panel==="harvest");
  $("kb-share").setAttribute("aria-pressed",S.panel==="share");
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
/* 按「工藝台」「園藝」「公會分享」：開這一個（另一個會關掉）；再按一次＝關閉。
   工藝台↔園藝：裝備格的裝備留著；換到公會分享（沒有裝備格）或關閉：裝備移回背包 */
function togglePanel(kind){
  if(S.panel===kind){ closePanel(); return; }
  if(kind==="share"&&!emptySlot()) return;
  S.panel=kind; hideTip(); drawPanel(); save();
}
function closePanel(){
  if(!emptySlot()) return;
  S.panel=null; hideTip(); drawAll(); save();
}
/* 裝備格的裝備放回背包；背包滿了放到暫存區（沒有就放第一個放得下的倉庫頁）。放不下回傳 false */
function emptySlot(){
  if(S.held&&S.held.kind==="item"&&S.held.from.cid==="slot") returnHeld();
  const e=slotEntry();
  if(e){
    const s=sizeOf(e.item);
    let to="inv", p=firstFit(S.inv,s.w,s.h);
    if(!p){
      const tabs=S.tabs.slice().sort((a,b)=>(b.name==="暫存區")-(a.name==="暫存區"));
      for(const t of tabs){ p=firstFit(t.items,s.w,s.h); if(p){ to=t.id; break; } }
    }
    if(!p){ flash("背包和倉庫頁都放不下裝備格裡的裝備，面板先不關"); return false; }
    const snap=snapshot();
    S.slot=[];
    cont(to).push({...e,x:p.x,y:p.y});
    pushUndo(snap,"關閉面板");
    if(to!=="inv") flash("背包滿了，裝備放到「"+S.tabs.find(t=>t.id===to).name+"」",true);
    drawAll();
  }
  return true;
}
/* 拿著的裝備放進裝備格（裝備格已有裝備就互換，那件到游標上） */
function placeInSlot(){
  const h=S.held, snap=h.snap||snapshot(), old=slotEntry();
  if(h.copyOf) countCopy(h.copyOf);
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

/* ── 公會分享架（右側面板）──
   複製制：分享出去的是快照，別人只能「複製一份」到自己的背包（原件留在架上，被複製次數 +1）。
   資料在 Worker＋D1（/shares），這裡只負責顯示和操作；權限、上限都由 Worker 檢查。
   ・分享：拿起背包／倉庫頁的裝備點分享架（或拖過去），或在裝備上按右鍵「分享到公會」→ 輸入備註 → 分享（裝備留在原處）
   ・複製：「複製到背包」、Ctrl＋左鍵、或從架上把裝備拖到背包／倉庫頁（拿起來的是複本，放下才算複製）
   ・撤下：分享者本人或團隊幹部（Worker 用登入時簽在 token 裡的身分組判斷） */
const SHELF_COLS=11;   // 分享架一列 11 格（留一格給捲軸）
const SH={list:[],me:null,limits:{perUser:10,total:100,perWindow:3,windowSec:60},loaded:false,loading:false,err:null,
  filter:"all",q:"",sel:null,layout:[],msg:null};
const shApi=(p,o)=>St&&St.api?St.api(p,o):Promise.reject(new Error("沒有 CraftStorage"));
const loggedIn=()=>!!(St&&St.status().loggedIn);
function shareItem(sh){
  if(!("_item" in sh)) sh._item=sh.item?E.fromStored(sh.item):null;   // 改版後讀不回來＝null
  return sh._item;
}
function shareById(id){ return SH.list.find(x=>x.id===id)||null; }
function canRemove(sh){ return !!SH.me&&(SH.me.id===sh.sharerId||SH.me.officer); }
function shareHay(sh){
  const it=shareItem(sh);
  const t=[sh.sharerName,sh.note];
  if(it){
    t.push(baseLabel(E.bases[it.b],"zh"),baseLabel(E.bases[it.b],"en"));
    for(const x of it.mods) t.push(E.render(x.m,x.v,"zh").join(" "),E.render(x.m,x.v,"en").join(" "),E.modName(x.m,"zh"));
  }
  return t.join("\n").toLowerCase();
}
function shareList(){
  const q=SH.q.toLowerCase();
  return SH.list.filter(sh=>(SH.filter!=="mine"||(SH.me&&sh.sharerId===SH.me.id))&&(!q||shareHay(sh).includes(q)));
}
/* 照時間（新的在前）由左到右、由上到下排進 11 欄的格子；讀不回來的佔 1 格 */
function layoutShelf(list){
  const out=[], used=[];
  const free=(x,y,w,h)=>!used.some(u=>u.x<x+w&&x<u.x+u.w&&u.y<y+h&&y<u.y+u.h);
  for(const sh of list){
    const it=shareItem(sh), s=it?sizeOf(it):{w:1,h:1};
    let p=null;
    for(let y=0;!p;y++) for(let x=0;x<=SHELF_COLS-s.w;x++) if(free(x,y,s.w,s.h)){ p={x,y}; break; }
    used.push({x:p.x,y:p.y,w:s.w,h:s.h});
    out.push({id:sh.id,x:p.x,y:p.y,w:s.w,h:s.h,item:it,sh});
  }
  return out;
}
function fmtTime(ms){ return new Date(ms).toLocaleString("zh-TW",{hour12:false,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}); }
async function loadShares(sel){
  SH.loading=true; drawShare();
  try{
    const r=await shApi("/shares");
    if(!r.ok) throw new Error("shares "+r.status);
    const d=await r.json();
    SH.list=d.shares||[]; SH.me=d.me||null; if(d.limits) SH.limits=d.limits;
    SH.loaded=true; SH.err=null;
  }catch(e){ SH.err="連不上公會分享架，請稍後再試"; }
  SH.loading=false;
  if(sel){
    SH.sel=sel;
    if(SH.loaded&&!shareById(sel)) SH.msg={bad:true,t:"連結裡的這件裝備已經被撤下，或不存在了"};
  }
  if(SH.filter==="mine"&&!SH.me) SH.filter="all";
  drawShare();
  if(sel){ const el=sideEl.querySelector('.ksh-it[data-sid="'+CSS.escape(sel)+'"]'); if(el) el.scrollIntoView({block:"nearest"}); }
}
function buildShare(){
  sideEl.innerHTML=`<div class="ksh" role="region" aria-label="公會分享">
    <div class="kbl-head"><b>公會分享</b><span class="kbl-sub ksh-sub"></span>
      <button type="button" class="ksh-ref" data-sh="refresh" title="重新整理" aria-label="重新整理">⟳</button>
      <button type="button" class="kbl-x" data-sh="close" aria-label="關閉" title="關閉">×</button></div>
    <div class="ksh-bar"><div class="ksh-fs" role="tablist">
        <button type="button" role="tab" class="ksh-f" data-sh="f-all">全部</button>
        <button type="button" role="tab" class="ksh-f" data-sh="f-mine">我的分享</button></div>
      <input type="text" class="ksh-q" placeholder="搜尋（底材／詞綴／分享者）" autocomplete="off" aria-label="搜尋分享架"></div>
    <div class="ksh-msg" role="status" aria-live="polite"></div>
    <div class="ksh-scroll"><div class="ksh-grid" aria-label="分享的裝備"></div></div>
    <div class="ksh-detail"></div>
    <div class="ksh-acts"><button type="button" class="kb-btn pri" data-sh="copy">複製到背包</button>
      <button type="button" class="kb-btn ksh-rm" data-sh="remove">撤下</button></div>
    <div class="ksh-foot">複製制：架上的是分享當時的快照，複製一份到背包洗不會影響原件。
      分享：把背包的裝備拖到架上，或在裝備上按右鍵「分享到公會」（要登入 RKSA）。複製：「複製到背包」、Ctrl＋左鍵，或把架上的裝備拖到背包。
      每人最多 ${SH.limits.perUser} 件、全架 ${SH.limits.total} 件、1 分鐘內最多分享 ${SH.limits.perWindow} 件。</div>
  </div>`;
  const q=sideEl.querySelector(".ksh-q");
  q.value=SH.q;
  q.oninput=()=>{ SH.q=q.value.trim(); drawShare(); };
}
function drawShare(){
  if(S.panel!=="share"||!sideEl.querySelector(".ksh")) return;
  const $s=s=>sideEl.querySelector(s);
  const list=shareList();
  SH.layout=layoutShelf(list);
  const rows=Math.max(6,...SH.layout.map(e=>e.y+e.h));
  const g=$s(".ksh-grid");
  g.style.height=`calc(var(--cell) * ${rows})`;
  g.innerHTML=SH.layout.map(e=>{
    const at=`left:calc(var(--cell) * ${e.x});top:calc(var(--cell) * ${e.y});width:calc(var(--cell) * ${e.w});height:calc(var(--cell) * ${e.h})`;
    const sel=SH.sel===e.id?" sel":"";
    return e.item?`<div class="kb-item r${e.item.r} ksh-it${sel}" data-sid="${esc(e.id)}" style="${at}">${itemIcon(e.item)}</div>`
      :`<div class="kb-item ksh-it ksh-bad${sel}" data-sid="${esc(e.id)}" style="${at}"><span>無法讀取</span></div>`;
  }).join("")+(SH.loading&&!SH.loaded?`<div class="ksh-empty">讀取中…</div>`:
    !list.length?`<div class="ksh-empty">${SH.err?esc(SH.err):SH.q||SH.filter==="mine"?"沒有符合的裝備。":"分享架是空的。把背包的裝備拖到這裡就能分享。"}</div>`:"");
  const mine=SH.me?SH.list.filter(x=>x.sharerId===SH.me.id).length:0;
  $s(".ksh-sub").textContent=`${SH.list.length}／${SH.limits.total} 件`+(SH.me?`・你分享了 ${mine}／${SH.limits.perUser} 件`+(SH.me.officer?"・團隊幹部":""):"・未登入（只能瀏覽、複製）");
  sideEl.querySelectorAll(".ksh-f").forEach(b=>{
    const f=b.dataset.sh.slice(2);
    b.setAttribute("aria-selected",SH.filter===f);
    if(f==="mine"){ b.disabled=!SH.me; b.title=SH.me?"":"登入後才能看自己的分享"; }
  });
  const m=$s(".ksh-msg"); m.className="ksh-msg"+(SH.msg&&SH.msg.bad?" bad":""); m.textContent=SH.msg?SH.msg.t:(SH.err||"");
  const sh=SH.sel&&shareById(SH.sel), it=sh&&shareItem(sh);
  const d=$s(".ksh-detail");
  if(!sh) d.innerHTML=`<div class="ksh-hint">點一件裝備看詳細資料。</div>`;
  else{
    const name=it?esc(baseLabel(E.bases[it.b]))+`<small>${CE.RARITY_ZH[it.r]}・物品等級 ${it.lv}・${it.mods.length} 條詞綴</small>`:"<span class=\"ksh-badtxt\">此版本無法讀取</span>";
    d.innerHTML=`<div class="ksh-name">${name}</div>
      <div class="ksh-meta">${esc(sh.sharerName)}｜${esc(fmtTime(sh.sharedAt))}｜被複製 ${sh.copies} 次</div>
      ${sh.note?`<div class="ksh-note">備註：${esc(sh.note)}</div>`:""}
      ${it?"":`<div class="ksh-note">分享時的資料版本 ${esc(sh.dataVersion||"不明")}，目前網站是 ${esc(D.version)}：底材或詞綴在這一版找不到，所以不能複製。</div>`}`;
  }
  const cp=$s('[data-sh="copy"]'), rm=$s('[data-sh="remove"]');
  cp.disabled=!it; cp.title=!sh?"先點一件裝備":!it?"此版本無法讀取，不能複製":"";
  rm.hidden=!(sh&&canRemove(sh));
  rm.textContent=sh&&SH.me&&sh.sharerId!==SH.me.id?"撤下（幹部）":"撤下";
}
function shareAction(a){
  if(a==="close"){ togglePanel("share"); return; }
  if(a==="refresh"){ SH.msg=null; loadShares(SH.sel); return; }
  if(a==="f-all"||a==="f-mine"){ SH.filter=a.slice(2); drawShare(); return; }
  const sh=SH.sel&&shareById(SH.sel);
  if(!sh){ SH.msg={bad:true,t:"先點一件裝備"}; drawShare(); return; }
  if(a==="copy") copyShareToInv(sh);
  if(a==="remove") removeShareAsk(sh);
}
/* 複製到背包（按鈕、Ctrl＋左鍵）：背包滿了不能複製 */
function copyShareToInv(sh){
  const it=shareItem(sh);
  if(!it){ SH.msg={bad:true,t:"此版本無法讀取，不能複製"}; drawShare(); return; }
  const s=sizeOf(it), p=firstFit(S.inv,s.w,s.h);
  if(!p){ SH.msg={bad:true,t:"背包滿了，不能複製（先清出 "+s.w+"×"+s.h+" 格的空間）"}; drawShare(); flash("背包滿了，不能複製"); return; }
  const snap=snapshot();
  S.inv.push({id:uid(),x:p.x,y:p.y,item:E.clone(it)});
  pushUndo(snap,"複製分享的裝備");
  drawGrid(invEl,S.inv); save();
  SH.msg={t:"已複製一份到背包"}; drawShare();
  countCopy(sh.id);
}
/* 被複製次數 +1（未登入也可以）；架上那件剛好被撤下時，已經複製的照樣保留 */
async function countCopy(id){
  try{
    const r=await shApi("/shares/"+encodeURIComponent(id)+"/copy",{method:"POST"});
    if(r.status===404){ SH.list=SH.list.filter(x=>x.id!==id); SH.msg={bad:true,t:"這件剛剛被撤下了（你複製的這件會保留）"}; drawShare(); return; }
    if(!r.ok) return;
    const d=await r.json(), sh=shareById(id);
    if(sh){ sh.copies=d.copies; drawShare(); }
  }catch(e){}
}
function removeShareAsk(sh){
  const it=shareItem(sh);
  const other=SH.me&&sh.sharerId!==SH.me.id;
  const m=modal(`<h3>撤下這件分享？</h3><p>${it?esc(baseLabel(E.bases[it.b])):"（此版本無法讀取的裝備）"}・分享者 ${esc(sh.sharerName)}<br>
    撤下後分享架上就沒有這件了；已經複製到背包的人不受影響。${other?"<br><b>你是以團隊幹部身分撤下別人的分享。</b>":""}</p>
    <div class="msg" role="status"></div>
    <div class="acts"><button class="kb-btn" data-x>取消</button><button class="kb-btn pri" data-ok>撤下</button></div>`);
  m.el.querySelector("[data-x]").onclick=m.close;
  const ok=m.el.querySelector("[data-ok]"), msg=m.el.querySelector(".msg");
  ok.onclick=async()=>{
    ok.disabled=true;
    try{
      const r=await shApi("/shares/"+encodeURIComponent(sh.id),{method:"DELETE"});
      if(r.ok||r.status===404){
        SH.list=SH.list.filter(x=>x.id!==sh.id); SH.sel=null;
        SH.msg={t:r.ok?"已撤下":"這件已經不在架上了"}; m.close(); drawShare(); return;
      }
      msg.className="msg bad";
      msg.textContent=r.status===403?"只有分享者本人或團隊幹部可以撤下。":r.status===401?"登入已過期，請重新登入。":"撤下失敗，請稍後再試。";
    }catch(e){ msg.className="msg bad"; msg.textContent="連不上分享架，請稍後再試。"; }
    ok.disabled=false;
  };
}
/* 分享：輸入備註（選填，最多 50 字）後送出；裝備留在原處 */
function shareFlow(item){
  if(!loggedIn()){ flash("登入 RKSA 的 Discord 才能分享（右上角「用 Discord 登入」）"); return; }
  if(S.slot.length){ flash("工藝台／園藝的裝備格裡還有裝備，請先移回背包再分享"); return; }
  const MAX=50;
  const m=modal(`<h3>分享到公會</h3>
    <div class="ksh-preview">${itemTooltipHTML(item,false)}</div>
    <label class="klab" for="ksh-note">備註（選填，最多 ${MAX} 字）</label>
    <input type="text" id="ksh-note" maxlength="${MAX}" placeholder="例如：洗到 T1 生命，缺一條抗性" autocomplete="off">
    <div class="ksh-count"><span>0</span>／${MAX}</div>
    <div class="msg" role="status" aria-live="polite"></div>
    <p class="ksh-tip">分享的是現在這一刻的快照，之後再洗也不會改到架上那件。分享後會在 💬poe閒聊 發一則通知。</p>
    <div class="acts"><button class="kb-btn" data-x>取消</button><button class="kb-btn pri" data-ok>分享</button></div>`,null,"kb-share");
  const input=m.el.querySelector("#ksh-note"), cnt=m.el.querySelector(".ksh-count span"), msg=m.el.querySelector(".msg"), ok=m.el.querySelector("[data-ok]");
  input.focus();
  input.oninput=()=>{ cnt.textContent=[...input.value].length; };
  m.el.querySelector("[data-x]").onclick=m.close;
  const send=async()=>{
    const note=input.value.trim();
    if([...note].length>MAX){ msg.className="msg bad"; msg.textContent="備註最多 "+MAX+" 字"; return; }
    ok.disabled=true; msg.className="msg"; msg.textContent="分享中…";
    const mods=item.mods.slice().sort((x,y)=>(E.mods[y.m].pre-E.mods[x.m].pre));
    const body={item:E.toStored(item),note,dataVersion:D.version,
      text:{base:E.baseName(item.b,"zh"),lines:mods.flatMap(x=>E.render(x.m,x.v,"zh"))}};
    try{
      const r=await shApi("/shares",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const d=await r.json().catch(()=>({}));
      if(r.status===201){
        m.close();
        if(S.panel!=="share") togglePanel("share");
        SH.filter="all"; SH.q=""; const q=sideEl.querySelector(".ksh-q"); if(q) q.value="";
        SH.msg={t:"已分享到公會分享架，💬poe閒聊 會收到通知"};
        loadShares(d.share&&d.share.id);
        flash("已分享到公會",true);
        return;
      }
      msg.className="msg bad";
      msg.textContent=d.error==="per_user_limit"?`你已經分享 ${d.count||d.limit} 件，請先撤下一件（每人最多 ${d.limit} 件）`
        :d.error==="shelf_full"?`分享架已經滿了（最多 ${d.limit} 件），請等其他人撤下`
        :d.error==="too_fast"?`分享太快了：${d.windowSec>=60?Math.round(d.windowSec/60)+" 分鐘":d.windowSec+" 秒"}內最多 ${d.limit} 件，請稍後再試`
        :d.error==="note_too_long"?"備註最多 "+MAX+" 字"
        :r.status===401?"登入已過期，請重新登入後再分享"
        :"分享失敗（"+(d.error||r.status)+"），請稍後再試";
    }catch(e){ msg.className="msg bad"; msg.textContent="連不上分享架，請稍後再試"; }
    ok.disabled=false;
  };
  ok.onclick=send;
  input.onkeydown=e=>{ if(e.key==="Enter") send(); };
}
/* 分享架上點一下：選中看詳細；Ctrl＋左鍵＝快速複製；拿著背包的裝備點架子＝分享 */
function shelfClick(ev){
  const h=S.held;
  if(h&&h.kind==="item"){
    if(h.copyOf){ cancelCopy(); return; }
    const item=h.e.item;
    returnHeld();
    shareFlow(item);
    return;
  }
  if(h&&h.kind==="cur"){ flash("架上的裝備不能直接用通貨，先複製到背包"); return; }
  const el=ev.target.closest(".ksh-it");
  SH.msg=null;
  if(!el){ SH.sel=null; drawShare(); return; }
  SH.sel=el.dataset.sid; drawShare();
  if(ev.ctrlKey||ev.metaKey) copyShareToInv(shareById(SH.sel));
}
/* 從架上拿起複本（拖曳時）：放到背包或倉庫頁才算複製；放回架上、右鍵、Esc＝取消 */
function pickShareCopy(id){
  const sh=shareById(id), it=sh&&shareItem(sh);
  if(!it){ flash("此版本無法讀取，不能複製"); return; }
  SH.sel=id; drawShare();
  S.held={kind:"item",e:{id:uid(),x:0,y:0,item:E.clone(it)},from:{cid:"shelf",x:0,y:0},copyOf:id,snap:snapshot()};
  hideTip(); drawCursor();
}
function cancelCopy(){ S.held=null; clearPreviews(); drawCursor(); flash("已取消複製",true); }
/* 連結 #craft&share=<id>：切到製裝台、打開分享架、選中這一件 */
function openShareLink(id){
  if(!id) return;
  window.CRAFT_SHARE_LINK=null;
  const t=document.getElementById("k-t-bench"); if(t&&t.getAttribute("aria-selected")!=="true") t.click();
  if(S.panel!=="share") togglePanel("share");
  SH.filter="all"; SH.q=""; const q=sideEl.querySelector(".ksh-q"); if(q) q.value="";
  loadShares(id);
  root.scrollIntoView({block:"start"});
}
window.addEventListener("craftsharelink",e=>{ if(S.ready) openShareLink(e.detail); });
window.addEventListener("craftstorage:status",()=>{ if(S.ready&&S.panel==="share"&&SH.loaded&&!!SH.me!==loggedIn()) loadShares(SH.sel); });

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
function clearPreviews(){ root.querySelectorAll(".kb-prev").forEach(p=>p.hidden=true); root.querySelectorAll("[data-kslot].over,.ksh-grid.over").forEach(x=>x.classList.remove("over")); }
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
  if(tipTarget.shelf){
    const sh=shareById(tipTarget.shelf), it=sh&&shareItem(sh);
    if(!sh) hideTip();
    else showTip((it?itemTooltipHTML(it,altDown):`<div class="kb-curtip"><b>此版本無法讀取</b><em>分享時的資料版本 ${esc(sh.dataVersion||"不明")}</em></div>`)+
      `<div class="kb-curtip ksh-tipmeta">${esc(sh.sharerName)}・被複製 ${sh.copies} 次${sh.note?"<br>備註："+esc(sh.note):""}</div>`);
  }
  else if(tipTarget.cur) showTip(currencyTooltipHTML(tipTarget.cur));
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
  if(h.copyOf){ S.held=null; drawAll(); return; }   // 從分享架拿起的複本：放回去＝取消複製
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
  if(h.copyOf) countCopy(h.copyOf);   // 從分享架拖過來的複本：放下才算複製
  if(p.hits.length===1){
    // 剛好只蓋到一件：互換，那件跑到游標上
    const other=p.hits[0];
    list.splice(list.indexOf(other),1);
    S.held={kind:"item",e:other,from:{cid,x:other.x,y:other.y},snap:null};
    pushUndo(snap,"互換裝備");
  }else{
    S.held=null;
    pushUndo(snap,h.copyOf?"複製分享的裝備":"移動裝備");
  }
  clearPreviews();
  redrawContainer(cid); drawCursor();
  save();
}
function quickMove(cid,e){
  let to;
  if(cid==="inv"&&S.panel&&S.panel!=="share"){
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
  dragMove(ev);
  const g=gridOf(ev.target), ks=ev.target.closest&&ev.target.closest("[data-kslot]"), shg=ev.target.closest&&ev.target.closest(".ksh-grid");
  if(S.held&&S.held.kind==="item"){
    clearPreviews();
    if(g){ showPreview(g,placement(g,cont(g.dataset.cid),ev.clientX,ev.clientY)); }
    if(ks) ks.classList.add("over");
    if(shg&&!S.held.copyOf) shg.classList.add("over");   // 放開就分享
    hideTip();
    return;
  }
  const shi=ev.target.closest&&ev.target.closest(".ksh-it");
  if(shi){
    const id=shi.dataset.sid;
    if(!tipTarget||tipTarget.shelf!==id){ tipTarget={shelf:id}; refreshTip(); } else placeTip();
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
  const ig=!S.held&&gridOf(ev.target);
  if(ig){
    const e=entryAt(ig,ig.dataset.cid,ev.clientX,ev.clientY);
    if(e){ ev.preventDefault(); ev.stopPropagation(); itemMenu(ig.dataset.cid,e,ev.clientX,ev.clientY); return; }
  }
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
  if(suppressClick){ suppressClick=false; return; }   // 剛拖曳完：放下已經在 mouseup 處理
  const t=ev.target;
  // 右側面板：裝備格、分享架由這裡處理，清單裡的按鈕由 craft-benchlist.js／craft-harvest.js 自己處理
  if(t.closest("[data-kslot]")){ slotClick(ev); return; }
  if(t.closest(".ksh-grid")){ shelfClick(ev); return; }
  const shb=t.closest("[data-sh]");
  if(shb){ if(!shb.disabled) shareAction(shb.dataset.sh); return; }
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
  if(t.closest("#kb-share")){ togglePanel("share"); return; }
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
/* 裝備右鍵選單：分享到公會（背包、倉庫頁的裝備） */
function itemMenu(cid,e,x,y){
  closeMenu(); hideTip();
  const ok=loggedIn();
  menuEl=document.createElement("div");
  menuEl.className="kb-menu"; menuEl.setAttribute("role","menu");
  menuEl.innerHTML=`<div class="kb-menu-note">${esc(baseLabel(E.bases[e.item.b]))}</div>
    <button type="button" role="menuitem" data-m="share"${ok?"":" disabled"}>分享到公會…</button>
    ${ok?"":`<div class="kb-menu-note">登入 RKSA 的 Discord 才能分享</div>`}`;
  root.appendChild(menuEl);
  const w=menuEl.offsetWidth, h=menuEl.offsetHeight;
  menuEl.style.left=clamp(x,4,innerWidth-w-4)+"px";
  menuEl.style.top=clamp(y,4,innerHeight-h-4)+"px";
  menuEl.onclick=ev=>{
    const b=ev.target.closest("button[data-m]"); if(!b||b.disabled) return;
    closeMenu();
    shareFlow(e.item);
  };
  const first=menuEl.querySelector("button:not([disabled])"); if(first) first.focus();
  document.addEventListener("mousedown",menuOutside,true);
  document.addEventListener("keydown",menuKey,true);
}
/* 拖曳裝備：按住左鍵移動超過幾個像素＝拿起來，放開的地方＝放下（背包、倉庫頁、裝備格、分享架）。
   沒有移動就是一般的點一下（拿起／放下）。 */
let dragStart=null, dragging=false, suppressClick=false;
root.addEventListener("mousedown",ev=>{
  if(ev.button!==0||S.held||ev.ctrlKey||ev.metaKey||ev.shiftKey) return;
  const shi=ev.target.closest(".ksh-it");
  if(shi){ dragStart={x:ev.clientX,y:ev.clientY,shelf:shi.dataset.sid}; return; }
  const g=gridOf(ev.target);
  const e=g&&entryAt(g,g.dataset.cid,ev.clientX,ev.clientY);
  const ks=ev.target.closest("[data-kslot]");
  if(e) dragStart={x:ev.clientX,y:ev.clientY,cid:g.dataset.cid,id:e.id};
  else if(ks&&slotEntry()) dragStart={x:ev.clientX,y:ev.clientY,cid:"slot",id:slotEntry().id};
});
function dragMove(ev){
  if(!dragStart||dragging) return;
  if(!(ev.buttons&1)){ dragStart=null; return; }
  if(Math.hypot(ev.clientX-dragStart.x,ev.clientY-dragStart.y)<6) return;
  dragging=true;
  if(dragStart.shelf){ pickShareCopy(dragStart.shelf); return; }
  const e=findEntry(dragStart.cid,dragStart.id);
  if(e) pickItem(dragStart.cid,e);
}
document.addEventListener("mouseup",ev=>{
  const was=dragging;
  dragStart=null; dragging=false;
  if(!was||!S.held||S.held.kind!=="item") return;
  suppressClick=true; setTimeout(()=>{ suppressClick=false; },0);
  const t=document.elementFromPoint(ev.clientX,ev.clientY)||document.body;
  if(!root.contains(t)) return;   // 放在製裝台外面：留在游標上
  if(t.closest(".ksh-grid")){ shelfClick({target:t,ctrlKey:false,metaKey:false}); return; }
  if(t.closest("[data-kslot]")){ placeInSlot(); return; }
  const g=gridOf(t);
  if(g) placeHeld(g.dataset.cid,g);
});
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
  if(S.held.copyOf){ cancelCopy(); return; }
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
  if(window.CRAFT_SHARE_LINK) openShareLink(window.CRAFT_SHARE_LINK);
  // 第一次使用（自動建立了暫存區）、或是舊格式（v2）的存檔：以新格式存一次
  if(!d||d.v!==SAVE_V||d.dataVersion!==D.version) save();
})();
})();
