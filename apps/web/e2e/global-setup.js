const API_URL = process.env['API_URL'] ?? 'http://localhost:4000';

async function globalSetup() {
  const res = await fetch(`${API_URL}/api/testing/reset`, { method: 'DELETE' });
  if (!res.ok) {
    console.warn(`[e2e:setup] /api/testing/reset returned ${res.status} — API may not be running in test mode`);
  }
}

module.exports = globalSetup;
