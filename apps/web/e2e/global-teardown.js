const API_URL = process.env['API_URL'] ?? 'http://localhost:4000';

async function globalTeardown() {
  await fetch(`${API_URL}/api/testing/reset`, { method: 'DELETE' }).catch(() => {});
}

module.exports = globalTeardown;
