/* 園藝工藝台（豐收；製裝台、模擬器共用）。規則都在 craft-engine.js（checkHarvest／applyHarvest），這裡只負責顯示和點選。
   美術圖是遊戲檔案抽出來的官方元件（img/craft/ui/，tools/extract_ui_art.py）：藤蔓外框＋標題牌、每一列的底、
   右邊放物品的面板、生命力計數框、生命力圖示。排版照遊戲畫面（備份/2026-10-22_園藝截圖）。
   選項＝遊戲資料 HarvestCraftOptions 全部 74 個；不能用的（待確認、不適用）照樣列出、變灰並說明原因。

   const h = CraftHarvest.open({ E, item, lang, host, used, onCraft });
     host：要把視窗放進去的元素（要在 #tab-craft 裡面，樣式才套得到）
     used()：回傳目前的使用量 {通貨鍵值: 數量}，右邊的生命力計數顯示「已用」
     onCraft(k)：按了「賦予」（k ＝ "hv:" ＋ 選項 Id）；呼叫的地方套用後用 h.update(新物品, 訊息) 更新畫面
   h.close() 關閉；按 Esc 或點視窗外面也會關。 */
(function(){
"use strict";
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const IMG="img/craft/items/", UI="img/craft/ui/";
/* 五種生命力：分頁篩選和右邊計數的順序照遊戲（紅、黃、藍、白、晶化仇怨） */
const LIFE=[
  {k:"x:HarvestSeedRed",zh:"野性",ic:UI+"lifeforce_wild.webp",has:o=>o.lf===1},
  {k:"x:HarvestSeedGreen",zh:"靈現",ic:UI+"lifeforce_vivid.webp",has:o=>o.lf===2},
  {k:"x:HarvestSeedBlue",zh:"原始",ic:UI+"lifeforce_primal.webp",has:o=>o.lf===3},
  {k:"x:HarvestSeedBoss",zh:"神聖",ic:UI+"lifeforce_sacred.webp",has:o=>!!o.c["x:HarvestSeedBoss"]},
  {k:"x:HarvestSeedFaridun",zh:"晶化仇怨",ic:null,has:o=>!!o.c["x:HarvestSeedFaridun"]},
];
function fmt(n){ return n>=100000?(Math.round(n/100)/10)+"k":n.toLocaleString("en-US"); }

function open(opt){
  const {E,host,onCraft}=opt, used=opt.used||(()=>({}));
  const D=E.data;
  let item=opt.item, lang=opt.lang||"zh", q="", filter=-1, sel=null, onlyOk=false, msg=null;
  const lifeIc=l=>l.ic||IMG+((E.curInfo(l.k)||{}).ic||"");

  const veil=document.createElement("div");
  veil.className="khv-veil";
  veil.innerHTML=`<div class="khv" role="dialog" aria-modal="true" aria-label="園藝工藝台">
    <div class="khv-stage">
      <img class="khv-frame" src="${UI}harvest_window.webp" alt="" draggable="false">
      <div class="khv-title">園藝</div>
      <button type="button" class="khv-x" aria-label="關閉">×</button>
      <div class="khv-tabs" role="tablist" aria-label="依生命力篩選">${LIFE.map((l,i)=>`<button type="button" role="tab" class="khv-tab" data-f="${i}" title="${esc(l.zh)}（再點一次取消篩選）">
        <img src="${esc(lifeIc(l))}" alt="${esc(l.zh)}"></button>`).join("")}</div>
      <div class="khv-list" role="listbox" aria-label="園藝工藝台選項"></div>
      <div class="khv-side">
        <img class="khv-sidebg" src="${UI}harvest_side.webp" alt="" draggable="false">
        <div class="khv-slot"><img class="khv-slotbg" src="${UI}harvest_slot.webp" alt="" draggable="false"><div class="khv-itm"></div></div>
        <button type="button" class="khv-go">賦予</button>
      </div>
      <div class="khv-counts" aria-label="生命力已用">${LIFE.map(l=>`<div class="khv-cnt" data-k="${esc(l.k)}" title="${esc((E.curInfo(l.k)||{zh:l.zh}).zh)}：已用">
        <img class="bg" src="${UI}harvest_counter.webp" alt=""><img class="ic" src="${esc(lifeIc(l))}" alt="${esc(l.zh)}"><span></span></div>`).join("")}</div>
    </div>
    <div class="khv-bar"><label class="khv-ql">搜尋選項<input type="text" class="khv-q" placeholder="請在此輸入關鍵字…" autocomplete="off"></label>
      <label class="khv-chk"><input type="checkbox" class="khv-ok">只顯示能用的</label></div>
    <div class="khv-msg" role="status" aria-live="polite"></div>
    <div class="khv-foot">右邊的數字是<b>已經用掉</b>的生命力（倉庫「通貨・聯盟」頁也看得到，可以歸零）。
      選項和數量照遊戲資料 HarvestCraftOptions（${esc((D.harvest||{}).patch||D.version)}）；灰色的是機制待確認或模擬器不適用，滑鼠移上去看原因。</div></div>`;
  host.appendChild(veil);
  const $=s=>veil.querySelector(s);

  function text(o){
    return E.hvParts(o.zh).map(p=>p.c?`<span class="hv-${esc(p.c)}">${esc(p.t)}</span>`:esc(p.t)).join("");
  }
  function costs(o){
    return LIFE.filter(l=>o.c[l.k]).map(l=>`<span class="khv-c">${fmt(o.c[l.k])}<img src="${esc(lifeIc(l))}" alt="${esc(l.zh)}"></span>`).join("");
  }
  function rows(){
    return E.harvest.map(o=>({o,err:E.check(item,o.k)}))
      .filter(x=>filter<0||LIFE[filter].has(x.o))
      .filter(x=>!onlyOk||!x.err)
      .filter(x=>!q||(E.hvText(x.o)+"\n"+x.o.en).toLowerCase().includes(q));
  }
  function draw(){
    const list=rows();
    $(".khv-list").innerHTML=list.length?list.map(x=>{
      const st=x.o.na?"na":x.o.why?"why":x.err?"off":"";
      return `<button type="button" role="option" class="khv-row${st?" off "+st:""}${sel===x.o.k?" sel":""}" data-k="${esc(x.o.k)}"
        aria-selected="${sel===x.o.k}" title="${esc(x.err||"點一下選擇，再按「賦予」")}">
        <span class="khv-t">${text(x.o)}</span>${x.err?`<em class="why">${esc(x.err)}</em>`:""}
        <span class="khv-cs">${costs(x.o)}</span></button>`;
    }).join(""):`<div class="khv-none">沒有符合的選項。</div>`;
    veil.querySelectorAll(".khv-tab").forEach(b=>b.setAttribute("aria-selected",+b.dataset.f===filter));
    const b=E.bases[item.b];
    $(".khv-itm").innerHTML=b.ic?`<img src="${IMG+esc(b.ic)}" alt="${esc(E.baseName(item.b,lang))}" title="${esc(E.baseName(item.b,lang))}">`:"";
    const u=used();
    veil.querySelectorAll(".khv-cnt").forEach(c=>c.querySelector("span").textContent=fmt(u[c.dataset.k]||0));
    const err=sel?E.check(item,sel):"先在左邊點一個選項。";
    const go=$(".khv-go");
    go.setAttribute("aria-disabled",!!err);
    go.title=err||"套用："+E.hvText(E.hvByKey[sel]);
    const m=$(".khv-msg"); m.className="khv-msg"+(msg&&msg.bad?" bad":""); m.textContent=msg?msg.t:"";
  }
  $(".khv-q").oninput=e=>{ q=e.target.value.trim().toLowerCase(); draw(); };
  $(".khv-ok").onchange=e=>{ onlyOk=e.target.checked; draw(); };
  $(".khv-tabs").onclick=e=>{ const b=e.target.closest(".khv-tab"); if(!b) return; const f=+b.dataset.f; filter=filter===f?-1:f; draw(); };
  $(".khv-list").onclick=e=>{
    const b=e.target.closest(".khv-row"); if(!b) return;
    sel=b.dataset.k;
    const err=E.check(item,sel);
    msg=err?{bad:true,t:err}:{t:"已選擇："+E.hvText(E.hvByKey[sel])+"。按「賦予」套用。"};
    draw();
  };
  $(".khv-list").ondblclick=e=>{ const b=e.target.closest(".khv-row"); if(b&&!E.check(item,b.dataset.k)) onCraft(b.dataset.k); };
  $(".khv-go").onclick=()=>{
    if(!sel){ msg={bad:true,t:"先在左邊點一個選項。"}; draw(); return; }
    const err=E.check(item,sel);
    if(err){ msg={bad:true,t:err}; draw(); return; }
    onCraft(sel);
  };
  const close=()=>{ veil.remove(); document.removeEventListener("keydown",onKey,true); };
  const onKey=e=>{ if(e.key==="Escape"){ e.stopPropagation(); close(); } };
  document.addEventListener("keydown",onKey,true);
  veil.addEventListener("mousedown",e=>{ if(e.target===veil) close(); });
  $(".khv-x").onclick=close;
  draw();
  return {close,update(it,m){ item=it; msg=m||null; draw(); },get open(){ return veil.isConnected; }};
}

window.CraftHarvest=Object.freeze({open});
})();
