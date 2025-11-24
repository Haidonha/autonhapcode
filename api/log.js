// /api/log.js
// record custom events (login already recorded in /api/login). This endpoint allows client or proxy to store events.
const db = require('../utils/db');
const jwtUtil = require('../utils/jwt');

module.exports = async function (req, res) {
  if (req.method !== 'POST') return res.status(405).send({ error: 'Method not allowed' });
  try {
    const auth = (req.headers.authorization || '').split(' ')[1];
    let username = null, userId = null;
    if (auth) {
      const v = jwtUtil.verify(auth);
      if (v.ok) { username = v.payload.username; userId = v.payload.id || v.payload.id; }
    }

    const { event, metadata } = req.body || {};
    if (!event) return res.status(400).json({ error: 'missing_event' });

    await db.query('INSERT INTO logs (user_id, username, event, metadata) VALUES ($1, $2, $3, $4)', [
      userId,
      username,
      event,
      JSON.stringify(metadata || {})
    ]);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('log error', e);
    return res.status(500).json({ error: e.message });
  }
};
