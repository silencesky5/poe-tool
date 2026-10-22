// 公會分享的 DC 通知：發一則測試訊息到 Webhook，確認格式（和 src/index.js 的 notifyShare 一樣）。
// Webhook 網址是密鑰：只從環境變數讀，不要寫進檔案、不要 commit。
// 用法（PowerShell，在 worker 資料夾）：
//   $env:SHARE_WEBHOOK_URL = "<Webhook 網址>"; node tools/webhook-test.mjs; Remove-Item Env:SHARE_WEBHOOK_URL
const url = process.env.SHARE_WEBHOOK_URL;
if (!url || !/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(url)) {
  console.error('請先設定環境變數 SHARE_WEBHOOK_URL（Discord Webhook 網址）');
  process.exit(1);
}
const content = [
  '📦 KAI 分享了一件 靈主之環（測試訊息）',
  '+16 最大能量護盾',
  '+68 最大魔力',
  '+31 智慧',
  '+48% 冰冷抗性',
  '備註：這是公會分享架的測試通知，可以刪掉',
  '👉 https://silencesky5.github.io/poe-tool/#craft&share=TEST00000000',
].join('\n');
const r = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
});
console.log(r.ok ? '已送出測試訊息' : `送出失敗：HTTP ${r.status}`);
process.exit(r.ok ? 0 : 1);
