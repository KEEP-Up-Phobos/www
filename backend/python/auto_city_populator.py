#!/usr/bin/env python3
"""
🌆 AUTO CITY POPULATOR — On-demand parallel AI event + venue discovery
======================================================================
When a user lands in a city with no events, this script fires ALL
available AI providers in PARALLEL to populate the city FAST.

Unlike the fallback chain (try A → if fail try B), this runs
every provider simultaneously — each AI sees the same city but
returns different results, maximizing event coverage.

Providers (ALL run in parallel):
  - DeepSeek direct:       always runs if key present
  - Free OpenRouter models: always run if key present (no cost)
  - Ticketmaster API:       REST call (non-AI)
  - Viagogo scraper:        lightweight HTTP scraper (BeautifulSoup)
  - Sympla scraper:         Brazilian event platform (BeautifulSoup)
  - Eventbrite scraper:     Global event platform (BeautifulSoup)
  - Bandsintown API:        Artist tour dates (REST, no key needed)
  - Venue discovery (AI):   finds popular venues/places for the map

Usage:
  python3 auto_city_populator.py "Porto Alegre" "Brazil" --lat -30.0346 --lng -51.2177
"""

import asyncio
import aiohttp
import json
import os
import re
import sys
import time
import unicodedata
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from urllib.parse import quote_plus

try:
    from dotenv import load_dotenv
except ImportError:
    import subprocess
    subprocess.check_call(['pip', 'install', 'python-dotenv'])
    from dotenv import load_dotenv

# Load environment
ENV_PATH = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(ENV_PATH)

# ── AI Configuration ──────────────────────────────────────────
DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY', '')
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"

OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY', '')
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

# Free OpenRouter models — run ALL in parallel (zero cost)
FREE_MODELS = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'mistralai/mistral-small-3.1-24b-instruct:free',
    'google/gemma-3-27b-it:free',
    'qwen/qwen3-4b:free',
]

# Ticketmaster key (non-AI source)
TICKETMASTER_API_KEY = os.getenv('TICKETMASTER_API_KEY', '')

# ── Postgres Configuration ──────────────────────────────────
PG_CONFIG = {
    'host': os.getenv('PG_DB_HOST', 'localhost'),
    'port': int(os.getenv('PG_DB_PORT', '5432')),
    'user': os.getenv('PG_DB_USER', 'keepup_user'),
    'password': os.getenv('PG_DB_PASSWORD', 'keepup_pass'),
    'database': os.getenv('PG_DB_NAME', 'keepup_events'),
}


def build_event_prompt(city: str, country: str, category: str = "") -> str:
    """Build the prompt that asks AI to find events."""
    cat_hint = f" Focus on {category} events." if category else ""
    return f"""Find real upcoming events in {city}, {country}.{cat_hint}

Search your knowledge for actual events, concerts, festivals, shows,
sports, theater, community gatherings happening in or near {city}.

For each event provide:
- name: Event or show name
- artist: Performer/artist/team name (if applicable)
- date: Date in YYYY-MM-DD format (or "TBA" if unknown)
- venue: Venue or location name
- city: "{city}"
- country: "{country}"
- category: one of Music, Sports, Theater, Festival, Comedy, Community, Other
- description: Brief description (1-2 sentences)

Return ONLY a valid JSON array of event objects. No markdown, no explanation.
If you know of no events, return an empty array: []
"""


def build_venue_prompt(city: str, country: str, lat: float = None, lng: float = None) -> str:
    """Build prompt to discover popular venues/places for the map."""
    coords_hint = f" (near latitude {lat}, longitude {lng})" if lat and lng else ""
    return f"""List popular event venues, performance spaces, and gathering places in {city}, {country}{coords_hint}.

Include all types of locations where events happen:
- Concert halls, theaters, auditoriums
- Sports stadiums and arenas
- Bars, clubs, and nightlife venues with live music
- Convention centers and exhibition halls
- Cultural centers, museums with event spaces
- Parks and outdoor amphitheaters
- Community centers, churches with events

For each venue provide:
- name: Official venue name
- address: Street address (if known)
- city: "{city}"
- country: "{country}"
- latitude: Approximate latitude (decimal, e.g. -30.0346)
- longitude: Approximate longitude (decimal, e.g. -51.2177)
- category: one of Venue, Stadium, Theater, Bar, Club, Cultural, Park, Arena, Other
- capacity: Estimated capacity (number or "Unknown")
- description: Brief description (1-2 sentences about the venue)

Return ONLY a valid JSON array. No markdown, no explanation.
If you know of no venues, return an empty array: []
"""


async def call_ai(session: aiohttp.ClientSession,
                  api_url: str, api_key: str, model: str,
                  prompt: str, provider_tag: str,
                  extra_headers: Optional[Dict] = None) -> Tuple[str, List[Dict]]:
    """
    Call a single AI provider and parse events from response.
    Returns (provider_tag, events_list).
    """
    try:
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.5,
            "max_tokens": 3000
        }
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        if extra_headers:
            headers.update(extra_headers)

        async with session.post(api_url, json=payload, headers=headers,
                                timeout=aiohttp.ClientTimeout(total=45)) as response:
            if response.status != 200:
                error_text = await response.text()
                print(f"  ⚠️  {provider_tag}: HTTP {response.status} — {error_text[:100]}")
                return (provider_tag, [])

            data = await response.json()
            content = data['choices'][0]['message']['content']

            # Parse JSON array from response
            json_match = re.search(r'\[[\s\S]*\]', content)
            if json_match:
                events = json.loads(json_match.group())
                if isinstance(events, list):
                    # Tag each event with source
                    for e in events:
                        e['source'] = f'auto_populate_{provider_tag}'
                    print(f"  ✅ {provider_tag}: {len(events)} events")
                    return (provider_tag, events)

            print(f"  ⚠️  {provider_tag}: No JSON array in response")
            return (provider_tag, [])

    except asyncio.TimeoutError:
        print(f"  ⚠️  {provider_tag}: Timeout (45s)")
        return (provider_tag, [])
    except Exception as e:
        print(f"  ⚠️  {provider_tag}: {e}")
        return (provider_tag, [])


async def fetch_ticketmaster(session: aiohttp.ClientSession,
                             city: str, country_code: str = 'BR') -> List[Dict]:
    """Fetch from Ticketmaster Discovery API (non-AI, just REST)."""
    if not TICKETMASTER_API_KEY or TICKETMASTER_API_KEY == 'your_key_here':
        return []

    try:
        params = {
            'apikey': TICKETMASTER_API_KEY,
            'city': city,
            'countryCode': country_code,
            'size': 50,
            'sort': 'date,asc'
        }
        async with session.get('https://app.ticketmaster.com/discovery/v2/events',
                               params=params,
                               timeout=aiohttp.ClientTimeout(total=15)) as response:
            if response.status != 200:
                return []
            data = await response.json()
            raw_events = data.get('_embedded', {}).get('events', [])
            events = []
            for ev in raw_events:
                venue = ev.get('_embedded', {}).get('venues', [{}])[0]
                events.append({
                    'name': ev.get('name', ''),
                    'artist': ev.get('name', ''),
                    'date': ev.get('dates', {}).get('start', {}).get('localDate', 'TBA'),
                    'venue': venue.get('name', 'TBA'),
                    'city': city,
                    'country': 'Brazil',
                    'category': 'Music',
                    'description': ev.get('info', ''),
                    'url': ev.get('url', ''),
                    'source': 'auto_populate_ticketmaster',
                })
            print(f"  ✅ Ticketmaster: {len(events)} events")
            return events
    except Exception as e:
        print(f"  ⚠️  Ticketmaster: {e}")
        return []


# ── Viagogo helpers ──────────────────────────────────────────
def _normalize_city_for_url(city: str) -> str:
    """Remove accents, lowercase, replace spaces with +."""
    nfkd = unicodedata.normalize('NFD', city)
    no_accents = ''.join(c for c in nfkd if unicodedata.category(c) != 'Mn')
    return no_accents.lower().replace(' ', '+')


def _parse_viagogo_date(text: str) -> Optional[str]:
    """Parse Portuguese/English date from Viagogo event text → ISO date."""
    months = {
        'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
        'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12,
        'feb': 2, 'apr': 4, 'may': 5, 'aug': 8, 'sep': 9, 'oct': 10, 'dec': 12,
    }
    # Portuguese: "11 mar QUA Bryan Adams 21:00 | Venue | City"
    m = re.search(
        r'(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+\w+\s+(.+?)\s+(\d{1,2}:\d{2})\s*\|\s*([^|]+)\|\s*([^|]+)',
        text, re.IGNORECASE
    )
    if m:
        day, mon, artist, time_s, venue, loc = m.groups()
        mn = months.get(mon.lower(), 1)
        yr = datetime.now().year
        if mn < datetime.now().month:
            yr += 1
        h, mi = map(int, time_s.split(':'))
        return f'{yr}-{mn:02d}-{int(day):02d}T{h:02d}:{mi:02d}:00', artist.strip(), venue.strip(), loc.strip()

    # Simpler: "11 mar QUA Artist 21:00 | City"
    m2 = re.search(
        r'(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+\w+\s+(.+?)\s+(\d{1,2}:\d{2})\s*\|\s*(.+)',
        text, re.IGNORECASE
    )
    if m2:
        day, mon, artist, time_s, loc = m2.groups()
        mn = months.get(mon.lower(), 1)
        yr = datetime.now().year
        if mn < datetime.now().month:
            yr += 1
        h, mi = map(int, time_s.split(':'))
        return f'{yr}-{mn:02d}-{int(day):02d}T{h:02d}:{mi:02d}:00', artist.strip(), 'Venue TBA', loc.strip()

    return None


async def fetch_viagogo(session: aiohttp.ClientSession,
                        city: str, lat: float = None, lng: float = None) -> Tuple[str, List[Dict]]:
    """
    Lightweight Viagogo scraper — uses aiohttp + BeautifulSoup (no Selenium).
    Fetches the search results page and parses event cards from HTML.
    """
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        print("  ⚠️  Viagogo: beautifulsoup4 not installed")
        return ('viagogo', [])

    url = f'https://www.viagogo.com/br/secure/Search?q={_normalize_city_for_url(city)}'
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }

    try:
        async with session.get(url, headers=headers,
                               timeout=aiohttp.ClientTimeout(total=20),
                               allow_redirects=True) as response:
            if response.status != 200:
                print(f"  ⚠️  Viagogo: HTTP {response.status}")
                return ('viagogo', [])

            html = await response.text()
            soup = BeautifulSoup(html, 'html.parser')

            events = []
            seen_keys = set()

            for link in soup.find_all('a', href=True):
                href = link['href']
                if '/E-' not in href:
                    continue

                text = link.get_text(' ', strip=True)
                if not text or len(text) < 10:
                    continue
                if text.strip().lower() in ('ver ingressos', 'see tickets'):
                    continue

                # Extract event ID
                eid_match = re.search(r'/E-(\d+)', href)
                eid = eid_match.group(1) if eid_match else str(hash(href) & 0xFFFFFFFF)
                event_key = f"viagogo_{eid}"

                if event_key in seen_keys:
                    continue
                seen_keys.add(event_key)

                # Try to parse date, artist, venue from text
                parsed = _parse_viagogo_date(text)
                if parsed is None:
                    continue

                event_date, artist_name, venue_name, venue_city = parsed

                # Clean artist name
                artist_name = re.sub(r'\s*(Ver ingressos|See tickets|Tickets|Buy).*$', '', artist_name, flags=re.IGNORECASE).strip()
                artist_name = re.sub(r'\s+', ' ', artist_name).strip()
                if not artist_name or len(artist_name) < 2:
                    continue

                full_url = f'https://www.viagogo.com{href}' if href.startswith('/') else href

                events.append({
                    'name': artist_name,
                    'artist': artist_name,
                    'date': event_date[:10] if event_date else 'TBA',
                    'venue': venue_name,
                    'city': city,
                    'country': 'Brazil',
                    'category': 'Music',
                    'description': f'{artist_name} live in {venue_city}',
                    'url': full_url,
                    'source': 'auto_populate_viagogo',
                    'venue_latitude': lat,
                    'venue_longitude': lng,
                })

            print(f"  ✅ Viagogo: {len(events)} events")
            return ('viagogo', events)

    except asyncio.TimeoutError:
        print("  ⚠️  Viagogo: Timeout (20s)")
        return ('viagogo', [])
    except Exception as e:
        print(f"  ⚠️  Viagogo: {e}")
        return ('viagogo', [])


# ── Sympla (Brazilian event platform) ────────────────────────
async def fetch_sympla(session: aiohttp.ClientSession,
                       city: str, lat: float = None, lng: float = None) -> Tuple[str, List[Dict]]:
    """
    Scrape Sympla event listings for a city.
    Uses the public browse page (no API key needed).
    """
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        return ('sympla', [])

    # Build city slug: "Porto Alegre" → "porto-alegre"
    slug = unicodedata.normalize('NFD', city)
    slug = ''.join(c for c in slug if unicodedata.category(c) != 'Mn')
    slug = slug.lower().replace(' ', '-')
    url = f'https://www.sympla.com.br/eventos/{slug}'

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9',
    }

    try:
        async with session.get(url, headers=headers,
                               timeout=aiohttp.ClientTimeout(total=15),
                               allow_redirects=True) as response:
            if response.status != 200:
                print(f"  ⚠️  Sympla: HTTP {response.status}")
                return ('sympla', [])

            html = await response.text()
            soup = BeautifulSoup(html, 'html.parser')
            events = []
            seen = set()

            for link in soup.find_all('a', href=True):
                href = link['href']
                if '/evento/' not in href:
                    continue

                title = link.get_text(' ', strip=True)
                if not title or len(title) < 5:
                    continue

                # Extract event slug/ID
                id_match = re.search(r'/evento/([^/]+)', href)
                eid = id_match.group(1) if id_match else str(hash(href) & 0xFFFFFFFF)
                event_key = f"sympla_{eid}"

                if event_key in seen:
                    continue
                seen.add(event_key)

                full_url = href if href.startswith('http') else f'https://www.sympla.com.br{href}'

                # Try to extract date from nearby elements
                parent = link.find_parent(['div', 'li', 'article'])
                date_text = ''
                if parent:
                    date_el = parent.find(string=re.compile(r'\d{1,2}\s+(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)', re.IGNORECASE))
                    if date_el:
                        date_text = date_el.strip()

                event_date = 'TBA'
                if date_text:
                    dm = re.search(r'(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)', date_text, re.IGNORECASE)
                    if dm:
                        months_pt = {'jan':1,'fev':2,'mar':3,'abr':4,'mai':5,'jun':6,'jul':7,'ago':8,'set':9,'out':10,'nov':11,'dez':12}
                        mn = months_pt.get(dm.group(2).lower(), 1)
                        yr = datetime.now().year
                        if mn < datetime.now().month:
                            yr += 1
                        event_date = f'{yr}-{mn:02d}-{int(dm.group(1)):02d}'

                events.append({
                    'name': title[:200],
                    'artist': title[:200],
                    'date': event_date,
                    'venue': 'Sympla Venue',
                    'city': city,
                    'country': 'Brazil',
                    'category': 'Event',
                    'description': '',
                    'url': full_url,
                    'source': 'auto_populate_sympla',
                    'venue_latitude': lat,
                    'venue_longitude': lng,
                })

            print(f"  ✅ Sympla: {len(events)} events")
            return ('sympla', events)

    except asyncio.TimeoutError:
        print("  ⚠️  Sympla: Timeout")
        return ('sympla', [])
    except Exception as e:
        print(f"  ⚠️  Sympla: {e}")
        return ('sympla', [])


# ── Eventbrite (global event platform) ───────────────────────
async def fetch_eventbrite(session: aiohttp.ClientSession,
                           city: str, lat: float = None, lng: float = None) -> Tuple[str, List[Dict]]:
    """
    Scrape Eventbrite event listings. No API key needed — uses public search page.
    """
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        return ('eventbrite', [])

    slug = unicodedata.normalize('NFD', city)
    slug = ''.join(c for c in slug if unicodedata.category(c) != 'Mn')
    slug = slug.lower().replace(' ', '-')
    url = f'https://www.eventbrite.com.br/d/{slug}/events/'

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    }

    try:
        async with session.get(url, headers=headers,
                               timeout=aiohttp.ClientTimeout(total=15),
                               allow_redirects=True) as response:
            if response.status != 200:
                print(f"  ⚠️  Eventbrite: HTTP {response.status}")
                return ('eventbrite', [])

            html = await response.text()
            soup = BeautifulSoup(html, 'html.parser')
            events = []
            seen = set()

            # Eventbrite uses structured data (JSON-LD) — much more reliable
            for script in soup.find_all('script', type='application/ld+json'):
                try:
                    ld_data = json.loads(script.string or '{}')
                    items = ld_data if isinstance(ld_data, list) else [ld_data]
                    for item in items:
                        if item.get('@type') != 'Event':
                            continue
                        name = item.get('name', '')
                        if not name or name in seen:
                            continue
                        seen.add(name)

                        loc = item.get('location', {})
                        addr = loc.get('address', {})
                        ev_date = (item.get('startDate') or '')[:10] or 'TBA'
                        ev_lat = loc.get('geo', {}).get('latitude') or lat
                        ev_lng = loc.get('geo', {}).get('longitude') or lng

                        events.append({
                            'name': name[:200],
                            'artist': name[:200],
                            'date': ev_date,
                            'venue': loc.get('name', 'TBA'),
                            'city': addr.get('addressLocality', city),
                            'country': addr.get('addressCountry', 'Brazil'),
                            'category': 'Event',
                            'description': (item.get('description') or '')[:300],
                            'url': item.get('url', ''),
                            'source': 'auto_populate_eventbrite',
                            'venue_latitude': ev_lat,
                            'venue_longitude': ev_lng,
                        })
                except (json.JSONDecodeError, TypeError):
                    continue

            # Fallback: parse event card links if no JSON-LD
            if not events:
                for link in soup.find_all('a', href=True):
                    href = link['href']
                    if '/e/' not in href or 'tickets' not in href.lower():
                        # Eventbrite event URLs typically contain /e/ and end with ticket ID
                        if '/e/' not in href:
                            continue

                    title = link.get_text(' ', strip=True)
                    if not title or len(title) < 5 or title in seen:
                        continue
                    seen.add(title)

                    full_url = href if href.startswith('http') else f'https://www.eventbrite.com.br{href}'
                    events.append({
                        'name': title[:200],
                        'artist': title[:200],
                        'date': 'TBA',
                        'venue': 'TBA',
                        'city': city,
                        'country': 'Brazil',
                        'category': 'Event',
                        'description': '',
                        'url': full_url,
                        'source': 'auto_populate_eventbrite',
                        'venue_latitude': lat,
                        'venue_longitude': lng,
                    })

            print(f"  ✅ Eventbrite: {len(events)} events")
            return ('eventbrite', events)

    except asyncio.TimeoutError:
        print("  ⚠️  Eventbrite: Timeout")
        return ('eventbrite', [])
    except Exception as e:
        print(f"  ⚠️  Eventbrite: {e}")
        return ('eventbrite', [])


# ── Bandsintown (artist tour dates, free REST API) ───────────
# Default popular artists that tour Brazil/South America
BANDSINTOWN_ARTISTS = [
    'Coldplay', 'Imagine Dragons', 'The Weeknd', 'Ed Sheeran',
    'Anitta', 'Ludmilla', 'Alok', 'Vintage Culture',
    'Jorge & Mateus', 'Henrique & Juliano',
    'Iron Maiden', 'Pearl Jam', 'Red Hot Chili Peppers',
    'Bruno Mars', 'Maroon 5', 'Dua Lipa',
    'Foo Fighters', 'Arctic Monkeys', 'Billie Eilish',
    'Twenty One Pilots', 'Linkin Park',
]

async def fetch_bandsintown(session: aiohttp.ClientSession,
                            city: str, country: str = 'Brazil',
                            lat: float = None, lng: float = None) -> Tuple[str, List[Dict]]:
    """
    Query Bandsintown free API for artist tour dates in/near a city.
    No API key needed (uses app_id=keepup-app).
    Checks multiple popular artists in parallel batches.
    """
    all_events = []
    city_lower = city.lower()
    country_lower = country.lower()

    async def _check_artist(artist: str) -> List[Dict]:
        """Check one artist's upcoming events."""
        try:
            url = f'https://rest.bandsintown.com/artists/{quote_plus(artist)}/events?app_id=keepup-app'
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=8)) as resp:
                if resp.status != 200:
                    return []
                data = await resp.json()
                if not isinstance(data, list):
                    return []

                events = []
                for ev in data:
                    venue = ev.get('venue', {})
                    v_city = (venue.get('city') or '').lower()
                    v_country = (venue.get('country') or '').lower()
                    # Filter: must match city OR country
                    if city_lower not in v_city and country_lower not in v_country:
                        continue

                    ev_date = (ev.get('datetime') or '')[:10] or 'TBA'
                    v_lat = venue.get('latitude')
                    v_lng = venue.get('longitude')
                    try:
                        v_lat = float(v_lat) if v_lat else lat
                        v_lng = float(v_lng) if v_lng else lng
                    except (ValueError, TypeError):
                        v_lat, v_lng = lat, lng

                    events.append({
                        'name': ev.get('title') or f'{artist} Live',
                        'artist': artist,
                        'date': ev_date,
                        'venue': venue.get('name', 'TBA'),
                        'city': venue.get('city', city),
                        'country': venue.get('country', country),
                        'category': 'Concert',
                        'description': f'{artist} live at {venue.get("name", "venue")}',
                        'url': ev.get('url', f'https://bandsintown.com/{quote_plus(artist)}'),
                        'source': 'auto_populate_bandsintown',
                        'venue_latitude': v_lat,
                        'venue_longitude': v_lng,
                    })
                return events
        except Exception:
            return []

    # Fire all artist checks in parallel (fast — each is a tiny REST call)
    artist_tasks = [_check_artist(a) for a in BANDSINTOWN_ARTISTS]
    results = await asyncio.gather(*artist_tasks, return_exceptions=True)

    for result in results:
        if isinstance(result, list):
            all_events.extend(result)

    print(f"  ✅ Bandsintown: {len(all_events)} events ({len(BANDSINTOWN_ARTISTS)} artists checked)")
    return ('bandsintown', all_events)


async def call_ai_venues(session: aiohttp.ClientSession,
                         api_url: str, api_key: str, model: str,
                         prompt: str, provider_tag: str,
                         city: str, country: str,
                         extra_headers: Optional[Dict] = None) -> Tuple[str, List[Dict]]:
    """
    Call an AI provider for venue/place discovery (not events).
    Returns venue entries with no date — they show on the map as locations.
    """
    try:
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.5,
            "max_tokens": 3000
        }
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        if extra_headers:
            headers.update(extra_headers)

        async with session.post(api_url, json=payload, headers=headers,
                                timeout=aiohttp.ClientTimeout(total=45)) as response:
            if response.status != 200:
                return (provider_tag, [])

            data = await response.json()
            content = data['choices'][0]['message']['content']

            json_match = re.search(r'\[[\s\S]*\]', content)
            if json_match:
                venues = json.loads(json_match.group())
                if isinstance(venues, list):
                    # Transform venues into event-like records (date=TBA, is_venue=true)
                    venue_events = []
                    for v in venues:
                        v_name = (v.get('name') or '').strip()
                        if not v_name or len(v_name) < 3:
                            continue
                        venue_events.append({
                            'name': v_name,
                            'artist': '',
                            'date': 'TBA',
                            'venue': v_name,
                            'city': city,
                            'country': country,
                            'category': v.get('category', 'Venue'),
                            'description': v.get('description', f'{v_name} — venue in {city}'),
                            'url': '',
                            'source': f'auto_populate_venue_{provider_tag}',
                            'venue_latitude': v.get('latitude'),
                            'venue_longitude': v.get('longitude'),
                            'is_venue': True,
                        })
                    print(f"  ✅ {provider_tag} (venues): {len(venue_events)} places")
                    return (provider_tag, venue_events)

            print(f"  ⚠️  {provider_tag} (venues): No JSON array in response")
            return (provider_tag, [])

    except asyncio.TimeoutError:
        print(f"  ⚠️  {provider_tag} (venues): Timeout")
        return (provider_tag, [])
    except Exception as e:
        print(f"  ⚠️  {provider_tag} (venues): {e}")
        return (provider_tag, [])


def deduplicate_events(events: List[Dict]) -> List[Dict]:
    """Remove duplicates by name similarity."""
    seen = set()
    unique = []
    for event in events:
        key = re.sub(r'[^a-z0-9]', '', (event.get('name', '') or '').lower())[:40]
        if key and key not in seen:
            seen.add(key)
            unique.append(event)
    return unique


async def save_to_postgres(events: List[Dict], lat: float = None, lng: float = None):
    """
    Save events to Postgres. The DB trigger `trg_events_geom` auto-creates
    the `geom` column from `venue_latitude`/`venue_longitude`, so we just
    need to provide lat/lng.
    """
    if not events:
        return 0

    try:
        import asyncpg
    except ImportError:
        import subprocess
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'asyncpg'])
        import asyncpg

    try:
        conn = await asyncpg.connect(
            host=PG_CONFIG['host'],
            port=PG_CONFIG['port'],
            user=PG_CONFIG['user'],
            password=PG_CONFIG['password'],
            database=PG_CONFIG['database'],
        )
    except Exception as e:
        print(f"  ❌ Postgres connect failed: {e}")
        return 0

    saved = 0
    for event in events:
        try:
            event_name = (event.get('name') or 'Unknown Event')[:255]
            # Unique key: source + normalized name + city
            city_slug = re.sub(r'[^a-z0-9]', '_', (event.get('city') or '').lower())[:30]
            name_slug = re.sub(r'[^a-z0-9]', '_', event_name.lower())[:60]
            event_key = f"auto_{city_slug}_{name_slug}_{int(time.time() * 1000) % 100000}"

            event_date = None
            raw_date = event.get('date', '')
            if raw_date and raw_date != 'TBA':
                try:
                    event_date = datetime.strptime(raw_date, '%Y-%m-%d')
                except ValueError:
                    pass

            # Use venue-specific lat/lng if AI provided them (venue discovery),
            # otherwise fall back to city-level coordinates
            venue_lat = event.get('venue_latitude') or lat or -30.0346
            venue_lng = event.get('venue_longitude') or lng or -51.2177
            # Ensure they're floats
            try:
                venue_lat = float(venue_lat)
                venue_lng = float(venue_lng)
            except (ValueError, TypeError):
                venue_lat = lat or -30.0346
                venue_lng = lng or -51.2177

            # Trigger trg_events_geom auto-creates geom from venue_latitude/venue_longitude
            await conn.execute("""
                INSERT INTO events (
                    event_key, event_name, description, event_date,
                    venue_name, venue_city, venue_country,
                    venue_latitude, venue_longitude,
                    event_url, source, category, artist_name
                ) VALUES (
                    $1, $2, $3, $4,
                    $5, $6, $7,
                    $8, $9,
                    $10, $11, $12, $13
                )
                ON CONFLICT (event_key) DO NOTHING
            """,
                event_key,
                event_name,
                (event.get('description') or '')[:500],
                event_date,
                (event.get('venue') or 'TBA')[:255],
                (event.get('city') or '')[:255],
                (event.get('country') or 'Brazil')[:255],
                venue_lat,
                venue_lng,
                (event.get('url') or '')[:500],
                (event.get('source') or 'auto_populate')[:100],
                (event.get('category') or 'Other')[:100],
                (event.get('artist') or event_name)[:255],
            )
            saved += 1
        except Exception as e:
            # Ignore duplicate key errors silently
            if 'duplicate' not in str(e).lower():
                print(f"  ⚠️  Insert error: {e}")

    await conn.close()
    return saved


async def auto_populate(city: str, country: str = 'Brazil',
                        lat: float = None, lng: float = None,
                        country_code: str = 'BR',
                        no_save: bool = False) -> Dict:
    """
    Run ALL AI providers + API sources + Viagogo + venue discovery in PARALLEL.
    Each provider generates events independently — interspersed, not fallback.
    """
    start_time = time.time()
    print(f"\n🌆 AUTO CITY POPULATOR: {city}, {country}")
    print(f"   Lat/Lng: {lat}, {lng}")

    # Build AI prompts (same city, different angles)
    prompt = build_event_prompt(city, country)
    music_prompt = build_event_prompt(city, country, "music and concerts")
    culture_prompt = build_event_prompt(city, country, "theater, arts, and cultural")
    venue_prompt = build_venue_prompt(city, country, lat, lng)

    tasks = []
    or_headers = {
        "HTTP-Referer": "https://app.keepup.lat",
        "X-Title": "KEEPUP"
    }

    async with aiohttp.ClientSession() as session:

        # ── DeepSeek: general + music (2 parallel calls) ───────
        if DEEPSEEK_API_KEY:
            tasks.append(call_ai(session, DEEPSEEK_API_URL, DEEPSEEK_API_KEY,
                                 "deepseek-chat", prompt, "deepseek"))
            tasks.append(call_ai(session, DEEPSEEK_API_URL, DEEPSEEK_API_KEY,
                                 "deepseek-chat", music_prompt, "deepseek_music"))

        # ── Free OpenRouter: each model gets a different angle ─
        if OPENROUTER_API_KEY:
            # Model 0: general events
            if len(FREE_MODELS) > 0:
                tasks.append(call_ai(session, OPENROUTER_API_URL, OPENROUTER_API_KEY,
                                     FREE_MODELS[0], prompt, FREE_MODELS[0].split('/')[1].split(':')[0],
                                     extra_headers=or_headers))
            # Model 1: music focus
            if len(FREE_MODELS) > 1:
                tasks.append(call_ai(session, OPENROUTER_API_URL, OPENROUTER_API_KEY,
                                     FREE_MODELS[1], music_prompt, FREE_MODELS[1].split('/')[1].split(':')[0],
                                     extra_headers=or_headers))
            # Model 2: culture focus
            if len(FREE_MODELS) > 2:
                tasks.append(call_ai(session, OPENROUTER_API_URL, OPENROUTER_API_KEY,
                                     FREE_MODELS[2], culture_prompt, FREE_MODELS[2].split('/')[1].split(':')[0],
                                     extra_headers=or_headers))
            # Model 3: general (different perspective)
            if len(FREE_MODELS) > 3:
                tasks.append(call_ai(session, OPENROUTER_API_URL, OPENROUTER_API_KEY,
                                     FREE_MODELS[3], prompt, FREE_MODELS[3].split('/')[1].split(':')[0],
                                     extra_headers=or_headers))

        # ── Ticketmaster API (non-AI, fast REST call) ──────────
        tasks.append(asyncio.ensure_future(
            fetch_ticketmaster(session, city, country_code)
        ))

        # ── Viagogo lightweight scraper (non-AI, HTTP+parse) ───
        tasks.append(asyncio.ensure_future(
            fetch_viagogo(session, city, lat, lng)
        ))

        # ── Sympla scraper (Brazilian events, HTTP+parse) ──────
        tasks.append(asyncio.ensure_future(
            fetch_sympla(session, city, lat, lng)
        ))

        # ── Eventbrite scraper (global events, HTTP+parse) ─────
        tasks.append(asyncio.ensure_future(
            fetch_eventbrite(session, city, lat, lng)
        ))

        # ── Bandsintown API (free, artist tour dates) ──────────
        tasks.append(asyncio.ensure_future(
            fetch_bandsintown(session, city, country, lat, lng)
        ))

        # ── Venue/place discovery via AI (for map locations) ───
        #    Use DeepSeek for venue discovery (best at structured data)
        if DEEPSEEK_API_KEY:
            tasks.append(call_ai_venues(session, DEEPSEEK_API_URL, DEEPSEEK_API_KEY,
                                        "deepseek-chat", venue_prompt,
                                        "deepseek_venues", city, country))
        # Also get venues from a free OpenRouter model (different perspective)
        if OPENROUTER_API_KEY and len(FREE_MODELS) > 0:
            tasks.append(call_ai_venues(session, OPENROUTER_API_URL, OPENROUTER_API_KEY,
                                        FREE_MODELS[0], venue_prompt,
                                        "openrouter_venues", city, country,
                                        extra_headers=or_headers))

        # ── Fire all tasks in parallel ─────────────────────────
        print(f"   🚀 Launching {len(tasks)} parallel searches (AI + Viagogo + Sympla + Eventbrite + Bandsintown + venues)...")
        results = await asyncio.gather(*tasks, return_exceptions=True)

    # ── Collect all events ─────────────────────────────────────
    all_events = []
    provider_stats = {}

    for result in results:
        if isinstance(result, Exception):
            print(f"  ⚠️  Task exception: {result}")
            continue
        if isinstance(result, tuple):
            provider_tag, events = result
            provider_stats[provider_tag] = len(events)
            all_events.extend(events)
        elif isinstance(result, list):
            # Ticketmaster returns a plain list
            provider_stats['ticketmaster'] = len(result)
            all_events.extend(result)

    # ── Deduplicate ────────────────────────────────────────────
    unique_events = deduplicate_events(all_events)

    # Split counts for logging
    venue_count = sum(1 for e in unique_events if e.get('is_venue'))
    event_count = len(unique_events) - venue_count
    elapsed = round(time.time() - start_time, 1)

    print(f"\n   📊 Results: {len(all_events)} total → {len(unique_events)} unique ({elapsed}s)")
    print(f"      Events: {event_count}  |  Venues/Places: {venue_count}")
    for provider, count in provider_stats.items():
        print(f"      {provider}: {count}")

    # ── Save to Postgres (or skip if --no-save) ─────────────────
    saved = 0
    if not no_save:
        saved = await save_to_postgres(unique_events, lat, lng)
        print(f"   💾 Saved {saved} events to Postgres")
    else:
        print(f"   ⏭️  Skipping Postgres save (--no-save mode, Node.js will save)")

    result = {
        'success': True,
        'city': city,
        'country': country,
        'total_found': len(all_events),
        'unique_events': len(unique_events),
        'saved': saved,
        'time_seconds': elapsed,
        'providers': provider_stats,
    }

    # When --no-save, include events data so Node.js bridge can save them
    if no_save:
        result['events'] = unique_events

    # Output JSON for Node.js bridge
    print(f"\n===JSON_START===")
    print(json.dumps(result, default=str))
    print(f"===JSON_END===")

    return result


# ── CLI entry point ────────────────────────────────────────────
if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python3 auto_city_populator.py <city> <country> [--lat N] [--lng N] [--cc BR] [--no-save]")
        sys.exit(1)

    city = sys.argv[1]
    country = sys.argv[2]
    lat = None
    lng = None
    cc = 'BR'
    no_save = False

    i = 3
    while i < len(sys.argv):
        if sys.argv[i] == '--lat' and i + 1 < len(sys.argv):
            lat = float(sys.argv[i + 1]); i += 2
        elif sys.argv[i] == '--lng' and i + 1 < len(sys.argv):
            lng = float(sys.argv[i + 1]); i += 2
        elif sys.argv[i] == '--cc' and i + 1 < len(sys.argv):
            cc = sys.argv[i + 1]; i += 2
        elif sys.argv[i] == '--no-save':
            no_save = True; i += 1
        else:
            i += 1

    asyncio.run(auto_populate(city, country, lat, lng, cc, no_save=no_save))
