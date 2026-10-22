/* 工藝台清單（製裝台、模擬器共用）。規則都在 craft-engine.js（benchFor／applyBench），這裡只負責顯示和點選。

   const h = CraftBenchList.open({ E, item, lang, host, onCraft });
     host：要把視窗放進去的元素（要在 #tab-craft 裡面，樣式才套得到）
     onCraft(k)：點了某一項（k ＝ 工藝台選項的鍵值）；呼叫的地方套用後用 h.update(新物品, 訊息) 更新畫面
   h.close() 關閉；按 Esc 或點視窗外面也會關。 */
(function(){
"use strict";
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const IMG="img/craft/items/";

function open(opt){
  const {E,host,onCraft}=opt;
  let item=opt.item, lang=opt.lang||"zh", q="", onlyOk=true, msg=null;
  const veil=document.createElement("div");
  veil.className="kbl-veil";
  veil.innerHTML=`<div class="kbl" role="dialog" aria-modal="true" aria-label="工藝台">
    <div class="kbl-head"><b>工藝台</b><span class="kbl-sub"></span><button type="button" class="kbl-x" aria-label="關閉">×</button></div>
    <div class="kbl-bar"><input type="text" class="kbl-q" placeholder="搜尋詞綴文字…" autocomplete="off" aria-label="搜尋工藝台詞綴">
      <label class="kbl-chk"><input type="checkbox" class="kbl-ok" checked>只顯示能做的</label></div>
    <div class="kbl-msg" role="status" aria-live="polite"></div>
    <div class="kbl-list"></div>
    <div class="kbl-foot">假設所有配方都已解鎖。每件裝備預設只能有 1 條工藝詞綴（「可以有 3 條工藝詞綴」這條本身也算）；
      已有 1 條時再做會取代它，多花 1 顆重鑄石。費用照 RePoE 3.29 資料。</div></div>`;
  host.appendChild(veil);
  const $=s=>veil.querySelector(s);

  function cost(c){
    return Object.entries(c).map(([k,n])=>{
      const i=E.curInfo(k)||{zh:k,ic:""};
      return `<span class="kbl-cost" title="${esc(i.zh)}">${i.ic?`<img src="${IMG+esc(i.ic)}" alt="">`:""}${esc(i.zh)} ×${n}</span>`;
    }).join("");
  }
  function label(x){
    const o=x.o;
    if(o.a==="remove") return "移除所有工藝詞綴（含元工藝）";
    if(o.a==="reroll") return o.n===1?"重抽稀有裝的 1 條詞綴（3.29 新增）":"重抽稀有裝的 "+o.n+" 條詞綴（3.29 新增）";
    return E.modRange(o.m,lang).join(" / ");
  }
  function hay(x){ return (label(x)+"\n"+(x.o.m!==undefined?E.modRange(x.o.m,"en").join(" ")+"\n"+E.modName(x.o.m,"zh")+"\n"+E.modName(x.o.m,"en"):"")).toLowerCase(); }
  function row(x){
    const m=x.o.m!==undefined?E.mods[x.o.m]:null;
    const tag=m?`<span class="ktag ${m.pre?"p":"s"}">${m.pre?"前綴":"後綴"}</span>`:"";
    return `<button type="button" class="kbl-row${x.err?" off":""}${m&&m.meta?" meta":""}" data-k="${esc(x.o.k)}" ${x.err?'aria-disabled="true"':""}>
      ${tag}<span class="kbl-t">${esc(label(x))}${x.replace?`<em>會取代原本的工藝詞綴（多 1 顆重鑄石）</em>`:""}${x.err?`<em class="why">${esc(x.err)}</em>`:""}</span>
      <span class="kbl-c">${cost(x.cost)}</span></button>`;
  }
  function draw(){
    const list=E.benchFor(item).filter(x=>(!onlyOk||!x.err||x.o.a==="reroll")&&(!q||hay(x).includes(q)));
    const sec=(t,l)=>l.length?`<div class="kbl-sec">${t}</div>`+l.map(row).join(""):"";
    const isMeta=x=>x.o.a==="add"&&E.mods[x.o.m].meta;
    const add=list.filter(x=>x.o.a==="add"&&!isMeta(x));
    const byTier=(a,b)=>(E.mods[a.o.m].ty<E.mods[b.o.m].ty?-1:E.mods[a.o.m].ty>E.mods[b.o.m].ty?1:(b.o.t||0)-(a.o.t||0));
    $(".kbl-list").innerHTML=
      sec("元工藝",list.filter(isMeta))+
      sec("前綴",add.filter(x=>E.mods[x.o.m].pre).sort(byTier))+
      sec("後綴",add.filter(x=>!E.mods[x.o.m].pre).sort(byTier))+
      sec("其他",list.filter(x=>x.o.a!=="add"))||`<div class="kbl-none">沒有符合的工藝台選項。</div>`;
    $(".kbl-sub").textContent=`工藝詞綴 ${E.craftedCount(item)}／${E.maxCrafted(item)} 條`;
    const m=$(".kbl-msg"); m.className="kbl-msg"+(msg&&msg.bad?" bad":""); m.textContent=msg?msg.t:"";
  }
  $(".kbl-q").oninput=e=>{ q=e.target.value.trim().toLowerCase(); draw(); };
  $(".kbl-ok").onchange=e=>{ onlyOk=e.target.checked; draw(); };
  $(".kbl-list").onclick=e=>{
    const b=e.target.closest(".kbl-row"); if(!b) return;
    if(b.getAttribute("aria-disabled")==="true"){ msg={bad:true,t:b.querySelector(".why")?b.querySelector(".why").textContent:"不能做"}; draw(); return; }
    onCraft(b.dataset.k);
  };
  const close=()=>{ veil.remove(); document.removeEventListener("keydown",onKey,true); };
  const onKey=e=>{ if(e.key==="Escape"){ e.stopPropagation(); close(); } };
  document.addEventListener("keydown",onKey,true);
  veil.addEventListener("mousedown",e=>{ if(e.target===veil) close(); });
  $(".kbl-x").onclick=close;
  draw();
  $(".kbl-q").focus();
  return {close,update(it,m){ item=it; msg=m||null; draw(); },get open(){ return veil.isConnected; }};
}

window.CraftBenchList=Object.freeze({open});
})();
