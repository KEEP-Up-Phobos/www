#!/usr/bin/env python3
"""
🐍🦅 KEEPUP FETCHER — Radar Sweeper
=====================================
Starts at a city center, sweeps outward in expanding radius rings (50km → 100km → ...),
resolves every event's real city via Nominatim reverse geocoding,
saves to fetcher_cities + fetcher_events + fetcher_venues.

Usage:
  python keepup_fetcher.py --city "Porto Alegre"
  python keepup_fetcher.py --city "São Paulo" --max-radius 500
  python keepup_fetcher.py --city "Paris" --step 100 --sources ticketmaster eventbrite bandsintown

Sources available:
  ticketmaster, sympla_api, sympla_scraper, bandsintown,
  viagogo_api, viagogo_scraper, eventbrite, ai

Environment (.env or shell):
  TICKETMASTER_API_KEY, SYMPLA_APP_TOKEN,
  DEEPSEEK_API_KEY, OPENROUTER_API_KEY,
  VIAGOGO_CLIENT_ID, VIAGOGO_CLIENT_SECRET,
  PG_DB_HOST, PG_DB_PORT, PG_DB_USER, PG_DB_PASSWORD, PG_DB_NAME
"""

import asyncio
import aiohttp
import argparse
import base64
import json
import logging
import math
import os
import re
import sys
import time
import unicodedata
from datetime import datetime
from typing import Dict, List, Optional, Set, Tuple

# ── Optional deps ─────────────────────────────────────────────
try:
    from bs4 import BeautifulSoup
    BS4 = True
except ImportError:
    BS4 = False

try:
    from dotenv import load_dotenv
    for _p in [os.path.join(os.path.dirname(__file__), '..', '.env'),
               os.path.join(os.path.dirname(__file__), '.env')]:
        if os.path.exists(_p):
            load_dotenv(_p)
            break
except ImportError:
    pass

# ── Logging ───────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s  %(levelname)s  %(message)s',
    datefmt='%H:%M:%S',
)
log = logging.getLogger('keepup')

# ── Keys ──────────────────────────────────────────────────────
TICKETMASTER_KEY    = os.getenv('TICKETMASTER_API_KEY', '')
SYMPLA_TOKEN        = os.getenv('SYMPLA_APP_TOKEN', '') or os.getenv('SYMPLA_API_TOKEN', '')
DEEPSEEK_KEY        = os.getenv('DEEPSEEK_API_KEY', '')
OPENROUTER_KEY      = os.getenv('OPENROUTER_API_KEY', '')
GEMINI_KEY          = os.getenv('GEMINI_API_KEY', '')
MISTRAL_KEY         = os.getenv('MISTRAL_API_KEY', '')
VIAGOGO_CLIENT_ID   = os.getenv('VIAGOGO_CLIENT_ID', '')
VIAGOGO_CLIENT_SEC  = os.getenv('VIAGOGO_CLIENT_SECRET', '')

DEEPSEEK_URL    = "https://api.deepseek.com/v1/chat/completions"
OPENROUTER_URL  = "https://openrouter.ai/api/v1/chat/completions"
GEMINI_URL      = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
MISTRAL_URL     = "https://api.mistral.ai/v1/chat/completions"
OR_HEADERS      = {"HTTP-Referer": "https://app.keepup.lat", "X-Title": "KEEPUP"}

FREE_MODELS = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'mistralai/mistral-small-3.1-24b-instruct:free',
    'google/gemma-3-27b-it:free',
    'qwen/qwen3-4b:free',
]

# ── Postgres ──────────────────────────────────────────────────
PG = {
    'host':     os.getenv('PG_DB_HOST', 'localhost'),
    'port':     int(os.getenv('PG_DB_PORT', '5432')),
    'user':     os.getenv('PG_DB_USER', 'keepup_user'),
    'password': os.getenv('PG_DB_PASSWORD', 'keepup_pass'),
    'database': os.getenv('PG_DB_NAME', 'keepup_events'),
}

# ── Nominatim ─────────────────────────────────────────────────
NOMINATIM_URL   = "https://nominatim.openstreetmap.org"
NOMINATIM_UA    = "KEEPUP-Fetcher/2.0 (contact@keepup.lat)"

# ── Radar config ──────────────────────────────────────────────
DEFAULT_STEP_KM     = 50
DEFAULT_MAX_KM      = 10_000   # daemon overrides per continent
RADAR_PAUSE_S       = 2.0      # pause between rings (be polite to APIs)

# ── Browser UA ───────────────────────────────────────────────
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0'

# ── Month map ─────────────────────────────────────────────────
MONTHS = {
    'jan':1,'fev':2,'mar':3,'abr':4,'mai':5,'jun':6,
    'jul':7,'ago':8,'set':9,'out':10,'nov':11,'dez':12,
    'feb':2,'apr':4,'may':5,'aug':8,'sep':9,'oct':10,'dec':12,
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# GEO HELPERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in km."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))


def km_to_deg_lat(km: float) -> float:
    return km / 111.0


def km_to_deg_lon(km: float, lat: float) -> float:
    return km / (111.0 * math.cos(math.radians(lat)))


# Nominatim reverse geocode cache (lat/lon → city info)
_nominatim_cache: Dict[str, Dict] = {}


async def reverse_geocode(session: aiohttp.ClientSession,
                          lat: float, lon: float) -> Dict:
    """
    Resolve (lat, lon) → {city, country, country_code} via Nominatim.
    Caches results to avoid hammering the API.
    """
    key = f"{round(lat, 2)}:{round(lon, 2)}"
    if key in _nominatim_cache:
        return _nominatim_cache[key]

    try:
        params = {
            'lat': lat, 'lon': lon,
            'format': 'json',
            'zoom': 10,          # city level
            'addressdetails': 1,
        }
        async with session.get(
            f"{NOMINATIM_URL}/reverse",
            params=params,
            headers={'User-Agent': NOMINATIM_UA},
            timeout=aiohttp.ClientTimeout(total=8),
        ) as resp:
            if resp.status != 200:
                return {}
            data = await resp.json(content_type=None)
            addr = data.get('address', {})
            result = {
                'city':         addr.get('city') or addr.get('town') or addr.get('village') or addr.get('municipality', ''),
                'country':      addr.get('country', ''),
                'country_code': addr.get('country_code', '').upper(),
            }
            _nominatim_cache[key] = result
            await asyncio.sleep(1.1)  # Nominatim rate limit: 1 req/s
            return result
    except Exception as e:
        log.debug(f"Nominatim error ({lat},{lon}): {e}")
        return {}


async def geocode_city(session: aiohttp.ClientSession,
                       city_name: str) -> Tuple[float, float, str, str]:
    """
    City name → (lat, lon, country, country_code) via Nominatim.
    """
    try:
        params = {'q': city_name, 'format': 'json', 'limit': 1, 'addressdetails': 1}
        async with session.get(
            f"{NOMINATIM_URL}/search",
            params=params,
            headers={'User-Agent': NOMINATIM_UA},
            timeout=aiohttp.ClientTimeout(total=8),
        ) as resp:
            if resp.status != 200:
                return None, None, '', ''
            results = await resp.json(content_type=None)
            if not results:
                return None, None, '', ''
            r = results[0]
            addr = r.get('address', {})
            await asyncio.sleep(1.1)
            return (
                float(r['lat']),
                float(r['lon']),
                addr.get('country', ''),
                addr.get('country_code', '').upper(),
            )
    except Exception as e:
        log.error(f"Geocode city '{city_name}' failed: {e}")
        return None, None, '', ''


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DATABASE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

_pg_conn = None


async def get_pg():
    global _pg_conn
    if _pg_conn is None or _pg_conn.is_closed():
        try:
            import asyncpg
        except ImportError:
            import subprocess
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'asyncpg', '-q'])
            import asyncpg
        _pg_conn = await asyncpg.connect(**PG)
    return _pg_conn


async def upsert_city(city_name: str, country: str, country_code: str,
                      lat: float, lon: float,
                      radius_km: float, border_km: float) -> int:
    """
    Insert or update fetcher_cities. Returns city.id.
    Updates current_radius_km and last_sweep_at on conflict.
    """
    conn = await get_pg()
    row = await conn.fetchrow("""
        INSERT INTO fetcher_cities
            (name, country, country_code, latitude, longitude,
             current_radius_km, border_radius_km, sweep_status,
             sweep_enabled, last_sweep_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'expanding',true,NOW())
        ON CONFLICT (name, country_code) DO UPDATE
            SET current_radius_km = EXCLUDED.current_radius_km,
                last_sweep_at     = NOW(),
                sweep_status      = EXCLUDED.sweep_status
        RETURNING id
    """, city_name, country, country_code, lat, lon,
         radius_km, border_km)
    return row['id']


async def upsert_venue(session: aiohttp.ClientSession,
                       name: str, lat: float, lon: float,
                       source: str, external_id: str,
                       address: str = '', category: str = '',
                       website: str = '') -> int:
    """
    Insert or update fetcher_venues. Resolves city via Nominatim. Returns venue.id.
    """
    conn = await get_pg()
    geo = await reverse_geocode(session, lat, lon)
    city_name    = geo.get('city', '')
    country      = geo.get('country', '')
    country_code = geo.get('country_code', '')

    # Ensure city exists
    city_id = None
    if city_name:
        city_id = await upsert_city(city_name, country, country_code, lat, lon, 0, 500)

    row = await conn.fetchrow("""
        INSERT INTO fetcher_venues
            (external_id, source, name, category, address, latitude, longitude, city_id, website)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (external_id, source) DO UPDATE
            SET name=EXCLUDED.name, latitude=EXCLUDED.latitude,
                longitude=EXCLUDED.longitude, updated_at=NOW()
        RETURNING id
    """, external_id or f"{source}_{name[:40]}",
         source, name[:500], category[:255] if category else None,
         address or None, lat, lon, city_id, website or None)
    return row['id']


async def save_event(session: aiohttp.ClientSession, ev: Dict,
                     origin_city_id: int) -> bool:
    """
    Save one event to fetcher_events.
    Resolves the event's REAL city via Nominatim using its lat/lon.
    This prevents all events being attributed to the sweep origin city.
    """
    conn = await get_pg()

    lat = ev.get('latitude') or ev.get('venue_latitude')
    lon = ev.get('longitude') or ev.get('venue_longitude')
    if lat is None or lon is None:
        lat = ev.get('origin_lat')
        lon = ev.get('origin_lon')

    # ── Resolve real city from event coordinates ──────────────
    real_city_id = origin_city_id  # fallback
    if lat and lon:
        geo = await reverse_geocode(session, lat, lon)
        real_city_name   = geo.get('city', '')
        real_country     = geo.get('country', '')
        real_country_code = geo.get('country_code', '')
        if real_city_name:
            real_city_id = await upsert_city(
                real_city_name, real_country, real_country_code,
                lat, lon, 0, 500)

    # ── Venue ─────────────────────────────────────────────────
    venue_id = None
    venue_name = ev.get('venue') or ev.get('venue_name', '')
    if venue_name and lat and lon:
        try:
            venue_id = await upsert_venue(
                session,
                name=venue_name,
                lat=float(lat), lon=float(lon),
                source=ev.get('source', 'keepup'),
                external_id=f"v_{ev.get('source','')}_{venue_name[:40]}",
                address=ev.get('venue_address', ''),
                category=ev.get('category', ''),
                website=ev.get('url', ''),
            )
        except Exception:
            pass

    # ── Parse date ────────────────────────────────────────────
    event_date = None
    raw = ev.get('date') or ev.get('event_date') or ''
    if raw and raw != 'TBA':
        for fmt in ('%Y-%m-%dT%H:%M:%S', '%Y-%m-%dT%H:%M:%SZ', '%Y-%m-%d'):
            try:
                event_date = datetime.strptime(raw[:19], fmt)
                break
            except ValueError:
                continue

    # ── external_id ───────────────────────────────────────────
    source      = (ev.get('source') or 'keepup')[:50]
    external_id = (ev.get('event_key') or ev.get('external_id') or
                   f"{source}_{re.sub(r'[^a-z0-9]','_',(ev.get('name','') or '').lower())[:60]}")[:255]

    try:
        await conn.execute("""
            INSERT INTO fetcher_events
                (external_id, source, name, description, category,
                 latitude, longitude, venue_name, city_id, venue_id,
                 start_date, url, image_url, price_min, price_max, currency)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
            ON CONFLICT (external_id, source) DO UPDATE
                SET name=EXCLUDED.name,
                    start_date=COALESCE(EXCLUDED.start_date, fetcher_events.start_date),
                    updated_at=NOW()
        """,
            external_id, source,
            (ev.get('name') or 'Unknown Event')[:500],
            (ev.get('description') or '')[:2000],
            (ev.get('category') or 'Other')[:255],
            float(lat) if lat else None,
            float(lon) if lon else None,
            venue_name[:500] if venue_name else None,
            real_city_id,
            venue_id,
            event_date,
            (ev.get('url') or ev.get('event_url') or ev.get('ticket_url') or '')[:1000],
            (ev.get('image_url') or '')[:1000],
            float(ev['price_min']) if ev.get('price_min') else None,
            float(ev['price_max']) if ev.get('price_max') else None,
            ev.get('currency'),
        )
        return True
    except Exception as e:
        if 'duplicate' not in str(e).lower():
            log.debug(f"DB insert error: {e}")
        return False


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# NOMINATIM ENRICH
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def enrich_description(session: aiohttp.ClientSession,
                              events: List[Dict]) -> List[Dict]:
    """
    Fill empty descriptions via DuckDuckGo Instant Answer API.
    Always runs (not optional).
    """
    DDG = "https://api.duckduckgo.com/"
    enriched = []
    for ev in events:
        if not ev.get('description'):
            artist = ev.get('artist') or ev.get('name', '')
            if artist:
                try:
                    async with session.get(
                        DDG,
                        params={'q': f'{artist} musician', 'format': 'json',
                                'no_html': 1, 'skip_disambig': 1},
                        headers={'User-Agent': UA},
                        timeout=aiohttp.ClientTimeout(total=5),
                    ) as resp:
                        if resp.status == 200:
                            d = await resp.json(content_type=None)
                            txt = d.get('AbstractText', '')
                            if txt:
                                ev = dict(ev)
                                ev['description'] = txt[:500]
                except Exception:
                    pass
                await asyncio.sleep(0.4)
        enriched.append(ev)
    return enriched


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# HELPERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def norm(city: str, sep='-') -> str:
    n = unicodedata.normalize('NFD', city)
    n = ''.join(c for c in n if unicodedata.category(c) != 'Mn')
    return n.lower().replace(' ', sep)


def parse_pt_date(text: str) -> Optional[Tuple]:
    m = re.search(
        r'(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+\w+'
        r'\s+(.+?)\s+(\d{1,2}:\d{2})\s*\|\s*([^|]+)\|\s*([^|]+)',
        text, re.IGNORECASE)
    if m:
        day, mon, artist, t, venue, loc = m.groups()
        mn = MONTHS.get(mon.lower(), 1)
        yr = datetime.now().year + (1 if mn < datetime.now().month else 0)
        h, mi = map(int, t.split(':'))
        return f'{yr}-{mn:02d}-{int(day):02d}T{h:02d}:{mi:02d}:00', artist.strip(), venue.strip(), loc.strip()
    m2 = re.search(
        r'(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+\w+'
        r'\s+(.+?)\s+(\d{1,2}:\d{2})\s*\|\s*(.+)',
        text, re.IGNORECASE)
    if m2:
        day, mon, artist, t, loc = m2.groups()
        mn = MONTHS.get(mon.lower(), 1)
        yr = datetime.now().year + (1 if mn < datetime.now().month else 0)
        h, mi = map(int, t.split(':'))
        return f'{yr}-{mn:02d}-{int(day):02d}T{h:02d}:{mi:02d}:00', artist.strip(), 'TBA', loc.strip()
    return None


def dedup(events: List[Dict]) -> List[Dict]:
    seen: Set[str] = set()
    out = []
    for e in events:
        k = re.sub(r'[^a-z0-9]', '', (e.get('name') or '').lower())[:50]
        if k and k not in seen:
            seen.add(k)
            out.append(e)
    return out


def load_artists_from_db_sync() -> List[str]:
    """
    Load artist names from the artists table (populated by artist_seed.py).
    Falls back to empty list if table doesn't exist yet.
    """
    try:
        import psycopg2
        conn = psycopg2.connect(**{k: v for k, v in PG.items()})
        cur = conn.cursor()
        cur.execute("SELECT name FROM artists WHERE is_active = true ORDER BY name LIMIT 5000")
        rows = cur.fetchall()
        cur.close(); conn.close()
        return [r[0] for r in rows]
    except Exception:
        return []


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SOURCE FETCHERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def fetch_ticketmaster(session: aiohttp.ClientSession,
                             lat: float, lon: float, radius_km: int) -> List[Dict]:
    if not TICKETMASTER_KEY:
        return []
    try:
        params = {
            'apikey': TICKETMASTER_KEY,
            'latlong': f'{lat},{lon}',
            'radius': str(radius_km),
            'unit': 'km',
            'size': 200,
            'sort': 'date,asc',
        }
        async with session.get(
            'https://app.ticketmaster.com/discovery/v2/events',
            params=params, timeout=aiohttp.ClientTimeout(total=15),
        ) as resp:
            if resp.status != 200:
                return []
            data = await resp.json()
            events = []
            for ev in data.get('_embedded', {}).get('events', []):
                venue = ev.get('_embedded', {}).get('venues', [{}])[0]
                vlat = venue.get('location', {}).get('latitude')
                vlon = venue.get('location', {}).get('longitude')
                # Pick best image: prefer 16_9 ratio, widest width
                images = ev.get('images', [])
                image_url = ''
                if images:
                    best = sorted(images, key=lambda i: i.get('width', 0), reverse=True)
                    image_url = best[0].get('url', '')

                events.append({
                    'name':        ev.get('name', ''),
                    'artist':      ev.get('name', ''),
                    'date':        ev.get('dates', {}).get('start', {}).get('dateTime', ''),
                    'venue':       venue.get('name', ''),
                    'category':    (ev.get('classifications') or [{}])[0].get('segment', {}).get('name', 'Event'),
                    'description': ev.get('info', ''),
                    'url':         ev.get('url', ''),
                    'image_url':   image_url,
                    'latitude':    float(vlat) if vlat else lat,
                    'longitude':   float(vlon) if vlon else lon,
                    'source':      'ticketmaster',
                    'event_key':   f"tm_{ev.get('id','')}",
                })
            log.info(f"  Ticketmaster: {len(events)} events")
            return events
    except Exception as e:
        log.warning(f"  Ticketmaster error: {e}")
        return []


async def fetch_sympla_api(session: aiohttp.ClientSession,
                           lat: float, lon: float) -> List[Dict]:
    if not SYMPLA_TOKEN:
        return []
    try:
        headers = {'s_token': SYMPLA_TOKEN, 'Accept': 'application/json'}
        async with session.get(
            'https://api.sympla.com.br/public/v1.5.1/events',
            headers=headers,
            params={'published': 'true', 'page_size': 200, 'page': 1},
            timeout=aiohttp.ClientTimeout(total=15),
        ) as resp:
            if resp.status != 200:
                return []
            data = await resp.json()
            events = []
            for ev in (data.get('data') or []):
                addr = ev.get('address', {})
                events.append({
                    'name':      ev.get('name', ''),
                    'artist':    ev.get('host', {}).get('name', ''),
                    'date':      ev.get('start_date', ''),
                    'venue':     addr.get('name', ''),
                    'category':  ev.get('category_prim', {}).get('name', 'Event'),
                    'description': ev.get('detail', ''),
                    'url':       ev.get('url', ''),
                    'latitude':  lat, 'longitude': lon,
                    'source':    'sympla_api',
                    'event_key': f"sympla_{ev.get('id','')}",
                })
            log.info(f"  Sympla API: {len(events)} events")
            return events
    except Exception as e:
        log.warning(f"  Sympla API error: {e}")
        return []


def bandsintown_city_slug(city_name: str, country: str = 'Brazil') -> str:
    """Porto Alegre + Brazil → porto-alegre-brazil"""
    import unicodedata as _ud
    def _s(t):
        n = _ud.normalize('NFD', t)
        return ''.join(c for c in n if _ud.category(c) != 'Mn').lower().replace(' ', '-').replace(',','').replace('.','')
    return f'{_s(city_name)}-{_s(country)}'


async def fetch_bandsintown(session: aiohttp.ClientSession,
                            lat: float, lon: float,
                            radius_km: float,
                            city_name: str = '',
                            country: str = 'Brazil') -> List[Dict]:
    """
    Scrapes Bandsintown city page and extracts MusicEvent JSON-LD.
    36+ events per city, no API key needed, structured data.
    URL: https://www.bandsintown.com/c/{city-slug}-{country-slug}
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        log.warning("  Bandsintown: playwright not installed (pip install playwright)")
        return []

    slug = bandsintown_city_slug(city_name, country)
    url  = f'https://www.bandsintown.com/c/{slug}'

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent=UA,
                locale='en-US',
            )
            page = await context.new_page()
            await page.goto(url, wait_until='domcontentloaded', timeout=30000)
            await page.wait_for_timeout(5000)
            html = await page.content()
            await browser.close()

        # Extract MusicEvent JSON-LD blocks
        ld_blocks = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL)
        events = []
        seen: Set[str] = set()

        for block in ld_blocks:
            try:
                data = json.loads(block)
                items = data if isinstance(data, list) else [data]
                for item in items:
                    if item.get('@type') != 'MusicEvent':
                        continue

                    ev_url = item.get('url', '')
                    ev_id  = re.search(r'/e/(\d+)', ev_url)
                    key    = f"bit_{ev_id.group(1) if ev_id else abs(hash(ev_url))}"
                    if key in seen:
                        continue
                    seen.add(key)

                    loc     = item.get('location', {})
                    geo     = loc.get('geo', {})
                    v_lat   = float(geo['latitude'])  if geo.get('latitude')  else lat
                    v_lon   = float(geo['longitude']) if geo.get('longitude') else lon
                    artist  = (item.get('performer') or {}).get('name', '') or item.get('name', '')
                    # Strip " @ Venue" from name if present
                    name    = item.get('name', '')
                    if ' @ ' in name:
                        artist = name.split(' @ ')[0].strip()
                        name   = artist

                    events.append({
                        'name':        name[:200],
                        'artist':      artist[:200],
                        'date':        (item.get('startDate') or '')[:19],
                        'venue':       loc.get('name', '')[:200],
                        'category':    'Concert',
                        'description': (item.get('description') or '')[:300],
                        'url':         ev_url,
                        'image_url':   item.get('image', ''),
                        'latitude':    v_lat,
                        'longitude':   v_lon,
                        'source':      'bandsintown',
                        'event_key':   key,
                    })
            except (json.JSONDecodeError, TypeError, KeyError):
                continue

        log.info(f"  Bandsintown: {len(events)} events for {city_name}")
        return events

    except Exception as e:
        log.warning(f"  Bandsintown error ({city_name}): {e}")
        return []

async def fetch_viagogo_api(session: aiohttp.ClientSession,
                            lat: float, lon: float,
                            radius_km: float) -> List[Dict]:
    if not VIAGOGO_CLIENT_ID or not VIAGOGO_CLIENT_SEC:
        return []
    try:
        creds = base64.b64encode(f"{VIAGOGO_CLIENT_ID}:{VIAGOGO_CLIENT_SEC}".encode()).decode()
        async with session.post(
            'https://account.viagogo.com/oauth2/token',
            headers={'Authorization': f'Basic {creds}',
                     'Content-Type': 'application/x-www-form-urlencoded'},
            data={'grant_type': 'client_credentials', 'scope': 'read:events'},
            timeout=aiohttp.ClientTimeout(total=15),
        ) as auth:
            if auth.status != 200:
                return []
            token = (await auth.json()).get('access_token')
        if not token:
            return []

        params = {
            'latitude': lat, 'longitude': lon,
            'max_distance_in_meters': int(radius_km * 1000),
            'page_size': 100,
            'exclude_parking_passes': 'true',
        }
        async with session.get(
            'https://api.viagogo.net/catalog/events/search',
            headers={'Authorization': f'Bearer {token}', 'Accept': 'application/hal+json'},
            params=params,
            timeout=aiohttp.ClientTimeout(total=15),
        ) as resp:
            if resp.status != 200:
                return []
            data = await resp.json()
            events = []
            for item in data.get('_embedded', {}).get('items', []):
                if item.get('status') in ('Cancelled', 'Deleted'):
                    continue
                vd = item.get('_embedded', {}).get('venue', {})
                vlat = vd.get('latitude', lat)
                vlon = vd.get('longitude', lon)
                eid  = item.get('id')
                eurl = item.get('_links', {}).get('event:webpage', {}).get(
                    'href', f'https://www.viagogo.com/E-{eid}')
                events.append({
                    'name':      item.get('name', ''),
                    'artist':    item.get('name', ''),
                    'date':      (item.get('start_date') or '')[:10],
                    'venue':     vd.get('name', ''),
                    'category':  'Concert',
                    'description': '',
                    'url':       eurl,
                    'latitude':  float(vlat) if vlat else lat,
                    'longitude': float(vlon) if vlon else lon,
                    'source':    'viagogo_api',
                    'event_key': f"vg_{eid}",
                })
            log.info(f"  Viagogo API: {len(events)} events")
            return events
    except Exception as e:
        log.warning(f"  Viagogo API error: {e}")
        return []


# Viagogo country code map (ISO2 → Viagogo URL prefix)
VIAGOGO_COUNTRY_MAP = {
    'BR': 'br', 'US': 'us', 'GB': 'gb', 'DE': 'de', 'FR': 'fr',
    'ES': 'es', 'IT': 'it', 'AR': 'ar', 'MX': 'mx', 'CL': 'cl',
    'CO': 'co', 'PE': 'pe', 'UY': 'uy', 'PY': 'py', 'BO': 'bo',
    'AU': 'au', 'NZ': 'nz', 'CA': 'ca', 'JP': 'jp', 'KR': 'kr',
    'NL': 'nl', 'BE': 'be', 'PT': 'pt', 'CH': 'ch', 'AT': 'at',
    'SE': 'se', 'NO': 'no', 'DK': 'dk', 'FI': 'fi', 'PL': 'pl',
    'ZA': 'za', 'NG': 'ng', 'IN': 'in', 'SG': 'sg', 'HK': 'hk',
}

# Portuguese month names for date parsing
VIAGOGO_MONTHS_PT = {
    'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
    'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12,
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
    'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
}


def viagogo_city_url(city_name: str, country_code: str = 'BR') -> str:
    """
    Build Viagogo city URL from city name and country code.
    Porto Alegre + BR → https://www.viagogo.com/br/Porto-Alegre
    Buenos Aires + AR → https://www.viagogo.com/ar/Buenos-Aires
    """
    vg_cc = VIAGOGO_COUNTRY_MAP.get(country_code.upper(), 'br')
    # Normalize: remove accents, title case, replace spaces with hyphens
    import unicodedata as _ud
    nfkd = _ud.normalize('NFD', city_name)
    no_acc = ''.join(c for c in nfkd if _ud.category(c) != 'Mn')
    city_slug = no_acc.title().replace(' ', '-')
    return f'https://www.viagogo.com/{vg_cc}/{city_slug}'


def parse_viagogo_date(day_month: str, time_str: str, year: int = None) -> str:
    """Parse Viagogo date like '01 abr' + '19:00' → ISO datetime."""
    if not day_month:
        return ''
    parts = day_month.strip().split()
    if len(parts) < 2:
        return ''
    try:
        day = int(parts[0])
        mon = VIAGOGO_MONTHS_PT.get(parts[1].lower()[:3], 0)
        if not mon:
            return ''
        if year is None:
            year = datetime.now().year
            if mon < datetime.now().month:
                year += 1
        if time_str:
            return f'{year}-{mon:02d}-{day:02d}T{time_str}:00'
        return f'{year}-{mon:02d}-{day:02d}'
    except (ValueError, IndexError):
        return ''


async def fetch_viagogo_scraper(session: aiohttp.ClientSession,
                                city_name: str,
                                lat: float, lon: float,
                                country_code: str = 'BR') -> List[Dict]:
    """
    Uses Viagogo's internal getExploreEvents JSON endpoint.
    No scraping needed — returns structured JSON directly.
    URL pattern: https://www.viagogo.com/{cc}/{City-Name}?method=getExploreEvents
    """
    url = f'{viagogo_city_url(city_name, country_code)}?method=getExploreEvents'
    headers = {
        'User-Agent': UA,
        'Accept': 'application/json',
        'Referer': viagogo_city_url(city_name, country_code),
    }
    try:
        async with session.get(url, headers=headers,
                               timeout=aiohttp.ClientTimeout(total=15),
                               allow_redirects=True) as resp:
            if resp.status != 200:
                log.debug(f"  Viagogo: HTTP {resp.status} for {city_name}")
                return []
            data = await resp.json(content_type=None)
            raw_events = data.get('events', [])
            if not raw_events:
                return []

            events = []
            for ev in raw_events:
                if ev.get('isParkingEvent'):
                    continue
                ev_id = ev.get('eventId')
                key = f"viagogo_{ev_id}"
                ev_date = parse_viagogo_date(
                    ev.get('formattedDateWithoutYear', ''),
                    ev.get('formattedTime', '')
                )
                events.append({
                    'name':      (ev.get('name') or '')[:200],
                    'artist':    (ev.get('name') or '')[:200],
                    'date':      ev_date,
                    'venue':     (ev.get('venueName') or '')[:200],
                    'category':  'Concert',
                    'description': '',
                    'url':       ev.get('url', ''),
                    'image_url': ev.get('imageUrl', ''),
                    'latitude':  lat,
                    'longitude': lon,
                    'source':    'viagogo',
                    'event_key': key,
                })

            log.info(f"  Viagogo: {len(events)} events for {city_name}")
            return events
    except Exception as e:
        log.warning(f"  Viagogo error ({city_name}): {e}")
        return []

SYMPLA_STATE_MAP = {
    'Porto Alegre': 'RS', 'Caxias do Sul': 'RS', 'Pelotas': 'RS', 'Santa Maria': 'RS',
    'São Paulo': 'SP', 'Campinas': 'SP', 'Santos': 'SP', 'São Bernardo do Campo': 'SP',
    'Rio de Janeiro': 'RJ', 'Niterói': 'RJ', 'Nova Iguaçu': 'RJ',
    'Belo Horizonte': 'MG', 'Uberlândia': 'MG', 'Contagem': 'MG',
    'Salvador': 'BA', 'Feira de Santana': 'BA',
    'Fortaleza': 'CE', 'Curitiba': 'PR', 'Londrina': 'PR',
    'Manaus': 'AM', 'Belém': 'PA', 'Recife': 'PE', 'Maceió': 'AL',
    'Natal': 'RN', 'Goiânia': 'GO', 'Brasília': 'DF',
    'Florianópolis': 'SC', 'Joinville': 'SC', 'Vitória': 'ES',
}


async def fetch_sympla_scraper(session: aiohttp.ClientSession,
                               city_name: str,
                               lat: float, lon: float) -> List[Dict]:
    """Uses Sympla internal discovery-bff API. No Playwright needed. Paginates all results."""
    state = SYMPLA_STATE_MAP.get(city_name, '')
    slug = f'{norm(city_name)}-{state.lower()}' if state else norm(city_name)
    headers = {
        'User-Agent': UA,
        'Accept': 'application/json',
        'Referer': f'https://www.sympla.com.br/eventos/{slug}',
    }
    base_url = 'https://www.sympla.com.br/api/discovery-bff/search/category-type'
    params = {
        'service':    '/v4/search',
        'has_banner': '1',
        'only':       'name,start_date,end_date,images,location,id,url,organizer',
        'sort':       'day-trending-score',
        'type':       'normal',
        'location':   city_name,
        'limit':      '24',
    }
    if state:
        params['state'] = state

    try:
        events = []
        seen: Set[str] = set()
        page = 1

        while True:
            params['page'] = str(page)
            async with session.get(base_url, params=params, headers=headers,
                                   timeout=aiohttp.ClientTimeout(total=15)) as resp:
                if resp.status != 200:
                    break
                data = await resp.json(content_type=None)
                items = data.get('data', [])
                if not items:
                    break

                for ev in items:
                    ev_id = ev.get('id')
                    key = f"sympla_{ev_id}"
                    if key in seen:
                        continue
                    seen.add(key)

                    loc = ev.get('location', {})
                    v_lat = loc.get('lat', lat)
                    v_lon = loc.get('lon', lon)
                    try:
                        v_lat = float(v_lat) if v_lat else lat
                        v_lon = float(v_lon) if v_lon else lon
                    except (ValueError, TypeError):
                        v_lat, v_lon = lat, lon

                    image_url = (ev.get('images') or {}).get('lg') or \
                                (ev.get('images') or {}).get('original', '')
                    artist = (ev.get('organizer') or {}).get('name', '') or ev.get('name', '')

                    events.append({
                        'name':      (ev.get('name') or '')[:200],
                        'artist':    artist[:200],
                        'date':      (ev.get('start_date') or '')[:19],
                        'venue':     (loc.get('name') or '')[:200],
                        'category':  'Event',
                        'description': '',
                        'url':       ev.get('url', ''),
                        'image_url': image_url,
                        'latitude':  v_lat,
                        'longitude': v_lon,
                        'source':    'sympla',
                        'event_key': key,
                    })

                if len(items) < 24:
                    break
                page += 1
                await asyncio.sleep(0.5)

        log.info(f"  Sympla: {len(events)} events ({page} pages)")
        return events
    except Exception as e:
        log.warning(f"  Sympla error: {e}")
        return []


def eventbrite_city_slug(city_name: str, country: str = 'Brazil') -> str:
    """
    Build Eventbrite city slug.
    Porto Alegre, Brazil → brazil--porto-alegre
    Buenos Aires, Argentina → argentina--buenos-aires
    """
    import unicodedata as _ud
    def _s(t):
        n = _ud.normalize('NFD', t)
        return ''.join(c for c in n if _ud.category(c) != 'Mn').lower().replace(' ', '-')
    return f'{_s(country)}--{_s(city_name)}'


async def fetch_eventbrite(session: aiohttp.ClientSession,
                           city_name: str,
                           lat: float, lon: float,
                           country: str = 'Brazil') -> List[Dict]:
    """
    Uses Eventbrite internal city-browse API.
    Returns structured event data with images, no auth needed.
    URL: /api/v3/destination/city-browse/ with slug=country--city
    """
    slug = eventbrite_city_slug(city_name, country)
    headers = {
        'User-Agent': UA,
        'Accept': 'application/json',
        'Referer': f'https://www.eventbrite.com.br/d/{slug}/events/',
    }
    api_url = 'https://www.eventbrite.com.br/api/v3/destination/city-browse/'
    params  = {'slug': slug, 'page_size': 50}

    try:
        events = []
        seen: Set[str] = set()

        async with session.get(api_url, params=params, headers=headers,
                               timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status != 200:
                log.debug(f"  Eventbrite: HTTP {resp.status} for {city_name}")
                # Fallback: try JSON-LD from HTML page
                return await _fetch_eventbrite_jsonld(session, slug, city_name, lat, lon)
            data = await resp.json(content_type=None)

        # city-browse returns buckets of events
        for bucket in (data.get('buckets') or []):
            for ev in (bucket.get('events') or []):
                ev_id = ev.get('id') or ev.get('event_id')
                if not ev_id:
                    continue
                key = f"eb_{ev_id}"
                if key in seen:
                    continue
                seen.add(key)

                img   = ev.get('image') or {}
                img_url = (img.get('url') or
                           (img.get('image_sizes') or {}).get('medium') or '')
                name  = (ev.get('name') or ev.get('title') or '')[:200]
                start = (ev.get('start_date') or ev.get('start') or
                         (ev.get('date') or {}).get('start') or '')
                if hasattr(start, 'get'):
                    start = start.get('utc', '') or start.get('local', '')

                venue = ev.get('venue') or {}
                if isinstance(venue, str):
                    venue_name = venue
                    v_lat, v_lon = lat, lon
                else:
                    venue_name = venue.get('name', '')
                    try:
                        v_lat = float(venue.get('latitude', lat) or lat)
                        v_lon = float(venue.get('longitude', lon) or lon)
                    except (ValueError, TypeError):
                        v_lat, v_lon = lat, lon

                ev_url = (ev.get('url') or
                          f'https://www.eventbrite.com.br/e/{ev_id}')

                events.append({
                    'name':        name,
                    'artist':      name,
                    'date':        str(start)[:19],
                    'venue':       str(venue_name)[:200],
                    'category':    (bucket.get('name') or 'Event')[:100],
                    'description': (ev.get('summary') or ev.get('description') or '')[:300],
                    'url':         ev_url,
                    'image_url':   img_url,
                    'latitude':    v_lat,
                    'longitude':   v_lon,
                    'source':      'eventbrite',
                    'event_key':   key,
                })

        log.info(f"  Eventbrite: {len(events)} events for {city_name}")
        return events

    except Exception as e:
        log.warning(f"  Eventbrite error ({city_name}): {e}")
        return []


async def _fetch_eventbrite_jsonld(session: aiohttp.ClientSession,
                                   slug: str, city_name: str,
                                   lat: float, lon: float) -> List[Dict]:
    """Fallback: parse JSON-LD from Eventbrite HTML page."""
    url = f'https://www.eventbrite.com.br/d/{slug}/events/'
    try:
        async with session.get(url,
                               headers={'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'},
                               timeout=aiohttp.ClientTimeout(total=15),
                               allow_redirects=True) as resp:
            if resp.status != 200:
                return []
            html = await resp.text()

        events = []
        seen: Set[str] = set()
        ld_blocks = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL)

        for block in ld_blocks:
            try:
                data = json.loads(block)
                items_list = data if isinstance(data, list) else [data]
                # Handle ItemList wrapper
                for wrapper in items_list:
                    if wrapper.get('@type') == 'ItemList':
                        items_list = [i.get('item', i) for i in wrapper.get('mainEntity', [])]
                        break
                for item in items_list:
                    if item.get('@type') not in ('Event', 'MusicEvent'):
                        continue
                    name = item.get('name', '')
                    if not name or name in seen:
                        continue
                    seen.add(name)
                    loc = item.get('location', {})
                    geo = loc.get('geo', {})
                    events.append({
                        'name':        name[:200],
                        'artist':      name[:200],
                        'date':        (item.get('startDate') or '')[:10],
                        'venue':       loc.get('name', '')[:200],
                        'category':    'Event',
                        'description': (item.get('description') or '')[:300],
                        'url':         item.get('url', ''),
                        'image_url':   item.get('image', ''),
                        'latitude':    float(geo['latitude'])  if geo.get('latitude')  else lat,
                        'longitude':   float(geo['longitude']) if geo.get('longitude') else lon,
                        'source':      'eventbrite',
                        'event_key':   f"eb_{abs(hash(name))}",
                    })
            except (json.JSONDecodeError, TypeError):
                continue

        log.info(f"  Eventbrite (JSON-LD fallback): {len(events)} events")
        return events
    except Exception as e:
        log.warning(f"  Eventbrite JSON-LD error: {e}")
        return []

async def fetch_ai(session: aiohttp.ClientSession,
                   city_name: str, country: str,
                   lat: float, lon: float) -> List[Dict]:
    """Run DeepSeek + free OpenRouter models in parallel, each with a different angle."""
    if not DEEPSEEK_KEY and not OPENROUTER_KEY and not GEMINI_KEY and not MISTRAL_KEY:        
        return []

    def _prompt(focus=''):
        hint = f' Focus on {focus}.' if focus else ''
        return f"""Find real upcoming events in {city_name}, {country}.{hint}

For each event return JSON with:
- name, artist, date (YYYY-MM-DD), venue, category, description, url

Return ONLY a JSON array. No markdown.
[]  if nothing found."""

    async def _call(api_url, api_key, model, prompt, tag, extra_hdrs=None) -> List[Dict]:
        try:
            hdrs = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
            if extra_hdrs:
                hdrs.update(extra_hdrs)
            payload = {'model': model, 'messages': [{'role':'user','content':prompt}],
                       'temperature': 0.5, 'max_tokens': 2000}
            async with session.post(api_url, json=payload, headers=hdrs,
                                    timeout=aiohttp.ClientTimeout(total=45)) as resp:
                if resp.status != 200:
                    return []
                data = await resp.json()
                content = data['choices'][0]['message']['content']
                m = re.search(r'\[[\s\S]*\]', content)
                if not m:
                    return []
                raw = json.loads(m.group())
                events = []
                for e in raw:
                    if not isinstance(e, dict) or not e.get('name'):
                        continue
                    events.append({
                        'name':        e.get('name','')[:200],
                        'artist':      e.get('artist','')[:200],
                        'date':        e.get('date',''),
                        'venue':       e.get('venue',''),
                        'category':    e.get('category','Event'),
                        'description': e.get('description','')[:500],
                        'url':         e.get('url',''),
                        'latitude':    lat, 'longitude': lon,
                        'source':      f'ai_{tag}',
                        'event_key':   f"ai_{tag}_{abs(hash(e.get('name','')))}",
                    })
                return events
        except Exception:
            return []
    tasks = []
    angles = ['', 'music and concerts', 'theater arts cultural sports']
    if DEEPSEEK_KEY:
        for i, a in enumerate(angles):
            tasks.append(_call(DEEPSEEK_URL, DEEPSEEK_KEY, 'deepseek-chat',
                               _prompt(a), f'deepseek_{i}'))
    if OPENROUTER_KEY:
        for i, model in enumerate(FREE_MODELS):
            tag = model.split('/')[1].split(':')[0]
            tasks.append(_call(OPENROUTER_URL, OPENROUTER_KEY, model,
                               _prompt(angles[i % len(angles)]), tag, OR_HEADERS))
    if MISTRAL_KEY:
        tasks.append(_call(MISTRAL_URL, MISTRAL_KEY, 'mistral-small-latest',
                           _prompt('music and concerts'), 'mistral'))
    if GEMINI_KEY:
        tasks.append(_call_gemini(_prompt(''), lat, lon, city_name, country))
    if not tasks:
        return []
    results = await asyncio.gather(*tasks, return_exceptions=True)
    events = [e for r in results if isinstance(r, list) for e in r]
    log.info(f"  AI: {len(events)} events")
    return events


async def _call_gemini(session_unused, prompt: str,
                       lat: float, lon: float,
                       city_name: str, country: str) -> List[Dict]:
    """Gemini uses a different API format — key in URL, not Bearer."""
    if not GEMINI_KEY:
        return []
    try:
        url = f"{GEMINI_URL}?key={GEMINI_KEY}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.5, "maxOutputTokens": 2000}
        }
        async with aiohttp.ClientSession() as s:
            async with s.post(url, json=payload,
                              timeout=aiohttp.ClientTimeout(total=45)) as resp:
                if resp.status != 200:
                    return []
                data = await resp.json()
                content = data['candidates'][0]['content']['parts'][0]['text']
                m = re.search(r'\[[\s\S]*\]', content)
                if not m:
                    return []
                raw = json.loads(m.group())
                events = []
                for e in raw:
                    if not isinstance(e, dict) or not e.get('name'):
                        continue
                    events.append({
                        'name':        e.get('name','')[:200],
                        'artist':      e.get('artist','')[:200],
                        'date':        e.get('date',''),
                        'venue':       e.get('venue',''),
                        'category':    e.get('category','Event'),
                        'description': e.get('description','')[:500],
                        'url':         e.get('url',''),
                        'latitude':    lat, 'longitude': lon,
                        'source':      'ai_gemini',
                        'event_key':   f"ai_gemini_{abs(hash(e.get('name','')))}",
                    })
                return events
    except Exception:
        return []


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# RADAR SWEEP
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def sweep_ring(session: aiohttp.ClientSession,
                     city_name: str, country: str,
                     lat: float, lon: float,
                     radius_km: float,
                     sources: List[str],
                     origin_city_id: int) -> int:
    """
    Fetch all sources for one radar ring, save results.
    Returns number of new events saved.
    """
    log.info(f"  📡 Ring {radius_km:.0f}km — launching {len(sources)} sources in parallel...")
    tasks = []

    if 'ticketmaster' in sources:
        tasks.append(fetch_ticketmaster(session, lat, lon, int(radius_km)))
    if 'sympla_api' in sources:
        tasks.append(fetch_sympla_api(session, lat, lon))
    if 'sympla_scraper' in sources:
        tasks.append(fetch_sympla_scraper(session, city_name, lat, lon))
    if 'bandsintown' in sources:
        tasks.append(fetch_bandsintown(session, lat, lon, radius_km))
    if 'viagogo_api' in sources:
        tasks.append(fetch_viagogo_api(session, lat, lon, radius_km))
    if 'viagogo_scraper' in sources:
        tasks.append(fetch_viagogo_scraper(session, city_name, lat, lon))
    if 'eventbrite' in sources:
        tasks.append(fetch_eventbrite(session, city_name, lat, lon))
    if 'ai' in sources:
        tasks.append(fetch_ai(session, city_name, country, lat, lon))

    results = await asyncio.gather(*tasks, return_exceptions=True)
    all_events: List[Dict] = []
    for r in results:
        if isinstance(r, list):
            all_events.extend(r)

    # Enrich descriptions (always on)
    all_events = await enrich_description(session, all_events)

    unique = dedup(all_events)
    saved = 0
    for ev in unique:
        ev['origin_lat'] = lat
        ev['origin_lon'] = lon
        ok = await save_event(session, ev, origin_city_id)
        if ok:
            saved += 1

    log.info(f"  ✅ Ring {radius_km:.0f}km: {len(all_events)} found → {len(unique)} unique → {saved} saved")
    return saved


async def run_fetcher(city_name: str,
                      step_km: float = DEFAULT_STEP_KM,
                      max_km: float = DEFAULT_MAX_KM,
                      sources: Optional[List[str]] = None) -> Dict:
    """
    Main radar sweep. Expands from city center outward in rings.
    """
    all_sources = sources or [
        'ticketmaster', 'sympla_api', 'sympla_scraper',
        'bandsintown', 'viagogo_api', 'viagogo_scraper',
        'eventbrite', 'ai',
    ]

    log.info(f"\n🌆 KEEPUP FETCHER — {city_name}")
    log.info(f"   Step: {step_km}km  |  Max: {max_km}km  |  Sources: {', '.join(all_sources)}")

    async with aiohttp.ClientSession() as session:
        # Geocode starting city
        lat, lon, country, cc = await geocode_city(session, city_name)
        if lat is None:
            log.error(f"Could not geocode '{city_name}'")
            return {'success': False, 'error': 'geocode_failed'}

        log.info(f"   📍 {city_name} → ({lat:.4f}, {lon:.4f}) | {country} [{cc}]")

        # Upsert origin city
        origin_id = await upsert_city(city_name, country, cc, lat, lon, 0, max_km)

        total_saved = 0
        radius = step_km

        while radius <= max_km:
            # Update sweep progress in DB
            conn = await get_pg()
            await conn.execute("""
                UPDATE fetcher_cities
                SET current_radius_km = $1, sweep_status = 'expanding', last_sweep_at = NOW()
                WHERE id = $2
            """, radius, origin_id)

            saved = await sweep_ring(
                session, city_name, country,
                lat, lon, radius,
                all_sources, origin_id)
            total_saved += saved

            radius += step_km
            if radius <= max_km:
                log.info(f"   ⏸  Pause {RADAR_PAUSE_S}s before next ring...")
                await asyncio.sleep(RADAR_PAUSE_S)

        # Mark sweep complete
        conn = await get_pg()
        await conn.execute("""
            UPDATE fetcher_cities
            SET sweep_status = 'complete', last_sweep_at = NOW()
            WHERE id = $1
        """, origin_id)

        log.info(f"\n🏁 Sweep complete: {city_name} | {total_saved} total events saved")
        return {
            'success': True,
            'city': city_name,
            'lat': lat, 'lon': lon,
            'max_radius_km': max_km,
            'total_saved': total_saved,
        }
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CLI
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Default continent starting cities — runs forever when no --city given
CONTINENT_CITIES = [
    ('São Paulo',       'Brazil',           'BR'),
    ('New York',        'United States',    'US'),
    ('London',          'United Kingdom',   'GB'),
    ('Lagos',           'Nigeria',          'NG'),
    ('Tokyo',           'Japan',            'JP'),
    ('Sydney',          'Australia',        'AU'),
]

async def run_forever(sources=None, step_km=DEFAULT_STEP_KM):
    """
    Default mode: sweeps all 6 continent cities in parallel, loops forever.
    """
    log.info("🌍 KEEPUP FETCHER — Daemon mode, sweeping all continents forever...")
    cycle = 0
    while True:
        cycle += 1
        log.info(f"\n🔄 Cycle #{cycle} — launching {len(CONTINENT_CITIES)} continents in parallel")
        tasks = [
            run_fetcher(city_name=city, country=country, step_km=step_km,
                       max_km=10_000, sources=sources)
            for city, country, cc in CONTINENT_CITIES
        ]
        await asyncio.gather(*tasks, return_exceptions=True)
        log.info(f"✅ Cycle #{cycle} complete — sleeping 1h before next cycle")
        await asyncio.sleep(3600)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='🐍🦅 KEEPUP Fetcher — Radar Sweeper')
    parser.add_argument('--city',       default=None, help='City to sweep (optional — runs all continents if omitted)')
    parser.add_argument('--country',    default='Brazil', help='Country name (default: Brazil)')
    parser.add_argument('--step',       type=float, default=DEFAULT_STEP_KM,
                        help=f'Ring step in km (default: {DEFAULT_STEP_KM})')
    parser.add_argument('--max-radius', type=float, default=DEFAULT_MAX_KM,
                        help=f'Max sweep radius in km (default: {DEFAULT_MAX_KM})')
    parser.add_argument('--sources',    nargs='+', default=None,
                        help='Sources: ticketmaster sympla_scraper bandsintown '
                             'viagogo_scraper eventbrite ai')
    args = parser.parse_args()

    if args.city:
        # Single city mode
        result = asyncio.run(run_fetcher(
            city_name=args.city,
            step_km=args.step,
            max_km=args.max_radius,
            sources=args.sources,
        ))
        print(json.dumps(result, indent=2, default=str))
    else:
        # Daemon mode — all continents forever
        asyncio.run(run_forever(
            sources=args.sources,
            step_km=args.step,
        ))