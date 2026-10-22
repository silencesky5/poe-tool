/* 製裝方法 → 模擬器 的畫面。規則都在 craft-engine.js，這裡只管顯示和操作。
   index.html 在第一次打開「製裝方法」分頁時才載入 craft-data.js、craft-engine.js 和這支。 */
(function(){
"use strict";
const CE=window.CraftEngine, D=window.CRAFT_DATA;
const E=CE.create(D);
const root=document.getElementById("ksim");
if(!root) return;

const OLD_PRICE_KEY="poe-craft-prices"; // 舊版存價格的地方，只在第一次載入時搬進 CraftStorage
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const $=id=>document.getElementById(id);
const GROUP_ZH={weapon:"武器",armour:"護甲",jewellery:"飾品"};
const pct=x=>x>=10?x.toFixed(1)+"%":x>=1?x.toFixed(2)+"%":x.toFixed(3)+"%";
const num=x=>Number.isInteger(x)?x.toLocaleString():x.toLocaleString(undefined,{maximumFractionDigits:1});

/* 詞綴語言（index.html 的 window.CraftLang；中文沒有翻譯的會自動顯示英文） */
const L=()=>window.CraftLang?window.CraftLang.get():"zh";
/* 同名底材（例如三種雙玉戒指）用固有詞綴區分 */
const nameCount={};
E.bases.forEach(b=>nameCount[b.n]=(nameCount[b.n]||0)+1);
const baseLabel=(b,lang)=>{
  lang=lang||L();
  const n=E.baseName(b.i,lang);
  return nameCount[b.n]>1&&b.imp.length?n+"（"+E.implicitLines(b.i,lang).join("、")+"）":n;
};
/* 搜尋用：中文、英文都放進去 */
const baseHay=b=>(baseLabel(b,"zh")+"\n"+baseLabel(b,"en")).toLowerCase();
const modHay=new Map();
const modSearch=mi=>{
  let s=modHay.get(mi);
  if(s===undefined){ const m=E.mods[mi]; s=(E.modRange(mi,"zh").join("\n")+"\n"+m.tx+"\n"+m.n+"\n"+E.modName(mi,"zh")).toLowerCase(); modHay.set(mi,s); }
  return s;
};
const modText=mi=>E.modRange(mi,L());   // 範圍文字（目前語言）

const S={
  cls:"Helmet", b:-1, lv:86, item:null, hist:[], msg:null,
  poolQuery:"", poolMerge:false,
  targets:[], mode:"all", need:1, method:"altaug", n:10000, limit:10000,
  ess:"", essence:"",   // 手動用的精髓、「精髓重鑄」用的精髓（"ess:" ＋ Metadata 路徑）
  fossils:[],           // 放進鑄新儀的化石（Metadata 路徑），手動和「化石重鑄」共用
  harvest:"ReforgeLife", // 「豐收重鑄」用的園藝工藝台選項 Id（只能選「重鑄並包含 1 個 X 詞綴」）
  running:false, progress:0, results:null,
  prices:{},
};

/* ── 存檔：一律透過 CraftStorage（craft-storage.js）。存檔是一整個物件，和製裝台共用；
   這裡只改 prices 欄位（之後倉庫放 stash），其他欄位原樣保留。 ── */
const St=window.CraftStorage||null;
let saved={};            // 記憶體裡目前的整份存檔
let pricesTouched=false; // 讀檔完成前使用者就改了價格的話，以使用者的為準
async function loadPrices(){
  if(!St) return;
  try{ saved=(await St.load())||{}; }catch(e){ saved={}; }
  if(!saved.prices){
    /* 舊版直接存在 localStorage 的價格：搬進存檔一次，之後不再讀 */
    let old=null;
    try{ old=JSON.parse(localStorage.getItem(OLD_PRICE_KEY)); localStorage.removeItem(OLD_PRICE_KEY); }catch(e){}
    if(old&&typeof old==="object"&&Object.keys(old).length){
      saved={...saved,prices:old};
      St.save(saved);
    }
  }
  if(!pricesTouched){ S.prices={...(saved.prices||{})}; drawPrices(); drawResults(); }
  else savePrices();
}
/* 輸入時連續觸發，等 400 ms 沒有新輸入再存；存之前重新讀一次，免得蓋掉製裝台剛存的欄位 */
let priceTimer=null;
function savePrices(){
  if(!St) return;
  clearTimeout(priceTimer);
  priceTimer=setTimeout(async()=>{
    priceTimer=null;
    try{ saved=(await St.load())||saved; }catch(e){}
    saved={...saved,prices:{...S.prices}};
    St.save(saved);
  },400);
}
/* 離開頁面前（CraftStorage 要補同步）：還沒存的價格，用目前最新的整份存檔合併後馬上存 */
window.addEventListener("craftstorage:beforeflush",e=>{
  if(!priceTimer||!St) return;
  clearTimeout(priceTimer); priceTimer=null;
  saved={...((e.detail&&e.detail.current)||saved),prices:{...S.prices}};
  St.save(saved);
});
/* 使用者在衝突視窗選了「用雲端的」：整份換掉 */
window.addEventListener("craftstorage:data",e=>{
  saved=e.detail||{};
  clearTimeout(priceTimer); pricesTouched=false;
  S.prices={...(saved.prices||{})};
  drawPrices(); drawResults();
});

/* ── 骨架 ── */
const classOpts=Object.entries(GROUP_ZH).map(([g,zh])=>
  `<optgroup label="${zh}">`+Object.entries(D.classes).filter(([,c])=>c.group===g)
    .map(([k,c])=>`<option value="${esc(k)}">${esc(c.zh)}（${esc(k)}）</option>`).join("")+`</optgroup>`).join("");

root.innerHTML=`
<div class="kgrid">
  <aside class="kpanel kleft">
    <label class="klab" for="kcls">物品類別</label>
    <select id="kcls">${classOpts}</select>
    <label class="klab" for="kbq">底材（Base Type）</label>
    <input id="kbq" type="text" placeholder="搜尋底材…" autocomplete="off">
    <div class="kbases" id="kbases" role="listbox" aria-label="底材"></div>
    <label class="klab" for="klvn">物品等級（Item Level）</label>
    <div class="klv"><input id="klvr" type="range" min="1" max="86" aria-label="物品等級滑桿"><input id="klvn" type="number" min="1" max="86"></div>
    <div class="khint">換底材或物品等級會重置物品。</div>
  </aside>
  <main class="kmid"><div id="kitem"></div></main>
  <aside class="kpanel kright">
    <div class="klab">通貨（Currency）</div>
    <div class="kcurs" id="kcurs"></div>
    <div class="kessrow"><select id="kess" aria-label="選精髓"></select><button class="kcur" id="kessgo">用精髓</button></div>
    <button class="kcur kbenchbtn" id="kresogo">用鑄新儀（下面選的化石）</button>
    <button class="kcur kbenchbtn" id="kbenchgo" data-tip="工藝台：加工藝詞綴、元工藝（前綴／後綴不能被改變等）、移除工藝詞綴">工藝台…</button>
    <button class="kcur kbenchbtn" id="kharvestgo" data-tip="園藝工藝台（豐收）：重鑄並包含 1 個 X 詞綴、增加 1 個 X 詞綴並移除其它隨機詞綴">園藝工藝台…</button>
    <div class="kmsg" id="kmsg" role="status" aria-live="polite"></div>
    <div class="khead"><span class="klab">操作紀錄</span>
      <span class="kbtns"><button class="kmini" id="kundo">上一步</button><button class="kmini" id="kreset">重置</button></span></div>
    <ol class="khist" id="khist"></ol>
  </aside>
</div>

<details class="kpanel kpool" id="kpool" open>
  <summary><span class="ksec">詞綴池（Mod Pool）</span><span class="ksub" id="kpoolsub"></span></summary>
  <div class="kpoolbar">
    <input id="kpq" type="text" placeholder="搜尋詞綴文字…" autocomplete="off">
    <label class="kchk"><input type="checkbox" id="kmerge">合併同類詞綴（同 mod type 的各 tier 加總）</label>
  </div>
  <div class="khint">機率＝這條的權重（Spawn Weight）÷ 同一邊（前綴或後綴）的權重總和，以空白物品計。
    已經有同組（Mod Group）詞綴、或那一邊滿了，實際抽的時候會排除。有些詞綴會附加 tag（例如 has_attack_mod），會讓之後其他詞綴的權重改變。
    勾選左邊的方框，就會加到下面批次模擬的目標。</div>
  <div class="kpoolcols">
    <div><div class="kcolh">前綴（Prefix）<span id="kpcount"></span></div><div class="ktable" id="kprefix"></div></div>
    <div><div class="kcolh">後綴（Suffix）<span id="kscount"></span></div><div class="ktable" id="ksuffix"></div></div>
  </div>
</details>

<section class="kpanel kbatch">
  <div class="ksec">批次模擬</div>
  <div class="kbgrid">
    <div>
      <div class="klab">目標詞綴</div>
      <div id="ktargets"></div>
      <div class="kcond">
        <label class="kchk"><input type="radio" name="kmode" value="all">全部都要</label>
        <label class="kchk"><input type="radio" name="kmode" value="atleast">至少 <input type="number" id="kneed" min="1" max="6" value="1"> 條</label>
      </div>
      <div class="klab">作法</div>
      <div class="kmethods" id="kmethods"></div>
      <div id="kmethess" hidden><label class="klab" for="kmess">精髓重鑄用哪一顆</label><select id="kmess"></select></div>
      <div id="kmethhv" hidden><label class="klab" for="kmhv">豐收重鑄用哪一個選項（生命力照遊戲資料的數量）</label><select id="kmhv"></select></div>
      <div id="kmethfos"><div class="klab">鑄新儀裡的化石（最多 <span id="kfosmax"></span> 顆；灰色＝機制待確認，先不開放）</div>
        <div class="kfos" id="kfos"></div>
        <div class="kfmode">多顆化石的「增加」效果：<label class="kchk"><input type="radio" name="kfm" value="add">相加</label>
          <label class="kchk"><input type="radio" name="kfm" value="mul">相乘</label><small>社群推定值，遊戲沒有公布</small></div></div>
      <div class="khint">詞綴條數的機率：魔法裝 1 條／2 條各 50%、稀有裝 4／5／6 條為 8 : 3 : 1。這是社群推定值（Kalandralang 採用），<b>不是官方公布的數字</b>；所有模擬結果都以這個機率為準。</div>
      <div class="krun">
        <label class="klab" for="knn">模擬次數</label>
        <div class="klv"><input id="knr" type="range" min="1000" max="10000" step="1000" aria-label="模擬次數滑桿"><input id="knn" type="number" min="1000" max="10000" step="1000"></div>
        <label class="klab" for="klimit">每件最多重抽幾次（超過算失敗）</label>
        <input id="klimit" type="number" min="10" max="1000000" step="100">
        <button class="kgo" id="kgo">開始模擬</button>
        <div class="kprog" id="kprog" hidden><i></i><span></span></div>
      </div>
    </div>
    <div>
      <div class="klab">結果</div>
      <div id="kres"><div class="khint">設定目標後按「開始模擬」。</div></div>
      <div class="klab kpricelab">通貨單價（以混沌石計）</div>
      <div class="kprices" id="kprices"></div>
      <div class="khint">和製裝存檔一起保存（登入 Discord 後會同步到雲端）。填了才會換算總成本，沒填的通貨以 0 計。</div>
    </div>
  </div>
</section>
<footer class="kfoot">資料：<a href="https://github.com/lvlvllvlvllvlvl/RePoE" target="_blank" rel="noopener">RePoE</a>（PoE1，遊戲版本 ${esc(D.version)}，MIT；遊戲資料版權屬 Grinding Gear Games）。
  通貨規則參考 <a href="https://github.com/doomeer/kalandralang" target="_blank" rel="noopener">Kalandralang</a>（MIT）的實作。
  詞綴條數機率（魔法 1／2 條 50 : 50、稀有 4／5／6 條 8 : 3 : 1）為社群推定值，非官方數字。
  園藝工藝台的選項和生命力數量來自遊戲資料 HarvestCraftOptions（pathofexile-dat）。
  不含勢力、分裂、附魔；豐收只做「重鑄並包含 X」和「增加 X 並移除」，其他選項待確認或不適用。</footer>`;

/* ── 左側：類別、底材、物品等級 ── */
const clsSel=$("kcls"), bq=$("kbq"), bl=$("kbases"), lvr=$("klvr"), lvn=$("klvn");
function basesOfClass(){ return E.bases.filter(b=>b.c===S.cls); }
function drawBases(){
  const q=bq.value.trim().toLowerCase();
  const list=basesOfClass().filter(b=>!q||baseHay(b).includes(q));
  bl.innerHTML=list.map(b=>`<button class="kbase" role="option" data-b="${b.i}" aria-selected="${b.i===S.b}">
    <span>${esc(baseLabel(b))}</span><em>${b.lv}</em></button>`).join("")||`<div class="khint">找不到符合的底材。</div>`;
  /* 選中的底材捲到看得到的地方（只捲清單，不捲整頁） */
  const on=bl.querySelector('[aria-selected="true"]');
  if(on) bl.scrollTop=Math.max(0,on.offsetTop-bl.clientHeight/2);
}
bl.addEventListener("click",e=>{
  const x=e.target.closest(".kbase"); if(!x) return;
  setBase(+x.dataset.b);
});
clsSel.onchange=()=>{
  S.cls=clsSel.value; bq.value="";
  const list=basesOfClass();
  setBase(list[list.length-1].i);
};
bq.oninput=drawBases;
function setLv(v){
  v=Math.max(1,Math.min(86,Math.round(+v||1)));
  if(v===S.lv) { lvr.value=lvn.value=v; return; }
  S.lv=v; lvr.value=lvn.value=v;
  reset(); drawPool();
}
lvr.oninput=()=>setLv(lvr.value);
lvn.onchange=()=>setLv(lvn.value);
function setBase(b){
  S.b=b; S.cls=E.bases[b].c; clsSel.value=S.cls;
  reset(); drawBases(); drawPool();
}

/* ── 中間：物品卡 ── */
function itemName(it){
  const b=E.bases[it.b];
  if(L()==="zh") return [E.baseName(it.b,"zh")];   // 中文：只顯示底材名稱
  if(it.r===E.MAGIC){
    const p=it.mods.find(x=>E.mods[x.m].pre), s=it.mods.find(x=>!E.mods[x.m].pre);
    return [(p?E.mods[p.m].n+" ":"")+b.n+(s?" "+E.mods[s.m].n:"")];
  }
  if(it.r===E.RARE) return ["稀有物品",b.n];
  return [b.n];
}
function drawItem(){
  const it=S.item, b=E.bases[it.b], c=E.counts(it), max=E.maxSide(it);
  const mods=it.mods.slice().sort((x,y)=>(E.mods[y.m].pre-E.mods[x.m].pre));
  const rows=mods.map(x=>{
    const m=E.mods[x.m], t=E.tierOf(it.b,x.m);
    const src=E.sourceNote(it.b,x.m);
    const tip=`${E.modName(x.m,L())}（${m.pre?"前綴":"後綴"}，${src||`T${t}／共 ${E.tierCount(it.b,x.m)} 階`}）\n範圍：${modText(x.m).join(" / ")}${L()==="zh"?"\n英文："+E.render(x.m,x.v,"en").join(" / "):""}\n需求等級 ${m.lv}・群組 ${m.gr.join(", ")}`;
    return `<div class="kmod${m.d?" d"+m.d:""}${m.meta?" meta":""}" title="${esc(tip)}"><span class="ktag ${m.pre?"p":"s"}">${E.tagLabel(it.b,x.m)}</span>
      <span class="ktxt">${E.render(x.m,x.v,L()).map(esc).join("<br>")}</span></div>`;
  }).join("");
  const name=itemName(it);
  $("kitem").innerHTML=`<div class="kcard r${it.r}">
    <div class="kname">${name.map(esc).join("<br>")}</div>
    <div class="kbody">
      <div class="kmeta">${esc(D.classes[b.c].zh)}・${CE.RARITY_ZH[it.r]}・物品等級 ${it.lv}</div>
      ${b.imp.length?`<div class="kimp">${E.implicitLines(it.b,L()).map(esc).join("<br>")}</div><div class="ksep"></div>`:""}
      ${rows||`<div class="kempty">沒有詞綴</div>`}
      ${it.r?`<div class="kcnt">前綴 ${c.p}/${max}・後綴 ${c.s}/${max}</div>`:""}
    </div></div>`;
}

/* ── 右側：通貨、紀錄 ── */
function drawCurs(){
  $("kcurs").innerHTML=CE.CURRENCIES.map(c=>{
    const err=E.check(S.item,c.k);
    const tip=c.en+"\n"+c.desc+(err?"\n\n不能用："+err:"");
    return `<button class="kcur" data-k="${c.k}" aria-disabled="${!!err}" data-tip="${esc(tip)}" aria-label="${esc(c.zh+"（"+c.en+"）："+c.desc)}">${esc(c.zh)}</button>`;
  }).join("");
}
/* 精髓選單：只列這個物品類別用得到的，依階級分組 */
const ESS_GROUP={1:"低語",2:"呢喃",3:"啼泣",4:"哀嚎",5:"咆哮",6:"尖嘯",7:"破空",8:"腐化精髓",0:"荒蕪精髓"};
function essOptions(sel){
  const cls=E.bases[S.b].c, list=E.essences.filter(e=>e.m[cls]!==undefined);
  if(!list.length) return `<option value="">這類物品沒有精髓</option>`;
  return [1,2,3,4,5,6,7,8,0].map(lv=>{
    const g=list.filter(e=>e.lv===lv); if(!g.length) return "";
    return `<optgroup label="${esc(ESS_GROUP[lv])}">`+g.map(e=>`<option value="${esc(e.k)}" ${e.k===sel?"selected":""}>${esc(L()==="zh"?e.nz:e.n)}</option>`).join("")+`</optgroup>`;
  }).join("");
}
function fixEss(k){ const cls=E.bases[S.b].c, e=E.essByKey[k]; return e&&e.m[cls]!==undefined?k:((E.essences.find(x=>x.m[cls]!==undefined&&x.lv>=5)||{}).k||""); }
function drawEss(){
  S.ess=fixEss(S.ess); S.essence=fixEss(S.essence);
  $("kess").innerHTML=essOptions(S.ess); $("kmess").innerHTML=essOptions(S.essence);
  const err=S.ess?E.check(S.item,S.ess):"這類物品沒有精髓。";
  const info=S.ess&&E.curInfo(S.ess);
  $("kessgo").setAttribute("aria-disabled",!!err);
  $("kessgo").dataset.tip=(info?info.en+"\n"+info.desc:"")+(err?"\n\n不能用："+err:"");
  $("kmethess").hidden=S.method!=="essence";
  drawFos(); drawHv();
}
/* 豐收重鑄：只列「重鑄並包含 1 個 X 詞綴」；費用照遊戲資料 */
function hvCostText(o){ return Object.entries(o.c).map(([k,n])=>n.toLocaleString("en-US")+" "+(E.curInfo(k)||{zh:k}).zh).join("＋"); }
function drawHv(){
  const list=E.harvest.filter(o=>o.a==="reforge");
  if(!list.some(o=>o.id===S.harvest)) S.harvest=(list[0]||{}).id||"";
  $("kmhv").innerHTML=list.map(o=>`<option value="${esc(o.id)}" ${o.id===S.harvest?"selected":""}>包含 1 個${esc(E.hvTagZh(o))}詞綴（${esc(hvCostText(o))}）</option>`).join("");
  $("kmethhv").hidden=S.method!=="harvest";
}
$("kmhv").onchange=e=>{ S.harvest=e.target.value; drawPrices(); };
/* 化石：勾選放進鑄新儀（手動「用鑄新儀」和「化石重鑄」共用）；相加／相乘存在這台電腦 */
const FOSSIL_MODE_KEY="poe-craft-fossil-mode";
function fossilMode(){ try{ return localStorage.getItem(FOSSIL_MODE_KEY)==="mul"?"mul":"add"; }catch(e){ return "add"; } }
E.setFossilMode(fossilMode());
function drawFos(){
  $("kfosmax").textContent=E.MAX_FOSSILS;
  $("kfos").innerHTML=E.fossils.map(f=>{
    const on=S.fossils.includes(f.id);
    return `<label class="kfo${f.why?" off":""}${on?" on":""}" title="${esc(f.nz+"："+(f.desc||[]).join("、")+(f.why?"\n先不開放（待確認）："+f.why:""))}">
      <input type="checkbox" data-f="${esc(f.id)}" ${on?"checked":""} ${f.why?"disabled":""}><img src="img/craft/items/${esc(f.ic)}" alt=""><span>${esc(L()==="zh"?f.nz:f.n)}</span></label>`;
  }).join("");
  document.querySelectorAll('input[name="kfm"]').forEach(r=>r.checked=r.value===fossilMode());
  const k=E.resoKey(S.fossils), err=S.fossils.length?E.check(S.item,k):"還沒有選化石。";
  $("kresogo").setAttribute("aria-disabled",!!err);
  $("kresogo").dataset.tip=(S.fossils.length?E.curInfo(k).desc:"")+(err?"\n\n不能用："+err:"");
  $("kmethfos").hidden=S.method!=="fossil";
}
$("kfos").addEventListener("change",e=>{
  const x=e.target.closest("input[data-f]"); if(!x) return;
  const id=x.dataset.f, i=S.fossils.indexOf(id);
  if(x.checked&&i<0){
    if(S.fossils.length>=E.MAX_FOSSILS){ x.checked=false; S.msg={bad:true,t:"鑄新儀最多放 "+E.MAX_FOSSILS+" 顆化石（終極鑄新儀 "+E.MAX_FOSSILS+" 孔）"}; drawMsg(); return; }
    S.fossils.push(id);
  }else if(!x.checked&&i>=0) S.fossils.splice(i,1);
  drawFos(); drawPrices();
});
document.querySelectorAll('input[name="kfm"]').forEach(r=>r.onchange=()=>{
  try{ localStorage.setItem(FOSSIL_MODE_KEY,r.value); }catch(e){}
  E.setFossilMode(r.value);
});
$("kresogo").onclick=()=>{ if(S.fossils.length) useCurrency(E.resoKey(S.fossils)); };
$("kess").onchange=e=>{ S.ess=e.target.value; drawEss(); };
/* 工藝台：清單在 craft-benchlist.js；做完一項就記到操作紀錄，清單保持開著 */
let benchUI=null;
function benchName(k){
  const o=E.benchByKey[k];
  if(o.a==="remove") return "移除工藝詞綴";
  return E.modRange(o.m,L()).join(" / ");
}
function costText(c){ return Object.entries(c).map(([k,n])=>(E.curInfo(k)||{zh:k}).zh+" ×"+n).join("、"); }
$("kbenchgo").onclick=()=>{
  if(!window.CraftBenchList) return;
  benchUI=CraftBenchList.open({E,item:S.item,lang:L(),host:root,onCraft(k){
    const r=E.applyBench(S.item,k);
    if(!r.ok){ benchUI.update(S.item,{bad:true,t:r.err}); return; }
    const label="工藝台："+benchName(k);
    S.hist.push({label,before:S.item,after:r.item});
    S.item=r.item;
    S.msg={bad:false,t:label+"（費用 "+costText(r.cost)+"）"};
    drawAll();
    benchUI.update(S.item,{t:"已完成："+benchName(k)+"（費用 "+costText(r.cost)+"）"});
  }});
};
/* 園藝工藝台：清單在 craft-harvest.js；右邊的生命力計數＝這次操作紀錄裡用掉的（上一步會扣回） */
let hvUI=null;
function hvUsed(){ const u={}; for(const h of S.hist) for(const [k,n] of Object.entries(h.cost||{})) u[k]=(u[k]||0)+n; return u; }
$("kharvestgo").onclick=()=>{
  if(!window.CraftHarvest) return;
  hvUI=CraftHarvest.open({E,item:S.item,lang:L(),host:root,used:hvUsed,onCraft(k){
    const r=E.apply(S.item,k), name=E.hvText(E.hvByKey[k]);
    if(!r.ok){ hvUI.update(S.item,{bad:true,t:r.err}); return; }
    const cost=E.harvestCost(k), label="園藝："+name;
    S.hist.push({label,before:S.item,after:r.item,cost});
    S.item=r.item;
    S.msg={bad:false,t:label+"（"+costText(cost)+"）→ "+summary(r.item)};
    drawAll();
    hvUI.update(S.item,{t:"已賦予："+name+"（"+costText(cost)+"）→ "+summary(r.item)});
  }});
};
$("kmess").onchange=e=>{ S.essence=e.target.value; drawPrices(); };
$("kessgo").onclick=()=>useCurrency(S.ess);
$("kcurs").addEventListener("click",e=>{
  const x=e.target.closest(".kcur"); if(!x) return;
  useCurrency(x.dataset.k);
});
function useCurrency(k){
  const c=k&&E.curInfo(k); if(!c) return;
  const r=E.apply(S.item,c.k);
  if(!r.ok){ S.msg={bad:true,t:c.zh+"："+r.err}; drawMsg(); return; }
  S.hist.push({label:c.zh,before:S.item,after:r.item});
  S.item=r.item;
  S.msg={bad:false,t:c.zh+" → "+summary(r.item)};
  drawAll();
}
function summary(it){ return CE.RARITY_ZH[it.r]+"，"+it.mods.length+" 條詞綴"; }
function drawMsg(){
  const m=$("kmsg");
  m.className="kmsg"+(S.msg&&S.msg.bad?" bad":"");
  m.textContent=S.msg?S.msg.t:"";
}
function drawHist(){
  $("khist").innerHTML=S.hist.length
    ?S.hist.map((h,i)=>`<li><b>${i+1}.</b> ${esc(h.label)} → ${esc(summary(h.after))}</li>`).reverse().join("")
    :`<li class="khint">還沒有操作。</li>`;
  $("kundo").disabled=!S.hist.length;
}
$("kundo").onclick=()=>{
  const h=S.hist.pop(); if(!h) return;
  S.item=h.before; S.msg={bad:false,t:"退回："+h.label}; drawAll();
};
$("kreset").onclick=()=>{ reset(); S.msg={bad:false,t:"已重置成普通物品"}; drawAll(); };
function reset(){ S.item=E.make(S.b,S.lv); S.hist=[]; S.msg=null; drawAll(); }
function drawAll(){ drawItem(); drawCurs(); drawEss(); drawMsg(); drawHist(); }

/* ── 詞綴池 ── */
let PV=null;
function families(){
  /* ty|g → 這個底材、物品等級下這類詞綴的資訊 */
  const f=new Map();
  for(const r of PV.rows){
    const m=E.mods[r.m], k=m.ty+"|"+m.g;
    let x=f.get(k);
    if(!x){ x={ty:m.ty,g:m.g,pre:m.pre,w:0,pct:0,rows:[],best:r,tiers:r.tiers}; f.set(k,x); }
    x.w+=r.w; x.pct+=r.pct; x.rows.push(r);
    if(r.tier<x.best.tier) x.best=r;
  }
  return f;
}
function targetOf(m){ return S.targets.find(t=>t.ty===m.ty&&t.g===m.g); }
function drawPool(){
  PV=E.poolView(S.b,S.lv);
  const q=S.poolQuery.toLowerCase();
  const b=E.bases[S.b];
  $("kpoolsub").textContent=`${baseLabel(b)}・物品等級 ${S.lv}`;
  let rows;
  if(S.poolMerge){
    rows=[...families().values()].sort((a,b)=>b.pct-a.pct).map(f=>{
      const ts=f.rows.map(r=>r.tier).sort((a,b)=>a-b);
      return {m:f.best.m,w:f.w,pct:f.pct,pre:f.pre,tierText:ts.length>1?`T${ts[0]}–T${ts[ts.length-1]}`:`T${ts[0]}`,
        maxTier:ts[ts.length-1],n:f.rows.length};
    });
  }else{
    rows=PV.rows.map(r=>({m:r.m,w:r.w,pct:r.pct,pre:r.pre,tierText:"T"+r.tier,maxTier:r.tier}));
  }
  if(q) rows=rows.filter(r=>modSearch(r.m).includes(q));
  const maxPct={p:0,s:0};
  rows.forEach(r=>{ const k=r.pre?"p":"s"; if(r.pct>maxPct[k]) maxPct[k]=r.pct; });
  const table=list=>list.length?`<table><thead><tr><th class="c"><span class="sr">目標</span></th><th>Tier</th><th>詞綴</th><th class="n">等級</th><th class="n">權重</th><th class="n">機率</th></tr></thead><tbody>`+
    list.map(r=>{
      const m=E.mods[r.m], t=targetOf(m)&&(S.poolMerge||r.maxTier<=targetOf(m).maxTier);
      const bar=r.pct/(maxPct[r.pre?"p":"s"]||1)*100;
      return `<tr class="${t?"on":""}"><td class="c"><input type="checkbox" data-m="${r.m}" data-t="${r.maxTier}" ${t?"checked":""} aria-label="加到目標"></td>
        <td class="t">${r.tierText}</td>
        <td><div class="ptx">${modText(r.m).map(esc).join("<br>")}</div><div class="pn">${esc(E.modName(r.m,L()))}${r.n>1?`・${r.n} 階`:""}</div></td>
        <td class="n">${S.poolMerge?"":m.lv}</td><td class="n">${num(r.w)}</td>
        <td class="n pc"><span style="--w:${bar.toFixed(1)}%">${pct(r.pct)}</span></td></tr>`;
    }).join("")+`</tbody></table>`:`<div class="khint">沒有符合的詞綴。</div>`;
  const pre=rows.filter(r=>r.pre), suf=rows.filter(r=>!r.pre);
  $("kprefix").innerHTML=table(pre);
  $("ksuffix").innerHTML=table(suf);
  const cnt=pre=>PV.rows.filter(r=>r.pre===pre).length;
  $("kpcount").textContent=`　${cnt(true)} 條・總權重 ${num(PV.prefixTotal)}`;
  $("kscount").textContent=`　${cnt(false)} 條・總權重 ${num(PV.suffixTotal)}`;
  drawTargets();
}
$("kpq").oninput=e=>{ S.poolQuery=e.target.value.trim(); drawPool(); };
$("kmerge").onchange=e=>{ S.poolMerge=e.target.checked; drawPool(); };
$("kpool").addEventListener("change",e=>{
  const x=e.target; if(!x.matches("input[data-m]")) return;
  const m=E.mods[+x.dataset.m], t=targetOf(m);
  /* 勾一列＝這類詞綴、這個 tier 以上都算中；取消勾選＝整類拿掉 */
  if(x.checked){
    if(t) t.maxTier=+x.dataset.t;
    else S.targets.push({ty:m.ty,g:m.g,mi:m.i,maxTier:+x.dataset.t});
  }else if(t) S.targets.splice(S.targets.indexOf(t),1);
  drawPool();
});

/* ── 批次模擬 ── */
function drawTargets(){
  const f=families();
  $("ktargets").innerHTML=S.targets.length?S.targets.map((t,i)=>{
    const fam=f.get(t.ty+"|"+t.g);
    const tiers=fam?[...new Set(fam.rows.map(r=>r.tier))].sort((a,b)=>a-b):[];
    if(fam&&!tiers.includes(t.maxTier)&&t.maxTier<tiers[tiers.length-1]) tiers.push(t.maxTier), tiers.sort((a,b)=>a-b);
    const opts=tiers.map(n=>`<option value="${n}" ${n===t.maxTier?"selected":""}>T${n}${n===1?"":" 以上"}</option>`).join("");
    const txt=modText(fam?fam.best.m:t.mi).join("\n");
    return `<div class="ktarget"><span class="ktag ${t.g}">${t.g==="p"?"前":"後"}</span>
      <span class="ktt">${esc(txt).replace(/\n/g," / ")}${fam?"":`<em>（這個底材／物品等級不會出現）</em>`}</span>
      ${fam?`<select data-i="${i}" aria-label="最低 tier">${opts}</select>`:""}
      <button class="kx" data-i="${i}" aria-label="移除">×</button></div>`;
  }).join(""):`<div class="khint">從上面的詞綴池勾選想要的詞綴（同類詞綴可以指定最低 tier）。</div>`;
  $("kneed").max=Math.max(1,S.targets.length);
}
$("ktargets").addEventListener("change",e=>{
  const x=e.target.closest("select[data-i]"); if(!x) return;
  S.targets[+x.dataset.i].maxTier=+x.value; drawPool();
});
$("ktargets").addEventListener("click",e=>{
  const x=e.target.closest(".kx"); if(!x) return;
  S.targets.splice(+x.dataset.i,1); drawPool();
});
document.querySelectorAll('input[name="kmode"]').forEach(r=>{
  r.checked=r.value===S.mode;
  r.onchange=()=>{ S.mode=r.value; };
});
$("kneed").onchange=e=>{ S.need=Math.max(1,+e.target.value||1); e.target.value=S.need; S.mode="atleast";
  document.querySelector('input[name="kmode"][value="atleast"]').checked=true; };
$("kmethods").innerHTML=CE.METHODS.map(m=>`<label class="kmethod"><input type="radio" name="kmeth" value="${m.k}" ${m.k===S.method?"checked":""}>
  <span><b>${esc(m.zh)}</b><small>${esc(m.desc)}</small></span></label>`).join("");
$("kmethods").addEventListener("change",e=>{ if(e.target.name==="kmeth"){ S.method=e.target.value; drawEss(); drawPrices(); } });
const nr=$("knr"), nn=$("knn");
nr.value=nn.value=S.n;
nr.oninput=()=>{ S.n=+nr.value; nn.value=S.n; };
nn.onchange=()=>{ S.n=Math.max(1000,Math.min(10000,Math.round(+nn.value/100)*100||1000)); nn.value=nr.value=S.n; };
$("klimit").value=S.limit;
$("klimit").onchange=e=>{ S.limit=Math.max(10,Math.round(+e.target.value)||10000); e.target.value=S.limit; };

function drawPrices(){
  const list=CE.CURRENCIES.slice();
  if(S.method==="essence"&&S.essence) list.push(E.curInfo(S.essence));
  if(S.method==="fossil"&&S.fossils.length){ for(const id of S.fossils) list.push(E.curInfo("fos:"+id)); list.push(E.curInfo("res:c"+S.fossils.length)); }
  if(S.method==="harvest"&&S.harvest) for(const k of Object.keys(E.harvestCost("hv:"+S.harvest))) list.push(Object.assign({},E.curInfo(k),{zh:E.curInfo(k).zh+"（每 1 個）"}));
  $("kprices").innerHTML=list.map(c=>`<label class="kprice"><span>${esc(c.zh)}</span>
    ${c.k==="chaos"?`<input type="number" value="1" disabled aria-label="混沌石單價">`
      :`<input type="number" min="0" step="any" data-k="${c.k}" value="${S.prices[c.k]!=null?esc(S.prices[c.k]):""}" placeholder="—" aria-label="${esc(c.zh)}單價">`}</label>`).join("");
}
$("kprices").addEventListener("input",e=>{
  const x=e.target; if(!x.dataset.k) return;
  const v=parseFloat(x.value);
  if(x.value===""||!(v>=0)) delete S.prices[x.dataset.k]; else S.prices[x.dataset.k]=v;
  pricesTouched=true; savePrices(); drawResults();
});
const priceOf=k=>k==="chaos"?1:S.prices[k];

$("kgo").onclick=run;
let worker=null, workerBroken=false;
function run(){
  if(S.running) return;
  const o={b:S.b,lv:S.lv,method:S.method,mode:S.mode,need:S.need,
    targets:S.targets.map(t=>({ty:t.ty,g:t.g,maxTier:t.maxTier})),n:S.n,limit:S.limit,essence:S.essence,
    fossils:S.fossils.slice(),fossilMode:fossilMode(),harvest:S.harvest};
  if(!o.targets.length){ showRunErr("還沒有設定目標詞綴。"); return; }
  const err=E.feasible(o);
  if(err){ showRunErr(err); return; }
  const meta={o,method:CE.METHODS.find(m=>m.k===S.method),uses:E.methodUses(o),
    targets:S.targets.map(t=>({...t})),t0:performance.now()};
  S.running=true; S.progress=0; drawProgress();
  const done=results=>{
    S.running=false; drawProgress();
    meta.ms=performance.now()-meta.t0;
    S.results={meta,results,sum:E.summarize(results,meta.uses)};
    drawResults();
  };
  if(!workerBroken&&typeof Worker!=="undefined"){
    try{
      if(!worker) worker=new Worker("craft-worker.js"+(window.CRAFT_VER?"?v="+window.CRAFT_VER:""));
      worker.onmessage=e=>{
        if(e.data.progress!=null){ S.progress=e.data.progress; drawProgress(); }
        if(e.data.done) done(e.data.results);
      };
      worker.onerror=ev=>{ ev.preventDefault&&ev.preventDefault(); workerBroken=true; worker=null; runHere(o,done); };
      worker.postMessage(o);
      return;
    }catch(e){ workerBroken=true; worker=null; }
  }
  runHere(o,done);
}
/* 沒辦法用 Web Worker（例如直接用 file:// 開網頁）時，在頁面上分批跑 */
function runHere(o,done){
  const results=[]; let i=0;
  (function chunk(){
    const end=performance.now()+30;
    while(i<o.n&&performance.now()<end){ results.push(E.runOne(o,Math.random)); i++; }
    S.progress=i/o.n; drawProgress();
    if(i<o.n) setTimeout(chunk,0); else done(results);
  })();
}
function showRunErr(t){ $("kres").innerHTML=`<div class="kmsg bad">${esc(t)}</div>`; }
function drawProgress(){
  const p=$("kprog"), g=$("kgo");
  g.disabled=S.running; g.textContent=S.running?"模擬中…":"開始模擬";
  p.hidden=!S.running;
  p.querySelector("i").style.width=(S.progress*100).toFixed(1)+"%";
  p.querySelector("span").textContent=Math.round(S.progress*100)+"%";
}
function drawResults(){
  const R=S.results;
  if(!R) return;
  const {meta,sum}=R, uses=meta.uses;
  const need=E.needCount(meta.o);
  const cond=meta.o.mode==="all"?"全部都要":`至少 ${need} 條`;
  let h=`<div class="kctx">${esc(baseLabel(E.bases[meta.o.b]))}・物品等級 ${meta.o.lv}・${esc(meta.method.zh)}・${cond}・${num(sum.n)} 次（${(meta.ms/1000).toFixed(1)} 秒）<br>`+
    meta.targets.map(t=>`<span class="ktag ${t.g}">${t.g==="p"?"前":"後"} T${t.maxTier}${t.maxTier>1?"+":""}</span> ${esc(modText(t.mi)[0])}`).join("<br>")+`</div>`;
  h+=`<div class="krate"><b>${(sum.rate*100).toFixed(1)}%</b> 成功（${num(sum.success)} / ${num(sum.n)}）${sum.rate<1?`<small>沒成功的是重抽超過 ${num(meta.o.limit)} 次</small>`:""}</div>`;
  if(sum.rate<0.99) h+=`<div class="kmsg bad">成功率低於 99%：有 ${num(sum.n-sum.success)} 件重抽到上限（${num(meta.o.limit)} 次）還沒中。`+
    `下面的數字已經把這些失敗件用掉的通貨算進去（當作沒中就重新開始）；要看「一直做到成功為止」的情況，建議把「每件最多重抽幾次」調高後再跑一次。</div>`;
  if(sum.success){
    h+=`<table class="kres"><thead><tr><th>通貨</th><th class="n">平均</th><th class="n">中位數</th><th class="n">90% 以內</th></tr></thead><tbody>`+
      uses.map(k=>{ const s=sum.per[k]; return `<tr><td>${esc(E.curInfo(k).zh)}</td><td class="n">${num(+s.mean.toFixed(1))}</td><td class="n">${num(s.median)}</td><td class="n">${num(s.p90)}</td></tr>`; }).join("");
    const priced=uses.filter(k=>priceOf(k)!=null);
    if(priced.length){
      const prices={}; uses.forEach(k=>prices[k]=priceOf(k)||0);
      const c=E.costStats(R.results,uses,prices);
      const miss=uses.filter(k=>priceOf(k)==null).map(k=>E.curInfo(k).zh);
      h+=`<tr class="kcost"><td>總成本（混沌石）</td><td class="n">${num(+c.mean.toFixed(1))}</td><td class="n">${num(+c.median.toFixed(1))}</td><td class="n">${num(+c.p90.toFixed(1))}</td></tr></tbody></table>`+
        (miss.length?`<div class="khint">未填單價、以 0 計：${miss.map(esc).join("、")}</div>`:"");
    }else h+=`</tbody></table><div class="khint">在下面填通貨單價，就會換算成混沌石的總成本。</div>`;
    h+=`<div class="khint">每做出一件成功品要用掉多少，<b>失敗的件數也算進去</b>（沒中就重新開始，前面用掉的累加到下一件成功品）。`+
      `平均＝全部用量 ÷ 成功件數；「90% 以內」＝ 90% 的情況下用量不會超過這個數字。</div>`;
  }
  $("kres").innerHTML=h;
}

/* 切換中／EN：重畫所有有詞綴或底材名稱的地方 */
window.addEventListener("craftlang",()=>{ drawBases(); drawPool(); drawItem(); drawResults(); });

/* ── 開始 ── */
lvr.value=lvn.value=S.lv;
clsSel.value=S.cls;
{ const list=basesOfClass(); S.b=list[list.length-1].i; }
S.item=E.make(S.b,S.lv);
drawPrices(); drawBases(); drawPool(); drawAll(); drawProgress();
loadPrices();
})();
