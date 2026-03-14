# 🐍 Python Serpents - CLI Guide

## Overview

The Python Serpents provide lightning-fast parallel event fetching with extensive CLI options for fine-grained control.

## Basic Usage

```bash
# Basic city + country search
python3 python/event_serpents.py "São Paulo" "Brazil"

# With Dragons (web scraping + Wikipedia)
python3 python/event_serpents.py "Porto Alegre" "Brazil" --dragons

# Limit results
python3 python/event_serpents.py "Rio de Janeiro" "Brazil" --limit 50
```

## CLI Arguments

### Positional Arguments

| Argument | Description | Example |
|----------|-------------|---------|
| `city` | City name | `"São Paulo"` |
| `country` | Country name | `"Brazil"` |

### Optional Arguments

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `--country-code` | string | Auto-detect | Country code (BR, US, FR, etc.) |
| `--limit` | number | None | Maximum events to return |
| `--parallel` | flag | `true` | Enable parallel fetching |
| `--max-parallel` | number | `10` | Max parallel requests |
| `--dragons` | flag | `false` | Enable Dragons (DuckDuckGo + Wikipedia) |
| `--serpents-only` | flag | `false` | Only API Serpents (no Dragons) |
| `--sources` | list | `['ticketmaster', 'sympla']` | Sources to use |

### Available Sources

- `ticketmaster` - Ticketmaster API (via Python Viper 🐍)
- `sympla` - Sympla API (via Python Cobra 🐍)
- `duckduckgo` - DuckDuckGo web search (via Feather-Dragon 🦅)
- `wikipedia` - Wikipedia knowledge (via Sage-Dragon 📚)

## Examples

### Example 1: Basic API Serpents Only

```bash
python3 python/event_serpents.py "Porto Alegre" "Brazil" \
  --sources ticketmaster sympla \
  --limit 100
```

**Expected Output:**
```
⚡ SERPENT STRIKE COMPLETE
   Time: 0.85s (parallel execution)
   Events: 2
   Errors: 0
```

### Example 2: With Dragons (Full Power)

```bash
python3 python/event_serpents.py "São Paulo" "Brazil" \
  --dragons \
  --max-parallel 20 \
  --limit 200
```

**Creatures Released:**
- 🐍 Viper (Ticketmaster)
- 🐍 Cobra (Sympla)
- 🦅 Feather-Dragon (DuckDuckGo)
- 📚 Sage-Dragon (Wikipedia)

### Example 3: Specific Sources Only

```bash
python3 python/event_serpents.py "Rio de Janeiro" "Brazil" \
  --sources ticketmaster duckduckgo \
  --limit 50
```

### Example 4: Country Code Specified

```bash
python3 python/event_serpents.py "Paris" "France" \
  --country-code FR \
  --sources ticketmaster \
  --limit 30
```

### Example 5: Maximum Parallelism

```bash
python3 python/event_serpents.py "Tokyo" "Japan" \
  --country-code JP \
  --dragons \
  --max-parallel 50 \
  --limit 500
```

## From Node.js (Bridge)

```javascript
const SerpentsBridge = require('./python/serpents_bridge');
const bridge = new SerpentsBridge();

// Check availability
const available = await bridge.checkAvailability();

if (available) {
    // Release with options
    const result = await bridge.releaseSerpents('São Paulo', 'Brazil', 'BR', {
        enableDragons: true,
        limit: 100,
        maxParallel: 20,
        sources: ['ticketmaster', 'sympla', 'duckduckgo']
    });
    
    console.log(`Found ${result.total} events in ${result.time_seconds}s`);
}
```

## Admin Dashboard Integration

The admin dashboard (`admin.html`) now includes Python Serpents controls:

### Crawler Tab

- **Use Python Serpents** - Enable/disable Python Serpents
- **Enable Dragons** - Add web scraping + Wikipedia
- **Python Max Parallel** - Control parallelism (1-50)
- **Python Event Limit** - Cap events returned
- **Python Sources** - Select which sources to use
- **Country Filter** - Filter by country
- **Artists Limit** - Limit artists processed
- **Events Limit per Artist** - Max events per artist

### Populate Town Tab

- **Use Python Serpents** - Enable/disable Python Serpents
- **Enable Dragons** - Add web scraping + Wikipedia
- **Python Max Parallel** - Control parallelism
- **Python Sources** - Select which sources to use
- **Max Events** - Total events limit

## Performance Comparison

| Method | Time | Events | Speed |
|--------|------|--------|-------|
| Node.js Sequential | 9-15s | ~50 | 1x |
| Python Serpents | 0.5-3s | ~50 | 5-10x faster |
| Python + Dragons | 1-5s | ~100+ | 3-5x faster |

## Troubleshooting

### "No module named aiohttp"

```bash
sudo apt-get install python3-aiohttp python3-dotenv
```

### Python Serpents not available

The system automatically falls back to Node.js Event Sorcerers. Install dependencies for speed boost.

### Test individual serpent

```bash
python3 -c "from python.event_serpents import TicketmasterSerpent; print('OK')"
```

### Check Python dependencies

```bash
cd /var/www/KEEP-Up/backend
node python/serpents_bridge.js
```

## JSON Output Format

Python Serpents return JSON for Node.js bridge parsing:

```json
{
  "events": [
    {
      "event_key": "ticketmaster_ABC123",
      "event_name": "Concert Name",
      "artist_name": "Artist Name",
      "description": "Description",
      "event_date": "2026-02-21T00:00:00Z",
      "venue_name": "Venue Name",
      "venue_city": "São Paulo",
      "venue_country": "Brazil",
      "event_url": "https://...",
      "ticket_url": "https://...",
      "source": "ticketmaster_python",
      "category": "Music"
    }
  ],
  "total": 2,
  "time_seconds": 0.85,
  "errors": 0,
  "limited": true
}
```

## Status

✅ **OPERATIONAL** - Python Serpents are ready for production use!

## The Eternal Balance

> *"The Python Serpents strike fast, but the Event Sorcerers are reliable. Both serve The Eternal Balance."*

Python Serpents are **optional speed optimization**, not required. The system works perfectly with Node.js.
