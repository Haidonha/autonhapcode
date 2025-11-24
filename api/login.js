// /api/login.js
const bcrypt = require('bcryptjs');
const db = require('../utils/db');
const jwtUtil = require('../utils/jwt');

module.exports = async function (req, res) {
  if (req.method !== 'POST') return res.status(405).send({ error: 'Method not allowed' });
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

    const q = await db.query('SELECT id, username, password_hash, banned FROM users WHERE username = $1 LIMIT 1', [username]);
    if (!q.rows.length) return res.status(401).json({ error: 'invalid_credentials' });

    const user = q.rows[0];
    if (user.banned) return res.status(403).json({ error: 'banned' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

    // create short-lived token (user requested token+uid per-run; still issue JWT)
    const token = jwtUtil.sign({ id: user.id, username: user.username }, { expiresIn: '1h' });

    // log login event
    await db.query('INSERT INTO logs (user_id, username, event, metadata) VALUES ($1, $2, $3, $4)', [
      user.id,
      user.username,
      'login',
      JSON.stringify({ ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress })
    ]);

    return res.status(200).json({ token, uid: user.id });
  } catch (e) {
    console.error('login error', e);
    return res.status(500).json({ error: e.message });
  }
};
