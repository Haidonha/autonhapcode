// /public/app.js
// simple client to demonstrate register/login and calling /api/proxy
const base = ''; // relative to same origin (Vercel will serve these api routes)

function $id(id){ return document.getElementById(id); }

$id('btnRegister').onclick = async () => {
  const email = $id('reg_email').value;
  const username = $id('reg_username').value;
  const password = $id('reg_password').value;
  const r = await fetch('/api/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, username, password }) });
  const j = await r.json();
  alert(JSON.stringify(j));
};

$id('btnLogin').onclick = async () => {
  const username = $id('login_username').value;
  const password = $id('login_password').value;
  const r = await fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username, password }) });
  const j = await r.json();
  if (j.token) {
    localStorage.setItem('jwt', j.token);
    $id('tokenShow').innerText = j.token;
    alert('Logged in');
  } else {
    alert(JSON.stringify(j));
  }
};

$id('btnCall').onclick = async () => {
  const token = localStorage.getItem('jwt');
  const target = $id('target').value;
  const path = $id('path').value;
  let body = $id('payload').value;
  try { body = JSON.parse(body); } catch(e) { /* keep string */ }
  const r = await fetch('/api/proxy', {
    method:'POST',
    headers: Object.assign({ 'Content-Type':'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify({ target, path, method:'POST', body })
  });
  const txt = await r.text();
  try {
    $id('result').innerText = JSON.stringify(JSON.parse(txt), null, 2);
  } catch(e) {
    $id('result').innerText = txt;
  }
};
