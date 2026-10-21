// 一次性：把 KV 裡所有 stash:<Discord ID> 搬到 D1 的 stash 表，搬完核對筆數和內容。KV 不刪。
// 用法（在 worker 資料夾）：node tools/migrate-kv-to-d1.mjs          → 只列出要搬的（不寫入）
//                          node tools/migrate-kv-to-d1.mjs --apply  → 真的寫入 D1
// 已經在 D1 而且比較新的不會被蓋掉（用和 Worker 一樣的版本判斷）。
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WRANGLER = path.join(ROOT, 'node_modules/wrangler/bin/wrangler.js');
const KV_ID = 'fc1cc83b5b354c37b5aab4565ee30dd1';
const apply = process.argv.includes('--apply');

const run = (args) =>
  execFileSync(process.execPath, [WRANGLER, ...args], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, CI: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
const jsonOf = (out) => JSON.parse(out.slice(out.search(/[[{]/)));
const d1 = (sql) => jsonOf(run(['d1', 'execute', 'CRAFT_DB', '--remote', '--command', sql, '--json']))[0];
const sqlStr = (s) => "'" + String(s).replace(/'/g, "''") + "'";

// 1. KV 裡的所有存檔
const keys = jsonOf(run(['kv', 'key', 'list', '--namespace-id', KV_ID, '--prefix', 'stash:', '--remote'])).map((k) => k.name);
console.log(`KV 裡的存檔：${keys.length} 筆`);
const rows = [];
for (const k of keys) {
  const raw = run(['kv', 'key', 'get', k, '--namespace-id', KV_ID, '--remote', '--text']);
  let v;
  try { v = JSON.parse(raw); } catch { console.log(`  ⚠️ ${k} 不是 JSON，略過`); continue; }
  const id = k.slice('stash:'.length);
  const data = JSON.stringify(v.data ?? null);
  rows.push({ id, data, updatedAt: Number(v.updatedAt) || 0 });
  console.log(`  ${id}  ${(data.length / 1024).toFixed(1)} KB  updatedAt=${v.updatedAt}`);
}

// 2. 寫入 D1（一筆一條 SQL；D1 單一指令上限 100 KB，所以用檔案送）
if (!apply) {
  console.log('\n（只列出，沒有寫入。要真的搬請加 --apply）');
  process.exit(0);
}
const big = rows.filter((r) => r.data.length > 90 * 1024);
if (big.length) {
  console.log(`⚠️ 有 ${big.length} 筆超過 90 KB，單一 SQL 可能超過 D1 的 100 KB 上限：${big.map((r) => r.id).join(', ')}`);
  process.exit(1);
}
const dir = mkdtempSync(path.join(tmpdir(), 'kv2d1-'));
try {
  const file = path.join(dir, 'migrate.sql');
  writeFileSync(file, rows.map((r) =>
    `INSERT INTO stash (discord_id, data, updated_at) VALUES (${sqlStr(r.id)}, ${sqlStr(r.data)}, ${r.updatedAt})
  ON CONFLICT (discord_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
  WHERE stash.updated_at < excluded.updated_at;`).join('\n'));
  if (rows.length) {
    const res = jsonOf(run(['d1', 'execute', 'CRAFT_DB', '--remote', '--file', file, '--json']));
    console.log('\n寫入 D1：', JSON.stringify(res[0].results || res[0].meta));
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// 3. 核對：筆數、每一筆的內容和版本
const inD1 = d1('SELECT discord_id, data, updated_at FROM stash').results;
const byId = Object.fromEntries(inD1.map((r) => [r.discord_id, r]));
let same = 0;
for (const r of rows) {
  const x = byId[r.id];
  if (x && x.data === r.data && x.updated_at === r.updatedAt) same++;
  else console.log(`  ✖ ${r.id} 不一致（D1：${x ? `updated_at=${x.updated_at}` : '沒有'}）`);
}
console.log(`\n核對：KV ${rows.length} 筆，D1 ${inD1.length} 筆，內容完全一致 ${same} 筆。KV 保留沒有刪。`);
process.exit(same === rows.length ? 0 : 1);
