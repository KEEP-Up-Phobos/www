#!/usr/bin/env python3
"""Test Shotgun scraper with new URL format."""

import asyncio
import sys

async def test_shotgun():
    sys.path.insert(0, '/media/phobos/KEEP-Up App/backend')
    
    from fetcher.providers.shotgun import ShotgunProvider
    
    provider = ShotgunProvider()
    
    print("Testing Shotgun.live scraper...")
    print("URL will be: https://shotgun.live/en/cities/porto-alegre\n")
    
    events = await provider.search_events(city_name="Porto Alegre")
    
    print(f"✅ Scraped {len(events)} events from Shotgun.live\n")
    
    if events:
        print("First 3 events:")
        for evt in events[:3]:
            print(f"  - {evt.get('name')} ({evt.get('source')})")
            print(f"    URL: {evt.get('url')}")
    
    await provider.close()

if __name__ == "__main__":
    asyncio.run(test_shotgun())
