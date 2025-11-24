// bot/telegram.js
// A standalone admin Telegram bot that can list users, ban/unban, show logs.
// Run this as a separate Node process (pm2, systemd, or on a small VPS).
// Required env: TELEGRAM_TOKEN, DATABASE_URL, ADMIN_TELEGRAM_ID (optional to restrict commands)
const TelegramBot = require('node-telegram-bot-api');
const db = require('./utils/db');

const token = process.env.TELEGRAM_TOKEN;
if (!token) {
  console.error('Missing TELEGRAM_TOKEN');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID ? String(process.env.ADMIN_TELEGRAM_ID) : null;

function okAdmin(from) {
  if (!ADMIN_ID) return true;
  return String(from.id) === ADMIN_ID;
}

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Admin bot ready. Use /help');
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, `/list_users\n/ban <username>\n/unban <username>\n/logs <username>\n/stats`);
});

bot.onText(/\/list_users/, async (msg) => {
  if (!okAdmin(msg.from)) return bot.sendMessage(msg.chat.id, 'Not allowed');
  const res = await db.query('SELECT id, username, email, banned, created_at FROM users ORDER BY id DESC LIMIT 200');
  const text = res.rows.map(r => `${r.id} | ${r.username} | ${r.email} | banned=${r.banned}`).join('\n') || 'no users';
  bot.sendMessage(msg.chat.id, text);
});

bot.onText(/\/ban (.+)/, async (msg, match) => {
  if (!okAdmin(msg.from)) return bot.sendMessage(msg.chat.id, 'Not allowed');
  const username = match[1].trim();
  await db.query('UPDATE users SET banned = true WHERE username = $1', [username]);
  await db.query('INSERT INTO logs (username, event, metadata) VALUES ($1,$2,$3)', [username, 'ban', JSON.stringify({ by: msg.from.username || msg.from.id })]);
  bot.sendMessage(msg.chat.id, `Banned ${username}`);
});

bot.onText(/\/unban (.+)/, async (msg, match) => {
  if (!okAdmin(msg.from)) return bot.sendMessage(msg.chat.id, 'Not allowed');
  const username = match[1].trim();
  await db.query('UPDATE users SET banned = false WHERE username = $1', [username]);
  await db.query('INSERT INTO logs (username, event, metadata) VALUES ($1,$2,$3)', [username, 'unban', JSON.stringify({ by: msg.from.username || msg.from.id })]);
  bot.sendMessage(msg.chat.id, `Unbanned ${username}`);
});

bot.onText(/\/logs (.+)/, async (msg, match) => {
  if (!okAdmin(msg.from)) return bot.sendMessage(msg.chat.id, 'Not allowed');
  const username = match[1].trim();
  const res = await db.query('SELECT event, metadata, created_at FROM logs WHERE username = $1 ORDER BY created_at DESC LIMIT 200', [username]);
  const text = res.rows.map(r => `${r.created_at.toISOString()} | ${r.event} | ${JSON.stringify(r.metadata)}`).join('\n') || 'no logs';
  bot.sendMessage(msg.chat.id, text);
});

bot.onText(/\/stats/, async (msg) => {
  if (!okAdmin(msg.from)) return bot.sendMessage(msg.chat.id, 'Not allowed');
  const users = await db.query('SELECT count(*) FROM users');
  const logs = await db.query('SELECT count(*) FROM logs');
  bot.sendMessage(msg.chat.id, `users: ${users.rows[0].count}\nlogs: ${logs.rows[0].count}`);
});

console.log('Telegram bot started');
