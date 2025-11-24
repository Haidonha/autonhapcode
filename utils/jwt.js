// utils/jwt.js
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'change_this_secret';

function sign(payload, opts = {}) {
  return jwt.sign(payload, SECRET, { expiresIn: opts.expiresIn || '1h' });
}

function verify(token) {
  try {
    return { ok: true, payload: jwt.verify(token, SECRET) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { sign, verify };
