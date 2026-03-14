Auth-proxy (Node) — short-lived socket tickets

This small service issues short-lived HMAC-signed JWT tickets that BEAM can verify without DB access.

Usage (dev):

1. Install dependencies:

```bash
cd backend/auth-proxy
npm install
```

2. Start the service (dev secret):

```bash
TICKET_SECRET=keepup_dev_secret_change_me npm start
```

3. Request a ticket (demo):

```bash
curl -X POST http://localhost:4002/auth/ticket -H "Content-Type: application/json" -d '{"user_id":"42"}'
```

4. Verify ticket:

```bash
curl -X POST http://localhost:4002/auth/verify -H "Content-Type: application/json" -d '{"ticket":"<TOKEN>"}'
```

Production notes:
- Validate the caller's existing session (cookie or bearer token) against MariaDB `unified_sessions` before issuing a ticket.
- Use a secure, rotated `TICKET_SECRET` (managed by secrets store). Consider using asymmetric signing (RS256) if BEAM should not have symmetric secret.
- Keep `TICKET_TTL_SECONDS` very short (30-120s) and refresh on reconnect.

Client usage examples
---------------------

1) Phoenix / BEAM socket connect (JavaScript client - `phoenix` JS)

```javascript
import { Socket } from 'phoenix';

// Acquire `socketTicket` from login response (see backend auth flow)
const socketTicket = localStorage.getItem('KEEPUP_SOCKET_TICKET');
const socket = new Socket('wss://beam-host/socket', {
	params: { ticket: socketTicket }
});

socket.connect();

const channel = socket.channel('events:nearby', {});
channel.join()
	.receive('ok', resp => console.log('Joined', resp))
	.receive('error', resp => console.error('Join failed', resp));
```

2) Raw WebSocket example (include ticket in query or subprotocol)

```javascript
const ticket = encodeURIComponent(localStorage.getItem('KEEPUP_SOCKET_TICKET'));
const ws = new WebSocket(`wss://beam-host/socket?ticket=${ticket}`);
ws.onopen = () => console.log('socket open');
ws.onmessage = (m) => console.log('msg', m.data);
```

3) Frontend flow summary

- After successful login, the backend returns `socketTicket` in the JSON response.
- Store it briefly in `localStorage` under `KEEPUP_SOCKET_TICKET` and pass it to the socket connect as shown above.
- Do NOT persist the ticket long-term; it is short-lived and should be refreshed after expiry by re-issuing `/auth/ticket` or re-logging in.

Security notes
-------------
- Prefer sending the ticket via WebSocket params or `Authorization` header when supported.
- For production, use RS256 so BEAM only needs the public key to verify tickets (avoid symmetric secrets in BEAM).
- Rotate keys and monitor failed verification attempts.
