#!/usr/bin/env python3
"""
🎵 ARTIST SEED — Wikipedia Artist Discovery
============================================
Populates the `artists` table in Postgres with real artist names
fetched from Wikipedia category members, filtered by death date
(dead artists are excluded from scraping — no upcoming tours).

Creates the `artists` table if it doesn't exist.

Usage:
  python artist_seed.py                          # seed all genres for all regions
  python artist_seed.py --genre Rock             # one genre
  python artist_seed.py --genre Jazz --limit 500
  python artist_seed.py --region BR              # Brazilian genres only
  python artist_seed.py --check-deaths           # re-check death dates for existing artists

Genres seeded per region:
  Global:  Rock, Pop, Jazz, Electronic, Hip Hop, Classical, R&B, Metal,
           Folk, Punk, Soul, Indie, Alternative, Funk, Country, Reggae
  Brazil:  Sertanejo, Pagode, MPB, Bossa nova, Forró, Axé, Baile funk
  Latin:   Salsa, Bachata, Reggaeton, Cumbia, Tango
  Korea:   K-pop
  Japan:   J-pop, J-rock
"""

import asyncio
import aiohttp
import argparse
import json
import logging
import os
import re
import sys
import time
from datetime import datetime
from typing import Dict, List, Optional, Set

try:
    from dotenv import load_dotenv
    for _p in [os.path.join(os.path.dirname(__file__), '..', '.env'),
               os.path.join(os.path.dirname(__file__), '.env')]:
        if os.path.exists(_p):
            load_dotenv(_p)
            break
except ImportError:
    pass

logging.basicConfig(level=logging.INFO, format='%(asctime)s  %(message)s', datefmt='%H:%M:%S')
log = logging.getLogger('artist_seed')

PG = {
    'host':     os.getenv('PG_DB_HOST', 'localhost'),
    'port':     int(os.getenv('PG_DB_PORT', '5432')),
    'user':     os.getenv('PG_DB_USER', 'keepup_user'),
    'password': os.getenv('PG_DB_PASSWORD', 'keepup_pass'),
    'database': os.getenv('PG_DB_NAME', 'keepup_events'),
}

WIKI_API   = "https://en.wikipedia.org/w/api.php"
WIKI_UA    = "KEEPUP-ArtistSeed/2.0 (contact@keepup.lat)"

# Rate limits
WIKI_SLEEP = 0.6   # between Wikipedia API calls
DEATH_SLEEP = 0.4  # between death-date checks

# ── Genre/region config ───────────────────────────────────────
GENRES: Dict[str, List[str]] = {
    # Genre label → Wikipedia category suffixes to try
    'Rock':        ['musicians', 'bands', 'artists', 'groups'],
    'Pop':         ['musicians', 'singers', 'artists', 'groups'],
    'Jazz':        ['musicians', 'artists', 'composers'],
    'Electronic':  ['musicians', 'music artists', 'DJs', 'producers'],
    'Hip hop':     ['musicians', 'rappers', 'artists', 'groups'],
    'Classical':   ['composers', 'musicians', 'conductors'],
    'R&B':         ['musicians', 'singers', 'artists'],
    'Metal':       ['musicians', 'bands', 'artists'],
    'Folk':        ['musicians', 'singers', 'artists'],
    'Punk rock':   ['musicians', 'bands', 'groups'],
    'Soul':        ['musicians', 'singers', 'artists'],
    'Indie rock':  ['musicians', 'bands', 'artists'],
    'Alternative rock': ['musicians', 'bands', 'artists'],
    'Funk':        ['musicians', 'bands', 'artists'],
    'Country':     ['musicians', 'singers', 'artists'],
    'Reggae':      ['musicians', 'artists', 'bands'],
    # Brazilian
    'Sertanejo':   ['musicians', 'singers', 'artists'],
    'Pagode':      ['musicians', 'artists'],
    'MPB':         ['musicians', 'singers', 'artists'],
    'Bossa nova':  ['musicians', 'composers', 'artists'],
    'Forró':       ['musicians', 'artists'],
    'Axé':         ['musicians', 'artists'],
    'Baile funk':  ['musicians', 'artists', 'DJs'],
    # Latin
    'Salsa':       ['musicians', 'artists', 'singers'],
    'Reggaeton':   ['musicians', 'artists', 'singers'],
    'Bachata':     ['musicians', 'artists'],
    'Cumbia':      ['musicians', 'artists', 'bands'],
    'Tango':       ['musicians', 'composers', 'artists'],
    # Asian
    'K-pop':       ['musicians', 'groups', 'artists', 'singers'],
    'J-pop':       ['musicians', 'artists', 'singers'],
    'J-rock':      ['musicians', 'bands', 'artists'],
    # African
    'Afrobeats':   ['musicians', 'artists', 'singers'],
    'Afropop':     ['musicians', 'artists'],
}

SKIP_PREFIXES = ('List of', 'Category:', 'Template:', 'Portal:', 'Wikipedia:', 'File:', 'Talk:')


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DB SETUP
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS artists (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(255) NOT NULL UNIQUE,
    genres       TEXT[],
    country_code VARCHAR(10),
    death_date   DATE,
    is_active    BOOLEAN NOT NULL DEFAULT true,
    wiki_checked_at TIMESTAMP WITH TIME ZONE,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_artists_active ON artists (is_active);
CREATE INDEX IF NOT EXISTS ix_artists_name   ON artists (name);
"""


async def ensure_table():
    conn = await _get_pg()
    await conn.execute(CREATE_TABLE_SQL)
    log.info("✅ artists table ready")


_pg_conn = None


async def _get_pg():
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


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# WIKIPEDIA FETCHING
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def fetch_category_members(session: aiohttp.ClientSession,
                                  category: str,
                                  limit: int = 500) -> List[str]:
    """Fetch page titles from a Wikipedia category."""
    members = []
    cmcontinue = None

    while len(members) < limit:
        params = {
            'action':  'query',
            'format':  'json',
            'list':    'categorymembers',
            'cmtitle': f'Category:{category}',
            'cmlimit': min(500, limit - len(members)),
            'cmtype':  'page',
        }
        if cmcontinue:
            params['cmcontinue'] = cmcontinue

        try:
            async with session.get(WIKI_API, params=params,
                                   headers={'User-Agent': WIKI_UA},
                                   timeout=aiohttp.ClientTimeout(total=15)) as resp:
                if resp.status != 200:
                    break
                data = await resp.json(content_type=None)
                for m in data.get('query', {}).get('categorymembers', []):
                    title = m.get('title', '')
                    if not any(title.startswith(p) for p in SKIP_PREFIXES):
                        members.append(title)
                cmcontinue = data.get('continue', {}).get('cmcontinue')
                if not cmcontinue:
                    break
                await asyncio.sleep(WIKI_SLEEP)
        except Exception as e:
            log.debug(f"  Wikipedia category error ({category}): {e}")
            break

    return members


async def get_death_date(session: aiohttp.ClientSession,
                          title: str) -> Optional[str]:
    """
    Check Wikipedia article for death date.
    Returns ISO date string if dead, None if alive or unknown.
    Uses the Wikidata API for reliability.
    """
    try:
        # First get the Wikidata ID from Wikipedia
        params = {
            'action': 'query', 'format': 'json',
            'titles': title, 'prop': 'pageprops',
            'ppprop': 'wikibase_item',
        }
        async with session.get(WIKI_API, params=params,
                               headers={'User-Agent': WIKI_UA},
                               timeout=aiohttp.ClientTimeout(total=8)) as resp:
            if resp.status != 200:
                return None
            data = await resp.json(content_type=None)
            pages = data.get('query', {}).get('pages', {})
            page  = list(pages.values())[0] if pages else {}
            qid   = page.get('pageprops', {}).get('wikibase_item')
        if not qid:
            return None

        await asyncio.sleep(DEATH_SLEEP)

        # Query Wikidata for date of death (P570)
        wd_url = f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json"
        async with session.get(wd_url,
                               headers={'User-Agent': WIKI_UA},
                               timeout=aiohttp.ClientTimeout(total=8)) as resp:
            if resp.status != 200:
                return None
            wd = await resp.json(content_type=None)
            entity  = wd.get('entities', {}).get(qid, {})
            claims  = entity.get('claims', {})
            p570    = claims.get('P570', [])  # date of death
            if not p570:
                return None
            time_val = (p570[0].get('mainsnak', {})
                               .get('datavalue', {})
                               .get('value', {})
                               .get('time', ''))
            # Format: +1970-01-01T00:00:00Z
            m = re.search(r'\+?(\d{4}-\d{2}-\d{2})', time_val)
            return m.group(1) if m else 'deceased'
    except Exception:
        return None


def clean_name(title: str) -> Optional[str]:
    """Remove disambiguation suffix and validate length."""
    name = re.sub(r'\s*\(.*?\)\s*$', '', title).strip()
    if 2 <= len(name) <= 120:
        return name
    return None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SEED LOGIC
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def seed_genre(session: aiohttp.ClientSession,
                     genre: str, suffixes: List[str],
                     limit: int = 500,
                     check_deaths: bool = True) -> int:
    """
    Fetch artists for one genre, filter dead ones, upsert into DB.
    Returns count of artists inserted/updated.
    """
    log.info(f"\n🎵 Genre: {genre}")
    conn = await _get_pg()

    all_titles: Set[str] = set()
    for suffix in suffixes:
        category = f'{genre} {suffix}'
        log.info(f"   Fetching Wikipedia category: '{category}'")
        titles = await fetch_category_members(session, category, limit)
        log.info(f"   → {len(titles)} raw entries")
        all_titles.update(titles)
        await asyncio.sleep(WIKI_SLEEP)

    saved = 0
    for title in all_titles:
        name = clean_name(title)
        if not name:
            continue

        death_date = None
        is_active  = True

        if check_deaths:
            death_str = await get_death_date(session, title)
            if death_str:
                is_active  = False
                try:
                    death_date = datetime.strptime(death_str[:10], '%Y-%m-%d').date() \
                                 if death_str != 'deceased' else None
                except ValueError:
                    death_date = None
            await asyncio.sleep(DEATH_SLEEP)

        try:
            await conn.execute("""
                INSERT INTO artists (name, genres, is_active, death_date, wiki_checked_at)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (name) DO UPDATE
                    SET genres          = array(
                            SELECT DISTINCT unnest(artists.genres || EXCLUDED.genres)),
                        is_active       = EXCLUDED.is_active,
                        death_date      = COALESCE(EXCLUDED.death_date, artists.death_date),
                        wiki_checked_at = NOW(),
                        updated_at      = NOW()
            """, name, [genre], is_active, death_date)
            saved += 1
            status = '💀 dead' if not is_active else '✅ active'
            log.debug(f"   {status}  {name}")
        except Exception as e:
            log.debug(f"   DB error ({name}): {e}")

    log.info(f"   → {saved} artists upserted for genre '{genre}'")
    return saved


async def recheck_deaths(session: aiohttp.ClientSession) -> int:
    """Re-check death dates for all artists not checked in the last 30 days."""
    conn = await _get_pg()
    rows = await conn.fetch("""
        SELECT id, name FROM artists
        WHERE is_active = true
          AND (wiki_checked_at IS NULL OR wiki_checked_at < NOW() - INTERVAL '30 days')
        ORDER BY wiki_checked_at NULLS FIRST
        LIMIT 1000
    """)
    log.info(f"Re-checking deaths for {len(rows)} artists...")
    updated = 0
    for row in rows:
        death_str = await get_death_date(session, row['name'])
        if death_str:
            death_date = None
            try:
                death_date = datetime.strptime(death_str[:10], '%Y-%m-%d').date() \
                             if death_str != 'deceased' else None
            except ValueError:
                pass
            await conn.execute("""
                UPDATE artists SET is_active=false, death_date=$1, wiki_checked_at=NOW()
                WHERE id=$2
            """, death_date, row['id'])
            log.info(f"  💀 Marked dead: {row['name']} ({death_str})")
            updated += 1
        else:
            await conn.execute("UPDATE artists SET wiki_checked_at=NOW() WHERE id=$1", row['id'])
        await asyncio.sleep(DEATH_SLEEP)
    log.info(f"Death recheck complete: {updated} newly marked dead")
    return updated


async def run_seed(genres_filter: Optional[List[str]] = None,
                   limit: int = 500,
                   check_deaths: bool = True,
                   recheck: bool = False):
    """Main seed entry point."""
    log.info("🌱 ARTIST SEED starting...")
    await ensure_table()

    async with aiohttp.ClientSession() as session:
        if recheck:
            await recheck_deaths(session)
            return

        genres_to_seed = (
            {g: GENRES[g] for g in genres_filter if g in GENRES}
            if genres_filter
            else GENRES
        )

        total = 0
        for genre, suffixes in genres_to_seed.items():
            n = await seed_genre(session, genre, suffixes, limit, check_deaths)
            total += n
            await asyncio.sleep(1.0)

        # Print summary
        conn = await _get_pg()
        stats = await conn.fetchrow("""
            SELECT COUNT(*) FILTER (WHERE is_active) AS active,
                   COUNT(*) FILTER (WHERE NOT is_active) AS dead,
                   COUNT(*) AS total
            FROM artists
        """)
        log.info(f"\n🏁 SEED COMPLETE")
        log.info(f"   Total in DB: {stats['total']}  |  Active: {stats['active']}  |  Dead: {stats['dead']}")
        log.info(f"   Inserted/updated this run: {total}")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CLI
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='🎵 KEEPUP Artist Seed — Wikipedia Discovery')
    parser.add_argument('--genre',         nargs='+', default=None,
                        help='Genres to seed (default: all). E.g.: --genre Rock Jazz MPB')
    parser.add_argument('--limit',         type=int, default=500,
                        help='Max artists per category (default: 500)')
    parser.add_argument('--no-deaths',     action='store_true',
                        help='Skip death date checking (faster, less accurate)')
    parser.add_argument('--check-deaths',  action='store_true',
                        help='Only re-check death dates for existing artists, no new seeding')
    args = parser.parse_args()

    asyncio.run(run_seed(
        genres_filter=args.genre,
        limit=args.limit,
        check_deaths=not args.no_deaths,
        recheck=args.check_deaths,
    ))
