/* 工藝台清單（製裝台、模擬器共用）。規則都在 craft-engine.js（benchFor／applyBench），這裡只負責顯示和點選。
   美術圖是遊戲檔案抽出來的官方元件（img/craft/ui/，tools/extract_ui_art.py）：上方金色翅膀物品格、物品類別分頁、
   「前綴」「後綴」分區標題、每一列的底、階級盾牌。清單面板的底在遊戲裡是拼出來的，這裡用 CSS 模擬。

   const h = CraftBenchList.open({ E, item, lang, host, onCraft, embed, onClose });
     host：要把視窗放進去的元素（要在 #tab-craft 裡面，樣式才套得到）
     onCraft(k)：按了「賦予」（或雙擊某一項；k ＝ 工藝台選項的鍵值）；呼叫的地方套用後用 h.update(新物品, 訊息) 更新畫面
     embed：true＝直接嵌在 host 裡（製裝台右側面板），沒有遮罩、按 Esc 或點外面不會關；item 可以是 null（裝備格空著）。
       物品格加上 data-kslot，點它由呼叫的地方處理（放進／拿出裝備）。
     onClose()：按了右上角 ×（embed 時由呼叫的地方決定怎麼關）
   h.close() 關閉；不是 embed 時按 Esc 或點視窗外面也會關。 */
(function(){
"use strict";
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const IMG="img/craft/items/", UI="img/craft/ui/";

function open(opt){
  const {E,host,onCraft}=opt, embed=!!opt.embed;
  const D=E.data, BUI=D.benchUI||{tabs:[]};
  let item=opt.item||null, lang=opt.lang||"zh", q="", showOff=false, msg=null, sel=null;
  const itemCls=()=>item?E.bases[item.b].c:null;
  const tabOf=cls=>BUI.tabs.find(t=>t.classes.includes(cls));
  let tab=(item&&tabOf(itemCls())||{code:"All"}).code;

  const wrap=document.createElement("div");
  wrap.className=embed?"kbl kbl-embed":"kbl-veil";
  const tabs=[{code:"All",zh:"全部"}].concat(BUI.tabs);
  const inner=`
    <div class="kbl-head"><b>工藝台</b><span class="kbl-sub"></span><button type="button" class="kbl-x" aria-label="關閉" title="關閉${embed?"（裝備會移回背包）":""}">×</button></div>
    <div class="kbl-item"><img class="kbl-wings" src="${UI}bench_item.webp" alt="" draggable="false"><div class="kbl-slot"${embed?' data-kslot="1" title="裝備格：左鍵放進／拿起裝備，Ctrl＋左鍵移回背包"':""}></div></div>
    <div class="kbl-tabs" role="tablist" aria-label="物品類別">${tabs.map(t=>`<button type="button" role="tab" class="kbl-tab" data-tab="${esc(t.code)}" title="${esc(t.zh)}">
      <img src="${UI}filterbtn_${esc(t.code)}.webp" alt="${esc(t.zh)}"><img class="on" src="${UI}filterbtn_${esc(t.code)}_on.webp" alt=""></button>`).join("")}</div>
    <div class="kbl-bar"><input type="text" class="kbl-q" placeholder="搜尋詞綴文字…" autocomplete="off" aria-label="搜尋工藝台詞綴">
      <label class="kbl-chk"><input type="checkbox" class="kbl-off">也顯示不能做的（灰色）</label></div>
    <div class="kbl-msg" role="status" aria-live="polite"></div>
    <div class="kbl-list" role="listbox" aria-label="工藝台選項"></div>
    <div class="kbl-go"><button type="button" class="kbl-apply">賦予</button></div>
    <div class="kbl-foot">點一項選擇，再按「賦予」（或雙擊）。lvl＝做完後裝備的角色需求等級（詞綴等級的 80%），工藝台不看物品等級。
      假設所有配方都已解鎖；每件裝備預設只能有 1 條工藝詞綴，已有 1 條時再做會取代它（多花 1 顆重鑄石）。資料：遊戲 ${esc(BUI.patch||D.version)}、RePoE。</div>`;
  wrap.innerHTML=embed?inner:`<div class="kbl" role="dialog" aria-modal="true" aria-label="工藝台">${inner}</div>`;
  host.appendChild(wrap);
  const $=s=>wrap.querySelector(s);

  function cost(c){
    return Object.entries(c).map(([k,n])=>{
      const i=E.curInfo(k)||{zh:k,ic:""};
      return `<span class="kbl-cost" title="${esc(i.zh)} ×${n}">${n}${i.ic?`<img src="${IMG+esc(i.ic)}" alt="${esc(i.zh)}">`:esc(i.zh)}</span>`;
    }).join("");
  }
  function label(x){
    const o=x.o;
    if(o.a==="remove") return "移除所有工藝詞綴（含元工藝）";
    if(o.a==="reroll") return o.n===1?"重抽稀有裝的 1 條詞綴（3.29 新增）":"重抽稀有裝的 "+o.n+" 條詞綴（3.29 新增）";
    return E.modRange(o.m,lang).join(" / ");
  }
  function hay(x){ return (label(x)+"\n"+(x.o.m!==undefined?E.modRange(x.o.m,"en").join(" ")+"\n"+E.modName(x.o.m,"zh")+"\n"+E.modName(x.o.m,"en"):"")).toLowerCase(); }
  /* 這一頁要列的選項：物品類別相符的用 benchFor 判斷能不能做；其他類別的列出來但標成不能做 */
  function entries(){
    const cls=itemCls(), mine=E.benchFor(item), t=tab==="All"?null:BUI.tabs.find(x=>x.code===tab);
    const inTab=o=>!t||t.classes.some(c=>o.cs.has(c));
    const out=mine.filter(x=>inTab(x.o)), seen=new Set(out.map(x=>x.o.k));
    const clsZh=(D.classes[cls]||{}).zh||cls;
    for(const o of E.bench){
      if(seen.has(o.k)||!inTab(o)) continue;
      seen.add(o.k);
      out.push({o,err:"目前的物品是「"+clsZh+"」，這一項不能用在這類物品上。",replace:false,cost:Object.assign({},o.c),other:true});
    }
    return out;
  }
  function row(x){
    const m=x.o.m!==undefined?E.mods[x.o.m]:null;
    const tier=Math.max(0,Math.min(5,x.o.t||0));
    const lv=m?E.craftLevel(m.i):0;
    return `<button type="button" role="option" class="kbl-row${x.err?" off":""}${m&&m.meta?" meta":""}${sel===x.o.k?" sel":""}" data-k="${esc(x.o.k)}"
      aria-selected="${sel===x.o.k}" ${x.err?'aria-disabled="true"':""}>
      <img class="kbl-tier" src="${UI}tier${tier}.webp" alt="${tier?"第 "+tier+" 階":""}">
      <span class="kbl-t">${esc(label(x))}${x.replace?`<em>會取代原本的工藝詞綴（多 1 顆重鑄石）</em>`:""}${x.err?`<em class="why">${esc(x.err)}</em>`:""}</span>
      <span class="kbl-lv">${lv>0?"lvl "+lv:""}</span>
      <span class="kbl-c">${cost(x.cost)}</span></button>`;
  }
  function selErr(){
    if(!item) return "裝備格是空的：先把背包裡的裝備放進來。";
    if(!sel) return "先在清單點一項。";
    return E.benchCheck(item,E.benchByKey[sel]).err;
  }
  function draw(){
    const b=item&&E.bases[item.b];
    $(".kbl-slot").innerHTML=b&&b.ic?`<img src="${IMG+esc(b.ic)}" alt="${esc(E.baseName(item.b,lang))}" draggable="false">`:
      embed?`<span class="kbl-empty">放入裝備</span>`:"";
    wrap.querySelectorAll(".kbl-tab").forEach(b=>b.setAttribute("aria-selected",b.dataset.tab===tab));
    const m=$(".kbl-msg"); m.className="kbl-msg"+(msg&&msg.bad?" bad":""); m.textContent=msg?msg.t:"";
    const go=$(".kbl-apply"), err=selErr();
    go.setAttribute("aria-disabled",!!err); go.title=err||"套用選擇的工藝台選項";
    if(!item){
      $(".kbl-list").innerHTML=`<div class="kbl-none">裝備格是空的。<br>左鍵拿起背包裡的裝備、點上面的裝備格放進來；或 Ctrl＋左鍵點背包裡的裝備。</div>`;
      $(".kbl-sub").textContent="";
      return;
    }
    const all=entries().filter(x=>!q||hay(x).includes(q));
    const list=all.filter(x=>showOff||!x.err);
    const sec=(t,l)=>l.length?`<div class="kbl-sec"><span>${t}</span></div>`+l.map(row).join(""):"";
    const add=list.filter(x=>x.o.a==="add");
    const order=(a,b)=>{ const ma=E.mods[a.o.m], mb=E.mods[b.o.m];
      return (ma.meta?0:1)-(mb.meta?0:1)||(ma.ty<mb.ty?-1:ma.ty>mb.ty?1:0)||(a.o.t||0)-(b.o.t||0); };
    const hidden=all.length-list.length;
    $(".kbl-list").innerHTML=
      sec("前綴",add.filter(x=>E.mods[x.o.m].pre).sort(order))+
      sec("後綴",add.filter(x=>!E.mods[x.o.m].pre).sort(order))+
      sec("其他",list.filter(x=>x.o.a!=="add"))||
      `<div class="kbl-none">${hidden?`這一頁沒有能做的工藝詞綴（另有 ${hidden} 項不能做，勾「也顯示不能做的」可以看原因）。`:"沒有符合的工藝台選項。"}</div>`;
    $(".kbl-sub").textContent=`工藝詞綴 ${E.craftedCount(item)}／${E.maxCrafted(item)} 條`+(hidden&&!showOff?`・另有 ${hidden} 項不能做`:"");
  }
  function apply(){
    const err=selErr();
    if(err){ msg={bad:true,t:err}; draw(); return; }
    onCraft(sel);
  }
  $(".kbl-q").oninput=e=>{ q=e.target.value.trim().toLowerCase(); draw(); };
  $(".kbl-off").onchange=e=>{ showOff=e.target.checked; draw(); };
  $(".kbl-tabs").onclick=e=>{ const b=e.target.closest(".kbl-tab"); if(!b) return; tab=b.dataset.tab; msg=null; draw(); };
  $(".kbl-list").onclick=e=>{
    const b=e.target.closest(".kbl-row"); if(!b) return;
    sel=b.dataset.k;
    const err=b.getAttribute("aria-disabled")==="true";
    msg=err?{bad:true,t:b.querySelector(".why")?b.querySelector(".why").textContent:"不能做"}:{t:"已選擇。按「賦予」套用。"};
    draw();
  };
  $(".kbl-list").ondblclick=e=>{ const b=e.target.closest(".kbl-row"); if(b){ sel=b.dataset.k; apply(); } };
  $(".kbl-apply").onclick=apply;
  let onKey=null;
  const close=()=>{ wrap.remove(); if(onKey) document.removeEventListener("keydown",onKey,true); };
  if(embed){
    $(".kbl-x").onclick=()=>{ if(opt.onClose) opt.onClose(); else close(); };
  }else{
    onKey=e=>{ if(e.key==="Escape"){ e.stopPropagation(); close(); } };
    document.addEventListener("keydown",onKey,true);
    wrap.addEventListener("mousedown",e=>{ if(e.target===wrap) close(); });
    $(".kbl-x").onclick=close;
  }
  draw();
  if(!embed) $(".kbl-q").focus();
  return {close,update(it,m){
    const was=itemCls();
    item=it||null; msg=m||null;
    if(item&&itemCls()!==was){ tab=(tabOf(itemCls())||{code:"All"}).code; sel=null; }
    if(!item) sel=null;
    draw();
  },get open(){ return wrap.isConnected; },el:wrap};
}

window.CraftBenchList=Object.freeze({open});
})();
