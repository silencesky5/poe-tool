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
    const old=E.fromIndexed(JSON.parse(JSON.stringify(it)));
    if(JSON.stringify(back)!==JSON.stringify(it)||JSON.stringify(old)!==JSON.stringify(it)) bad++;
  }
  ok(bad===0,"3000 件隨機裝備：新格式存回讀、舊格式轉換，底材、詞綴、數值完全一致");
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

console.log(fail?`\n有 ${fail} 項失敗`:"\n全部通過");
process.exit(fail?1:0);
