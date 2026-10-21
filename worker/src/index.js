// PoE 工具箱的小後端：Discord 登入、檢查公會成員、讀寫雲端倉庫
// 密鑰（DISCORD_CLIENT_SECRET、SESSION_SECRET）只從 env 讀取，不寫在程式裡。

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
        default:
          return withCors(json({ error: 'not_found' }, 404), cors);
      }
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
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
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
  const auth = request.headers.get('Authorization') || '';
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  const user = m ? await verifyToken(env, m[1].trim()) : null;
  if (!user) throw json({ error: 'unauthorized' }, 401);
  return user;
}

// 把 throw 出來的 Response 當成回覆
function guard(fn) {
  return async (request, env) => {
    try {
      return await fn(request, env);
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
    const token = await signToken(env, {
      sub: user.id,
      name: member.nick || user.global_name || user.username,
      avatar: avatarUrl(user),
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
  return json({ id: user.sub, name: user.name, avatar: user.avatar });
});

// ───────────── /stash ─────────────

async function readStash(env, id) {
  const raw = await env.CRAFT_STASH.get(`stash:${id}`);
  if (!raw) return { data: null, updatedAt: 0 };
  try {
    return JSON.parse(raw);
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

  const current = await readStash(env, user.sub);
  if (current.updatedAt > base) return json({ error: 'conflict', ...current }, 409);

  const updatedAt = Math.max(Date.now(), current.updatedAt + 1);
  await env.CRAFT_STASH.put(`stash:${user.sub}`, JSON.stringify({ data: body.data, updatedAt }));
  return json({ updatedAt });
});
