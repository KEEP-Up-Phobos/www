BEAM WebSocket acceptor (Cowboy)

This minimal service accepts WebSocket connections on `/socket`, verifies HS256 `socketTicket` passed as `ticket` query param, and replies with a welcome message.

Run (dev):

```bash
# Install Elixir deps
cd backend/beam
mix deps.get

# Run with dev secret and default port 4004
TICKET_SECRET=keepup_dev_secret_change_me KEEPUP_BEAM_PORT=4004 iex -S mix
```

Connect from browser (example):

```javascript
const ticket = encodeURIComponent(localStorage.getItem('KEEPUP_SOCKET_TICKET'));
const ws = new WebSocket(`ws://localhost:4004/socket?ticket=${ticket}`);
ws.onmessage = m => console.log('msg', m.data);
```

Notes:
- This prototype uses HS256 and requires `TICKET_SECRET` to match the `auth-proxy` secret. For production, prefer RS256 and only give BEAM the public key.
- The handler currently echos JSON messages and replies to `{type:'ping'}` with a `{type:'pong'}` message. Extend to subscribe to broker messages and perform spatial routing in memory.
