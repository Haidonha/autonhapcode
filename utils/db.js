// utils/db.js
// Postgres helper (uses DATABASE_URL env var)
const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // If using Vercel Postgres, DATABASE_URL is provided by Vercel
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }
  return pool;
}

module.exports = {
  query: (text, params) => getPool().query(text, params),
  getClient: () => getPool().connect()
};
