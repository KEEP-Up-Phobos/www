#!/usr/bin/env python3
"""
🐍🦅 KEEPUP FETCHER — Radar Sweeper
=====================================
Starts at a city center, sweeps outward in expanding radius rings (50km → 100km → ...),
resolves every event's real city via Nominatim reverse geocoding,
saves to fetcher_cities + fetcher_events + fetcher_venues.

Usage:
  python keepup_fetcher.py                          # daemon: sweeps 6 continents forever
  python keepup_fetcher.py --city "Porto Alegre"    # single city sweep
  python keepup_fetcher.py --city "Paris" --step 100 --max-radius 500
  python keepup_fetcher.py --city "SP" --sources ticketmaster sympla_scraper

Sources:
  ticketmaster, sympla_scraper, bandsintown,
  viagogo_scraper, eventbrite, ai

Environment (.env):
  TICKETMASTER_API_KEY, SYMPLA_APP_TOKEN,
  DEEPSEEK_API_KEY, OPENROUTER_API_KEY,
  GEMINI_API_KEY, MISTRAL_API_KEY,
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
import signal
import sys
import unicodedata
from datetime import datetime
from typing import Dict, List, Optional, Set, Tuple

# ── Optional deps ─────────────────────────────────────────────
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

# ── API Keys ──────────────────────────────────────────────────
TICKETMASTER_KEY   = os.getenv('TICKETMASTER_API_KEY', '')
SYMPLA_TOKEN       = os.getenv('SYMPLA_APP_TOKEN', '') or os.getenv('SYMPLA_API_TOKEN', '')
DEEPSEEK_KEY       = os.getenv('DEEPSEEK_API_KEY', '')
OPENROUTER_KEY     = os.getenv('OPENROUTER_API_KEY', '')
GEMINI_KEY         = os.getenv('GEMINI_API_KEY', '')
MISTRAL_KEY        = os.getenv('MISTRAL_API_KEY', '')
VIAGOGO_CLIENT_ID  = os.getenv('VIAGOGO_CLIENT_ID', '')
VIAGOGO_CLIENT_SEC = os.getenv('VIAGOGO_CLIENT_SECRET', '')

DEEPSEEK_URL   = "https://api.deepseek.com/v1/chat/completions"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
GEMINI_URL     = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
MISTRAL_URL    = "https://api.mistral.ai/v1/chat/completions"
OR_HEADERS     = {"HTTP-Referer": "https://app.keepup.lat", "X-Title": "KEEPUP"}

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
NOMINATIM_URL = "https://nominatim.openstreetmap.org"
NOMINATIM_UA  = "KEEPUP-Fetcher/2.0 (contact@keepup.lat)"

# ── Radar config ──────────────────────────────────────────────
DEFAULT_STEP_KM = 50
DEFAULT_MAX_KM  = 10_000
RADAR_PAUSE_S   = 2.0

# ── Browser UA ────────────────────────────────────────────────
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0'

# ── Month map ─────────────────────────────────────────────────
MONTHS = {
    'jan':1,'fev':2,'mar':3,'abr':4,'mai':5,'jun':6,
    'jul':7,'ago':8,'set':9,'out':10,'nov':11,'dez':12,
    'feb':2,'apr':4,'may':5,'aug':8,'sep':9,'oct':10,'dec':12,
}

# ── Continent starting cities (daemon mode) ───────────────────
CONTINENT_CITIES = [
    ('São Paulo',  'Brazil',        'BR'),
    ('New York',   'United States', 'US'),
    ('London',     'United Kingdom','GB'),
    ('Lagos',      'Nigeria',       'NG'),
    ('Tokyo',      'Japan',         'JP'),
    ('Sydney',     'Australia',     'AU'),
]

# ── Sympla state map (BR only) ────────────────────────────────
SYMPLA_STATE_MAP = {
    'Porto Alegre':'RS','Caxias do Sul':'RS','Pelotas':'RS','Santa Maria':'RS',
    'São Paulo':'SP','Campinas':'SP','Santos':'SP','São Bernardo do Campo':'SP',
    'Rio de Janeiro':'RJ','Niterói':'RJ','Nova Iguaçu':'RJ',
    'Belo Horizonte':'MG','Uberlândia':'MG','Contagem':'MG',
    'Salvador':'BA','Feira de Santana':'BA',
    'Fortaleza':'CE','Curitiba':'PR','Londrina':'PR','Maringá':'PR',
    'Manaus':'AM','Belém':'PA','Recife':'PE','Maceió':'AL',
    'Natal':'RN','Goiânia':'GO','Brasília':'DF',
    'Florianópolis':'SC','Joinville':'SC','Blumenau':'SC','Vitória':'ES',
}

# ── Viagogo country map ───────────────────────────────────────
VIAGOGO_CC = {
    'BR':'br','US':'us','GB':'gb','DE':'de','FR':'fr','ES':'es','IT':'it',
    'AR':'ar','MX':'mx','CL':'cl','CO':'co','PE':'pe','UY':'uy','PY':'py',
    'AU':'au','NZ':'nz','CA':'ca','JP':'jp','KR':'kr','NL':'nl','BE':'be',
    'PT':'pt','CH':'ch','AT':'at','SE':'se','NO':'no','DK':'dk','FI':'fi',
    'PL':'pl','ZA':'za','NG':'ng','IN':'in','SG':'sg','HK':'hk',
}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# GEO HELPERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def haversine_km(lat1, lon1, lat2, lon2) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))


def slug(text: str, sep='-') -> str:
    """Remove accents, lowercase, replace spaces."""
    n = unicodedata.normalize('NFD', text)
    n = ''.join(c for c in n if unicodedata.category(c) != 'Mn')
    return n.lower().replace(' ', sep).replace(',','').replace('.','')


_nom_cache: Dict[str, Dict] = {}


async def reverse_geocode(session: aiohttp.ClientSession, lat: float, lon: float) -> Dict:
    """lat/lon → {city, country, country_code}. Cached, 1 req/s."""
    key = f"{round(lat, 2)}:{round(lon, 2)}"
    if key in _nom_cache:
        return _nom_cache[key]
    try:
        async with session.get(
            f"{NOMINATIM_URL}/reverse",
            params={'lat': lat, 'lon': lon, 'format': 'json', 'zoom': 10, 'addressdetails': 1},
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
            _nom_cache[key] = result
            await asyncio.sleep(1.1)
            return result
    except Exception:
        return {}


async def geocode_city(session: aiohttp.ClientSession, city_name: str) -> Tuple[float, float, str, str]:
    """City name → (lat, lon, country, country_code)."""
    try:
        async with session.get(
            f"{NOMINATIM_URL}/search",
            params={'q': city_name, 'format': 'json', 'limit': 1, 'addressdetails': 1},
            headers={'User-Agent': NOMINATIM_UA},
            timeout=aiohttp.ClientTimeout(total=8),
        ) as resp:
            if resp.status != 200:
                return None, None, '', ''
            results = await resp.json(content_type=None)
            if not results:
                return None, None, '', ''
            r    = results[0]
            addr = r.get('address', {})
            await asyncio.sleep(1.1)
            return float(r['lat']), float(r['lon']), addr.get('country', ''), addr.get('country_code', '').upper()
    except Exception as e:
        log.error(f"Geocode '{city_name}' failed: {e}")
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


async def upsert_city(name: str, country: str, cc: str,
                      lat: float, lon: float, radius: float, border: float) -> int:
    conn = await get_pg()
    row = await conn.fetchrow("""
        INSERT INTO fetcher_cities
            (name, country, country_code, latitude, longitude,
             current_radius_km, border_radius_km, sweep_status, sweep_enabled, last_sweep_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'expanding',true,NOW())
        ON CONFLICT (name, country_code) DO UPDATE
            SET current_radius_km = EXCLUDED.current_radius_km,
                last_sweep_at     = NOW(),
                sweep_status      = EXCLUDED.sweep_status
        RETURNING id
    """, name, country, cc, lat, lon, radius, border)
    return row['id']


async def save_event(session: aiohttp.ClientSession, ev: Dict, origin_city_id: int) -> bool:
    """
    Save event to fetcher_events.
    Uses stable external_id from event_key — no timestamp, so re-runs don't duplicate.
    Only calls Nominatim if event has its own lat/lon different from origin.
    """
    conn = await get_pg()

    lat = ev.get('latitude') or ev.get('venue_latitude') or ev.get('origin_lat')
    lon = ev.get('longitude') or ev.get('venue_longitude') or ev.get('origin_lon')

    # ── Stable external_id ─────────────────────────────────────
    source      = (ev.get('source') or 'keepup')[:50]
    external_id = (ev.get('event_key') or ev.get('external_id') or
                   f"{source}_{slug((ev.get('name') or ''), '_')[:60]}")[:255]

    # ── Resolve real city — only if event has distinct coords ──
    real_city_id = origin_city_id
    origin_lat   = ev.get('origin_lat')
    origin_lon   = ev.get('origin_lon')
    has_own_coords = (lat and lon and origin_lat and origin_lon and
                      haversine_km(lat, lon, origin_lat, origin_lon) > 1.0)

    if has_own_coords:
        geo = await reverse_geocode(session, lat, lon)
        city_name = geo.get('city', '')
        if city_name:
            real_city_id = await upsert_city(
                city_name, geo.get('country',''), geo.get('country_code',''),
                lat, lon, 0, 500)

    # ── Venue ──────────────────────────────────────────────────
    venue_id   = None
    venue_name = (ev.get('venue') or ev.get('venue_name') or '')
    if venue_name and lat and lon:
        try:
            conn2 = await get_pg()
            row = await conn2.fetchrow("""
                INSERT INTO fetcher_venues
                    (external_id, source, name, latitude, longitude, city_id)
                VALUES ($1,$2,$3,$4,$5,$6)
                ON CONFLICT (external_id, source) DO UPDATE
                    SET name=EXCLUDED.name, updated_at=NOW()
                RETURNING id
            """, f"v_{source}_{slug(venue_name[:40], '_')}",
                 source, venue_name[:500], float(lat), float(lon), real_city_id)
            venue_id = row['id']
        except Exception:
            pass

    # ── Parse date ─────────────────────────────────────────────
    event_date = None
    raw = ev.get('date') or ev.get('event_date') or ''
    if raw and raw not in ('TBA', ''):
        for fmt in ('%Y-%m-%dT%H:%M:%S', '%Y-%m-%dT%H:%M:%SZ', '%Y-%m-%d'):
            try:
                event_date = datetime.strptime(raw[:19], fmt)
                break
            except ValueError:
                continue

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
                    image_url=COALESCE(NULLIF(EXCLUDED.image_url,''), fetcher_events.image_url),
                    updated_at=NOW()
        """,
            external_id, source,
            (ev.get('name') or 'Unknown')[:500],
            (ev.get('description') or '')[:2000],
            (ev.get('category') or 'Other')[:255],
            float(lat) if lat else None,
            float(lon) if lon else None,
            venue_name[:500] if venue_name else None,
            real_city_id, venue_id, event_date,
            (ev.get('url') or '')[:1000],
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
# HELPERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def dedup(events: List[Dict]) -> List[Dict]:
    seen: Set[str] = set()
    out  = []
    for e in events:
        k = re.sub(r'[^a-z0-9]', '', (e.get('name') or '').lower())[:50]
        if k and k not in seen:
            seen.add(k)
            out.append(e)
    return out


async def enrich_descriptions(session: aiohttp.ClientSession, events: List[Dict]) -> List[Dict]:
    """Fill empty descriptions via DuckDuckGo Instant Answer (best-effort, fast)."""
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
                        timeout=aiohttp.ClientTimeout(total=4),
                    ) as resp:
                        if resp.status == 200:
                            d   = await resp.json(content_type=None)
                            txt = d.get('AbstractText', '')
                            if txt:
                                ev = dict(ev)
                                ev['description'] = txt[:500]
                except Exception:
                    pass
                await asyncio.sleep(0.3)
        enriched.append(ev)
    return enriched


def parse_pt_date(text: str) -> Optional[Tuple]:
    """Parse Portuguese date string from Viagogo text."""
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


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SOURCE FETCHERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def fetch_ticketmaster(session: aiohttp.ClientSession,
                             lat: float, lon: float, radius_km: int) -> List[Dict]:
    if not TICKETMASTER_KEY:
        return []
    try:
        async with session.get(
            'https://app.ticketmaster.com/discovery/v2/events',
            params={'apikey': TICKETMASTER_KEY, 'latlong': f'{lat},{lon}',
                    'radius': str(radius_km), 'unit': 'km', 'size': 200, 'sort': 'date,asc'},
            timeout=aiohttp.ClientTimeout(total=15),
        ) as resp:
            if resp.status != 200:
                return []
            data = await resp.json()
            events = []
            for ev in data.get('_embedded', {}).get('events', []):
                venue = ev.get('_embedded', {}).get('venues', [{}])[0]
                vlat  = venue.get('location', {}).get('latitude')
                vlon  = venue.get('location', {}).get('longitude')
                imgs  = sorted(ev.get('images', []), key=lambda i: i.get('width', 0), reverse=True)
                events.append({
                    'name':        ev.get('name', ''),
                    'artist':      ev.get('name', ''),
                    'date':        ev.get('dates', {}).get('start', {}).get('dateTime', ''),
                    'venue':       venue.get('name', ''),
                    'category':    (ev.get('classifications') or [{}])[0].get('segment', {}).get('name', 'Event'),
                    'description': ev.get('info', ''),
                    'url':         ev.get('url', ''),
                    'image_url':   imgs[0].get('url', '') if imgs else '',
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


async def fetch_sympla_scraper(session: aiohttp.ClientSession,
                               city_name: str, country_code: str,
                               lat: float, lon: float) -> List[Dict]:
    """
    Sympla internal API. BR only — skips non-Brazilian cities entirely.
    Paginates until empty. Max 100 pages to avoid infinite loop.
    """
    if country_code != 'BR':
        return []

    state = SYMPLA_STATE_MAP.get(city_name, '')
    if not state:
        # Unknown BR city — try without state filter but still attempt
        log.debug(f"  Sympla: no state mapping for '{city_name}', trying without state")

    slug_city = f'{slug(city_name)}-{state.lower()}' if state else slug(city_name)
    headers = {
        'User-Agent': UA,
        'Accept': 'application/json',
        'Referer': f'https://www.sympla.com.br/eventos/{slug_city}',
    }
    params = {
        'service': '/v4/search', 'has_banner': '1',
        'only':    'name,start_date,end_date,images,location,id,url,organizer',
        'sort':    'day-trending-score', 'type': 'normal',
        'location': city_name, 'limit': '24',
    }
    if state:
        params['state'] = state

    try:
        events = []
        seen: Set[str] = set()
        page = 1
        MAX_PAGES = 50  # safety cap — avoid 417-page runs

        while page <= MAX_PAGES:
            params['page'] = str(page)
            async with session.get(
                'https://www.sympla.com.br/api/discovery-bff/search/category-type',
                params=params, headers=headers,
                timeout=aiohttp.ClientTimeout(total=15),
            ) as resp:
                if resp.status != 200:
                    break
                data  = await resp.json(content_type=None)
                items = data.get('data', [])
                if not items:
                    break

                for ev in items:
                    ev_id = ev.get('id')
                    key   = f"sympla_{ev_id}"
                    if key in seen:
                        continue
                    seen.add(key)
                    loc   = ev.get('location', {})
                    v_lat = float(loc.get('lat') or lat)
                    v_lon = float(loc.get('lon') or lon)
                    img   = (ev.get('images') or {})
                    events.append({
                        'name':        (ev.get('name') or '')[:200],
                        'artist':      ((ev.get('organizer') or {}).get('name') or ev.get('name') or '')[:200],
                        'date':        (ev.get('start_date') or '')[:19],
                        'venue':       (loc.get('name') or '')[:200],
                        'category':    'Event',
                        'description': '',
                        'url':         ev.get('url', ''),
                        'image_url':   img.get('lg') or img.get('original', ''),
                        'latitude':    v_lat,
                        'longitude':   v_lon,
                        'source':      'sympla',
                        'event_key':   key,
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


async def fetch_bandsintown(session: aiohttp.ClientSession,
                            city_name: str, country: str,
                            lat: float, lon: float) -> List[Dict]:
    """
    Renders Bandsintown city page via Playwright and extracts MusicEvent JSON-LD.
    Validates that each event's venue is actually in or near the target city.
    Falls back gracefully if Playwright is not installed.
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        log.warning("  Bandsintown: playwright not installed")
        return []

    def _city_slug(c, co):
        return f'{slug(c)}-{slug(co)}'

    city_slug = _city_slug(city_name, country)
    url = f'https://www.bandsintown.com/c/{city_slug}'

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(user_agent=UA, locale='en-US')
            page    = await context.new_page()
            await page.goto(url, wait_until='domcontentloaded', timeout=30000)
            await page.wait_for_timeout(5000)
            html = await page.content()
            await browser.close()

        ld_blocks = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL)
        events = []
        seen: Set[str] = set()
        city_lower = city_name.lower()

        for block in ld_blocks:
            try:
                data  = json.loads(block)
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

                    loc    = item.get('location', {})
                    geo    = loc.get('geo', {})
                    v_lat  = float(geo['latitude'])  if geo.get('latitude')  else lat
                    v_lon  = float(geo['longitude']) if geo.get('longitude') else lon

                    # Validate: skip if venue is suspiciously far (>500km) AND
                    # venue name/location doesn't mention our city
                    # This catches the "36 featured events" problem
                    venue_location = str(item).lower()
                    dist = haversine_km(lat, lon, v_lat, v_lon)
                    if dist > 500 and city_lower not in venue_location:
                        continue

                    name   = item.get('name', '')
                    artist = (item.get('performer') or {}).get('name', '') or name
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


async def fetch_viagogo_scraper(session: aiohttp.ClientSession,
                                city_name: str, country_code: str,
                                lat: float, lon: float) -> List[Dict]:
    """
    Viagogo internal getExploreEvents endpoint.
    Returns city-specific events — always the same set for a city (not radius-dependent).
    ON CONFLICT in save_event handles re-runs cleanly.
    """
    vg_cc = VIAGOGO_CC.get(country_code.upper(), 'us')
    nfkd  = unicodedata.normalize('NFD', city_name)
    city_slug_vg = ''.join(c for c in nfkd if unicodedata.category(c) != 'Mn').title().replace(' ', '-')
    base_url = f'https://www.viagogo.com/{vg_cc}/{city_slug_vg}'
    url      = f'{base_url}?method=getExploreEvents'

    try:
        async with session.get(url,
                               headers={'User-Agent': UA, 'Accept': 'application/json', 'Referer': base_url},
                               timeout=aiohttp.ClientTimeout(total=15),
                               allow_redirects=True) as resp:
            if resp.status != 200:
                return []
            data = await resp.json(content_type=None)
            events = []

            # Parse month names (PT + EN)
            months = {**MONTHS, 'may': 5, 'mar': 3}

            for ev in (data.get('events') or []):
                if ev.get('isParkingEvent'):
                    continue
                ev_id = ev.get('eventId')

                # Parse date from formattedDateWithoutYear + formattedTime
                ev_date = ''
                parts = (ev.get('formattedDateWithoutYear') or '').strip().split()
                if len(parts) >= 2:
                    try:
                        day = int(parts[0])
                        mon = months.get(parts[1].lower()[:3], 0)
                        if mon:
                            yr = datetime.now().year
                            if mon < datetime.now().month:
                                yr += 1
                            t = ev.get('formattedTime', '')
                            ev_date = f'{yr}-{mon:02d}-{day:02d}T{t}:00' if t else f'{yr}-{mon:02d}-{day:02d}'
                    except (ValueError, IndexError):
                        pass

                events.append({
                    'name':        (ev.get('name') or '')[:200],
                    'artist':      (ev.get('name') or '')[:200],
                    'date':        ev_date,
                    'venue':       (ev.get('venueName') or '')[:200],
                    'category':    'Concert',
                    'description': '',
                    'url':         ev.get('url', ''),
                    'image_url':   ev.get('imageUrl', ''),
                    'latitude':    lat,
                    'longitude':   lon,
                    'source':      'viagogo',
                    'event_key':   f"viagogo_{ev_id}",
                })

            log.info(f"  Viagogo: {len(events)} events for {city_name}")
            return events
    except Exception as e:
        log.warning(f"  Viagogo error ({city_name}): {e}")
        return []


async def fetch_eventbrite(session: aiohttp.ClientSession,
                           city_name: str, country: str,
                           lat: float, lon: float) -> List[Dict]:
    """
    Eventbrite internal city-browse API.
    Slug: country--city (e.g. brazil--porto-alegre).
    Falls back to JSON-LD HTML parse if API returns non-200.
    """
    def _eb_slug(c, co):
        return f'{slug(co)}--{slug(c)}'

    city_slug = _eb_slug(city_name, country)
    headers   = {'User-Agent': UA, 'Accept': 'application/json',
                 'Referer': f'https://www.eventbrite.com.br/d/{city_slug}/events/'}

    try:
        events: List[Dict] = []
        seen:   Set[str]   = set()

        async with session.get(
            'https://www.eventbrite.com.br/api/v3/destination/city-browse/',
            params={'slug': city_slug, 'page_size': 50},
            headers=headers,
            timeout=aiohttp.ClientTimeout(total=15),
        ) as resp:
            if resp.status != 200:
                return await _eventbrite_jsonld(session, city_slug, city_name, lat, lon)
            data = await resp.json(content_type=None)

        for bucket in (data.get('buckets') or []):
            for ev in (bucket.get('events') or []):
                ev_id = ev.get('id') or ev.get('event_id')
                if not ev_id:
                    continue
                key = f"eb_{ev_id}"
                if key in seen:
                    continue
                seen.add(key)

                img       = ev.get('image') or {}
                img_url   = img.get('url') or (img.get('image_sizes') or {}).get('medium', '')
                name      = (ev.get('name') or ev.get('title') or '')[:200]
                start     = ev.get('start_date') or ev.get('start') or ''
                if isinstance(start, dict):
                    start = start.get('utc', '') or start.get('local', '')
                venue     = ev.get('venue') or {}
                venue_name = venue.get('name', '') if isinstance(venue, dict) else str(venue)
                try:
                    v_lat = float(venue.get('latitude', lat) or lat) if isinstance(venue, dict) else lat
                    v_lon = float(venue.get('longitude', lon) or lon) if isinstance(venue, dict) else lon
                except (ValueError, TypeError):
                    v_lat, v_lon = lat, lon

                events.append({
                    'name':        name,
                    'artist':      name,
                    'date':        str(start)[:19],
                    'venue':       venue_name[:200],
                    'category':    (bucket.get('name') or 'Event')[:100],
                    'description': (ev.get('summary') or ev.get('description') or '')[:300],
                    'url':         ev.get('url') or f'https://www.eventbrite.com.br/e/{ev_id}',
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


async def _eventbrite_jsonld(session: aiohttp.ClientSession,
                             city_slug: str, city_name: str,
                             lat: float, lon: float) -> List[Dict]:
    """Fallback: JSON-LD from Eventbrite HTML."""
    try:
        async with session.get(
            f'https://www.eventbrite.com.br/d/{city_slug}/events/',
            headers={'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'},
            timeout=aiohttp.ClientTimeout(total=15), allow_redirects=True,
        ) as resp:
            if resp.status != 200:
                return []
            html = await resp.text()

        events = []
        seen: Set[str] = set()
        for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL):
            try:
                data  = json.loads(block)
                items = data if isinstance(data, list) else [data]
                for w in list(items):
                    if w.get('@type') == 'ItemList':
                        items = [i.get('item', i) for i in w.get('mainEntity', [])]
                        break
                for item in items:
                    if item.get('@type') not in ('Event', 'MusicEvent'):
                        continue
                    name = item.get('name', '')
                    if not name or name in seen:
                        continue
                    seen.add(name)
                    loc = item.get('location', {})
                    geo = loc.get('geo', {})
                    events.append({
                        'name': name[:200], 'artist': name[:200],
                        'date': (item.get('startDate') or '')[:10],
                        'venue': loc.get('name', '')[:200],
                        'category': 'Event',
                        'description': (item.get('description') or '')[:300],
                        'url': item.get('url', ''),
                        'image_url': item.get('image', ''),
                        'latitude':  float(geo['latitude'])  if geo.get('latitude')  else lat,
                        'longitude': float(geo['longitude']) if geo.get('longitude') else lon,
                        'source': 'eventbrite',
                        'event_key': f"eb_{abs(hash(name))}",
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
    """
    Run all available AI providers in parallel.
    Supports: DeepSeek, OpenRouter (4 free models), Gemini, Mistral.
    Each coroutine is properly awaited — no 'never awaited' warnings.
    """
    if not any([DEEPSEEK_KEY, OPENROUTER_KEY, GEMINI_KEY, MISTRAL_KEY]):
        return []

    def _prompt(focus=''):
        hint = f' Focus on {focus}.' if focus else ''
        return (f"Find real upcoming events in {city_name}, {country}.{hint}\n"
                "Return ONLY a JSON array. Each item: name, artist, date (YYYY-MM-DD), "
                "venue, category, description, url.\n[] if nothing found.")

    def _parse(content: str, tag: str) -> List[Dict]:
        m = re.search(r'\[[\s\S]*\]', content)
        if not m:
            return []
        try:
            raw = json.loads(m.group())
        except json.JSONDecodeError:
            return []
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

    async def _call_openai_compat(api_url, api_key, model, prompt, tag, extra_hdrs=None) -> List[Dict]:
        """Standard OpenAI-compatible API call (DeepSeek, OpenRouter, Mistral)."""
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
                data    = await resp.json()
                content = data['choices'][0]['message']['content']
                return _parse(content, tag)
        except Exception:
            return []

    async def _call_gemini(prompt: str) -> List[Dict]:
        """Gemini uses different API format — key in URL param."""
        try:
            url     = f"{GEMINI_URL}?key={GEMINI_KEY}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.5, "maxOutputTokens": 2000}
            }
            async with session.post(url, json=payload,
                                    timeout=aiohttp.ClientTimeout(total=45)) as resp:
                if resp.status != 200:
                    return []
                data    = await resp.json()
                content = data['candidates'][0]['content']['parts'][0]['text']
                return _parse(content, 'gemini')
        except Exception:
            return []

    angles = ['', 'music and concerts', 'theater arts cultural sports']
    coros  = []

    if DEEPSEEK_KEY:
        for i, a in enumerate(angles):
            coros.append(_call_openai_compat(DEEPSEEK_URL, DEEPSEEK_KEY, 'deepseek-chat',
                                             _prompt(a), f'deepseek_{i}'))

    if OPENROUTER_KEY:
        for i, model in enumerate(FREE_MODELS):
            tag = model.split('/')[1].split(':')[0]
            coros.append(_call_openai_compat(OPENROUTER_URL, OPENROUTER_KEY, model,
                                             _prompt(angles[i % len(angles)]), tag, OR_HEADERS))

    if MISTRAL_KEY:
        coros.append(_call_openai_compat(MISTRAL_URL, MISTRAL_KEY, 'mistral-small-latest',
                                         _prompt('music and concerts'), 'mistral'))

    if GEMINI_KEY:
        coros.append(_call_gemini(_prompt('')))

    results = await asyncio.gather(*coros, return_exceptions=True)
    events  = [e for r in results if isinstance(r, list) for e in r]
    log.info(f"  AI: {len(events)} events ({len(coros)} providers)")
    return events


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# RADAR SWEEP
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def sweep_ring(session: aiohttp.ClientSession,
                     city_name: str, country: str, country_code: str,
                     lat: float, lon: float,
                     radius_km: float,
                     sources: List[str],
                     origin_city_id: int) -> int:
    """Fire all sources in parallel for one radar ring."""
    log.info(f"  📡 Ring {radius_km:.0f}km — launching {len(sources)} sources in parallel...")
    coros = []

    if 'ticketmaster'   in sources: coros.append(fetch_ticketmaster(session, lat, lon, int(radius_km)))
    if 'sympla_scraper' in sources: coros.append(fetch_sympla_scraper(session, city_name, country_code, lat, lon))
    if 'bandsintown'    in sources: coros.append(fetch_bandsintown(session, city_name, country, lat, lon))
    if 'viagogo_scraper'in sources: coros.append(fetch_viagogo_scraper(session, city_name, country_code, lat, lon))
    if 'eventbrite'     in sources: coros.append(fetch_eventbrite(session, city_name, country, lat, lon))
    if 'ai'             in sources: coros.append(fetch_ai(session, city_name, country, lat, lon))

    results    = await asyncio.gather(*coros, return_exceptions=True)
    all_events = [e for r in results if isinstance(r, list) for e in r]

    # Enrich empty descriptions via DuckDuckGo
    all_events = await enrich_descriptions(session, all_events)

    unique = dedup(all_events)
    saved  = 0
    for ev in unique:
        ev['origin_lat'] = lat
        ev['origin_lon'] = lon
        if await save_event(session, ev, origin_city_id):
            saved += 1

    log.info(f"  ✅ Ring {radius_km:.0f}km: {len(all_events)} found → {len(unique)} unique → {saved} saved")
    return saved


async def run_fetcher(city_name: str,
                      step_km:  float = DEFAULT_STEP_KM,
                      max_km:   float = DEFAULT_MAX_KM,
                      sources:  Optional[List[str]] = None) -> Dict:
    """Main radar sweep for a single city."""
    all_sources = sources or [
        'ticketmaster', 'sympla_scraper', 'bandsintown',
        'viagogo_scraper', 'eventbrite', 'ai',
    ]

    log.info(f"\n🌆 KEEPUP FETCHER — {city_name}")
    log.info(f"   Step: {step_km}km  |  Max: {max_km}km  |  Sources: {', '.join(all_sources)}")

    async with aiohttp.ClientSession() as session:
        lat, lon, country, cc = await geocode_city(session, city_name)
        if lat is None:
            log.error(f"Could not geocode '{city_name}'")
            return {'success': False, 'error': 'geocode_failed', 'city': city_name}

        log.info(f"   📍 {city_name} → ({lat:.4f}, {lon:.4f}) | {country} [{cc}]")

        origin_id   = await upsert_city(city_name, country, cc, lat, lon, 0, max_km)
        total_saved = 0
        radius      = step_km

        while radius <= max_km:
            conn = await get_pg()
            await conn.execute("""
                UPDATE fetcher_cities
                SET current_radius_km=$1, sweep_status='expanding', last_sweep_at=NOW()
                WHERE id=$2
            """, radius, origin_id)

            saved = await sweep_ring(
                session, city_name, country, cc,
                lat, lon, radius, all_sources, origin_id)
            total_saved += saved
            radius      += step_km

            if radius <= max_km:
                log.info(f"   ⏸  Pause {RADAR_PAUSE_S}s before next ring...")
                await asyncio.sleep(RADAR_PAUSE_S)

        conn = await get_pg()
        await conn.execute("""
            UPDATE fetcher_cities SET sweep_status='complete', last_sweep_at=NOW() WHERE id=$1
        """, origin_id)

        log.info(f"\n🏁 Sweep complete: {city_name} | {total_saved} total events saved")
        return {'success': True, 'city': city_name,
                'lat': lat, 'lon': lon, 'max_radius_km': max_km, 'total_saved': total_saved}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DAEMON + CLI
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def run_forever(sources=None, step_km=DEFAULT_STEP_KM):
    """
    Daemon mode: sweeps all 6 continent cities in parallel, loops forever.
    Ctrl+C exits cleanly without 'coroutine never awaited' warnings.
    """
    log.info("🌍 KEEPUP FETCHER — Daemon mode, sweeping all continents forever...")
    cycle = 0
    try:
        while True:
            cycle += 1
            log.info(f"\n🔄 Cycle #{cycle} — launching {len(CONTINENT_CITIES)} continents in parallel")
            tasks = [
                asyncio.create_task(
                    run_fetcher(city_name=city, step_km=step_km, max_km=10_000, sources=sources)
                )
                for city, country, cc in CONTINENT_CITIES
            ]
            await asyncio.gather(*tasks, return_exceptions=True)
            log.info(f"✅ Cycle #{cycle} complete — sleeping 1h before next cycle")
            await asyncio.sleep(3600)
    except asyncio.CancelledError:
        log.info("\n⏹  Daemon stopping — cancelling running tasks...")
        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        log.info("⏹  Daemon stopped cleanly.")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='🐍🦅 KEEPUP Fetcher — Radar Sweeper')
    parser.add_argument('--city',       default=None,
                        help='City to sweep. Omit to run daemon mode (all continents forever).')
    parser.add_argument('--step',       type=float, default=DEFAULT_STEP_KM,
                        help=f'Ring step in km (default: {DEFAULT_STEP_KM})')
    parser.add_argument('--max-radius', type=float, default=DEFAULT_MAX_KM,
                        help=f'Max sweep radius in km (default: {DEFAULT_MAX_KM})')
    parser.add_argument('--sources',    nargs='+', default=None,
                        help='Sources: ticketmaster sympla_scraper bandsintown '
                             'viagogo_scraper eventbrite ai')
    args = parser.parse_args()

    # Graceful Ctrl+C handler
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    def _handle_sigint():
        log.info("\n⏹  Ctrl+C — shutting down gracefully...")
        for task in asyncio.all_tasks(loop):
            task.cancel()

    loop.add_signal_handler(signal.SIGINT,  _handle_sigint)
    loop.add_signal_handler(signal.SIGTERM, _handle_sigint)

    try:
        if args.city:
            result = loop.run_until_complete(run_fetcher(
                city_name=args.city,
                step_km=args.step,
                max_km=args.max_radius,
                sources=args.sources,
            ))
            print(json.dumps(result, indent=2, default=str))
        else:
            loop.run_until_complete(run_forever(
                sources=args.sources,
                step_km=args.step,
            ))
    except (KeyboardInterrupt, asyncio.CancelledError):
        pass
    finally:
        loop.close()