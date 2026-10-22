/* 製裝模擬器核心規則（PoE1）。
   通貨規則參考 Kalandralang（https://github.com/doomeer/kalandralang ，MIT）的實作邏輯，用 JavaScript 重寫。
   資料來自 RePoE（craft-data.js，由 tools/build_craft_data.py 產生）。

   不碰畫面，瀏覽器、Web Worker、Node 都能載入：
     瀏覽器 / Worker → window.CraftEngine / self.CraftEngine
     Node            → require("./craft-engine.js")
   用法：const E = CraftEngine.create(CRAFT_DATA);

   物品格式：{ b: 底材編號, lv: 物品等級, r: 0 普通 / 1 魔法 / 2 稀有, mods: [{ m: 詞綴編號, v: [數值…] }] }
   apply() 不會改動傳進去的物品，會回傳新的。
   編號只在網頁內部用（每次更新資料都可能變）；存檔一律用 toStored() 轉成穩定 id，讀檔用 fromStored()。 */
(function(root){
"use strict";

const NORMAL=0, MAGIC=1, RARE=2;
const RARITY_ZH=["普通","魔法","稀有"];

/* 通貨。中文名稱照遊戲繁中版；作用說明給滑鼠提示用。 */
const CURRENCIES=[
  {k:"transmute", zh:"蛻變石", en:"Orb of Transmutation", desc:"普通 → 魔法，隨機 1～2 條詞綴（各 50%，社群推定值）"},
  {k:"alt",       zh:"改造石", en:"Orb of Alteration",    desc:"魔法物品重抽，隨機 1～2 條詞綴（各 50%，社群推定值）"},
  {k:"aug",       zh:"增幅石", en:"Orb of Augmentation",  desc:"魔法物品補 1 條詞綴"},
  {k:"regal",     zh:"富豪石", en:"Regal Orb",            desc:"魔法 → 稀有，保留原詞綴並加 1 條"},
  {k:"alch",      zh:"點金石", en:"Orb of Alchemy",       desc:"普通 → 稀有，隨機 4～6 條詞綴（機率 8 : 3 : 1，社群推定值）"},
  {k:"chaos",     zh:"混沌石", en:"Chaos Orb",            desc:"稀有物品重抽，隨機 4～6 條詞綴（機率 8 : 3 : 1，社群推定值）"},
  {k:"exalt",     zh:"崇高石", en:"Exalted Orb",          desc:"稀有物品加 1 條詞綴"},
  {k:"annul",     zh:"無效石", en:"Orb of Annulment",     desc:"隨機拿掉 1 條詞綴（稀有度不變）"},
  {k:"scour",     zh:"重鑄石", en:"Orb of Scouring",      desc:"清空所有詞綴，變回普通"},
  {k:"divine",    zh:"神聖石", en:"Divine Orb",           desc:"重骰所有詞綴的數值，詞綴本身不變"},
];
const CUR=Object.fromEntries(CURRENCIES.map(c=>[c.k,c]));

/* 批次模擬的作法 */
const METHODS=[
  {k:"altaug", zh:"改造＋增幅", desc:"蛻變石開始；沒中就改造，只有一條、而且增幅有機會補中時才增幅", uses:["transmute","alt","aug"]},
  {k:"chaos",  zh:"混沌重抽",   desc:"點金石開始；沒中就用混沌石重抽", uses:["alch","chaos"]},
  {k:"alchscour", zh:"點金＋重鑄", desc:"點金石開始；沒中就重鑄再點金", uses:["alch","scour"]},
  {k:"essence", zh:"精髓重鑄", desc:"用選定的精髓開始；沒中就再用一次（咆哮以上直接重鑄稀有物品，哀嚎以下要先重鑄石變回普通）", uses:["ess"]},
];

/* ── 數值換算（stat_translations 的 index_handlers）── */
const HANDLERS={
  negate:v=>-v, double:v=>v*2, negate_and_double:v=>-v*2, times_twenty:v=>v*20,
  times_one_point_five:v=>v*1.5, canonical_stat:v=>v,
  divide_by_one_hundred:v=>v/100, divide_by_one_hundred_2dp:v=>v/100, divide_by_one_hundred_2dp_if_required:v=>v/100,
  milliseconds_to_seconds:v=>v/1000, milliseconds_to_seconds_0dp:v=>Math.round(v/1000),
  milliseconds_to_seconds_1dp:v=>v/1000, milliseconds_to_seconds_2dp:v=>v/1000,
  milliseconds_to_seconds_2dp_if_required:v=>v/1000,
  per_minute_to_per_second:v=>v/60, per_minute_to_per_second_0dp:v=>Math.round(v/60),
  per_minute_to_per_second_1dp:v=>v/60, per_minute_to_per_second_2dp:v=>v/60,
  per_minute_to_per_second_2dp_if_required:v=>v/60,
  divide_by_ten_0dp:v=>Math.round(v/10), divide_by_ten_1dp:v=>v/10, divide_by_ten_1dp_if_required:v=>v/10,
  locations_to_metres:v=>v/10, deciseconds_to_seconds:v=>v/10,
  divide_by_two_0dp:v=>Math.round(v/2), divide_by_five:v=>v/5, divide_by_six:v=>v/6,
  divide_by_twelve:v=>v/12, divide_by_one_thousand:v=>v/1000,
  "30%_of_value":v=>v*0.3, "60%_of_value":v=>v*0.6,
  old_leech_percent:v=>v/5, old_leech_permyriad:v=>v/50,
  "permyriad_per_minute_to_%_per_second":v=>v/6000,
};
function fmtNum(v){
  if(Number.isInteger(v)) return String(v);
  return String(Math.round(v*100)/100);
}

function create(D){
  const tagId=Object.fromEntries(D.tags.map((t,i)=>[t,i]));
  const bases=D.bases.map((b,i)=>Object.assign({},b,{i,ts:new Set(b.t)}));
  /* 元工藝（工藝台的特殊詞綴），用群組辨認：PL 前綴不能被改變、SL 後綴不能被改變、
     NA 不能骰出攻擊詞綴、NC 不能骰出法術詞綴、MM 可以有 3 條工藝詞綴 */
  const META_GROUP={ItemGenerationCannotChangePrefixes:"PL",ItemGenerationCannotChangeSuffixes:"SL",
    ItemGenerationCannotRollAttackAffixes:"NA",ItemGenerationCannotRollCasterAffixes:"NC",ItemGenerationCanHaveMultipleCraftedMods:"MM"};
  const mods=D.mods.map((m,i)=>Object.assign({},m,{i,pre:m.g==="p",grs:new Set(m.gr),
    meta:m.d==="c"&&m.gr.map(g=>META_GROUP[g]).find(Boolean)||null,
    atk:(m.tg||[]).includes("attack"),cst:(m.tg||[]).includes("caster")}));
  const modById=Object.fromEntries(mods.map(m=>[m.id,m]));
  const baseById=Object.fromEntries(bases.filter(b=>b.id).map(b=>[b.id,b]));
  /* 精髓：k ＝ "ess:" ＋ Metadata 路徑（當通貨鍵值用，存檔裡的使用次數也用這個） */
  const essences=(D.essences||[]).map((e,i)=>Object.assign({},e,{i,k:"ess:"+e.id}));
  const essByKey=Object.fromEntries(essences.map(e=>[e.k,e]));

  /* ── 權重：spawn_weights 依順序取第一個物品也有的 tag；再乘上 generation_weights（百分比） ── */
  function firstMatch(list,ts){
    for(const [t,w] of list) if(ts.has(t)) return w;
    return null;
  }
  function weightOf(m,ts){
    const w=firstMatch(m.sw,ts);
    if(w===null||w<=0) return 0;
    const g=firstMatch(m.gw,ts);
    if(g===null) return w;
    const x=Math.trunc(w*g/100);
    return x>0?x:0;
  }

  /* 物品目前的 tag：底材 tag ＋ 身上詞綴附加的 tag（例如 has_attack_mod） */
  function addedTags(item){
    let a=null;
    for(const x of item.mods){
      const at=mods[x.m].at;
      if(at.length){ a=a||new Set(); for(const t of at) a.add(t); }
    }
    return a;
  }
  function tagSet(item){
    const a=addedTags(item);
    if(!a) return bases[item.b].ts;
    const s=new Set(bases[item.b].ts); a.forEach(t=>s.add(t)); return s;
  }
  function tagKey(item){
    const a=addedTags(item);
    return a?[...a].sort((x,y)=>x-y).join(","):"";
  }

  /* 只依底材、物品等級、附加 tag 決定的詞綴池（還沒考慮身上已有的詞綴），快取起來。 */
  const poolCache=new Map();
  function basePool(item){
    const key=item.b+"|"+item.lv+"|"+tagKey(item);
    let p=poolCache.get(key);
    if(p) return p;
    const ts=tagSet(item), list=[];
    for(const m of mods){
      if(m.d||m.lv>item.lv) continue;   // d：精髓專屬等，不在一般詞綴池
      const w=weightOf(m,ts);
      if(w>0) list.push({m:m.i,w});
    }
    const cum=new Float64Array(list.length);
    let t=0;
    list.forEach((x,i)=>{ t+=x.w; cum[i]=t; });
    p={list,cum,total:t};
    if(poolCache.size>400) poolCache.clear();
    poolCache.set(key,p);
    return p;
  }

  function maxSide(item){ return item.r===RARE?3:item.r===MAGIC?1:0; }
  function counts(item){
    let p=0,s=0;
    for(const x of item.mods) mods[x.m].pre?p++:s++;
    return {p,s};
  }
  function hasGroup(item,m){
    for(const x of item.mods){
      for(const g of mods[x.m].gr) if(m.grs.has(g)) return true;
    }
    return false;
  }
  /* f：物品上的元工藝（metaOf）。不能骰出攻擊／法術詞綴時，新加的詞綴排除有 attack／caster tag 的 */
  function allowed(item,m,c,max,f){
    if(m.pre?c.p>=max:c.s>=max) return false;
    if(f&&((f.NA&&m.atk)||(f.NC&&m.cst))) return false;
    return !hasGroup(item,m);
  }
  function metaOf(item){
    const f={}; let any=false;
    for(const x of item.mods){ const k=mods[x.m].meta; if(k){ f[k]=true; any=true; } }
    return any?f:null;
  }
  function craftedCount(item){ let n=0; for(const x of item.mods) if(mods[x.m].d==="c") n++; return n; }
  function maxCrafted(item){ const f=metaOf(item); return f&&f.MM?3:1; }
  /* 詞綴能不能被拿掉／洗掉：前綴（後綴）不能被改變時那一邊不動；
     roll＝也看「不能骰出攻擊／法術詞綴」（無效石：有 attack／caster tag 的詞綴拿不掉） */
  function canRemove(m,f,roll){
    if(!f) return true;
    if(f.PL&&m.pre) return false;
    if(f.SL&&!m.pre) return false;
    if(roll&&((f.NA&&m.atk)||(f.NC&&m.cst))) return false;
    return true;
  }
  /* 洗掉可以洗的詞綴（元工藝本身也是詞綴：它那一邊沒被鎖住就會被洗掉） */
  function strip(item,roll){ const f=metaOf(item); item.mods=item.mods.filter(x=>!canRemove(mods[x.m],f,roll)); }

  /* cap：其他隨機詞綴的最高等級（低階精髓），0 ＝ 不限 */
  function capped(item,cap){ return cap&&cap<item.lv?{b:item.b,lv:cap,mods:item.mods}:item; }
  /* 目前這件物品「下一條詞綴」的完整詞綴池（已排除滿了的那一邊和同 group） */
  function pool(item,cap){
    const bp=basePool(capped(item,cap)), c=counts(item), max=maxSide(item), f=metaOf(item);
    return bp.list.filter(x=>allowed(item,mods[x.m],c,max,f));
  }

  /* 依權重抽一條。先從快取的池子抽、抽到不合格的就重抽（結果和從篩過的池子抽一樣），
     重抽太多次才真的篩一次池子。抽不到回傳 -1。 */
  function pickMod(item,rng,cap){
    const bp=basePool(capped(item,cap));
    if(!bp.list.length) return -1;
    const c=counts(item), max=maxSide(item), f=metaOf(item);
    for(let tries=0;tries<40;tries++){
      const r=rng()*bp.total;
      let lo=0,hi=bp.cum.length-1;
      while(lo<hi){ const mid=(lo+hi)>>1; if(bp.cum[mid]>r) hi=mid; else lo=mid+1; }
      const m=mods[bp.list[lo].m];
      if(allowed(item,m,c,max,f)) return m.i;
    }
    const pl=pool(item,cap);
    if(!pl.length) return -1;
    let t=0; for(const x of pl) t+=x.w;
    let r=rng()*t;
    for(const x of pl){ r-=x.w; if(r<0) return x.m; }
    return pl[pl.length-1].m;
  }

  function rollValues(m,rng){
    return m.st.map(([,a,b])=>{
      const lo=Math.min(a,b), hi=Math.max(a,b);
      return lo+Math.floor(rng()*(hi-lo+1));
    });
  }
  function addMod(item,mi,rng){ item.mods.push({m:mi,v:rollValues(mods[mi],rng)}); }
  /* 成功加了一條回傳 true */
  function spawn(item,rng,cap){
    const mi=pickMod(item,rng,cap);
    if(mi<0) return false;
    addMod(item,mi,rng); return true;
  }
  /* 補到目標數量：魔法 1～2 條（50 : 50），稀有 4～6 條（8 : 3 : 1）；池子空了就停 */
  /* 詞綴條數：魔法 1／2 條 50 : 50、稀有 4／5／6 條 8 : 3 : 1。照 Kalandralang，是社群推定值，不是官方數字 */
  function spawnAdditional(item,rng,cap){
    let n;
    if(item.r===MAGIC) n=rng()<0.5?1:2;
    else if(item.r===RARE){ const i=Math.floor(rng()*12); n=i<8?4:i<11?5:6; }
    else n=0;
    for(let k=item.mods.length;k<n;k++) if(!spawn(item,rng,cap)) break;
  }

  function clone(item){ return {b:item.b,lv:item.lv,r:item.r,mods:item.mods.map(x=>({m:x.m,v:x.v.slice()}))}; }
  function make(b,lv){ return {b,lv,r:NORMAL,mods:[]}; }

  /* 能不能用：可以回傳 null，不行回傳原因 */
  function check(item,k){
    if(essByKey[k]) return checkEssence(item,essByKey[k]);
    const n=item.mods.length, c=counts(item);
    const need=r=>item.r===r?null:"這顆只能用在"+RARITY_ZH[r]+"物品上，目前是"+RARITY_ZH[item.r]+"物品。";
    const room=()=>{
      const max=maxSide(item);
      if(c.p>=max&&c.s>=max) return "前綴、後綴都已經滿了（"+RARITY_ZH[item.r]+"物品各 "+max+" 條）。";
      if(!pool(item).length) return "目前沒有任何可以出現的詞綴。";
      return null;
    };
    switch(k){
      case "transmute": case "alch": return need(NORMAL);
      case "alt": return need(MAGIC);
      case "aug": return need(MAGIC)||room();
      case "regal": return need(MAGIC)||room2(RARE);
      case "chaos": return need(RARE);
      case "exalt": return need(RARE)||room();
      case "annul":
        if(!n) return "物品上沒有詞綴可以拿掉。";
        return removable(item,true).length?null:"剩下的詞綴都受元工藝保護，無效石拿不掉。";
      case "scour":
        if(item.r===NORMAL&&!n) return "已經是沒有詞綴的普通物品了。";
        if(n&&!removable(item,false).length&&lowestRarity(item)===item.r) return "所有詞綴都受元工藝保護，重鑄石不會有作用。";
        return null;
      case "divine":
        if(!n) return "物品上沒有詞綴可以重骰。";
        return rerollable(item).length?null:"所有詞綴都受元工藝保護（前綴／後綴不能被改變），數值不會重骰。";
    }
    return "不認得的通貨："+k;
    function room2(r){ const t=clone(item); t.r=r; return pool(t).length?null:"目前沒有任何可以出現的詞綴。"; }
  }
  /* 元工藝和各通貨的互動（poewiki Meta-crafting mod 的對照表）：
     改造、混沌、重鑄、無效、神聖：被鎖住（前綴／後綴不能被改變）的那一邊不動；空著的位置照樣可以補上。
     增幅、富豪、崇高、改造／混沌補詞綴時：不能骰出攻擊／法術詞綴的話，新詞綴排除 attack／caster。
     無效石：有 attack／caster tag 的詞綴，在「不能骰出攻擊／法術詞綴」時拿不掉。重鑄石不看攻擊／法術。
     精髓（和化石）：有任何元工藝就不能用。 */
  function removable(item,roll){ const f=metaOf(item); return item.mods.filter(x=>canRemove(mods[x.m],f,roll)); }
  function rerollable(item){ const f=metaOf(item); return item.mods.filter(x=>canRemove(mods[x.m],f,false)); }
  /* 重鑄後的稀有度：照剩下的前綴／後綴數決定（Kalandralang 的做法） */
  function lowestRarity(item){
    const keep=item.mods.filter(x=>!canRemove(mods[x.m],metaOf(item),false)), c=counts({mods:keep});
    return c.p>1||c.s>1?RARE:c.p||c.s?MAGIC:NORMAL;
  }
  /* 精髓：普通物品 → 稀有＋保證詞綴；稀有物品只有咆哮（第 5 階）以上、腐化精髓可以重鑄。
     荒蕪精髓（第 0 階）能不能重鑄稀有物品：待確認，先當作只能用在普通物品。 */
  function essenceMod(item,e){ const mi=e.m[bases[item.b].c]; return mi===undefined?-1:mi; }
  function checkEssence(item,e){
    if(essenceMod(item,e)<0) return "這顆精髓不能用在"+(D.classes[bases[item.b].c]||{}).zh+"上（資料裡沒有這類物品的保證詞綴）。";
    if(item.r===MAGIC) return "精髓只能用在普通或稀有物品上，目前是魔法物品。";
    if(metaOf(item)) return "物品上有元工藝（例如前綴不能被改變），不能使用精髓。";
    if(item.r===RARE&&!(e.lv>=5)) return "低階精髓（哀嚎以下）只能用在普通物品上；咆哮以上才能重鑄稀有物品。";
    return null;
  }
  function applyEssence(item,e,rng){
    item.r=RARE; item.mods=[];
    addMod(item,essenceMod(item,e),rng);
    spawnAdditional(item,rng,e.ilr||0);
  }
  /* 通貨的名稱、說明、圖示（一般通貨和精髓都可以） */
  function curInfo(k){
    const e=essByKey[k];
    if(e) return {k,zh:e.nz,en:e.n,ic:e.ic,ess:e,
      desc:(e.lv>=5?"普通 → 稀有，或重鑄稀有物品":"普通 → 稀有（不能用在稀有物品）")+"，保證一條指定詞綴"+
        (e.ilr?"；其他隨機詞綴最高等級 "+e.ilr:"")};
    const c=CUR[k];
    if(c) return Object.assign({ic:(D.curIcons||{})[k]||""},c);
    const d=(D.decor||{})[k];   // 工藝台費用用到的其他通貨（瓦爾寶珠、機會石等）
    return d?{k,zh:d.zh,en:d.en,ic:d.ic,desc:"模擬器只用來計算工藝台費用"}:null;
  }

  /* ── 工藝台（RePoE crafting_bench_options；假設全部配方都已解鎖）──
     ・每件裝備預設只能有 1 條工藝詞綴；有「可以有 3 條工藝詞綴」時最多 3 條（這條本身也算，照 Kalandralang）。
     ・照一般詞綴規則：那一邊要有空位、不能和身上的詞綴同群組（poewiki Crafting Bench）。
     ・已經有 1 條工藝詞綴時再做＝取代那一條，多花 1 顆重鑄石；有多條工藝詞綴時不能取代（poewiki）。
     ・普通物品做工藝詞綴會變成魔法物品；不檢查物品等級（照 Kalandralang，遊戲內待確認）。
     ・3.29 新增的「重抽稀有裝 3 條／1 條詞綴」：規則待確認，只列出、不能用。 */
  const bench=(D.bench||[]).map((o,i)=>Object.assign({},o,{i,cs:new Set(o.cls)}));
  const benchByKey=Object.fromEntries(bench.map(o=>[o.k,o]));
  function benchCheck(item,o){
    if(!o||!o.cs.has(bases[item.b].c)) return {err:"這個物品類別不能做這一項。"};
    if(o.a==="reroll") return {err:"3.29 新增的選項，實際規則待確認，模擬器先不提供。"};
    if(o.a==="remove") return craftedCount(item)?{err:null}:{err:"物品上沒有工藝詞綴。"};
    const m=mods[o.m], cc=craftedCount(item), mx=maxCrafted(item);
    let t=item, replace=false;
    if(cc>=mx){
      if(mx>1) return {err:"工藝詞綴已經有 "+cc+" 條（上限 "+mx+" 條）。"};
      replace=true; t={b:item.b,lv:item.lv,r:item.r,mods:item.mods.filter(x=>mods[x.m].d!=="c")};
    }
    const max=t.r===RARE?3:1, c=counts(t);
    if(m.pre?c.p>=max:c.s>=max) return {err:(m.pre?"前綴":"後綴")+"已經滿了（"+RARITY_ZH[Math.max(t.r,MAGIC)]+"物品各 "+max+" 條）。"};
    if(hasGroup(t,m)) return {err:"物品上已經有同一類（群組 "+m.gr.join("、")+"）的詞綴。"};
    return {err:null,replace};
  }
  /* 工藝台每列右邊的「lvl」：做完後裝備的角色需求等級＝詞綴等級的 80%（無條件捨去）。
     遊戲資料 CraftingBenchOptions 的 RequiredLevel 對裝備詞綴都是 0，物品等級不限制工藝台（照 Kalandralang）。 */
  function craftLevel(mi){ return Math.floor(mods[mi].lv*0.8); }
  /* 這件物品可以看到的工藝台選項（含不能做的原因、實際費用） */
  function benchFor(item){
    const cls=bases[item.b].c;
    return bench.filter(o=>o.cs.has(cls)).map(o=>{
      const r=benchCheck(item,o), cost=Object.assign({},o.c);
      if(r.replace) cost.scour=(cost.scour||0)+1;
      return {o,err:r.err,replace:!!r.replace,cost};
    });
  }
  function applyBench(item,k,rng){
    rng=rng||Math.random;
    const o=benchByKey[k], r=benchCheck(item,o);
    if(r.err) return {ok:false,err:r.err,item};
    const it=clone(item), cost=Object.assign({},o.c);
    if(o.a==="remove") it.mods=it.mods.filter(x=>mods[x.m].d!=="c");
    else{
      if(r.replace){ it.mods=it.mods.filter(x=>mods[x.m].d!=="c"); cost.scour=(cost.scour||0)+1; }
      if(it.r===NORMAL) it.r=MAGIC;
      addMod(it,o.m,rng);
    }
    return {ok:true,item:it,cost,replace:!!r.replace};
  }

  /* 直接改動 item（給批次模擬用）。呼叫前要先 check。 */
  function applyMut(item,k,rng){
    if(essByKey[k]){ applyEssence(item,essByKey[k],rng); return item; }
    switch(k){
      case "transmute": item.r=MAGIC; item.mods=[]; spawnAdditional(item,rng); break;
      case "alt": strip(item,false); spawnAdditional(item,rng); break;
      case "aug": spawn(item,rng); break;
      case "regal": item.r=RARE; spawn(item,rng); break;
      case "alch": item.r=RARE; item.mods=[]; spawnAdditional(item,rng); break;
      case "chaos": strip(item,false); spawn(item,rng); spawnAdditional(item,rng); break;
      case "exalt": spawn(item,rng); break;
      case "annul": { const l=removable(item,true); item.mods.splice(item.mods.indexOf(l[Math.floor(rng()*l.length)]),1); break; }
      case "scour": item.r=lowestRarity(item); strip(item,false); break;
      case "divine": for(const x of rerollable(item)) x.v=rollValues(mods[x.m],rng); break;
    }
    return item;
  }
  function apply(item,k,rng){
    rng=rng||Math.random;
    const err=check(item,k);
    if(err) return {ok:false,err,item};
    return {ok:true,item:applyMut(clone(item),k,rng)};
  }

  /* ── Tier：同一個 mod type、能出現在這個底材上（不看物品等級）的詞綴，
     依需求等級由高到低、同等級再比數值總和，排在最前面的是 T1。 ── */
  const tierCache=new Map();
  function tierTable(b,ty){
    const key=b+"|"+ty;
    let t=tierCache.get(key);
    if(t) return t;
    const ts=bases[b].ts;
    const sum=m=>m.st.reduce((a,s)=>a+s[1]+s[2],0);
    const list=mods.filter(m=>m.ty===ty&&weightOf(m,ts)>0)
      .sort((x,y)=>(y.lv-x.lv)||(sum(y)-sum(x)));
    t=new Map(); let tier=0, prev=null; const sums=[];
    for(const m of list){
      const k=m.lv+"|"+sum(m);
      if(k!==prev){ tier++; prev=k; sums.push(sum(m)); }
      t.set(m.i,tier);
    }
    t.count=tier; t.sums=sums;
    tierCache.set(key,t);
    return t;
  }
  /* 精髓專屬等不在一般詞綴池的詞綴：用數值總和換算成「相當於一般詞綴的第幾階」（模擬器自己的換算，不是遊戲規則） */
  function tierOf(b,mi){
    const m=mods[mi], t=tierTable(b,m.ty);
    if(!m.d) return t.get(mi)||0;
    if(!t.count) return 1;
    const sum=m.st.reduce((a,s)=>a+s[1]+s[2],0);
    for(let k=0;k<t.sums.length;k++) if(t.sums[k]<=sum) return k+1;
    return t.count+1;
  }
  /* 物品卡上詞綴前面的小標籤：一般「前 T3」、精髓專屬「前 精≈T4」 */
  function tagLabel(b,mi){
    const m=mods[mi], side=m.pre?"前":"後";
    if(m.meta) return side+" 元工藝";
    if(m.d==="c") return side+" 工藝";
    if(m.d==="e") return side+" 精≈T"+tierOf(b,mi);
    return side+" T"+tierOf(b,mi);
  }
  /* 詞綴來源的說明（給滑鼠提示、詳細資訊） */
  function sourceNote(b,mi){
    const m=mods[mi];
    if(m.d==="e") return "精髓詞綴（數值相當於一般詞綴 T"+tierOf(b,mi)+"）";
    if(m.meta) return "元工藝（工藝台詞綴，改變其他通貨的作用）";
    if(m.d==="c") return "工藝台詞綴（數值相當於一般詞綴 T"+tierOf(b,mi)+"）";
    return null;
  }
  function tierCount(b,mi){ return tierTable(b,mods[mi].ty).count; }

  /* ── 詞綴文字：用 stat_translations 套實際數值；套不出來就用 RePoE 的範圍文字 ── */
  function condOk(c,v){
    const [mn,mx,neg]=c;
    const ok=(mn===null||mn===undefined||v>=mn)&&(mx===null||mx===undefined||v<=mx);
    return neg?!ok:ok;
  }
  /* stats：[[stat id, 最小, 最大]]（已經骰好的數值就是最小＝最大）。lang："zh" 用繁中模板，其他用英文。
     某條沒有中文模板就用英文那條；有 stat 完全沒有翻譯回傳 null（呼叫的地方改用 RePoE 的英文文字）。 */
  function statLines(stats,lang){
    const lo={}, hi={};
    for(const [id,a,b] of stats){ lo[id]=a; hi[id]=b; }
    const seen=new Set(), lines=[];
    for(const [sid] of stats){
      const ti=D.statTr[sid];
      if(ti===undefined){
        if(!lo[sid]&&!hi[sid]) continue;   // 例如 dummy_stat_display_nothing：數值 0、本來就不顯示
        return null;
      }
      if(seen.has(ti)) continue;
      seen.add(ti);
      const e=D.trans[ti];
      const vl=e.ids.map(id=>lo[id]!==undefined?lo[id]:0), vh=e.ids.map(id=>hi[id]!==undefined?hi[id]:0);
      const list=lang==="zh"&&e.z?e.z:e.v;
      const ok=vs=>x=>x.c.every((c,k)=>condOk(c,vs[k]));
      const v=list.find(ok(vh))||list.find(ok(vl));
      if(!v) continue;
      lines.push(v.s.replace(/\{(\d+)\}/g,(_,k)=>{
        k=+k;
        const f=v.f[k];
        if(f==="ignore") return "";
        let a=vl[k], b=vh[k];
        for(const h of (v.h[k]||[])) if(HANDLERS[h]){ a=HANDLERS[h](a); b=HANDLERS[h](b); }
        if(a>b){ const t=a; a=b; b=t; }
        const sign=f==="+#"&&b>0?"+":"";
        return sign+(a===b?fmtNum(a):"("+fmtNum(a)+"-"+fmtNum(b)+")");
      }));
    }
    return lines;
  }
  /* 詞綴文字。vals 省略就是範圍文字（英文直接用 RePoE 的 text） */
  function render(mi,vals,lang){
    const m=mods[mi];
    if(!vals) return modRange(mi,lang);
    const l=statLines(m.st.map((s,i)=>[s[0],vals[i],vals[i]]),lang);
    return l&&l.length?l:m.tx.split("\n");
  }
  function modRange(mi,lang){
    const m=mods[mi];
    if(lang==="zh"){ const l=statLines(m.st,"zh"); if(l&&l.length) return l; }
    return m.tx.split("\n");
  }
  /* 底材名稱、固有詞綴（範圍文字） */
  function baseName(b,lang){ const x=bases[b]; return lang==="zh"&&x.nz?x.nz:x.n; }
  /* 詞綴名稱（例如 Frosted／結霜的） */
  function modName(mi,lang){ const m=mods[mi]; return lang==="zh"&&m.nz?m.nz:m.n; }
  function implicitLines(b,lang){
    const x=bases[b];
    return x.imp.flatMap((t,i)=>{
      if(lang==="zh"&&x.is&&x.is[i]){ const l=statLines(x.is[i],"zh"); if(l&&l.length) return l; }
      return t.split("\n");
    });
  }

  /* ── 詞綴池檢視：只看底材＋物品等級（空白物品），前綴、後綴分開算機率 ── */
  function poolView(b,lv){
    const bp=basePool(make(b,lv));
    let tp=0,tsuf=0;
    for(const x of bp.list) mods[x.m].pre?tp+=x.w:tsuf+=x.w;
    const rows=bp.list.map(x=>{
      const m=mods[x.m];
      return {m:x.m,w:x.w,pre:m.pre,tier:tierOf(b,x.m),tiers:tierCount(b,x.m),
        pct:x.w/(m.pre?tp:tsuf)*100};
    }).sort((a,b)=>b.pct-a.pct);
    return {rows,prefixTotal:tp,suffixTotal:tsuf};
  }

  /* ── 批次模擬 ──
     目標：[{ty: mod type, g: "p"|"s", maxTier: 最低可接受的 tier（數字越小越好）}]
     mode："all" 全部都要，或 "atleast"＋need 條 */
  function satisfied(item,targets){
    const hit=new Array(targets.length).fill(false);
    for(const x of item.mods){
      const m=mods[x.m];
      targets.forEach((t,i)=>{
        if(!hit[i]&&t.ty===m.ty&&t.g===m.g&&tierOf(item.b,x.m)<=t.maxTier) hit[i]=true;
      });
    }
    return hit;
  }
  function needCount(o){ return o.mode==="all"?o.targets.length:Math.max(1,Math.min(o.need||1,o.targets.length)); }
  function isDone(item,o){
    let n=0; for(const h of satisfied(item,o.targets)) if(h) n++;
    return n>=needCount(o);
  }
  /* 增幅有沒有機會補中：還差 1 條、而且空著的那一邊有沒中的目標 */
  function augCanHelp(item,o){
    const hit=satisfied(item,o.targets);
    const got=hit.filter(Boolean).length;
    if(got+1<needCount(o)) return false;
    const c=counts(item);
    return o.targets.some((t,i)=>!hit[i]&&(t.g==="p"?c.p===0:c.s===0));
  }
  /* 跑之前先看可不可能達成，不可能就回傳原因 */
  function feasible(o){
    const item=make(o.b,o.lv);
    let bp=basePool(item), ess=null;
    if(o.method==="essence"){
      ess=essByKey[o.essence];
      if(!ess) return "還沒有選精髓。";
      const err=checkEssence(item,ess);
      if(err) return err;
      bp=basePool(capped(item,ess.ilr||0));
    }
    const em=ess?essenceMod(item,ess):-1;
    const hits=(mi,t)=>{ const m=mods[mi]; return m.ty===t.ty&&m.g===t.g&&tierOf(o.b,mi)<=t.maxTier; };
    for(const t of o.targets){
      const any=(em>=0&&hits(em,t))||bp.list.some(x=>hits(x.m,t));
      if(!any) return ess&&ess.ilr&&o.lv>ess.ilr
        ?"有目標詞綴在這個精髓下不會出現（低階精髓的其他隨機詞綴最高只到 "+ess.ilr+" 級）。"
        :"有目標詞綴在這個底材、物品等級下不會出現（例如 tier 要求太高）。";
    }
    const need=needCount(o);
    if(o.method==="altaug"){
      if(need>2) return "魔法物品最多 2 條詞綴（一前一後），這個目標用改造＋增幅不可能達成。";
      if(o.mode==="all"){
        const p=o.targets.filter(t=>t.g==="p").length, s=o.targets.length-p;
        if(p>1||s>1) return "魔法物品最多一條前綴、一條後綴，這個目標用改造＋增幅不可能達成。";
      }
    }else if(o.mode==="all"){
      const p=o.targets.filter(t=>t.g==="p").length, s=o.targets.length-p;
      if(p>3||s>3) return "稀有物品前綴、後綴各最多 3 條，這個目標不可能達成。";
    }
    return null;
  }
  /* 跑一件，回傳 {ok, used:{通貨:顆數}}。limit：最多重抽幾次，超過就算失敗 */
  function runOne(o,rng){
    const used={};
    const use=(item,k)=>{ used[k]=(used[k]||0)+1; applyMut(item,k,rng); };
    const item=make(o.b,o.lv);
    const limit=o.limit||10000;
    if(o.method==="altaug"){
      use(item,"transmute");
      for(let i=0;;i++){
        if(item.mods.length===1&&augCanHelp(item,o)) use(item,"aug");
        if(isDone(item,o)) return {ok:true,used};
        if(i>=limit) return {ok:false,used};
        use(item,"alt");
      }
    }else if(o.method==="essence"){
      const ess=essByKey[o.essence], again=ess.lv>=5;
      use(item,ess.k);
      for(let i=0;;i++){
        if(isDone(item,o)) return {ok:true,used};
        if(i>=limit) return {ok:false,used};
        if(!again) use(item,"scour");
        use(item,ess.k);
      }
    }else if(o.method==="chaos"){
      use(item,"alch");
      for(let i=0;;i++){
        if(isDone(item,o)) return {ok:true,used};
        if(i>=limit) return {ok:false,used};
        use(item,"chaos");
      }
    }else{
      use(item,"alch");
      for(let i=0;;i++){
        if(isDone(item,o)) return {ok:true,used};
        if(i>=limit) return {ok:false,used};
        use(item,"scour"); use(item,"alch");
      }
    }
  }
  /* 失敗的件數也要算：把結果依序串起來，每拿到一件成功品就切一段，
     一段＝「拿到一件成功品總共用掉多少」（包含前面失敗、重新開始的那幾件）。
     最後一件成功之後的失敗接回第一段（頭尾相接），所以每段加起來＝全部用量，平均＝全部用量 ÷ 成功件數。 */
  function perSuccess(results,costOf){
    const n=results.length, last=results.map(r=>r.ok).lastIndexOf(true);
    if(last<0) return [];
    const out=[]; let acc=0;
    for(let j=1;j<=n;j++){
      const r=results[(last+j)%n];
      acc+=costOf(r);
      if(r.ok){ out.push(acc); acc=0; }
    }
    return out;
  }
  /* 平均、中位數、90%（每拿到一件成功品要用掉多少，見 perSuccess） */
  function stat(arr){
    if(!arr.length) return {mean:0,median:0,p90:0};
    const s=arr.slice().sort((a,b)=>a-b);
    const q=p=>s[Math.min(s.length-1,Math.ceil(p*s.length)-1)];
    return {mean:s.reduce((a,b)=>a+b,0)/s.length,median:q(0.5),p90:q(0.9)};
  }
  /* 作法實際會用到的通貨（精髓重鑄：選的那顆精髓，哀嚎以下再加重鑄石） */
  function methodUses(o){
    const m=METHODS.find(x=>x.k===o.method);
    if(o.method!=="essence") return m.uses;
    const e=essByKey[o.essence];
    return e?(e.lv>=5?[e.k]:[e.k,"scour"]):[];
  }
  function summarize(results,uses){
    const success=results.filter(r=>r.ok).length;
    const per={};
    for(const k of uses){
      per[k]=stat(perSuccess(results,r=>r.used[k]||0));
      per[k].total=results.reduce((a,r)=>a+(r.used[k]||0),0);   // 全部（含失敗）總共用掉幾顆
    }
    return {n:results.length,success,rate:results.length?success/results.length:0,per};
  }
  /* 每拿到一件成功品換算成混沌石的總成本；prices：{通貨: 單價}，沒填的算 0 */
  function costStats(results,uses,prices){
    return stat(perSuccess(results,r=>uses.reduce((a,k)=>a+(r.used[k]||0)*(prices[k]||0),0)));
  }

  /* ── 存檔格式：底材存 Metadata 路徑、詞綴存 mod id（不存編號，每季更新資料後也讀得回來） ── */
  function toStored(item){
    return {base:bases[item.b].id,lv:item.lv,r:item.r,mods:item.mods.map(x=>({id:mods[x.m].id,v:x.v.slice()}))};
  }
  const okNum=v=>Array.isArray(v)&&v.every(n=>typeof n==="number"&&isFinite(n));
  const okHead=(lv,r)=>Number.isInteger(lv)&&lv>=1&&lv<=100&&Number.isInteger(r)&&r>=0&&r<=2;
  /* 讀回網頁內部的格式；找不到底材或詞綴（例如改版後被移除）、格式不對就回傳 null */
  function fromStored(s){
    if(!s||typeof s!=="object"||!okHead(s.lv,s.r)||!Array.isArray(s.mods)) return null;
    const b=baseById[s.base]; if(!b) return null;
    const out=[];
    for(const x of s.mods){
      const m=x&&modById[x.id];
      if(!m||!okNum(x.v)) return null;
      out.push({m:m.i,v:x.v.slice()});
    }
    return {b:b.i,lv:s.lv,r:s.r,mods:out};
  }
  /* 舊格式（存檔 v2，用編號記）：用存檔 v2 當時的順序（D.v2，3.29.3.3）把編號換成 id，再對到目前的資料 */
  const V2=D.v2||{b:bases.map(b=>b.id),m:mods.map(m=>m.id)};
  function fromIndexed(s){
    if(!s||typeof s!=="object"||!okHead(s.lv,s.r)||!Array.isArray(s.mods)) return null;
    const b=Number.isInteger(s.b)&&baseById[V2.b[s.b]];
    if(!b) return null;
    const out=[];
    for(const x of s.mods){
      const m=x&&Number.isInteger(x.m)&&modById[V2.m[x.m]];
      if(!m||!okNum(x.v)) return null;
      out.push({m:m.i,v:x.v.slice()});
    }
    return {b:b.i,lv:s.lv,r:s.r,mods:out};
  }

  return {
    data:D, bases, mods, modById, baseById, tagId, NORMAL, MAGIC, RARE, toStored, fromStored, fromIndexed, modName,
    essences, essByKey, curInfo, essenceMod, methodUses, tagLabel, sourceNote,
    bench, benchByKey, benchFor, benchCheck, applyBench, craftLevel, metaOf, craftedCount, maxCrafted, removable,
    make, clone, check, apply, applyMut, pool, poolView, counts, maxSide, tagSet, weightOf,
    tierOf, tierCount, render, modRange, baseName, implicitLines, feasible, runOne, summarize, costStats, isDone, needCount,
  };
}

const API={create, CURRENCIES, CUR, METHODS, RARITY_ZH};
if(typeof module!=="undefined"&&module.exports) module.exports=API;
else root.CraftEngine=API;
})(typeof self!=="undefined"?self:this);
