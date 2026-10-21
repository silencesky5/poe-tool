/* 製裝方法分頁：右上角的 Discord 登入區。
   存取資料一律透過 craft-storage.js（window.CraftStorage）。 */
(function(){
"use strict";
const S = window.CraftStorage;
const box = document.getElementById("kauth");
if(!S || !box) return;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

const NOTICE = {
  not_member: "這個 Discord 帳號不在 RKSA 公會伺服器裡，倉庫會先存在這台電腦",
  no_role: "這個 Discord 帳號還沒有使用雲端倉庫的身分組，倉庫會先存在這台電腦",
  denied: "已取消 Discord 登入",
  bad_state: "登入逾時或連結失效，請再按一次登入",
  token_failed: "Discord 登入失敗，請再試一次",
  user_failed: "Discord 登入失敗，請再試一次",
  member_failed: "暫時無法確認公會成員資格，請稍後再試",
  expired: "登入已過期，請重新登入",
  offline: "暫時連不上雲端，改動先存在這台電腦，恢復連線後會自動上傳",
  too_large: "倉庫太大（超過 512 KB），雲端存不下，只存在這台電腦",
  rate_limited: "存檔太頻繁，1 分鐘後會自動再上傳",
};
const SYNC = { synced: "已同步", syncing: "同步中…", error: "同步失敗", local: "存在這台電腦" };

function render(st){
  let html = "";
  if(st.loggedIn){
    html =
      '<div class="kauth-user">' +
        '<img class="kauth-avatar" src="' + esc(st.user.avatar) + '" alt="" width="34" height="34" referrerpolicy="no-referrer">' +
        '<div class="kauth-who"><b>' + esc(st.user.name) + '</b>' +
        '<span class="kauth-sync" data-s="' + esc(st.sync) + '">' + esc(SYNC[st.sync] || st.sync) + '</span></div>' +
        '<button type="button" class="kauth-out" id="kauth-out">登出</button>' +
      '</div>';
  }else{
    html =
      '<button type="button" class="kauth-login" id="kauth-login">' +
        '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.2a18.3 18.3 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.4C.6 9 -.3 13.5.1 18a19.9 19.9 0 0 0 6 3l1.3-2a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4a12.9 12.9 0 0 1-2 1l1.3 2a19.8 19.8 0 0 0 6-3c.5-5.2-.9-9.7-3.6-13.6ZM8.5 15.3c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm7 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z"/></svg>' +
        '用 Discord 登入</button>' +
      '<div class="kauth-note">限 RKSA 公會成員，雲端保存倉庫</div>';
  }
  const msgs = [];
  if(st.notice && NOTICE[st.notice]) msgs.push(NOTICE[st.notice]);
  if(!st.localAvailable) msgs.push("這個瀏覽器不能在本機存檔（可能是無痕模式），關掉頁面後資料會消失");
  if(msgs.length) html += msgs.map(m => '<div class="kauth-msg">' + esc(m) + '</div>').join("");
  box.innerHTML = html;

  const inBtn = document.getElementById("kauth-login");
  if(inBtn) inBtn.onclick = () => S.login();
  const outBtn = document.getElementById("kauth-out");
  if(outBtn) outBtn.onclick = () => { outBtn.disabled = true; S.logout(); };
}

window.addEventListener("craftstorage:status", e => render(e.detail));
render(S.status());
})();
