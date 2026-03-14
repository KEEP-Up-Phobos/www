Socket-proxy — quick WebSocket server for testing socket ticket auth

This service accepts WebSocket connections and verifies the short-lived `socketTicket` by calling the `auth-proxy` `/auth/verify` endpoint. It's intended for local testing.

Install & run

```bash
cd backend/socket-proxy
npm install
AUTH_PROXY_VERIFY=http://localhost:4002/auth/verify npm start
```

Connect examples

- Query param (recommended):

```javascript
const ticket = encodeURIComponent(localStorage.getItem('KEEPUP_SOCKET_TICKET'));
const ws = new WebSocket(`ws://localhost:4003/?ticket=${ticket}`);
ws.onopen = () => console.log('open');
ws.onmessage = (m) => console.log('msg', m.data);
```

- `Authorization: Bearer <ticket>` header (some clients can set via `Sec-WebSocket-Protocol` or custom client libraries)

Security notes

- This proxy calls `auth-proxy` to validate tickets and does not require the shared secret.
- For production, use BEAM/Phoenix (or a hardened socket server) that verifies tickets directly via public-key signature (RS256) or holds secrets securely.

Behavior

- If ticket verification succeeds, the socket stays open and receives a welcome JSON with `{ ok: true, message: 'socket authenticated', user }`.
- If verification fails, the server sends `{ ok: false, error: 'authentication_failed' }` and closes the socket.

Next steps

- Replace this proxy with the BEAM socket consumer using `KeepupBeam.AuthValidator` to verify tickets locally (recommended for final deployment).
- Wire frontend to request `socketTicket` at login and connect to the socket as demonstrated.
