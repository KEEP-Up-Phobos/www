#!/usr/bin/env python3
"""
🌍 FETCHER DAEMON — 6-Continent Parallel Sweeper
=================================================
Launches 6 parallel radar sweeps, one per continent,
each starting from the continent's geographic center
and expanding radially until the continent's border.

Runs continuously — after all 6 complete, sleeps briefly
then restarts. Stays within the 2GB RAM budget.

Memory target: ~300MB per process × 6 = ~1.8GB peak
               (Python aiohttp processes are lean)

Usage:
  python fetcher_daemon.py              # run all 6 continents
  python fetcher_daemon.py --once       # run one full cycle then exit
  python fetcher_daemon.py --continents south_america europe  # subset

Systemd unit example (create as /etc/systemd/system/keepup-fetcher.service):
  [Unit]
  Description=KEEPUP Fetcher Daemon
  After=network.target docker.service

  [Service]
  User=phobos
  WorkingDirectory=/media/phobos/KEEP-Up App/backend/python
  ExecStart=/usr/bin/python3 fetcher_daemon.py
  Restart=always
  RestartSec=30
  Environment=PYTHONUNBUFFERED=1

  [Install]
  WantedBy=multi-user.target
"""

import asyncio
import logging
import os
import sys
import argparse
import json
import time
from datetime import datetime
from typing import Dict, List, Optional

# Import the radar fetcher
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from keepup_fetcher import run_fetcher, DEFAULT_STEP_KM

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s  [%(name)s]  %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
log = logging.getLogger('daemon')

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CONTINENT CONFIG
# Each continent has:
#   center_city  — Nominatim-resolvable city near geographic center
#   max_radius   — approximate radius to reach continent borders (km)
#   step         — ring increment (km) — smaller = more granular but slower
#   sources      — which fetchers to run (tune per continent)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONTINENTS: Dict[str, Dict] = {
    'south_america': {
        'center_city':  'Cuiabá',           # geographic center of South America
        'max_radius':   4_500,              # ~4500km from center reaches Tierra del Fuego + Caribbean
        'step':         100,
        'sources': [
            'ticketmaster', 'sympla_api', 'sympla_scraper',
            'bandsintown', 'viagogo_scraper', 'eventbrite', 'ai',
        ],
    },
    'north_america': {
        'center_city':  'Kansas City',      # rough center of continental USA/Canada
        'max_radius':   5_500,
        'step':         150,
        'sources': [
            'ticketmaster', 'bandsintown',
            'viagogo_api', 'viagogo_scraper', 'eventbrite', 'ai',
        ],
    },
    'europe': {
        'center_city':  'Prague',           # geographic center of Europe
        'max_radius':   3_500,
        'step':         100,
        'sources': [
            'ticketmaster', 'bandsintown',
            'viagogo_api', 'viagogo_scraper', 'eventbrite', 'ai',
        ],
    },
    'africa': {
        'center_city':  'Bangui',           # Central African Republic — near center
        'max_radius':   5_000,
        'step':         200,
        'sources': [
            'bandsintown', 'eventbrite', 'ai',
        ],
    },
    'asia': {
        'center_city':  'Novosibirsk',      # central Eurasia / Siberia
        'max_radius':   6_000,              # large continent — stops before EU/Africa
        'step':         200,
        'sources': [
            'ticketmaster', 'bandsintown',
            'viagogo_api', 'viagogo_scraper', 'eventbrite', 'ai',
        ],
    },
    'oceania': {
        'center_city':  'Alice Springs',    # center of Australia
        'max_radius':   4_000,              # reaches NZ, PNG, Pacific Islands
        'step':         150,
        'sources': [
            'ticketmaster', 'bandsintown',
            'viagogo_api', 'eventbrite', 'ai',
        ],
    },
}

# Sleep between full continent cycles (seconds)
CYCLE_SLEEP = 3600   # 1 hour before restarting all 6

# Max RAM per process hint (not enforced — Python GC, but keeps us honest)
RAM_LIMIT_MB = 2048


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CONTINENT SWEEPER
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def sweep_continent(name: str, config: Dict) -> Dict:
    """Run a full radar sweep for one continent."""
    log.info(f"\n🌍 [{name.upper()}] Starting sweep from '{config['center_city']}'")
    t0 = time.time()

    try:
        result = await run_fetcher(
            city_name=config['center_city'],
            step_km=config.get('step', DEFAULT_STEP_KM),
            max_km=config['max_radius'],
            sources=config.get('sources'),
        )
        elapsed = round(time.time() - t0, 1)
        log.info(f"🌍 [{name.upper()}] Complete in {elapsed}s — {result.get('total_saved', 0)} events saved")
        return {**result, 'continent': name, 'elapsed_s': elapsed}
    except Exception as e:
        elapsed = round(time.time() - t0, 1)
        log.error(f"🌍 [{name.upper()}] FAILED after {elapsed}s: {e}")
        return {'success': False, 'continent': name, 'error': str(e), 'elapsed_s': elapsed}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DAEMON LOOP
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def run_cycle(continent_names: Optional[List[str]] = None) -> List[Dict]:
    """
    Launch all 6 continent sweeps in parallel.
    Returns list of results when all complete.
    """
    selected = {k: v for k, v in CONTINENTS.items()
                if continent_names is None or k in continent_names}

    log.info(f"\n{'='*60}")
    log.info(f"🌐 KEEPUP FETCHER DAEMON — Cycle starting at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    log.info(f"   Continents: {', '.join(selected.keys())}")
    log.info(f"{'='*60}")

    tasks = [
        sweep_continent(name, config)
        for name, config in selected.items()
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)
    parsed = []
    for r in results:
        if isinstance(r, Exception):
            parsed.append({'success': False, 'error': str(r)})
        else:
            parsed.append(r)

    # Summary
    total_events = sum(r.get('total_saved', 0) for r in parsed)
    successful   = sum(1 for r in parsed if r.get('success'))
    log.info(f"\n{'='*60}")
    log.info(f"🏁 CYCLE COMPLETE — {successful}/{len(parsed)} continents OK — {total_events} total events saved")
    for r in parsed:
        status = '✅' if r.get('success') else '❌'
        log.info(f"   {status} {r.get('continent','?'):20s}  {r.get('total_saved',0):5d} events  {r.get('elapsed_s',0):.0f}s")
    log.info(f"{'='*60}\n")

    return parsed


async def daemon_loop(continent_names: Optional[List[str]] = None,
                      once: bool = False):
    """
    Main daemon loop. Runs continuously unless --once is set.
    """
    cycle_num = 0
    while True:
        cycle_num += 1
        log.info(f"\n🔄 Daemon cycle #{cycle_num}")
        await run_cycle(continent_names)

        if once:
            log.info("--once flag set, exiting after first cycle.")
            break

        log.info(f"💤 Sleeping {CYCLE_SLEEP}s before next cycle...")
        await asyncio.sleep(CYCLE_SLEEP)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CLI
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='🌍 KEEPUP Fetcher Daemon — 6-Continent Sweeper')
    parser.add_argument('--continents', nargs='+', default=None,
                        choices=list(CONTINENTS.keys()),
                        help='Continents to sweep (default: all 6)')
    parser.add_argument('--once', action='store_true',
                        help='Run one full cycle then exit (no loop)')
    parser.add_argument('--list', action='store_true',
                        help='List configured continents and exit')
    args = parser.parse_args()

    if args.list:
        print("\nConfigured continents:")
        for name, cfg in CONTINENTS.items():
            print(f"  {name:20s}  center={cfg['center_city']:20s}  max={cfg['max_radius']}km  step={cfg['step']}km")
        sys.exit(0)

    try:
        asyncio.run(daemon_loop(
            continent_names=args.continents,
            once=args.once,
        ))
    except KeyboardInterrupt:
        log.info("\n⏹  Daemon stopped by user.")
