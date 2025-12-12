/*
  モックCRMが http://localhost:4000 で起動している前提で、
  認証と簡単なデータ取得を検証するスモークテストです。
*/

const BASE = process.env.MOCK_CRM_URL || 'http://localhost:4000';

async function run() {
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'secret' }),
  });
  if (!loginRes.ok) throw new Error(`login failed: ${loginRes.status}`);
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log('token', token);

  const headers = { Authorization: `Bearer ${token}` };
  const customers = await fetch(`${BASE}/api/customers`, { headers });
  if (!customers.ok) throw new Error(`customers failed: ${customers.status}`);
  const customerData = await customers.json();
  console.log('customers', customerData.data.length);

  const newCustomer = await fetch(`${BASE}/api/customers`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'New Demo', plan: 'starter', owner: 'QA' }),
  });
  const created = await newCustomer.json();
  console.log('created', created.data.id);

  const health = await fetch(`${BASE}/health`);
  console.log('health', await health.json());
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
