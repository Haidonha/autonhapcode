// /api/proxy.js
// Single proxy endpoint. Body: { target: 'web3task'|'user', path: '/v1/..', method: 'POST', body: {...}, headers: {...} }
// Validates Bearer token (Authorization) and checks banned status in DB, logs request.
const fetch = require('node-fetch'); // if running on Vercel/Edge, native fetch is available; keep this for local dev
const db = require('../utils/db');
const jwtUtil = require('../utils/jwt');

// map allowed targets
const TARGETS = {
  web3task: 'https://web3task.3games.io',
  user: 'https://user.3games.io'
};

module.exports = async function (req, res) {
  if (req.method !== 'POST') return res.status(405).send({ error: 'Method not allowed' });
  try {
    const { target, path, method = 'POST', body, headers: extraHeaders, qs } = req.body || {};
    if (!target || !TARGETS[target]) return res.status(400).json({ error: 'invalid_target' });

    // auth check
    const authHeader = req.headers.authorization || '';
    const token = authHeader.split(' ')[1];
    let username = null, userId = null;
    if (token) {
      const v = jwtUtil.verify(token);
      if (!v.ok) return res.status(401).json({ error: 'invalid_token' });
      username = v.payload.username; userId = v.payload.id || v.payload.uid || v.payload.id;
      // check banned
      const q = await db.query('SELECT banned FROM users WHERE username = $1 LIMIT 1', [username]);
      if (q.rows.length && q.rows[0].banned) {
        // record blocked request
        await db.query('INSERT INTO logs (user_id, username, event, metadata) VALUES ($1,$2,$3,$4)', [
          userId, username, 'blocked_proxy_call', JSON.stringify({ target, path })
        ]);
        return res.status(403).json({ error: 'user_banned' });
      }
    } else {
      // no token provided: allow? Here we allow but mark username null (you can change to require auth)
      // return res.status(401).json({ error: 'missing_token' });
    }

    // record proxy call
    await db.query('INSERT INTO logs (user_id, username, event, metadata) VALUES ($1,$2,$3,$4)', [
      userId, username, 'proxy_call', JSON.stringify({ target, path })
    ]);

    // build destination
    const base = TARGETS[target];
    const url = base + (path || '') + (qs ? ('?' + qs) : '');

    // prepare headers to forward
    const forwarded = {};
    // copy some safe headers from incoming request
    const incoming = req.headers || {};
    ['user-agent','accept','content-type','referer','origin'].forEach(h => {
      if (incoming[h]) forwarded[h] = incoming[h];
    });
    // merge extra headers from client body (but do not allow overriding host)
    if (extraHeaders && typeof extraHeaders === 'object') {
      for (const k of Object.keys(extraHeaders)) {
        if (k.toLowerCase() === 'host') continue;
        forwarded[k] = extraHeaders[k];
      }
    }
    // Example: if you want to inject secret headers, do it here from env vars (kept secret)
    // forwarded['user-secret-key'] = process.env.USER_SECRET_KEY;

    const fetchOpts = {
      method: method.toUpperCase(),
      headers: forwarded
    };
    if (['POST','PUT','PATCH'].includes(fetchOpts.method) && body !== undefined) {
      fetchOpts.body = typeof body === 'string' ? body : JSON.stringify(body);
      if (!fetchOpts.headers['content-type']) fetchOpts.headers['content-type'] = 'application/json';
    }

    const r = await fetch(url, fetchOpts);
    const text = await r.text();
    // try parse json, else return text
    try { 
      const json = JSON.parse(text);
      res.status(r.status).json(json);
    } catch (e) {
      res.status(r.status).send(text);
    }
  } catch (e) {
    console.error('proxy error', e);
    return res.status(500).json({ error: e.message });
  }
};
