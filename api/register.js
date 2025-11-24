// /api/register.js
// Vercel Serverless function style (Node.js)
const bcrypt = require('bcryptjs');
const db = require('../utils/db');

module.exports = async function (req, res) {
  if (req.method !== 'POST') return res.status(405).send({ error: 'Method not allowed' });
  try {
    const { email, username, password } = req.body || {};
    if (!email || !username || !password) return res.status(400).json({ error: 'Missing fields' });

    // check uniqueness
    const exists = await db.query('SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1', [username, email]);
    if (exists.rows.length) {
      const row = exists.rows[0];
      // determine which one conflicts
      const byName = await db.query('SELECT id FROM users WHERE username = $1 LIMIT 1', [username]);
      if (byName.rows.length) return res.status(400).json({ error: 'username_exists' });
      return res.status(400).json({ error: 'email_exists' });
    }

    const hash = await bcrypt.hash(password, 10);
    const insert = await db.query(
      'INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
      [email, username, hash]
    );

    // record registration log
    const user = insert.rows[0];
    await db.query('INSERT INTO logs (user_id, username, event, metadata) VALUES ($1, $2, $3, $4)', [
      user.id,
      user.username,
      'register',
      JSON.stringify({ ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress })
    ]);

    return res.status(200).json({ ok: true, user: { id: user.id, username: user.username } });
  } catch (e) {
    console.error('register error', e);
    return res.status(500).json({ error: e.message });
  }
};
