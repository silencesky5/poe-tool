// 本機測試：用 wrangler dev 跑 Worker，Discord API 換成本機假伺服器，不需要真的密鑰
// 用法：npm test（在 worker 資料夾）
import { spawn, execFileSync } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 8787;
const MOCK_PORT = 8799;
const BASE = `http://127.0.0.1:${PORT}`;
const SITE = 'http://localhost:8765';
const SESSION_SECRET = randomBytes(32).toString('hex'); // 測試用，跑完就丟
const DEV_VARS = path.join(ROOT, '.dev.vars');
const STATE_DIR = mkdtempSync(path.join(tmpdir(), 'poe-auth-test-')); // 每次測試用全新的 KV 和 D1

// ── 假的 Discord API ──
const USERS = {
  'code-member': { token: 'tok-member', user: { id: '111111111111111111', username: 'kai', global_name: 'KAI', avatar: null }, member: true },
  'code-outsider': { token: 'tok-out', user: { id: '222222222222222222', username: 'stranger', avatar: 'abc' }, member: false },
};
const byToken = Object.fromEntries(Object.values(USERS).map((u) => [u.token, u]));
const revoked = [];
const mock = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const send = (status, obj) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(obj ?? {}));
    };
    const auth = (req.headers.authorization || '').replace('Bearer ', '');
    if (req.url === '/oauth2/token') {
      const p = new URLSearchParams(body);
      if (p.get('client_secret') !== 'test-client-secret') return send(401, { error: 'invalid_client' });
      const u = USERS[p.get('code')];
      return u ? send(200, { access_token: u.token, token_type: 'Bearer' }) : send(400, { error: 'invalid_grant' });
    }
    if (req.url === '/oauth2/token/revoke') {
      revoked.push(new URLSearchParams(body).get('token'));
      return send(200);
    }
    const u = byToken[auth];
    if (!u) return send(401);
    if (req.url === '/users/@me') return send(200, u.user);
    if (req.url.startsWith('/users/@me/guilds/') && req.url.endsWith('/member')) {
      return u.member ? send(200, { nick: null, roles: [] }) : send(404, { message: 'Unknown Guild' });
    }
    send(404);
  });
});

// ── 小工具 ──
let pass = 0;
let fail = 0;
function check(name, cond, detail = '') {
  if (cond) {
    pass++;
    console.log(`  ✔ ${name}`);
  } else {
    fail++;
    console.log(`  ✖ ${name} ${detail}`);
  }
}
const b64url = (buf) => Buffer.from(buf).toString('base64url');
function forgeToken(payload, secret = SESSION_SECRET) {
  const body = b64url(JSON.stringify(payload));
  return `${body}.${b64url(createHmac('sha256', secret).update(body).digest())}`;
}
const api = (p, { token, origin = SITE, ...init } = {}) =>
  fetch(BASE + p, {
    redirect: 'manual',
    ...init,
    headers: { ...(origin ? { Origin: origin } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
  });
const put = (token, data, baseUpdatedAt) =>
  api('/stash', { token, method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, baseUpdatedAt }) });

async function loginAs(code) {
  const start = await api('/auth/login');
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  const cookie = start.headers.get('set-cookie').split(';')[0];
  const cb = await api(`/auth/callback?code=${code}&state=${state}`, { headers: { Cookie: cookie } });
  return cb.headers.get('location');
}

// ── 主流程 ──
async function main() {
  writeFileSync(
    DEV_VARS,
    [
      `DISCORD_CLIENT_SECRET=test-client-secret`,
      `SESSION_SECRET=${SESSION_SECRET}`,
      `SITE_ORIGIN=${SITE}`,
      `DISCORD_API=http://127.0.0.1:${MOCK_PORT}`,
    ].join('\n'),
  );
  await new Promise((r) => mock.listen(MOCK_PORT, '127.0.0.1', r));

  // 本機 D1 先建表（和線上一樣用 schema.sql）
  execFileSync(process.execPath, [path.join(ROOT, 'node_modules/wrangler/bin/wrangler.js'), 'd1', 'execute', 'CRAFT_DB', '--local', '--persist-to', STATE_DIR, '--file', path.join(ROOT, 'schema.sql')], { cwd: ROOT, stdio: 'ignore', env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' } });
  const wrangler = spawn(process.execPath, [path.join(ROOT, 'node_modules/wrangler/bin/wrangler.js'), 'dev', '--port', String(PORT), '--ip', '127.0.0.1', '--persist-to', STATE_DIR], {
    cwd: ROOT,
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' },
  });
  let log = '';
  wrangler.stdout.on('data', (d) => (log += d));
  wrangler.stderr.on('data', (d) => (log += d));

  try {
    for (let i = 0; i < 120; i++) {
      try {
        await fetch(BASE + '/nope');
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
      if (i === 119) throw new Error('wrangler dev 沒有啟動：\n' + log);
    }

    console.log('\n[CORS]');
    let r = await api('/stash', { method: 'OPTIONS', headers: { 'Access-Control-Request-Method': 'PUT' } });
    check('允許的來源：預檢 204 並回傳 Allow-Origin', r.status === 204 && r.headers.get('access-control-allow-origin') === SITE);
    r = await api('/stash', { method: 'OPTIONS', origin: 'https://evil.example' });
    check('其他來源：預檢被拒，沒有 Allow-Origin', r.status === 403 && !r.headers.get('access-control-allow-origin'));
    r = await api('/me', { origin: 'https://evil.example' });
    check('其他來源：一般請求沒有 Allow-Origin', !r.headers.get('access-control-allow-origin'));

    console.log('\n[/auth/login]');
    r = await api('/auth/login');
    const loc = new URL(r.headers.get('location'));
    check('302 導向 Discord 授權頁', r.status === 302 && loc.origin === 'https://discord.com' && loc.pathname === '/oauth2/authorize');
    check('scope 為 identify guilds.members.read', loc.searchParams.get('scope') === 'identify guilds.members.read');
    check('redirect_uri 指向 /auth/callback', loc.searchParams.get('redirect_uri') === `${BASE}/auth/callback`);
    check('state 存在 HttpOnly cookie', /poe_oauth_state=[\w-]{20,};.*HttpOnly/.test(r.headers.get('set-cookie') || ''));

    console.log('\n[/auth/callback]');
    r = await api('/auth/callback?code=code-member&state=wrong', { headers: { Cookie: 'poe_oauth_state=right' } });
    check('state 不符 → 導回 error=bad_state', r.headers.get('location') === `${SITE}/poe-tool/#craft&error=bad_state`);
    const outsider = await loginAs('code-outsider');
    check('不是公會成員 → 導回 error=not_member', outsider === `${SITE}/poe-tool/#craft&error=not_member`);
    const memberLoc = await loginAs('code-member');
    check('成員 → 導回 #craft&login=<token>', memberLoc?.startsWith(`${SITE}/poe-tool/#craft&login=`));
    const token = memberLoc.split('login=')[1];
    await new Promise((res) => setTimeout(res, 300));
    check('Discord access token 用完有撤銷', revoked.includes('tok-member') && revoked.includes('tok-out'));
    const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
    check('token 有效期 30 天', Math.round((payload.exp - payload.iat) / 86400) === 30);
    check('token 裡沒有 Discord access token', !token.includes('tok-member') && !JSON.stringify(payload).includes('tok-'));

    console.log('\n[驗證]');
    check('沒帶 token → 401', (await api('/me')).status === 401);
    check('亂簽的 token → 401', (await api('/me', { token: forgeToken(payload, 'x'.repeat(64)) })).status === 401);
    check('過期的 token → 401', (await api('/me', { token: forgeToken({ ...payload, exp: 1 }) })).status === 401);
    r = await api('/me', { token });
    const meBody = await r.json();
    check('/me 回傳 { id, name, avatar }', meBody.id === '111111111111111111' && meBody.name === 'KAI' && meBody.avatar.includes('cdn.discordapp.com'));
    check('/me 有 CORS 標頭', r.headers.get('access-control-allow-origin') === SITE);

    console.log('\n[/stash]');
    let s = await (await api('/stash', { token })).json();
    check('沒有資料時回傳空的', s.data === null && s.updatedAt === 0);
    r = await put(token, { text: '測試123' }, 0);
    const p1 = await r.json(), t1 = p1.updatedAt;
    check('PUT 成功並回傳 updatedAt', r.status === 200 && t1 > 0);
    check('第一次存檔（新增）D1 rows_written = 1', p1.rowsWritten === 1, `（實際 ${p1.rowsWritten}）`);
    s = await (await api('/stash', { token })).json();
    check('GET 讀回剛存的資料', s.data?.text === '測試123' && s.updatedAt === t1);
    r = await put(token, { text: 'AAA' }, t1);
    const p2 = await r.json(), t2 = p2.updatedAt;
    check('用最新的 baseUpdatedAt 存檔成功', r.status === 200 && t2 > t1);
    check('之後的存檔（更新）D1 rows_written = 1', p2.rowsWritten === 1, `（實際 ${p2.rowsWritten}）`);
    r = await put(token, { text: 'BBB' }, t1);
    const conflict = await r.json();
    check('用舊的 baseUpdatedAt → 409 並附上雲端那份', r.status === 409 && conflict.data?.text === 'AAA' && conflict.updatedAt === t2);
    s = await (await api('/stash', { token })).json();
    check('409 時雲端資料沒有被改到', s.data?.text === 'AAA' && s.updatedAt === t2);
    r = await put(token, { text: 'BBB' }, conflict.updatedAt);
    check('選「用這台的」後重送成功', r.status === 200);
    r = await put(token, { blob: 'x'.repeat(512 * 1024) }, 0);
    check('超過 512 KB → 413', r.status === 413);
    const other = await loginAs('code-member');
    check('同一個人重新登入也能讀到自己的倉庫', (await (await api('/stash', { token: other.split('login=')[1] })).json()).data?.text === 'BBB');

    console.log('\n[速率限制]');
    let current = (await (await api('/stash', { token })).json()).updatedAt;
    const statuses = [];
    for (let i = 0; i < 35; i++) {
      const res = await put(token, { n: i }, current);
      statuses.push(res.status);
      if (res.status === 200) current = (await res.json()).updatedAt;
    }
    check('每分鐘超過 30 次 PUT → 429', statuses.includes(429), `（狀態：${[...new Set(statuses)].join(',')}）`);

    console.log('\n[登出]');
    r = await api('/auth/logout', { token, method: 'POST' });
    check('POST /auth/logout → 204', r.status === 204);
    check('登出後舊 token 失效', (await api('/me', { token })).status === 401);
    check('登出後其他舊 token 也失效', (await api('/me', { token: other.split('login=')[1] })).status === 401);
  } finally {
    rmSync(DEV_VARS, { force: true });
    const exited = new Promise((r) => wrangler.once('exit', r));
    wrangler.kill();
    mock.close();
    await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))]);
    try {
      rmSync(STATE_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
    } catch {
      /* 測試資料夾刪不掉也沒關係（已在 .gitignore） */
    }
  }

  console.log(`\n通過 ${pass}，失敗 ${fail}`);
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  rmSync(DEV_VARS, { force: true });
  process.exit(1);
});
