// PoE 工具箱的小後端：Discord 登入、檢查公會成員、讀寫雲端倉庫、公會分享架
// 密鑰（DISCORD_CLIENT_SECRET、SESSION_SECRET、SHARE_WEBHOOK_URL）只從 env 讀取，不寫在程式裡。

const TOKEN_DAYS = 30;
const MAX_STASH_BYTES = 512 * 1024;
const STATE_COOKIE = 'poe_oauth_state';
const DEFAULT_DISCORD_API = 'https://discord.com/api/v10';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: cors ? 204 : 403, headers: cors ?? {} });
    }

    try {
      const route = `${request.method} ${url.pathname}`;
      switch (route) {
        case 'GET /auth/login':
          return login(request, env);
        case 'GET /auth/callback':
          return await callback(request, env, ctx);
        case 'POST /auth/logout':
          return withCors(await logout(request, env), cors);
        case 'GET /me':
          return withCors(await me(request, env), cors);
        case 'GET /stash':
          return withCors(await getStash(request, env), cors);
        case 'PUT /stash':
          return withCors(await putStash(request, env), cors);
        case 'GET /shares':
          return withCors(await listShares(request, env), cors);
        case 'POST /shares':
          return withCors(await createShare(request, env, ctx), cors);
      }
      const m = /^\/shares\/([A-Za-z0-9_-]{6,40})(\/copy)?$/.exec(url.pathname);
      if (m && request.method === 'DELETE' && !m[2]) return withCors(await removeShare(request, env, m[1]), cors);
      if (m && request.method === 'POST' && m[2]) return withCors(await copyShare(request, env, m[1]), cors);
      return withCors(json({ error: 'not_found' }, 404), cors);
    } catch (err) {
      console.error(err);
      return withCors(json({ error: 'server_error' }, 500), cors);
    }
  },
};

// ───────────── CORS：只允許 SITE_ORIGIN ─────────────

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin || origin !== env.SITE_ORIGIN) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function withCors(response, cors) {
  if (!cors) return response;
  const r = new Response(response.body, response);
  for (const [k, v] of Object.entries(cors)) r.headers.set(k, v);
  return r;
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

// ───────────── 工具 ─────────────

const enc = new TextEncoder();

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(secret) {
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET 未設定或太短');
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

function randomString(bytes = 24) {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

function siteUrl(env, fragment) {
  return `${env.SITE_ORIGIN}${env.SITE_PATH || '/'}#${fragment}`;
}

function redirect(location, headers = {}) {
  return new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': 'no-store', ...headers } });
}

function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ───────────── session token：payload.signature（HMAC-SHA256，30 天） ─────────────

async function signToken(env, payload) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const key = await hmacKey(env.SESSION_SECRET);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

async function verifyToken(env, token) {
  const [body, sig, extra] = (token || '').split('.');
  if (!body || !sig || extra !== undefined) return null;
  const key = await hmacKey(env.SESSION_SECRET);
  let ok = false;
  try {
    ok = await crypto.subtle.verify('HMAC', key, b64urlDecode(sig), enc.encode(body));
  } catch {
    return null;
  }
  if (!ok) return null;
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
  } catch {
    return null;
  }
  if (!payload?.sub || typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null;
  // 登出時版本號 +1，舊 token 就失效
  const ver = Number((await env.CRAFT_STASH.get(`ver:${payload.sub}`)) || 0);
  if ((payload.ver ?? 0) !== ver) return null;
  return payload;
}

async function requireUser(request, env) {
  const user = await optionalUser(request, env);
  if (!user) throw json({ error: 'unauthorized' }, 401);
  return user;
}

// 有帶 token 就驗證；沒帶或無效＝未登入（公開的 API 用）
async function optionalUser(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  return m ? await verifyToken(env, m[1].trim()) : null;
}

// 把 throw 出來的 Response 當成回覆
function guard(fn) {
  return async (request, env, ...rest) => {
    try {
      return await fn(request, env, ...rest);
    } catch (e) {
      if (e instanceof Response) return e;
      throw e;
    }
  };
}

// ───────────── /auth/login ─────────────

function login(request, env) {
  const state = randomString();
  const redirectUri = `${new URL(request.url).origin}/auth/callback`;
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'identify guilds.members.read',
    state,
    prompt: 'none',
  });
  return redirect(`https://discord.com/oauth2/authorize?${params}`, {
    'Set-Cookie': `${STATE_COOKIE}=${state}; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  });
}

// ───────────── /auth/callback ─────────────

async function callback(request, env, ctx) {
  const url = new URL(request.url);
  const clearState = { 'Set-Cookie': `${STATE_COOKIE}=; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0` };
  const fail = (code) => redirect(siteUrl(env, `craft&error=${code}`), clearState);

  if (url.searchParams.get('error')) return fail('denied'); // 使用者在 Discord 按了取消
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  if (!state || !code || !timingSafeEqual(state, readCookie(request, STATE_COOKIE))) return fail('bad_state');

  const api = env.DISCORD_API || DEFAULT_DISCORD_API;
  const redirectUri = `${url.origin}/auth/callback`;

  // 用 code 換 access token（只用來查成員資格，用完就丟，不存）
  const tokenRes = await fetch(`${api}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenRes.ok) return fail('token_failed');
  const { access_token: accessToken } = await tokenRes.json();
  const authHeaders = { Authorization: `Bearer ${accessToken}` };

  try {
    const userRes = await fetch(`${api}/users/@me`, { headers: authHeaders });
    if (!userRes.ok) return fail('user_failed');
    const user = await userRes.json();

    const memberRes = await fetch(`${api}/users/@me/guilds/${env.GUILD_ID}/member`, { headers: authHeaders });
    if (memberRes.status === 404) return fail('not_member');
    if (!memberRes.ok) return fail('member_failed');
    const member = await memberRes.json();
    if (env.REQUIRED_ROLE_ID && !(member.roles || []).includes(env.REQUIRED_ROLE_ID)) return fail('no_role');

    const ver = Number((await env.CRAFT_STASH.get(`ver:${user.id}`)) || 0);
    const now = Math.floor(Date.now() / 1000);
    // 團隊幹部：登入當下的身分組（從 Discord 查到的，簽在 token 裡，前端改不了）。
    // 身分組變動要重新登入才會更新。
    const officer = !!env.OFFICER_ROLE_ID && (member.roles || []).includes(env.OFFICER_ROLE_ID);
    const token = await signToken(env, {
      sub: user.id,
      name: member.nick || user.global_name || user.username,
      avatar: avatarUrl(user),
      officer,
      ver,
      iat: now,
      exp: now + TOKEN_DAYS * 86400,
    });
    return redirect(siteUrl(env, `craft&login=${token}`), clearState);
  } finally {
    // access token 用完就撤銷
    ctx.waitUntil(
      fetch(`${api}/oauth2/token/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env.DISCORD_CLIENT_ID,
          client_secret: env.DISCORD_CLIENT_SECRET,
          token: accessToken,
          token_type_hint: 'access_token',
        }),
      }).catch(() => {}),
    );
  }
}

function avatarUrl(user) {
  if (user.avatar) return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`;
  const idx = Number((BigInt(user.id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}

// ───────────── /auth/logout、/me ─────────────

const logout = guard(async (request, env) => {
  const user = await requireUser(request, env);
  const ver = Number((await env.CRAFT_STASH.get(`ver:${user.sub}`)) || 0);
  await env.CRAFT_STASH.put(`ver:${user.sub}`, String(ver + 1));
  return new Response(null, { status: 204 });
});

const me = guard(async (request, env) => {
  const user = await requireUser(request, env);
  return json({ id: user.sub, name: user.name, avatar: user.avatar, officer: !!user.officer });
});

// ───────────── /stash ─────────────

// 存檔放在 D1 的 stash 表（schema.sql）；KV 只留登出版本號
async function readStash(env, id) {
  const row = await env.CRAFT_DB.prepare('SELECT data, updated_at FROM stash WHERE discord_id = ?1').bind(id).first();
  if (!row) return { data: null, updatedAt: 0 };
  try {
    return { data: JSON.parse(row.data), updatedAt: row.updated_at };
  } catch {
    return { data: null, updatedAt: 0 };
  }
}

const getStash = guard(async (request, env) => {
  const user = await requireUser(request, env);
  return json(await readStash(env, user.sub));
});

const putStash = guard(async (request, env) => {
  const user = await requireUser(request, env);

  if (env.PUT_LIMITER) {
    const { success } = await env.PUT_LIMITER.limit({ key: user.sub });
    if (!success) return json({ error: 'rate_limited' }, 429, { 'Retry-After': '60' });
  }

  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > MAX_STASH_BYTES) return json({ error: 'too_large', limit: MAX_STASH_BYTES }, 413);
  const text = await request.text();
  if (enc.encode(text).length > MAX_STASH_BYTES) return json({ error: 'too_large', limit: MAX_STASH_BYTES }, 413);

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  if (!body || !('data' in body)) return json({ error: 'missing_data' }, 400);
  const base = Number(body.baseUpdatedAt) || 0;

  // 一條 SQL 完成「檢查版本＋寫入」：雲端版本沒有比 base 新才寫（寫 1 筆），否則什麼都不寫
  const res = await env.CRAFT_DB.prepare(
    `INSERT INTO stash (discord_id, data, updated_at) VALUES (?1, ?2, ?3)
     ON CONFLICT (discord_id) DO UPDATE SET
       data = excluded.data,
       updated_at = MAX(excluded.updated_at, stash.updated_at + 1)
     WHERE stash.updated_at <= ?4
     RETURNING updated_at`,
  )
    .bind(user.sub, JSON.stringify(body.data), Date.now(), base)
    .run();

  const saved = res.results && res.results[0];
  if (!saved) {
    // 另一台電腦有比較新的存檔：把雲端那份傳回去讓使用者選
    return json({ error: 'conflict', ...(await readStash(env, user.sub)) }, 409);
  }
  return json({ updatedAt: saved.updated_at, rowsWritten: res.meta && res.meta.rows_written });
});

// ───────────── /shares：公會分享架 ─────────────
// 複製制：分享出去的是快照（存檔 v3 格式的裝備），原件一直留在架上，別人只能複製一份。
// 每次分享、撤下、複製都只寫 1 筆（guild_shares 表沒有索引，見 schema.sql）。

const SHARE_ITEM_MAX = 4096;      // 一件裝備的 JSON 最多幾 bytes
const SHARE_NOTE_MAX = 50;        // 備註最多幾個字
const SHARE_TEXT_LINES = 16;      // 通知訊息裡的詞綴文字最多幾行

function shareLimits(env) {
  const n = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : d);
  return {
    perUser: n(env.SHARE_PER_USER, 10),
    total: n(env.SHARE_TOTAL, 100),
    perWindow: n(env.SHARE_PER_WINDOW, 3),
    windowMs: n(env.SHARE_WINDOW_SEC, 60) * 1000,
  };
}

function shareRow(r) {
  let item = null;
  try {
    item = JSON.parse(r.item);
  } catch {
    item = null; // 壞掉的資料：前端顯示「無法讀取」，不讓整個清單壞掉
  }
  return {
    id: r.id,
    sharerId: r.sharer_id,
    sharerName: r.sharer_name,
    item,
    note: r.note,
    sharedAt: r.shared_at,
    copies: r.copies,
    dataVersion: r.data_version,
  };
}

// 裝備格式檢查（存檔 v3：{ base, lv, r, mods:[{ id, v:[數字…] }] }）。只檢查形狀，詞綴是否存在由前端判斷（改版後會變）
function validItem(it) {
  if (!it || typeof it !== 'object' || Array.isArray(it)) return false;
  if (typeof it.base !== 'string' || !it.base || it.base.length > 200) return false;
  if (!Number.isInteger(it.lv) || it.lv < 1 || it.lv > 100) return false;
  if (!Number.isInteger(it.r) || it.r < 0 || it.r > 2) return false;
  if (!Array.isArray(it.mods) || it.mods.length > 12) return false;
  return it.mods.every(
    (m) =>
      m && typeof m.id === 'string' && m.id && m.id.length <= 200 &&
      Array.isArray(m.v) && m.v.length <= 8 && m.v.every((x) => typeof x === 'number' && Number.isFinite(x)),
  );
}

// Discord 訊息用：拿掉會變成 @提及、連結、格式的字元
function plainText(s, max) {
  return String(s ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/@/g, '＠')
    .replace(/[`*_~|>\\[\]<]/g, (c) => '\\' + c)
    .replace(/https?:\/\//gi, '')
    .slice(0, max)
    .trim();
}

const listShares = guard(async (request, env) => {
  const user = await optionalUser(request, env);
  const { results } = await env.CRAFT_DB.prepare(
    'SELECT id, sharer_id, sharer_name, item, note, shared_at, copies, data_version FROM guild_shares ORDER BY shared_at DESC',
  ).all();
  return json({
    shares: (results || []).map(shareRow),
    me: user ? { id: user.sub, name: user.name, officer: !!user.officer } : null,
    limits: shareLimits(env),
  });
});

const createShare = guard(async (request, env, ctx) => {
  const user = await requireUser(request, env);
  const text = await request.text();
  if (enc.encode(text).length > SHARE_ITEM_MAX * 3) return json({ error: 'too_large' }, 413);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  if (!validItem(body?.item)) return json({ error: 'bad_item' }, 400);
  const itemJson = JSON.stringify(body.item);
  if (enc.encode(itemJson).length > SHARE_ITEM_MAX) return json({ error: 'too_large' }, 413);
  const note = String(body.note ?? '').trim();
  if ([...note].length > SHARE_NOTE_MAX) return json({ error: 'note_too_long', limit: SHARE_NOTE_MAX }, 400);
  const dataVersion = String(body.dataVersion ?? '').slice(0, 32);

  const L = shareLimits(env);
  const now = Date.now();
  const id = randomString(9);
  // 一條 SQL 完成「檢查上限＋新增」：任一條件不符就什麼都不寫
  const res = await env.CRAFT_DB.prepare(
    `INSERT INTO guild_shares (id, sharer_id, sharer_name, item, note, shared_at, copies, data_version)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, 0, ?7
     WHERE (SELECT COUNT(*) FROM guild_shares WHERE sharer_id = ?2) < ?8
       AND (SELECT COUNT(*) FROM guild_shares) < ?9
       AND (SELECT COUNT(*) FROM guild_shares WHERE sharer_id = ?2 AND shared_at > ?10) < ?11
     RETURNING id`,
  )
    .bind(id, user.sub, String(user.name || '').slice(0, 64), itemJson, note, now, dataVersion,
      L.perUser, L.total, now - L.windowMs, L.perWindow)
    .run();

  if (!res.results || !res.results[0]) {
    // 沒寫進去：查是哪一個上限（只讀）
    const c = await env.CRAFT_DB.prepare(
      `SELECT (SELECT COUNT(*) FROM guild_shares WHERE sharer_id = ?1) AS mine,
              (SELECT COUNT(*) FROM guild_shares) AS total,
              (SELECT COUNT(*) FROM guild_shares WHERE sharer_id = ?1 AND shared_at > ?2) AS recent`,
    )
      .bind(user.sub, now - L.windowMs)
      .first();
    if (c.mine >= L.perUser) return json({ error: 'per_user_limit', limit: L.perUser, count: c.mine }, 429);
    if (c.total >= L.total) return json({ error: 'shelf_full', limit: L.total }, 429);
    return json({ error: 'too_fast', limit: L.perWindow, windowSec: L.windowMs / 1000 }, 429, {
      'Retry-After': String(Math.ceil(L.windowMs / 1000)),
    });
  }

  const share = { id, sharerId: user.sub, sharerName: user.name, item: body.item, note, sharedAt: now, copies: 0, dataVersion };
  if (env.SHARE_WEBHOOK_URL) ctx.waitUntil(notifyShare(env, share, body.text).catch((e) => console.error('webhook', e)));
  return json({ share, rowsWritten: res.meta && res.meta.rows_written }, 201);
});

// DC 通知（只有分享時發；撤下、複製不發）。底材名稱和詞綴文字由前端算好送來（Worker 沒有詞綴資料），這裡只做清理。
async function notifyShare(env, share, text) {
  const base = plainText(text?.base, 60) || '裝備';
  const lines = (Array.isArray(text?.lines) ? text.lines : [])
    .slice(0, SHARE_TEXT_LINES)
    .map((l) => plainText(l, 120))
    .filter(Boolean);
  const note = plainText(share.note, SHARE_NOTE_MAX * 2);
  const content = [
    `📦 ${plainText(share.sharerName, 64)} 分享了一件 ${base}`,
    ...lines,
    ...(note ? [`備註：${note}`] : []),
    `👉 ${siteUrl(env, `craft&share=${share.id}`)}`,
  ].join('\n');
  const r = await fetch(env.SHARE_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: content.slice(0, 1900), allowed_mentions: { parse: [] } }),
  });
  if (!r.ok) console.error('webhook status', r.status);
}

const removeShare = guard(async (request, env, id) => {
  const user = await requireUser(request, env);
  // 本人、或登入時有團隊幹部身分組的人（簽在 token 裡）才能撤下。一條 SQL：條件不符就不刪
  const res = await env.CRAFT_DB.prepare('DELETE FROM guild_shares WHERE id = ?1 AND (sharer_id = ?2 OR ?3 = 1) RETURNING id')
    .bind(id, user.sub, user.officer ? 1 : 0)
    .run();
  if (res.results && res.results[0]) return json({ ok: true, rowsWritten: res.meta && res.meta.rows_written });
  const row = await env.CRAFT_DB.prepare('SELECT sharer_id FROM guild_shares WHERE id = ?1').bind(id).first();
  return row ? json({ error: 'forbidden' }, 403) : json({ error: 'not_found' }, 404);
});

// 複製：未登入也可以（裝備複製到自己的本機背包）。被複製次數 +1，寫 1 筆。
const copyShare = guard(async (request, env, id) => {
  if (env.COPY_LIMITER) {
    const ip = request.headers.get('CF-Connecting-IP') || 'local';
    const { success } = await env.COPY_LIMITER.limit({ key: ip });
    if (!success) return json({ error: 'rate_limited' }, 429, { 'Retry-After': '60' });
  }
  const row = await env.CRAFT_DB.prepare('UPDATE guild_shares SET copies = copies + 1 WHERE id = ?1 RETURNING copies')
    .bind(id)
    .first();
  if (!row) return json({ error: 'not_found' }, 404);
  return json({ copies: row.copies });
});
