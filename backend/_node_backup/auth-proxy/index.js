const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

const app = express();
app.use(bodyParser.json());

// Use a strong secret in production (env var). Default is for local dev only.
const TICKET_SECRET = process.env.TICKET_SECRET || 'keepup_dev_secret_change_me';
const TICKET_TTL_SECONDS = parseInt(process.env.TICKET_TTL_SECONDS || '60', 10); // short-lived

// Simplified demo login - in production validate session cookie / MariaDB unified_sessions.
app.post('/auth/ticket', (req, res) => {
  // Accept either a body with user_id or Basic auth / cookie in real use.
  const { user_id } = req.body || {};
  if (!user_id) return res.status(400).json({ error: 'user_id required in body for demo' });

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: String(user_id),
    iat: now,
    exp: now + TICKET_TTL_SECONDS,
    typ: 'socket_ticket',
    // optional: include minimal user claims
  };

  const token = jwt.sign(payload, TICKET_SECRET, { algorithm: 'HS256' });
  res.json({ ticket: token, expires_in: TICKET_TTL_SECONDS });
});

// Endpoint to introspect/verify ticket (for debugging)
app.post('/auth/verify', (req, res) => {
  const { ticket } = req.body || {};
  if (!ticket) return res.status(400).json({ error: 'ticket required' });
  try {
    const decoded = jwt.verify(ticket, TICKET_SECRET, { algorithms: ['HS256'] });
    res.json({ ok: true, decoded });
  } catch (err) {
    res.status(401).json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 4002;
app.listen(PORT, () => console.log(`Auth-proxy listening on ${PORT}`));
