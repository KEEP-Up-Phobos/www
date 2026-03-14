const WebSocket = require('ws');
const fetch = require('node-fetch');
const url = require('url');

const PORT = process.env.PORT || 4003;
const AUTH_PROXY_VERIFY = process.env.AUTH_PROXY_VERIFY || 'http://localhost:4002/auth/verify';

const wss = new WebSocket.Server({ port: PORT }, () => {
  console.log(`Socket-proxy listening on ws://0.0.0.0:${PORT}`);
});

async function verifyTicket(ticket) {
  if (!ticket) return { ok: false, error: 'no_ticket' };
  try {
    const resp = await fetch(AUTH_PROXY_VERIFY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket })
    });
    if (!resp.ok) return { ok: false, error: `verify_status_${resp.status}` };
    const body = await resp.json();
    return body && body.ok ? { ok: true, decoded: body.decoded } : { ok: false, error: body.error || 'invalid' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

wss.on('connection', async function connection(ws, req) {
  const q = url.parse(req.url, true).query;
  const ticket = q.ticket || (req.headers && (req.headers['sec-websocket-protocol'] || req.headers['authorization']));

  // If ticket provided in Sec-WebSocket-Protocol or Authorization header like "Bearer <token>"
  let parsedTicket = ticket;
  if (parsedTicket && typeof parsedTicket === 'string' && parsedTicket.startsWith('Bearer ')) parsedTicket = parsedTicket.split(' ')[1];

  console.log('Incoming socket connection, verifying ticket...');
  const verification = await verifyTicket(parsedTicket);
  if (!verification.ok) {
    console.warn('Ticket verification failed:', verification.error);
    ws.send(JSON.stringify({ ok: false, error: 'authentication_failed' }));
    ws.close();
    return;
  }

  const claims = verification.decoded || {};
  console.log('Authenticated socket for user:', claims.sub || claims);

  // attach claims to ws for handlers
  ws.claims = claims;

  ws.send(JSON.stringify({ ok: true, message: 'socket authenticated', user: claims.sub || null }));

  ws.on('message', function message(message) {
    console.log('received: %s', message);
    // Echo back for demo
    try {
      const parsed = JSON.parse(message.toString());
      if (parsed.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', ts: new Date().toISOString() }));
      } else {
        ws.send(JSON.stringify({ echo: parsed }));
      }
    } catch (e) {
      ws.send(JSON.stringify({ echo: message.toString() }));
    }
  });

  ws.on('close', () => {
    console.log('Socket closed for user', claims.sub || '(unknown)');
  });
});

wss.on('listening', () => console.log('Socket proxy ready'));

wss.on('error', (err) => console.error('Socket server error', err));
