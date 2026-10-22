/* 製裝模擬器自我檢查。用法：node tools/test_craft_engine.js */
const fs=require("fs"), path=require("path");
global.window={};
eval(fs.readFileSync(path.join(__dirname,"..","craft-data.js"),"utf8"));
const CE=require(path.join(__dirname,"..","craft-engine.js"));
const E=CE.create(window.CRAFT_DATA);

let fail=0;
const ok=(cond,msg)=>{ console.log((cond?"  通過  ":"  失敗  ")+msg); if(!cond) fail++; };
const baseByName=n=>E.bases.findIndex(b=>b.n===n);

const helm=baseByName("Hubris Circlet");
const ring=baseByName("Two-Stone Ring");
const bow=baseByName("Thicket Bow");
console.log("資料版本",E.data.version,"底材",E.bases.length,"詞綴",E.mods.length);

// 1. 普通物品用混沌石被拒絕
{
  const r=E.apply(E.make(helm,86),"chaos");
  ok(!r.ok&&/普通/.test(r.err),"普通物品用混沌石被拒絕："+r.err);
  // 其他不能用的情況也都不會丟例外
  let threw=false;
  const items=[E.make(helm,86)];
  items.push(E.apply(items[0],"transmute").item, E.apply(items[0],"alch").item);
  for(const it of items) for(const c of CE.CURRENCIES){
    try{ E.apply(it,c.k); }catch(e){ threw=true; console.log(e); }
  }
  ok(!threw,"所有通貨對普通／魔法／稀有物品都不會出錯");
}

// 2. 稀有物品用 1,000 次混沌石
for(const b of [helm,ring,bow]){
  let it=E.apply(E.make(b,86),"alch").item, bad=0, minN=9, maxN=0, groupDup=0;
  for(let i=0;i<1000;i++){
    it=E.apply(it,"chaos").item;
    const c=E.counts(it), n=it.mods.length;
    if(c.p>3||c.s>3) bad++;
    minN=Math.min(minN,n); maxN=Math.max(maxN,n);
    const gs=it.mods.flatMap(x=>E.mods[x.m].gr);
    if(new Set(gs).size!==gs.length) groupDup++;
  }
  ok(bad===0&&minN>=4&&maxN<=6,`${E.bases[b].n}：1000 次混沌石，前後綴都 ≤ 3，詞綴數 ${minN}～${maxN}（Kalandralang：4～6）`);
  ok(groupDup===0,`${E.bases[b].n}：沒有同 group 的兩條詞綴`);
}

// 3. 物品等級 1 不會出現 required_level > 1 的詞綴
{
  let bad=0;
  for(let i=0;i<2000;i++){
    const it=E.apply(E.make(helm,1),"alch").item;
    for(const x of it.mods) if(E.mods[x.m].lv>1) bad++;
  }
  const pv=E.poolView(helm,1);
  ok(bad===0&&pv.rows.every(r=>E.mods[r.m].lv<=1),"物品等級 1：抽到和詞綴池裡都沒有 required_level > 1 的詞綴");
}

// 4. 同一件物品上不會有兩條同 group（改造＋增幅＋富豪＋崇高的路線也測）
{
  let dup=0;
  for(let i=0;i<3000;i++){
    let it=E.make(ring,86);
    for(const k of ["transmute","aug","regal","exalt","exalt","exalt","annul","exalt"]){
      const r=E.apply(it,k); if(r.ok) it=r.item;
    }
    const gs=it.mods.flatMap(x=>E.mods[x.m].gr);
    if(new Set(gs).size!==gs.length) dup++;
  }
  ok(dup===0,"蛻變→增幅→富豪→崇高×3→無效→崇高 3000 次，沒有同 group 詞綴");
}

// 5. 權重為 0 的詞綴在 10,000 次模擬中一次都不出現
{
  const ts=E.bases[helm].ts;
  const zero=new Set(E.mods.filter(m=>E.weightOf(m,ts)===0).map(m=>m.i));
  let seen=0, it=E.apply(E.make(helm,86),"alch").item;
  for(let i=0;i<10000;i++){
    it=E.apply(it,"chaos").item;
    for(const x of it.mods) if(zero.has(x.m)){
      // 詞綴附加的 tag（has_attack_mod 等）可能讓權重改變，所以用當下的 tag 再確認一次
      const others={...it,mods:it.mods.filter(y=>y!==x)};
      if(E.weightOf(E.mods[x.m],E.tagSet(others))===0) seen++;
    }
  }
  ok(seen===0,`權重 0 的詞綴（${zero.size} 條）在 10,000 次混沌石中出現 ${seen} 次`);
}

// 6. 詞綴池機率加總為 100%（前後綴分開）
for(const [b,lv] of [[helm,86],[helm,40],[ring,86],[bow,60]]){
  const pv=E.poolView(b,lv);
  const sp=pv.rows.filter(r=>r.pre).reduce((a,r)=>a+r.pct,0);
  const ss=pv.rows.filter(r=>!r.pre).reduce((a,r)=>a+r.pct,0);
  ok(Math.abs(sp-100)<1e-9&&Math.abs(ss-100)<1e-9,`${E.bases[b].n} ilvl ${lv}：前綴 ${sp.toFixed(6)}%、後綴 ${ss.toFixed(6)}%`);
}

// 其他：魔法物品的詞綴數、tier、文字
{
  const n={1:0,2:0}; let bad=0;
  for(let i=0;i<4000;i++){
    const it=E.apply(E.make(helm,86),"transmute").item;
    n[it.mods.length]++;
    const c=E.counts(it); if(c.p>1||c.s>1) bad++;
  }
  ok(bad===0&&Math.abs(n[1]/4000-0.5)<0.05,`蛻變石：1 條 ${n[1]}、2 條 ${n[2]}（約各半），前後綴各 ≤ 1`);
  const life=E.mods.filter(m=>m.ty==="IncreasedLife"&&E.weightOf(m,E.bases[helm].ts)>0)
    .map(m=>`T${E.tierOf(helm,m.i)} lv${m.lv} ${m.tx}`);
  console.log("  參考  Hubris Circlet 最大生命 tier：\n        "+life.join("\n        "));
  const it=E.apply(E.make(helm,86),"alch").item;
  console.log("  參考  點金後的詞綴：\n        "+it.mods.map(x=>E.render(x.m,x.v).join(" / ")+"  ["+E.mods[x.m].tx.replace(/\n/g," / ")+"]").join("\n        "));
}

// 批次模擬速度
{
  const life=E.mods.find(m=>m.ty==="IncreasedLife"&&m.lv===1);
  const o={b:helm,lv:86,method:"altaug",mode:"all",
    targets:[{ty:"IncreasedLife",g:"p",maxTier:3}],limit:20000};
  ok(!E.feasible(o),"可行性檢查通過");
  const t0=Date.now(), res=[];
  for(let i=0;i<10000;i++) res.push(E.runOne(o,Math.random));
  const s=E.summarize(res,["transmute","alt","aug"]);
  console.log(`  參考  改造＋增幅，生命 T3 以上 ×10000：成功率 ${(s.rate*100).toFixed(1)}%，平均改造 ${s.per.alt.mean.toFixed(1)}、中位數 ${s.per.alt.median}、90% ${s.per.alt.p90}，${Date.now()-t0} ms`);
}

// 點金 4／5／6 條約 8 : 3 : 1（社群推定值，見 craft-engine.js spawnAdditional）
{
  const n={4:0,5:0,6:0};
  for(let i=0;i<24000;i++) n[E.apply(E.make(helm,86),"alch").item.mods.length]++;
  ok(Math.abs(n[4]/24000-8/12)<0.02&&Math.abs(n[5]/24000-3/12)<0.02&&Math.abs(n[6]/24000-1/12)<0.015,
    `點金石：4 條 ${n[4]}、5 條 ${n[5]}、6 條 ${n[6]}（約 8 : 3 : 1）`);
}

// 期望值要把失敗的件數算進去：混沌重抽生命 T1、上限 30 次（盤點報告的例子，約 26 顆）
{
  const o={b:helm,lv:86,method:"chaos",mode:"all",targets:[{ty:"IncreasedLife",g:"p",maxTier:1}],limit:30};
  const res=[]; for(let i=0;i<20000;i++) res.push(E.runOne(o,Math.random));
  const s=E.summarize(res,["alch","chaos"]), c=s.per.chaos;
  const okOnly=res.filter(r=>r.ok).map(r=>r.used.chaos||0);
  const oldMean=okOnly.reduce((a,b)=>a+b,0)/okOnly.length;
  ok(Math.abs(c.mean-c.total/s.success)<1e-9,`平均＝全部用量 ÷ 成功件數（${c.total} ÷ ${s.success} = ${c.mean.toFixed(2)}）`);
  ok(c.mean>23&&c.mean<29,`混沌重抽生命 T1、上限 30：成功率 ${(s.rate*100).toFixed(1)}%，期望 ${c.mean.toFixed(1)} 顆（舊算法只算成功的：${oldMean.toFixed(1)}），中位數 ${c.median}、90% ${c.p90}`);
  const cost=E.costStats(res,["alch","chaos"],{alch:0.5,chaos:1});
  ok(Math.abs(cost.mean-(s.per.alch.total*0.5+c.total)/s.success)<1e-9,`總成本平均＝全部花費 ÷ 成功件數（${cost.mean.toFixed(2)}）`);
  // 全部成功時和舊算法一樣
  const all=[{ok:true,used:{chaos:3}},{ok:true,used:{chaos:5}}];
  ok(E.summarize(all,["chaos"]).per.chaos.mean===4,"全部成功時，平均和舊算法相同");
  ok(E.summarize([{ok:false,used:{chaos:30}}],["chaos"]).per.chaos.mean===0,"全部失敗時不會出錯");
}

// 存檔格式：底材存 Metadata 路徑、詞綴存 mod id；舊格式（編號）轉過去內容完全一樣
{
  ok(E.bases.every(b=>/^Metadata\/Items\//.test(b.id))&&new Set(E.bases.map(b=>b.id)).size===E.bases.length,"每個底材都有唯一的 Metadata id");
  ok(new Set(E.mods.map(m=>m.id)).size===E.mods.length,"每條詞綴都有唯一的 id");
  let bad=0;
  for(let i=0;i<3000;i++){
    const b=Math.floor(Math.random()*E.bases.length);
    let it=E.make(b,1+Math.floor(Math.random()*86));
    it=E.apply(it,["transmute","alch"][i%2]).item;
    if(i%3===0) it=E.apply(it,"exalt").item;
    const st=E.toStored(it), back=E.fromStored(JSON.parse(JSON.stringify(st)));
    // 同一件裝備用 v2 當時的編號記（D.v2 的順序），轉回來要一模一樣
    const v2=E.data.v2, asV2={b:v2.b.indexOf(E.bases[it.b].id),lv:it.lv,r:it.r,mods:it.mods.map(x=>({m:v2.m.indexOf(E.mods[x.m].id),v:x.v.slice()}))};
    const old=E.fromIndexed(JSON.parse(JSON.stringify(asV2)));
    if(JSON.stringify(back)!==JSON.stringify(it)||JSON.stringify(old)!==JSON.stringify(it)) bad++;
  }
  ok(bad===0,"3000 件隨機裝備：新格式存回讀、舊格式（v2 編號）轉換，底材、詞綴、數值完全一致");
  // 固定的 v2 存檔樣本（tools/fixtures/save_v2_sample.json，當時的格式）：內容要對得上當時寫下的 id
  const fx=JSON.parse(fs.readFileSync(path.join(__dirname,"fixtures","save_v2_sample.json"),"utf8"));
  let fxBad=0;
  for(const e of fx.inventory.concat(...fx.tabs.map(t=>t.items))){
    const it=E.fromIndexed(e.item), want=fx.expect[e.id];
    if(!it||E.bases[it.b].id!==want.base||JSON.stringify(it.mods.map(x=>[E.mods[x.m].id,x.v]))!==JSON.stringify(want.mods)) fxBad++;
  }
  ok(fxBad===0,"v2 存檔樣本（6 件）：資料多了精髓詞綴、編號位移後，仍然轉回原本的底材和詞綴");
  ok(E.data.v2.m.length===1096&&E.data.v2.b.length===666,"v2 編號對照表：底材 666、詞綴 1096（3.29.3.3 當時）");
  // v3 存檔樣本（記 id）：每件都讀得回來，而且和 v2 樣本轉出來的一樣
  const f3=JSON.parse(fs.readFileSync(path.join(__dirname,"fixtures","save_v3_sample.json"),"utf8"));
  let v3Bad=0;
  for(const e of f3.inventory.concat(...f3.tabs.map(t=>t.items))){
    const it=E.fromStored(e.item), want=fx.expect[e.id];
    if(!it||E.bases[it.b].id!==want.base||JSON.stringify(it.mods.map(x=>[E.mods[x.m].id,x.v]))!==JSON.stringify(want.mods)) v3Bad++;
  }
  ok(v3Bad===0,"v3 存檔樣本（6 件）讀取正常：底材、詞綴、數值都對");
  ok(E.fromStored({base:"Metadata/Items/不存在",lv:80,r:0,mods:[]})===null&&
     E.fromStored({base:E.bases[helm].id,lv:80,r:1,mods:[{id:"不存在的詞綴",v:[1]}]})===null,"找不到的底材或詞綴回傳 null（不會讀成別的東西）");
}

// 詞綴中文名稱
{
  const miss=E.mods.filter(m=>!m.nz||m.nz===m.n).length;
  const frosted=E.mods.find(m=>m.n==="Frosted");
  ok(miss===0&&E.modName(frosted.i,"zh")==="結霜的"&&E.modName(frosted.i,"en")==="Frosted",
    `詞綴中文名稱：缺 ${miss} 條；Frosted → ${E.modName(frosted.i,"zh")}`);
}

// ── 精髓 ──
{
  const ILR={1:35,2:45,3:60,4:75};   // 低語、呢喃、啼泣、哀嚎：其他隨機詞綴的最高等級（poewiki Essence）
  const classes=[...new Set(E.bases.map(b=>b.c))];
  const baseOf=c=>E.bases.filter(b=>b.c===c).slice(-1)[0].i;   // 每個類別取掉落等級最高的底材
  ok(E.essences.length===105,`精髓 ${E.essences.length} 種（RePoE 106 筆，扣掉沒有詞綴的遺忘的污染器皿）`);
  ok(E.essences.every(e=>e.nz&&e.nz!==e.n),"每顆精髓都有中文名稱");
  ok(E.essences.every(e=>e.lv>=1&&e.lv<=4?e.ilr===ILR[e.lv]:e.lv===0?e.ilr===15:!e.ilr),
    "低階精髓的隨機詞綴等級上限：低語 35、呢喃 45、啼泣 60、哀嚎 75；咆哮以上和腐化精髓不限（荒蕪精髓 15）");
  let missG=0, overLv=0, badCnt=0, badSide=0, dupG=0, uses=0, rareBad=0, rareOk=0, magicBad=0, noClass=0;
  for(const e of E.essences){
    for(const c of classes){
      const b=baseOf(c);
      if(e.m[c]===undefined){ if(!E.check(E.make(b,86),e.k)) noClass++; continue; }
      for(const lv of [86,40]){
        for(let i=0;i<25;i++){
          const r=E.apply(E.make(b,lv),e.k); uses++;
          if(!r.ok){ missG++; continue; }
          const it=r.item, g=E.essenceMod(it,e);
          if(it.r!==E.RARE||!it.mods.some(x=>x.m===g)) missG++;
          const cap=Math.min(lv,e.ilr||99);
          for(const x of it.mods) if(x.m!==g&&E.mods[x.m].lv>cap) overLv++;
          if(it.mods.length>6) badCnt++;
          const cc=E.counts(it); if(cc.p>3||cc.s>3) badSide++;
          const gs=it.mods.flatMap(x=>E.mods[x.m].gr); if(new Set(gs).size!==gs.length) dupG++;
          // 稀有物品再用一次：咆哮以上可以重鑄，哀嚎以下（和荒蕪精髓）要被拒絕
          const again=E.apply(it,e.k);
          if(e.lv>=5){ if(again.ok&&again.item.mods.some(x=>x.m===g)) rareOk++; else rareBad++; }
          else if(again.ok) rareBad++;
        }
      }
      // 魔法物品一律拒絕
      if(!E.check(E.apply(E.make(b,86),"transmute").item,e.k)) magicBad++;
    }
  }
  ok(missG===0,`105 種精髓 × 每個可用類別 × 物品等級 86／40 × 25 次（共 ${uses} 次）：保證詞綴每次都出現、物品變稀有`);
  ok(overLv===0,`其他隨機詞綴都不超過「物品等級」和「精髓等級上限」（超過 ${overLv} 次）`);
  ok(badCnt===0&&badSide===0&&dupG===0,`詞綴數 ≤ 6、前後綴各 ≤ 3、沒有同 group（違反 ${badCnt}／${badSide}／${dupG}）`);
  ok(rareBad===0&&rareOk>0,`稀有物品：咆哮以上重鑄成功並保留保證詞綴（${rareOk} 次）；哀嚎以下被拒絕（錯 ${rareBad} 次）`);
  ok(magicBad===0,"魔法物品用精髓一律被拒絕");
  ok(noClass===0,"資料裡沒有保證詞綴的類別（例如符文匕首、戰杖）會被拒絕");
  const w=E.essences.find(e=>e.n==="Wailing Essence of Greed"), s=E.essences.find(e=>e.n==="Screaming Essence of Greed");
  const rare=E.apply(E.make(helm,86),"alch").item;
  ok(/低階精髓/.test(E.check(rare,w.k)||"")&&!E.check(rare,s.k),"哀嚎精髓用在稀有物品被拒絕（附原因），咆哮精髓可以");
  // 精髓重鑄的批次模擬：保證詞綴的類型一定中
  const g=E.mods[E.essenceMod(E.make(helm,86),s)];
  const o={b:helm,lv:86,method:"essence",essence:s.k,mode:"all",targets:[{ty:g.ty,g:g.g,maxTier:E.tierOf(helm,g.i)}],limit:100};
  ok(!E.feasible(o),"精髓重鑄的可行性檢查通過");
  const res=[]; for(let i=0;i<200;i++) res.push(E.runOne(o,Math.random));
  ok(res.every(r=>r.ok&&r.used[s.k]===1),"目標＝精髓保證的詞綴：每件第一次就中，只用 1 顆精髓");
  // 找一類 T1 需求等級超過 75 的詞綴（和哀嚎精髓的保證詞綴不同類）
  const hi=E.poolView(helm,86).rows.find(r=>r.tier===1&&E.mods[r.m].lv>75&&E.mods[r.m].ty!==E.mods[E.essenceMod(E.make(helm,86),w)].ty);
  const wo={...o,essence:w.k,targets:[{ty:E.mods[hi.m].ty,g:E.mods[hi.m].g,maxTier:1}]};
  ok(/低階精髓/.test(E.feasible(wo)||"")&&!E.feasible({...wo,essence:s.k}),
    `哀嚎精髓的隨機詞綴最高 75 級：要求 ${E.mods[hi.m].id}（T1，${E.mods[hi.m].lv} 級）時被擋下並說明原因；咆哮精髓可以`);
  ok(JSON.stringify(E.methodUses({method:"essence",essence:w.k}))===JSON.stringify([w.k,"scour"])&&
     JSON.stringify(E.methodUses({method:"essence",essence:s.k}))===JSON.stringify([s.k]),"哀嚎以下的精髓重鑄＝重鑄石＋精髓；咆哮以上直接重鑄");
}

// ── 工藝台＋元工藝 ──
{
  const META={PL:"StrMasterItemGenerationCannotChangePrefixes",SL:"DexMasterItemGenerationCannotChangeSuffixes",
    NA:"IntMasterItemGenerationCannotRollAttackAffixes",NC:"StrDexMasterItemGenerationCannotRollCasterAffixes",
    MM:"StrIntMasterItemGenerationCanHaveMultipleCraftedMods"};
  const N=400;
  const mid=id=>E.modById[id].i;
  // 用指定的詞綴組一件物品（數值取最小值）
  const build=(b,r,list)=>({b,lv:86,r,mods:list.map(m=>({m,v:E.mods[m].st.map(s=>Math.min(s[1],s[2]))}))});
  const craft=(it,k)=>{ const r=E.applyBench(it,k); if(!r.ok) throw new Error(k+"："+r.err); return r.item; };
  const has=(it,m)=>it.mods.some(x=>x.m===m);
  const pre=it=>it.mods.filter(x=>E.mods[x.m].pre), suf=it=>it.mods.filter(x=>!E.mods[x.m].pre);
  // 測試用底材：權杖（同時有 attack、caster 詞綴）
  const sc=E.bases.filter(b=>b.c==="Sceptre").slice(-1)[0].i;
  const pv=E.poolView(sc,86).rows.map(r=>E.mods[r.m]);
  const pick=(f)=>pv.find(f).i;
  const P1=pick(m=>m.pre&&!m.atk&&!m.cst), P2=pick(m=>m.pre&&!m.atk&&!m.cst&&!E.mods[P1].gr.some(g=>m.gr.includes(g)));
  const S1=pick(m=>!m.pre&&!m.atk&&!m.cst);
  const PA=pick(m=>m.pre&&m.atk), PC=pick(m=>m.pre&&m.cst&&!m.atk);
  console.log("  參考  測試底材 "+E.bases[sc].n+"；攻擊前綴 "+E.mods[PA].id+"，法術前綴 "+E.mods[PC].id);
  const times=(f)=>{ let n=0; for(let i=0;i<N;i++) if(f()) n++; return n; };

  // 工藝台基本規則
  {
    const life=E.bench.find(o=>o.a==="add"&&o.cs.has("Sceptre")&&E.mods[o.m].pre&&!E.mods[o.m].meta&&!E.mods[o.m].gr.some(g=>E.mods[P1].gr.includes(g)));
    const res=E.bench.find(o=>o.a==="add"&&o.cs.has("Sceptre")&&!E.mods[o.m].pre&&!E.mods[o.m].meta&&!E.mods[o.m].gr.some(g=>E.mods[S1].gr.includes(g)));
    const rare=build(sc,E.RARE,[P1,S1]);
    const one=craft(rare,life.k);
    ok(has(one,life.m)&&E.craftedCount(one)===1,"工藝台：稀有物品加 1 條工藝詞綴");
    const two=E.applyBench(one,res.k);
    ok(two.ok&&two.replace&&!has(two.item,life.m)&&has(two.item,res.m)&&two.cost.scour===(res.c.scour||0)+1,
      "已經有 1 條工藝詞綴時再做＝取代那一條，多花 1 顆重鑄石");
    const mm=craft(rare,META.MM);
    const three=craft(craft(mm,life.k),res.k);
    ok(E.craftedCount(three)===3&&E.maxCrafted(three)===3,"有「可以有 3 條工藝詞綴」：最多 3 條（這條本身也算）");
    const four=E.bench.find(o=>o.a==="add"&&o.cs.has("Sceptre")&&E.benchCheck(three,o).err===null);
    ok(!four,"已經 3 條工藝詞綴時，其他選項都不能做（不能取代）");
    const sameGroup=E.bench.find(o=>o.a==="add"&&o.cs.has("Sceptre")&&E.mods[o.m].gr.some(g=>E.mods[P1].gr.includes(g)));
    ok(!sameGroup||/同一類/.test(E.benchCheck(rare,sameGroup).err||""),"和身上詞綴同群組的工藝詞綴不能做");
    const full=build(sc,E.RARE,[P1,P2,PA,S1]);
    ok(/前綴已經滿了/.test(E.benchCheck(full,life).err||""),"那一邊滿了就不能做");
    const normal=craft(E.make(sc,86),life.k);
    ok(normal.r===E.MAGIC&&has(normal,life.m),"普通物品做工藝詞綴會變成魔法物品（照 Kalandralang）");
    const rm=E.applyBench(three,"remove_crafted");
    ok(rm.ok&&E.craftedCount(rm.item)===0&&rm.cost.scour===1&&has(rm.item,P1)&&has(rm.item,S1),"移除工藝詞綴：全部工藝詞綴（含元工藝）拿掉，一般詞綴保留，花 1 顆重鑄石");
    ok(E.bench.filter(o=>o.a==="reroll").length===2&&E.bench.filter(o=>o.a==="reroll").every(o=>/待確認/.test(E.benchCheck(rare,o).err)),
      "3.29 新增的「重抽 3 條／1 條詞綴」有列出，但規則待確認、不能用");
    const fee=E.bench.find(o=>o.k===META.PL);
    ok(fee&&fee.c.divine===2&&E.bench.find(o=>o.k===META.NA).c.divine===1&&E.bench.find(o=>o.k==="remove_crafted").c.scour===1,"費用照 RePoE：鎖前綴 2 神聖石、不能骰出攻擊 1 神聖石、移除工藝詞綴 1 重鑄石");
    const st=E.toStored(three), back=E.fromStored(JSON.parse(JSON.stringify(st)));
    ok(JSON.stringify(back)===JSON.stringify(three)&&st.mods.some(x=>x.id===META.MM),"存檔（v3）能存工藝詞綴和元工藝，讀回來完全一樣");
  }

  // poewiki 元工藝對照表：每一格
  const cell=(cur,col,cond,desc)=>ok(cond,`${cur} × ${col}：${desc}`);
  // 改造石（魔法物品）
  {
    const it=craft(build(sc,E.MAGIC,[P1]),META.PL);          // 前綴 P1＋後綴「前綴不能被改變」
    cell("改造石","前綴不能被改變",times(()=>has(E.apply(it,"alt").item,P1))===N,"遵守：原本的前綴一定留著");
    const open=craft(build(sc,E.MAGIC,[]),META.SL);           // 只有前綴「後綴不能被改變」：後綴是空的
    const it2=craft(build(sc,E.MAGIC,[S1]),META.SL);          // 後綴 S1＋前綴「後綴不能被改變」
    cell("改造石","後綴不能被改變",times(()=>has(E.apply(it2,"alt").item,S1))===N,"遵守：原本的後綴一定留著");
    cell("改造石","後綴不能被改變",times(()=>suf(E.apply(open,"alt").item).length>0)>0,"空著的後綴可能被補上");
    const open2=craft(build(sc,E.MAGIC,[]),META.PL);
    cell("改造石","前綴不能被改變",times(()=>pre(E.apply(open2,"alt").item).length>0)>0,"空著的前綴可能被補上");
    const na=craft(build(sc,E.MAGIC,[]),META.NA), nc=craft(build(sc,E.MAGIC,[]),META.NC);
    cell("改造石","不能骰出攻擊／法術",E.apply(na,"alt").ok&&!E.apply(na,"alt").item.mods.some(x=>E.mods[x.m].meta)&&E.apply(nc,"alt").ok,
      "—（沒有特別作用；元工藝本身是後綴，會被洗掉）");
  }
  // 增幅石、富豪石（魔法物品）
  for(const [k,zh] of [["aug","增幅石"],["regal","富豪石"]]){
    const na=craft(build(sc,E.MAGIC,[]),META.NA), nc=craft(build(sc,E.MAGIC,[]),META.NC);
    cell(zh,"不能骰出攻擊詞綴",times(()=>E.apply(na,k).item.mods.every(x=>!E.mods[x.m].atk))===N,"遵守：新詞綴不會有攻擊詞綴");
    cell(zh,"不能骰出法術詞綴",times(()=>E.apply(nc,k).item.mods.every(x=>!E.mods[x.m].cst))===N,"遵守：新詞綴不會有法術詞綴");
    const pl=craft(build(sc,E.MAGIC,[]),META.PL), sl=craft(build(sc,E.MAGIC,[]),META.SL);
    cell(zh,"前綴／後綴不能被改變",E.apply(pl,k).ok&&E.apply(sl,k).ok,"—（照常加詞綴）");
  }
  // 重鑄石
  {
    const it=craft(build(sc,E.RARE,[P1,P2,S1]),META.PL);
    const r=E.apply(it,"scour").item;
    cell("重鑄石","前綴不能被改變",has(r,P1)&&has(r,P2)&&!suf(r).length&&r.r===E.RARE,"遵守：前綴留著、後綴（含元工藝）洗掉；剩 2 條前綴仍是稀有");
    const it1=craft(build(sc,E.RARE,[P1,S1]),META.PL);
    cell("重鑄石","前綴不能被改變",E.apply(it1,"scour").item.r===E.MAGIC,"剩 1 條前綴時變成魔法物品（照 Kalandralang）");
    const it2=craft(build(sc,E.RARE,[P1,S1]),META.SL);
    const r2=E.apply(it2,"scour").item;
    cell("重鑄石","後綴不能被改變",has(r2,S1)&&!pre(r2).length,"遵守：後綴留著、前綴（含元工藝）洗掉");
    // 「不能骰出攻擊」要和「後綴不能被改變」同時存在才留得住，所以加「可以有 3 條工藝詞綴」
    const it3=craft(craft(craft(build(sc,E.RARE,[PA,PC]),META.MM),META.SL),META.NA);
    cell("重鑄石","不能骰出攻擊詞綴",!has(E.apply(it3,"scour").item,PA),"忽略：攻擊前綴照樣被洗掉");
    const it4=craft(craft(craft(build(sc,E.RARE,[PA,PC]),META.MM),META.SL),META.NC);
    cell("重鑄石","不能骰出法術詞綴",!has(E.apply(it4,"scour").item,PC),"忽略：法術前綴照樣被洗掉");
  }
  // 神聖石
  {
    const it=craft(build(sc,E.RARE,[P1,P2,S1]),META.PL);
    const vs=pre(it).map(x=>JSON.stringify(x.v)).join();
    let sChanged=0;
    const pKept=times(()=>{ const r=E.apply(it,"divine").item;
      if(JSON.stringify(r.mods.find(x=>x.m===S1).v)!==JSON.stringify(it.mods.find(x=>x.m===S1).v)) sChanged++;
      return pre(r).map(x=>JSON.stringify(x.v)).join()===vs; });
    cell("神聖石","前綴不能被改變",pKept===N&&sChanged>0,"遵守：前綴數值不變，後綴數值會重骰");
    const it2=craft(build(sc,E.RARE,[P1,S1]),META.SL);
    const sv=JSON.stringify(it2.mods.find(x=>x.m===S1).v);
    cell("神聖石","後綴不能被改變",times(()=>JSON.stringify(E.apply(it2,"divine").item.mods.find(x=>x.m===S1).v)===sv)===N,"遵守：後綴數值不變");
    const na=craft(build(sc,E.RARE,[P1,S1]),META.NA);
    cell("神聖石","不能骰出攻擊／法術",E.apply(na,"divine").ok,"—（照常重骰）");
  }
  // 混沌石
  {
    const it=craft(build(sc,E.RARE,[P1,S1]),META.PL);
    cell("混沌石","前綴不能被改變",times(()=>has(E.apply(it,"chaos").item,P1))===N,"遵守：原本的前綴一定留著");
    cell("混沌石","前綴不能被改變",times(()=>pre(E.apply(it,"chaos").item).length>1)>0,"空著的前綴可能被補上");
    const it2=craft(build(sc,E.RARE,[P1,S1]),META.SL);
    cell("混沌石","後綴不能被改變",times(()=>has(E.apply(it2,"chaos").item,S1))===N,"遵守：原本的後綴一定留著");
    cell("混沌石","後綴不能被改變",times(()=>suf(E.apply(it2,"chaos").item).length>1)>0,"空著的後綴可能被補上");
    const withSL=craft(craft(craft(build(sc,E.RARE,[]),META.MM),META.SL),META.NA);
    cell("混沌石","不能骰出攻擊詞綴",times(()=>E.apply(withSL,"chaos").item.mods.every(x=>!E.mods[x.m].atk))===N,"搭配「後綴不能被改變」：新詞綴不會有攻擊詞綴");
    const alone=craft(build(sc,E.RARE,[]),META.NA);
    cell("混沌石","不能骰出攻擊詞綴",times(()=>E.apply(alone,"chaos").item.mods.some(x=>E.mods[x.m].atk))>0,"單獨存在時沒作用（它是後綴，先被洗掉）");
    const withSL2=craft(craft(craft(build(sc,E.RARE,[]),META.MM),META.SL),META.NC);
    cell("混沌石","不能骰出法術詞綴",times(()=>E.apply(withSL2,"chaos").item.mods.every(x=>!E.mods[x.m].cst))===N,"搭配「後綴不能被改變」：新詞綴不會有法術詞綴");
    const alone2=craft(build(sc,E.RARE,[]),META.NC);
    cell("混沌石","不能骰出法術詞綴",times(()=>E.apply(alone2,"chaos").item.mods.some(x=>E.mods[x.m].cst))>0,"單獨存在時沒作用");
  }
  // 無效石
  {
    const it=craft(build(sc,E.RARE,[P1,P2,S1]),META.PL);
    cell("無效石","前綴不能被改變",times(()=>{ const r=E.apply(it,"annul").item; return has(r,P1)&&has(r,P2); })===N,"遵守：前綴不會被拿掉");
    const it2=craft(build(sc,E.RARE,[P1,S1]),META.SL);
    cell("無效石","後綴不能被改變",times(()=>has(E.apply(it2,"annul").item,S1))===N,"遵守：後綴不會被拿掉");
    const it3=craft(build(sc,E.RARE,[PA,P1,S1]),META.NA);
    cell("無效石","不能骰出攻擊詞綴",times(()=>has(E.apply(it3,"annul").item,PA))===N,"遵守：攻擊詞綴不會被拿掉");
    cell("無效石","不能骰出攻擊詞綴",times(()=>!E.apply(it3,"annul").item.mods.some(x=>E.mods[x.m].meta))>0,"元工藝本身不是攻擊詞綴，可能被拿掉");
    const it4=craft(build(sc,E.RARE,[PC,P1,S1]),META.NC);
    cell("無效石","不能骰出法術詞綴",times(()=>has(E.apply(it4,"annul").item,PC))===N,"遵守：法術詞綴不會被拿掉");
    const locked=craft(craft(craft(build(sc,E.RARE,[P1]),META.MM),META.PL),META.SL);
    cell("無效石","前綴＋後綴都不能被改變",/元工藝保護/.test(E.check(locked,"annul")||""),"全部受保護時拒絕並說明原因");
  }
  // 崇高石
  {
    const it=craft(build(sc,E.RARE,[P1,S1]),META.PL);
    cell("崇高石","前綴不能被改變",times(()=>{ const r=E.apply(it,"exalt").item; return has(r,P1)&&has(r,S1); })===N&&times(()=>pre(E.apply(it,"exalt").item).length>1)>0,"遵守（原本的都留著），空著的前綴可能被補上");
    const it2=craft(build(sc,E.RARE,[P1,S1]),META.SL);
    cell("崇高石","後綴不能被改變",times(()=>{ const r=E.apply(it2,"exalt").item; return has(r,P1)&&has(r,S1); })===N&&times(()=>suf(E.apply(it2,"exalt").item).length>1)>0,"遵守（原本的都留著），空著的後綴可能被補上");
    const na=craft(build(sc,E.RARE,[P1,S1]),META.NA), nc=craft(build(sc,E.RARE,[P1,S1]),META.NC);
    cell("崇高石","不能骰出攻擊詞綴",times(()=>E.apply(na,"exalt").item.mods.every(x=>!E.mods[x.m].atk))===N,"遵守：新詞綴不會有攻擊詞綴");
    cell("崇高石","不能骰出法術詞綴",times(()=>E.apply(nc,"exalt").item.mods.every(x=>!E.mods[x.m].cst))===N,"遵守：新詞綴不會有法術詞綴");
  }
  // 精髓：有任何元工藝都不能用
  {
    const ess=E.essences.find(e=>e.lv===7&&e.m.Sceptre!==undefined);
    const bad=Object.values(META).filter(id=>!/元工藝/.test(E.check(craft(build(sc,E.RARE,[P1,S1]),id),ess.k)||""));
    cell("精髓","全部 5 種元工藝",bad.length===0,"不能使用（附原因）");
  }
  // 顯示
  {
    const res=E.bench.find(o=>o.a==="add"&&o.cs.has("Sceptre")&&!E.mods[o.m].pre&&!E.mods[o.m].meta);
    ok(E.tagLabel(sc,mid(META.PL))==="後 元工藝"&&E.tagLabel(sc,res.m)==="後 工藝"&&/^前 T\d+$/.test(E.tagLabel(sc,P1)),"標籤：元工藝「後 元工藝」、工藝詞綴「後 工藝」、一般詞綴「前 T#」");
    const focus=E.mods.filter(m=>m.d==="c"&&/Focus/.test(m.id));
    const en=focus.filter(m=>E.modRange(m.i,"zh").join()===m.tx.split("\n").join());
    ok(en.length===34&&en.every(m=>m.tx),`「專注時」工藝詞綴 ${focus.length} 條，其中 ${en.length} 條沒有中文翻譯：中文介面先顯示英文（不會變成空白）`);
  }
}

// ── 精髓倉庫頁：照遊戲資料 EssenceStashTabLayout 的位置 ──
{
  const T=E.data.essTab, L=JSON.parse(fs.readFileSync(path.join(__dirname,"..","img","craft","stash_layouts.json"),"utf8")).stash_page_D;
  const G=JSON.parse(fs.readFileSync(path.join(__dirname,"stash_layout_game.json"),"utf8"));
  ok(T&&Object.keys(T.slots).length===104&&T.generic.length===4,"精髓頁排列表：104 種精髓有專屬格、4 個通用格（遊戲資料共 109 格，含中間大格）");
  const all=[...Object.values(T.slots),...T.generic];
  ok(new Set(all).size===all.length&&all.every(i=>L.slots.some(s=>s.i===i&&!s.big)),"每一格都對到背景圖上不同的小格，不重複、不佔用中間大格");
  const noSlot=E.essences.filter(e=>T.slots[e.id]===undefined).map(e=>e.n);
  ok(noSlot.length===1&&noSlot[0]==="Essence of Desolation","遊戲排列表裡沒有專屬格的只有荒蕪精髓（放在通用格）");
  // 同一列（同一種精髓）y 相同；左側區塊的高階在外側（左），右側區塊的高階在外側（右）
  const x=id=>L.slots.find(s=>s.i===T.slots[id]).x, y=id=>L.slots.find(s=>s.i===T.slots[id]).y;
  const C="Metadata/Items/Currency/CurrencyEssence";
  const greed=[1,2,3,4,5,6,7].map(n=>C+"Greed"+n), envy=[1,2,3].map(n=>C+"Envy"+n);
  ok(greed.every(id=>Math.abs(y(id)-y(greed[0]))<5)&&greed.every((id,i)=>!i||x(id)<x(greed[i-1])),"貪婪（7 階）同一列；低語在最靠中間、破空在最左邊（遊戲資料）");
  ok(envy.every(id=>Math.abs(y(id)-y(envy[0]))<5)&&envy.every((id,i)=>!i||x(id)>x(envy[i-1]))&&x(envy[0])>L.width/2,"忌妒（3 階）在右側短區塊同一列；咆哮在左、破空在最右（遊戲資料）");
  const corr=["Hysteria1","Insanity1","Horror1","Delirium1"].map(n=>C+n);
  ok(corr.every(id=>x(id)>L.width*0.7&&y(id)>L.height*0.45),"腐化精髓 4 種在右下");
  ok(G.essence.length===109&&G.patch===E.data.version,"排列表的遊戲版本和資料版本一致（"+G.patch+"）");
}

// ── 通貨倉庫頁「一般」：官方 3.29 美術圖＋遊戲資料 CurrencyStashTabLayout ──
{
  const T=E.data.curTab, G=JSON.parse(fs.readFileSync(path.join(__dirname,"stash_layout_game.json"),"utf8"));
  const raw=G.currency.filter(r=>r.group===0||r.group===3);
  ok(T&&fs.existsSync(path.join(__dirname,"..","img","craft",T.bg)),"通貨頁背景：官方美術圖 "+(T&&T.bg)+" 存在");
  ok(T.slots.length===raw.length&&T.slots.length===67,`格子數＝遊戲資料 SlotGroup 0＋3（${T.slots.length} 格：通貨 52、大格 1、通用格 14）`);
  ok(T.slots.filter(s=>s.hide).length===raw.filter(r=>r.group===0&&!r.show).length,`隱藏格（ShowIfEmpty＝否）${T.slots.filter(s=>s.hide).length} 格有標記`);
  const pos=k=>T.slots.filter(s=>s.k===k);
  ok(CE.CURRENCIES.every(c=>pos(c.k).length===1&&!pos(c.k)[0].hide),"模擬器的 10 顆通貨在通貨頁各有 1 個格子，而且不是隱藏格");
  const meta={transmute:"CurrencyUpgradeToMagic",alt:"CurrencyRerollMagic",annul:"CurrencyRemoveMod",exalt:"CurrencyAddModToRare",regal:"CurrencyUpgradeMagicToRare",
    alch:"CurrencyUpgradeToRare",chaos:"CurrencyRerollRare",aug:"CurrencyAddModToMagic",divine:"CurrencyModValues",scour:"CurrencyConvertToNormal"};
  const k=G.currencyArt.k, tx=G.currencyArt.tx, ty=G.currencyArt.ty;
  const okPos=Object.entries(meta).every(([key,m])=>{ const r=raw.find(x=>x.item==="Metadata/Items/Currency/"+m&&x.show); const s=pos(key)[0];
    return r&&Math.abs(s.x-(k*r.x+tx))<k*85*0.2&&Math.abs(s.y-(k*r.y+ty))<k*85*0.2; });
  ok(okPos,"10 顆通貨的位置和遊戲資料的座標一致（換算後誤差 < 0.2 格）");
  // 大格（CraftingSlot）按資料是 2×4 格，換算後下緣會碰到通用格；網頁不畫它（美術圖上的框比較短），所以不列入
  const vis=T.slots.filter(s=>!s.hide&&s.kind!=="craft");
  let overlap=0;
  for(let i=0;i<vis.length;i++) for(let j=i+1;j<vis.length;j++){ const a=vis[i],b=vis[j];
    if(a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h) overlap++; }
  ok(overlap===0&&vis.every(s=>s.x>=0&&s.y>=0&&s.x+s.w<=T.w&&s.y+s.h<=T.h),"顯示的格子（通貨格、通用格）互不重疊，都在美術圖範圍內");
  ok(T.slots.filter(s=>s.kind==="item"&&!s.hide).every(s=>s.k&&(CE.CUR[s.k]||E.data.decor[s.k])),"每個會顯示的通貨格都有對應的通貨或擺設（名稱、圖示）");
  ok(["scrollfrag","wisdom","vaal","chance","mirror","fracture","binding"].every(d=>pos(d).length===1),"原本的擺設通貨（卷軸碎片、瓦爾寶珠等）都還在");
}

console.log(fail?`\n有 ${fail} 項失敗`:"\n全部通過");
process.exit(fail?1:0);
