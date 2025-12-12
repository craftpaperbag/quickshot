const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 4000;
const DATA_PATH = path.join(__dirname, 'data', 'seed.json');
const ALLOWED_ORIGIN = '*';

let store = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
const VALID_TOKEN = 'mock-crm-token';
const USERS = [{ email: 'admin@example.com', password: 'secret', name: 'Admin User' }];

function sendJson(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    ...headers,
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      if (!data) return resolve({});
      try { return resolve(JSON.parse(data)); } catch (err) { return resolve({ _raw: data }); }
    });
  });
}

function authenticate(req) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return false;
  return auth.slice(7) === VALID_TOKEN;
}

function notFound(res) {
  sendJson(res, 404, { message: 'Not found' });
}

function docsHtml() {
  const docPath = path.join(__dirname, 'docs.html');
  return fs.readFileSync(docPath, 'utf-8');
}

function handleLogin(req, res, body) {
  const { email, password } = body;
  const user = USERS.find((u) => u.email === email && u.password === password);
  if (!user) return sendJson(res, 401, { message: '認証に失敗しました' });
  return sendJson(res, 200, { token: VALID_TOKEN, user: { email: user.email, name: user.name } });
}

function nextId(collection) {
  return collection.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1;
}

function handleCustomers(req, res, pathname, body) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 2 && req.method === 'GET') {
    return sendJson(res, 200, { data: store.customers });
  }
  if (parts.length === 3) {
    const id = Number(parts[2]);
    const customer = store.customers.find((c) => c.id === id);
    if (!customer) return notFound(res);

    if (req.method === 'GET') return sendJson(res, 200, { data: customer });
    if (req.method === 'PUT' || req.method === 'PATCH') {
      Object.assign(customer, body);
      return sendJson(res, 200, { data: customer, message: '更新しました' });
    }
    if (req.method === 'DELETE') {
      store.customers = store.customers.filter((c) => c.id !== id);
      return sendJson(res, 200, { message: '削除しました' });
    }
  }

  if (parts.length === 2 && req.method === 'POST') {
    const newCustomer = { id: nextId(store.customers), ...body };
    store.customers.push(newCustomer);
    return sendJson(res, 201, { data: newCustomer, message: '登録しました' });
  }

  return notFound(res);
}

function handleOpportunities(req, res, pathname, body) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 2 && req.method === 'GET') {
    return sendJson(res, 200, { data: store.opportunities });
  }
  if (parts.length === 3) {
    const id = Number(parts[2]);
    const opp = store.opportunities.find((c) => c.id === id);
    if (!opp) return notFound(res);
    if (req.method === 'GET') return sendJson(res, 200, { data: opp });
  }
  return notFound(res);
}

function handleRoutes(req, res) {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    return sendJson(res, 204, {});
  }

  if (pathname === '/health') {
    return sendJson(res, 200, { status: 'ok', customers: store.customers.length });
  }

  if (pathname === '/' || pathname === '/docs') {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    });
    res.end(docsHtml());
    return;
  }

  if (pathname === '/auth/login' && req.method === 'POST') {
    parseBody(req).then((body) => handleLogin(req, res, body));
    return;
  }

  if (pathname.startsWith('/api/')) {
    if (!authenticate(req)) {
      return sendJson(res, 401, { message: 'Bearerトークンが必要です', tokenHint: VALID_TOKEN });
    }
    parseBody(req).then((body) => {
      if (pathname.startsWith('/api/customers')) {
        return handleCustomers(req, res, pathname, body);
      }
      if (pathname.startsWith('/api/opportunities')) {
        return handleOpportunities(req, res, pathname, body);
      }
      return notFound(res);
    });
    return;
  }

  notFound(res);
}

http.createServer(handleRoutes).listen(PORT, () => {
  console.log(`Mock CRM listening on :${PORT}`);
});
