# 🐍 Python Serpents - Lightning-Fast Event Fetching

## Overview

The **Python Serpents** are optional async event fetchers that provide **5-10x speed improvement** over sequential Node.js fetching when querying multiple Event Sorcerer APIs simultaneously.

## Status: OPTIONAL

✅ **System works perfectly WITHOUT Python Serpents**  
⚡ **Python Serpents provide speed boost when available**

## How It Works

### Without Python Serpents (Node.js Sequential):
```
Ticketmaster → 3s → Eventbrite → 3s → Sympla → 3s = 9-15s total
```

### With Python Serpents (Parallel):
```
Ticketmaster ⚡
Eventbrite  ⚡  } All strike simultaneously
Sympla      ⚡
Total: ~3-5 seconds (fastest API wins)
```

## Installation

### Option 1: Automatic (Recommended)
```bash
cd /var/www/KEEP-Up/backend
sudo apt-get install -y python3-aiohttp python3-dotenv
```

### Option 2: Docker (Add to Dockerfile)
```dockerfile
# In docker-compose.yml, modify node service:
node:
  image: node:20  # Use full image, not alpine
  command: >
    sh -c "apt-get update && 
           apt-get install -y python3-aiohttp python3-dotenv &&
           npm install && node main_server.js"
```

## Testing

### Check if Python Serpents are available:
```bash
cd /var/www/KEEP-Up/backend
node python/serpents_bridge.js
```

### Expected Output:
```
✅ Python Serpents are READY!
🐍 Viper strikes for Ticketmaster... ✅ 75 events
🐍 Cobra strikes for Sympla... ✅ 0 events
⚡ SERPENT STRIKE COMPLETE in 3.45s
```

## Usage in Code

### From Node.js:
```javascript
const SerpentsBridge = require('./python/serpents_bridge');

const bridge = new SerpentsBridge();

// Check availability first
const available = await bridge.checkAvailability();

if (available) {
    // Use Python Serpents (faster)
    const result = await bridge.releaseSerpents('São Paulo', 'Brazil');
    console.log(`Found ${result.total} events in ${result.time_seconds}s`);
} else {
    // Fallback to Node.js Event Sorcerers
    const fetcher = new APIEventFetcher({city, country});
    const result = await fetcher.fetchAll();
}
```

### Direct Python:
```bash
python3 python/event_serpents.py "Porto Alegre" "Brazil"
```

## Architecture

```
┌─────────────────────────────────────────────┐
│         Node.js town-populator.js           │
│                     ↓                       │
│      ┌──────────────┴──────────────┐       │
│      ↓                             ↓       │
│  Option A:                    Option B:     │
│  Node.js Sorcerers            Python Bridge │
│  (api-event-fetcher.js)      (serpents.js) │
│      ↓                             ↓       │
│  Sequential APIs          Python Serpents  │
│  (9-15 seconds)           (event_serpents.py)│
│                                   ↓         │
│                           Parallel APIs     │
│                           (3-5 seconds)     │
└─────────────────────────────────────────────┘
```

## Files

- `python/event_serpents.py` - Python async fetchers
- `python/serpents_bridge.js` - Node.js ↔ Python bridge
- `api-event-fetcher.js` - Node.js fallback (always works)

## Troubleshooting

### "No module named aiohttp"
```bash
sudo apt-get install python3-aiohttp python3-dotenv
```

### "Python Serpents NOT available"
This is normal! The system will use Node.js Event Sorcerers automatically.

### Test individual serpents:
```bash
cd /var/www/KEEP-Up/backend
python3 -c "from python.event_serpents import TicketmasterSerpent; print('OK')"
```

## Performance Comparison

| Method | APIs | Time | Notes |
|--------|------|------|-------|
| Node.js Sequential | 6 | 15-25s | Always available |
| Python Parallel | 6 | 3-5s | Requires dependencies |
| AI Archmage | 1 | 5-10s | Fallback only |

## Remember

> *"The Python Serpents are swift, but the Event Sorcerers are reliable. Both serve The Eternal Balance."*

The system is designed to work perfectly with or without Python Serpents. They're an **optional speed optimization**, not a requirement.
