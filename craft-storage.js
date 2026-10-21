/* 製裝模擬器的存檔。模擬器只透過這支存取資料，不要直接碰 localStorage 或 Worker。

   CraftStorage.load(opts)    → Promise<data | null>（opts.refresh = 去雲端拿最新的）
   CraftStorage.save(data)    → 立刻存一份在這台電腦；登入時 2 秒沒有新改動才上傳雲端
   CraftStorage.status()      → { loggedIn, user, sync, notice, localAvailable }
   CraftStorage.login()       → 前往 Discord 登入
   CraftStorage.logout()      → Promise

   存檔是「一整個物件」，製裝台和模擬器共用。各自只改自己的欄位、其他欄位原樣保留：
     const cur = (await CraftStorage.load()) || {};
     CraftStorage.save({ ...cur, prices });                          // 模擬器：通貨單價
     CraftStorage.save({ ...cur, v: 2, inventory, tabs, … });         // 製裝台：倉庫和背包
   load() 回傳這台目前的版本、不連雲端，所以另一台電腦改過時，下次存檔會跳出衝突視窗讓使用者選；
   要拿雲端最新的用 load({ refresh: true })。

   狀態改變時會發出 window 事件 "craftstorage:status"（detail = status()）；
   選了「用雲端的」存檔時會發出 "craftstorage:data"（detail = 新的 data），畫面要重新顯示。

   未登入：存在 localStorage（poeCraftStash）。
   已登入：存在雲端（Cloudflare Worker），localStorage 留一份備份。
   這支要在分頁切換的程式之前載入：登入後網址的 #craft&login=… 要先清掉。 */
(function(){
"use strict";

const API = "https://poe-tool-auth.poe-tool-auth.workers.dev";
const KEY = "poeCraftStash";          // { data }
const META = "poeCraftStashMeta";    // { uid, base, dirty }：雲端版本與是否有還沒上傳的改動
const AUTH = "poeCraftAuth";         // 登入 token
const DEBOUNCE_MS = 2000;
const KEEPALIVE_MAX = 60 * 1024;     // 關閉頁面時用 keepalive 送出的上限

/* ── localStorage：一律包 try/catch，不能用時只提示，不讓頁面壞掉 ── */
const store = {
  ok: true,
  get(k){ try{ return localStorage.getItem(k); }catch(e){ this.ok=false; return null; } },
  set(k,v){ try{ localStorage.setItem(k,v); return true; }catch(e){ this.ok=false; return false; } },
  del(k){ try{ localStorage.removeItem(k); }catch(e){} },
  getJSON(k){ try{ return JSON.parse(this.get(k)); }catch(e){ return null; } },
  setJSON(k,v){ return this.set(k, JSON.stringify(v)); },
};
(function probe(){
  try{ localStorage.setItem("__poeCraftProbe","1"); localStorage.removeItem("__poeCraftProbe"); }
  catch(e){ store.ok=false; }
})();

let token = store.get(AUTH);
let user = null;           // { id, name, avatar }
let sync = "local";        // local / syncing / synced / error
let notice = null;         // not_member、no_role、denied、bad_state、expired、offline、too_large…
let freshLogin = false;
let timer = null;
let pending = undefined;   // 還沒上傳的資料
let cache = undefined;     // 登入時，這台目前的整份存檔（undefined = 這次開頁還沒跟雲端讀過）
let flushing = null;

/* ── 1. 登入回來：從網址取出 token 或錯誤代碼，立刻清掉 ── */
(function readHash(){
  const h = location.hash.slice(1);
  if(!/^craft&/.test(h)) return;
  const p = new URLSearchParams(h.slice("craft&".length));
  const t = p.get("login"), err = p.get("error");
  if(t){ token = t; store.set(AUTH, t); freshLogin = true; notice = null; }
  if(err) notice = err;
  try{ history.replaceState(null, "", location.pathname + location.search + "#craft"); }catch(e){}
})();

function tokenUid(t){
  try{
    const b = t.split(".")[0].replace(/-/g,"+").replace(/_/g,"/");
    return JSON.parse(decodeURIComponent(escape(atob(b + "===".slice((b.length + 3) % 4))))).sub || null;
  }catch(e){ return null; }
}

function meta(){
  const m = store.getJSON(META) || {};
  return { uid: m.uid || null, base: Number(m.base) || 0, dirty: !!m.dirty };
}
function setMeta(patch){ store.setJSON(META, { ...meta(), ...patch }); }

function readLocal(){ const v = store.getJSON(KEY); return v && "data" in v ? v.data : null; }
function writeLocal(data){ return store.setJSON(KEY, { data }); }

function status(){
  return { loggedIn: !!user, user, sync, notice, localAvailable: store.ok };
}
function emit(){ window.dispatchEvent(new CustomEvent("craftstorage:status", { detail: status() })); }
function setSync(s, n){ sync = s; if(n !== undefined) notice = n; emit(); }

/* ── 呼叫 Worker ── */
async function call(path, opts = {}){
  const res = await fetch(API + path, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: "Bearer " + token },
  });
  if(res.status === 401){ dropLogin("expired"); throw new Error("unauthorized"); }
  return res;
}

function dropLogin(why){
  token = null; user = null;
  store.del(AUTH);
  sync = "local";
  if(why) notice = why;
  emit();
}

/* ── 2. 開頁時確認登入、補傳上次沒傳完的、第一次登入時詢問要不要上傳本機倉庫 ── */
const ready = (async function init(){
  if(!token){ emit(); return; }
  const uid = tokenUid(token);
  try{
    const res = await call("/me");
    if(!res.ok) throw new Error("me " + res.status);
    user = await res.json();
  }catch(e){
    if(token){ user = null; sync = "error"; notice = "offline"; emit(); }
    return;
  }
  // 換了帳號：本機記的雲端版本號作廢
  const m = meta();
  if(m.uid && m.uid !== user.id) setMeta({ uid: user.id, base: 0, dirty: false });
  else if(!m.uid) setMeta({ uid: user.id });
  sync = "synced"; emit();

  if(freshLogin){
    const local = readLocal();
    try{
      const res = await call("/stash");
      const cloud = await res.json();
      setMeta({ base: cloud.updatedAt || 0 });
      cache = cloud.data;
      if(cloud.data != null) writeLocal(cloud.data);
      else if(local != null){
        const ok = window.confirm("這台電腦已經有製裝倉庫的資料，雲端還是空的。\n要把這台電腦的倉庫上傳到雲端嗎？");
        if(ok){ cache = local; pending = local; await flush(); }
      }
    }catch(e){ setSync("error", "offline"); }
  }else if(m.dirty && (m.uid === user.id || uid === user.id)){
    pending = cache = readLocal();
    flush();
  }
})();

/* ── 3. 讀檔 ──
   load()                  → 這台目前的版本（存檔前合併欄位用這個，不會跳過衝突檢查）
   load({ refresh: true }) → 去雲端拿最新的（「讀檔」按鈕用這個）
   這次開頁第一次 load() 一定會去雲端拿。還有改動沒上傳時，一律回傳這台的版本。 */
async function load(opts){
  await ready;
  if(!user) return readLocal();
  if(pending !== undefined || flushing || timer || meta().dirty) return cache !== undefined ? cache : readLocal();
  if(cache !== undefined && !(opts && opts.refresh)) return cache;
  try{
    setSync("syncing");
    const res = await call("/stash");
    if(!res.ok) throw new Error("stash " + res.status);
    const cloud = await res.json();
    setMeta({ base: cloud.updatedAt || 0, dirty: false });
    cache = cloud.data;
    if(cloud.data != null) writeLocal(cloud.data);
    setSync("synced", null);
    return cloud.data;
  }catch(e){
    if(user) setSync("error", "offline");
    return readLocal();
  }
}

/* ── 4. 存檔：本機立刻存；雲端等 2 秒沒有新改動才上傳 ── */
function save(data){
  if(!writeLocal(data) && !user) emit(); // 本機存不了：讓畫面顯示提示
  if(!user) return;
  cache = data;
  pending = data;
  setMeta({ dirty: true });
  setSync("syncing");
  clearTimeout(timer);
  timer = setTimeout(flush, DEBOUNCE_MS);
}

async function flush(){
  clearTimeout(timer); timer = null;
  if(flushing) { await flushing; if(pending === undefined) return; }
  if(!user || pending === undefined) return;
  const data = pending; pending = undefined;
  flushing = (async () => {
    try{
      setSync("syncing");
      const res = await call("/stash", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, baseUpdatedAt: meta().base }),
      });
      if(res.ok){
        const { updatedAt } = await res.json();
        setMeta({ base: updatedAt, dirty: pending !== undefined });
        setSync(pending === undefined ? "synced" : "syncing", null);
      }else if(res.status === 409){
        const cloud = await res.json();
        await resolveConflict(data, cloud);
      }else if(res.status === 413){
        setSync("error", "too_large");
      }else if(res.status === 429){
        if(pending === undefined) pending = data;
        setSync("error", "rate_limited");
        timer = setTimeout(flush, 60 * 1000);
      }else{
        throw new Error("put " + res.status);
      }
    }catch(e){
      if(!user) return;
      if(pending === undefined) pending = data;
      setSync("error", "offline");
    }
  })();
  await flushing;
  flushing = null;
}

/* ── 5. 409：另一台電腦有比較新的存檔，讓使用者選 ── */
async function resolveConflict(mine, cloud){
  // 雲端那份跟這台要上傳的一樣（例如關頁前用 keepalive 送出成功、但這台沒收到回覆）：不算衝突
  if(JSON.stringify(cloud.data) === JSON.stringify(mine)){
    setMeta({ base: cloud.updatedAt, dirty: pending !== undefined });
    if(pending === undefined){ setSync("synced", null); return; }
    flushing = null;
    return flush();
  }
  const choice = await askConflict(cloud.updatedAt);
  if(choice === "cloud"){
    pending = undefined;
    cache = cloud.data;
    writeLocal(cloud.data);
    setMeta({ base: cloud.updatedAt, dirty: false });
    setSync("synced", null);
    window.dispatchEvent(new CustomEvent("craftstorage:data", { detail: cloud.data }));
  }else{
    setMeta({ base: cloud.updatedAt });
    if(pending === undefined) pending = mine;
    flushing = null;
    await flush();
  }
}

function askConflict(when){
  return new Promise(resolve => {
    const wrap = document.createElement("div");
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(6,5,5,.75);display:flex;align-items:center;justify-content:center;padding:16px";
    const t = new Date(when).toLocaleString("zh-TW", { hour12: false });
    wrap.innerHTML =
      '<div style="background:#1B1B19;border:1px solid #46443F;border-left:4px solid #C77C2E;border-radius:8px;max-width:420px;width:100%;padding:20px 22px;color:#E6E2DB;font:15px/1.7 system-ui,sans-serif;box-shadow:0 16px 40px rgba(0,0,0,.6)">' +
      '<div style="font-size:17px;font-weight:700;margin-bottom:6px">另一台電腦有比較新的存檔</div>' +
      '<div style="color:#A09B93;font-size:13.5px;margin-bottom:16px">雲端的存檔時間：' + t + '<br>要用哪一份？沒選的那份會被覆蓋。</div>' +
      '<div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">' +
      '<button data-c="cloud" style="background:#1D1D1B;border:1px solid #46443F;color:#E6E2DB;border-radius:99px;padding:8px 18px;cursor:pointer;font:inherit;font-size:14px">用雲端的</button>' +
      '<button data-c="local" style="background:#C77C2E;border:1px solid #C77C2E;color:#0F0F0E;border-radius:99px;padding:8px 18px;cursor:pointer;font:inherit;font-size:14px;font-weight:600">用這台的</button>' +
      '</div></div>';
    wrap.addEventListener("click", e => {
      const c = e.target.getAttribute && e.target.getAttribute("data-c");
      if(!c) return;
      wrap.remove();
      resolve(c);
    });
    document.body.appendChild(wrap);
    wrap.querySelector('[data-c="local"]').focus();
  });
}

/* ── 6. 關閉頁面前：還沒上傳的改動用 keepalive 送出（本機已經有一份，下次開頁也會補傳） ── */
function flushOnExit(){
  if(!user || pending === undefined) return;
  const body = JSON.stringify({ data: pending, baseUpdatedAt: meta().base });
  if(body.length > KEEPALIVE_MAX) return;
  try{
    fetch(API + "/stash", {
      method: "PUT", keepalive: true, body,
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    });
  }catch(e){}
}
window.addEventListener("pagehide", flushOnExit);
window.addEventListener("online", () => { if(user && meta().dirty){ if(pending === undefined) pending = readLocal(); flush(); } });

/* ── 7. 登入／登出 ── */
function login(){ location.href = API + "/auth/login"; }

async function logout(){
  clearTimeout(timer);
  if(user && pending !== undefined) await flush();
  const t = token;
  dropLogin(null);
  cache = undefined;
  setMeta({ base: 0, dirty: false, uid: null });
  try{ await fetch(API + "/auth/logout", { method: "POST", headers: { Authorization: "Bearer " + t } }); }catch(e){}
}

window.CraftStorage = Object.freeze({ load, save, status, login, logout });
})();
