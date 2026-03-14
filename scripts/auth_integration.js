#!/usr/bin/env node
(async () => {
  try {
    const envUrl = process.env.API_URL || '';
    let API_URL = envUrl || '';
    if (!API_URL) {
      const candidates = ['http://192.168.15.8:3002', 'http://localhost:3002', 'http://127.0.0.1:3002', 'http://0.0.0.0:3002'];
      for (const c of candidates) {
        try {
          const probe = await fetch(c + '/', { method: 'GET', redirect: 'manual' });
          if (probe.status >= 200 && probe.status < 600) { API_URL = c; break; }
        } catch (e) { /* try next */ }
      }
      if (!API_URL) API_URL = 'http://192.168.15.8:3002';
    }
    const suffix = Math.floor(Date.now() / 1000);
    const name = 'Integration Tester';
    const username = `node_int_user_${suffix}`;
    const email = `${username}@example.local`;
    const password = 'TestPass123!';

    console.log('API:', API_URL);
    console.log('Registering:', username, email);

    let cookie = null;

    const setCookieFromResponse = (res) => {
      const sc = res.headers.get('set-cookie');
      if (!sc) return;
      const m = sc.match(/KEEPUP_SESSION=([^;]+)/);
      if (m) cookie = `KEEPUP_SESSION=${m[1]}`;
    };

    // Register
    let res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, email, password }),
    });
    setCookieFromResponse(res);
    const registerBody = await res.text();
    if (res.status !== 200) {
      console.error('Register failed', res.status, registerBody);
      process.exit(2);
    }
    console.log('Register OK');

    // Login
    res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify({ email, username, password }),
    });
    setCookieFromResponse(res);
    const loginBody = await res.text();
    if (res.status !== 200) {
      console.error('Login failed', res.status, loginBody);
      process.exit(3);
    }
    console.log('Login OK');

    // Check
    res = await fetch(`${API_URL}/api/auth/check`, {
      method: 'GET',
      headers: cookie ? { Cookie: cookie } : {},
    });
    const checkBody = await res.text();
    if (res.status !== 200) {
      console.error('Check failed', res.status, checkBody);
      process.exit(4);
    }
    console.log('Check OK');
    console.log('Response:', checkBody);
    console.log('Integration test succeeded');
    process.exit(0);
  } catch (err) {
    console.error('Error running integration script', err);
    process.exit(1);
  }
})();
