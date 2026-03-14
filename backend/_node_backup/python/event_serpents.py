#!/usr/bin/env python3
"""
🐍🦅📚 THE PYTHON SERPENTS & DRAGONS - Lightning-Fast Event Fetchers
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Trained creatures released by THE KEEPER for parallel,
asynchronous event fetching across multiple sources simultaneously.

🐍 SERPENTS: Strike APIs with venom (Ticketmaster, Sympla)
🦅 FEATHER-DRAGON: Swift DuckDuckGo web searches (The Duck's wings)
📚 SAGE-DRAGON: Ancient Wikipedia knowledge extraction (The Scholar's wisdom)

"Where Node.js fetches one by one, Python creatures strike all at once."
"""

import asyncio
import aiohttp
import os
import json
import re
from datetime import datetime
from typing import List, Dict, Optional
from dotenv import load_dotenv
from urllib.parse import quote, urljoin

load_dotenv()


class PythonSerpent:
    """🐍 A single serpent trained to fetch from one Event Sorcerer"""
    
    def __init__(self, name: str, sorcerer: str):
        self.name = name
        self.sorcerer = sorcerer
        self.events = []
        self.errors = 0
        
    async def strike(self, session: aiohttp.ClientSession, city: str, country: str) -> List[Dict]:
        """⚡ Strike with lightning speed"""
        print(f"   🐍 {self.name} strikes for {self.sorcerer}...")
        return []


class TicketmasterSerpent(PythonSerpent):
    """🎫 Serpent trained in Ticketmaster incantations"""
    
    async def strike(self, session: aiohttp.ClientSession, city: str, country: str, country_code: str = 'BR') -> List[Dict]:
        api_key = os.getenv('TICKETMASTER_API_KEY')
        if not api_key or api_key == 'your_key_here':
            return []
            
        print(f"   🐍 {self.name} strikes for {self.sorcerer}...")
        
        try:
            # Try city search first
            params = {
                'apikey': api_key,
                'city': city,
                'countryCode': country_code,
                'size': 100
            }
            
            async with session.get(
                'https://app.ticketmaster.com/discovery/v2/events',
                params=params,
                timeout=aiohttp.ClientTimeout(total=15)
            ) as response:
                if response.status != 200:
                    raise Exception(f"Status {response.status}")
                    
                data = await response.json()
                
                if data.get('_embedded') and data['_embedded'].get('events'):
                    events = []
                    for event in data['_embedded']['events'][:100]:
                        venue = event.get('_embedded', {}).get('venues', [{}])[0]
                        events.append({
                            'event_key': f"ticketmaster_{event.get('id')}",
                            'event_name': event.get('name', 'Unknown'),
                            'artist_name': event.get('name', 'Unknown'),
                            'description': event.get('info', ''),
                            'event_date': event.get('dates', {}).get('start', {}).get('dateTime'),
                            'venue_name': venue.get('name', 'TBD'),
                            'venue_city': venue.get('city', {}).get('name', city),
                            'venue_country': venue.get('country', {}).get('name', country),
                            'event_url': event.get('url', ''),
                            'ticket_url': event.get('url', ''),
                            'source': 'ticketmaster_python',
                            'category': event.get('classifications', [{}])[0].get('segment', {}).get('name', 'Event')
                        })
                    
                    print(f"      ✅ {len(events)} events")
                    return events
                else:
                    # Try country-wide if city returns nothing
                    print(f"      🔄 No city events, trying country-wide...")
                    params = {'apikey': api_key, 'countryCode': country_code, 'size': 100}
                    
                    async with session.get(
                        'https://app.ticketmaster.com/discovery/v2/events',
                        params=params,
                        timeout=aiohttp.ClientTimeout(total=15)
                    ) as response2:
                        if response2.status == 200:
                            data2 = await response2.json()
                            if data2.get('_embedded') and data2['_embedded'].get('events'):
                                events = []
                                for event in data2['_embedded']['events'][:100]:
                                    venue = event.get('_embedded', {}).get('venues', [{}])[0]
                                    events.append({
                                        'event_key': f"ticketmaster_{event.get('id')}",
                                        'event_name': event.get('name', 'Unknown'),
                                        'artist_name': event.get('name', 'Unknown'),
                                        'description': event.get('info', ''),
                                        'event_date': event.get('dates', {}).get('start', {}).get('dateTime'),
                                        'venue_name': venue.get('name', 'TBD'),
                                        'venue_city': venue.get('city', {}).get('name', city),
                                        'venue_country': venue.get('country', {}).get('name', country),
                                        'event_url': event.get('url', ''),
                                        'ticket_url': event.get('url', ''),
                                        'source': 'ticketmaster_python',
                                        'category': event.get('classifications', [{}])[0].get('segment', {}).get('name', 'Event')
                                    })
                                print(f"      ✅ {len(events)} country events")
                                return events
                    
                    return []
                    
        except Exception as e:
            self.errors += 1
            print(f"      ❌ Error: {e}")
            return []


class SymplaSerpent(PythonSerpent):
    """🎭 Serpent trained in Sympla incantations"""
    
    async def strike(self, session: aiohttp.ClientSession, city: str, country: str, country_code: str = 'BR') -> List[Dict]:
        api_token = os.getenv('SYMPLA_APP_TOKEN')
        if not api_token or api_token == 'your_key_here':
            return []
            
        print(f"   🐍 {self.name} strikes for {self.sorcerer}...")
        
        try:
            headers = {
                's_token': api_token,
                'Accept': 'application/json'
            }
            params = {
                'published': 'true',
                'page_size': 200,
                'page': 1
            }
            
            async with session.get(
                'https://api.sympla.com.br/public/v1.5.1/events',
                headers=headers,
                params=params,
                timeout=aiohttp.ClientTimeout(total=15)
            ) as response:
                if response.status != 200:
                    raise Exception(f"Status {response.status}")
                    
                data = await response.json()
                events = []
                
                if data.get('data'):
                    for event in data['data']:
                        address = event.get('address', {})
                        events.append({
                            'event_key': f"sympla_{event.get('id')}",
                            'event_name': event.get('name', 'Unknown'),
                            'artist_name': event.get('host', {}).get('name', 'Various'),
                            'description': event.get('detail', ''),
                            'event_date': event.get('start_date'),
                            'venue_name': address.get('name', 'TBD'),
                            'venue_city': address.get('city', city),
                            'venue_country': 'Brazil',
                            'event_url': event.get('url', ''),
                            'ticket_url': event.get('url', ''),
                            'source': 'sympla_python',
                            'category': event.get('category_prim', {}).get('name', 'Event')
                        })
                
                print(f"      ✅ {len(events)} events")
                return events
                
        except Exception as e:
            self.errors += 1
            print(f"      ❌ Error: {e}")
            return []


class FeatherDragon(PythonSerpent):
    """🦅 The Feather-Dragon - DuckDuckGo's Swift Wings
    
    Soars through the web with the Duck's grace, finding events
    that APIs cannot reach. Faster than Node.js web scraping!
    """
    
    async def strike(self, session: aiohttp.ClientSession, city: str, country: str, country_code: str = 'BR') -> List[Dict]:
        print(f"   🦅 {self.name} soars for {self.sorcerer}...")
        
        # Multilingual search query
        events_word = self.get_events_word(country)
        platforms = ['ticketmaster', 'eventbrite', 'sympla', 'meetup']
        
        try:
            all_events = []
            
            # Search for multiple platforms in parallel
            for platform in platforms[:2]:  # Limit to 2 platforms for speed
                query = f"{city} {platform} {events_word}"
                search_url = f"https://lite.duckduckgo.com/lite/?q={quote(query)}"
                
                async with session.get(search_url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    if response.status == 200:
                        html = await response.text()
                        
                        # Extract event URLs (simple regex for now)
                        urls = re.findall(r'href="([^"]+(?:' + platform + r')[^"]+)"', html)
                        
                        for url in urls[:3]:  # Max 3 per platform
                            # Create event from URL
                            event_name = url.split('/')[-1].replace('-', ' ').title()
                            all_events.append({
                                'event_key': f"feather_{platform}_{hash(url) % 100000}",
                                'event_name': event_name,
                                'artist_name': event_name,
                                'description': f'Found via DuckDuckGo search',
                                'event_date': None,
                                'venue_name': 'TBD',
                                'venue_city': city,
                                'venue_country': country,
                                'event_url': url,
                                'ticket_url': url,
                                'source': 'feather_dragon',
                                'category': 'Event'
                            })
            
            print(f"      🦅 {len(all_events)} events found by Feather-Dragon")
            return all_events
            
        except Exception as e:
            print(f"      ❌ Feather-Dragon error: {e}")
            return []
    
    def get_events_word(self, country: str) -> str:
        """Get 'events' word in the country's language"""
        translations = {
            'Brazil': 'eventos', 'United States': 'events', 'Mexico': 'eventos',
            'Argentina': 'eventos', 'France': 'événements', 'Germany': 'veranstaltungen',
            'Spain': 'eventos', 'Italy': 'eventi', 'Japan': 'イベント',
            'United Kingdom': 'events', 'Canada': 'events', 'Australia': 'events'
        }
        return translations.get(country, 'events')


class SageDragon(PythonSerpent):
    """📚 The Sage-Dragon - Wikipedia's Ancient Wisdom
    
    Draws upon the infinite knowledge of Wikipedia to enrich
    events with artist/venue information. Wiser than all!
    """
    
    async def strike(self, session: aiohttp.ClientSession, city: str, country: str, country_code: str = 'BR') -> List[Dict]:
        print(f"   📚 {self.name} seeks wisdom for {self.sorcerer}...")
        
        try:
            # Search Wikipedia for city events/concerts
            wiki_url = f"https://en.wikipedia.org/w/api.php"
            params = {
                'action': 'query',
                'format': 'json',
                'list': 'search',
                'srsearch': f'{city} concerts events 2026',
                'srlimit': 5
            }
            
            async with session.get(wiki_url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    data = await response.json()
                    events = []
                    
                    for result in data.get('query', {}).get('search', [])[:3]:
                        title = result.get('title', '')
                        snippet = result.get('snippet', '').replace('<span class="searchmatch">', '').replace('</span>', '')
                        
                        events.append({
                            'event_key': f"sage_{result.get('pageid')}",
                            'event_name': title,
                            'artist_name': title,
                            'description': snippet[:200],
                            'event_date': None,
                            'venue_name': 'TBD',
                            'venue_city': city,
                            'venue_country': country,
                            'event_url': f"https://en.wikipedia.org/wiki/{title.replace(' ', '_')}",
                            'ticket_url': f"https://en.wikipedia.org/wiki/{title.replace(' ', '_')}",
                            'source': 'sage_dragon',
                            'category': 'Arts & Culture'
                        })
                    
                    print(f"      📚 {len(events)} wisdom entries from Sage-Dragon")
                    return events
            
            return []
            
        except Exception as e:
            print(f"      ❌ Sage-Dragon error: {e}")
            return []


class SerpentNest:
    """🏰 The nest where Python Serpents & Dragons gather before striking"""
    
    def __init__(self, city: str, country: str, country_code: str = 'BR', enable_dragons: bool = True):
        self.city = city
        self.country = country
        self.country_code = country_code
        self.serpents = []
        self.enable_dragons = enable_dragons
        
        # Initialize all trained serpents
        self.serpents.append(TicketmasterSerpent("Viper", "Ticketmaster"))
        self.serpents.append(SymplaSerpent("Cobra", "Sympla"))
        
        # Initialize Dragons (optional - for enhanced search)
        if enable_dragons:
            self.serpents.append(FeatherDragon("Feather-Dragon", "DuckDuckGo"))
            self.serpents.append(SageDragon("Sage-Dragon", "Wikipedia"))
        
        # More serpents can be added: EventbriteSerpent, FoursquareSerpent, etc.
        
    async def release_all_serpents(self) -> Dict:
        """
        ⚡ RELEASE ALL SERPENTS & DRAGONS AT ONCE
        All creatures strike simultaneously using asyncio.gather()
        """
        creature_type = "serpents & dragons" if self.enable_dragons else "serpents"
        print(f"\n🐍🦅📚 RELEASING PYTHON {creature_type.upper()} FOR: {self.city}, {self.country}")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print(f"⚡ {len(self.serpents)} creatures ready to strike simultaneously...\n")
        
        start_time = datetime.now()
        
        # Create a shared session for all serpents
        async with aiohttp.ClientSession() as session:
            # STRIKE ALL AT ONCE - This is the magic! 🐍⚡
            tasks = [
                serpent.strike(session, self.city, self.country, self.country_code)
                for serpent in self.serpents
            ]
            
            # Wait for all serpents to complete (parallel execution)
            results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Collect all events from all serpents
        all_events = []
        total_errors = 0
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                print(f"   ❌ {self.serpents[i].name} failed: {result}")
                total_errors += 1
            else:
                all_events.extend(result)
        
        elapsed = (datetime.now() - start_time).total_seconds()
        
        print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print(f"⚡ SERPENT STRIKE COMPLETE")
        print(f"   Time: {elapsed:.2f}s (parallel execution)")
        print(f"   Events: {len(all_events)}")
        print(f"   Errors: {total_errors}")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
        
        return {
            'events': all_events,
            'total': len(all_events),
            'time_seconds': elapsed,
            'errors': total_errors
        }


async def main():
    """Test the Python Serpents with CLI options"""
    import sys
    import argparse
    
    # Parse CLI arguments
    parser = argparse.ArgumentParser(description='🐍 Python Serpents - Lightning-Fast Event Fetching')
    parser.add_argument('city', nargs='?', default='Porto Alegre', help='City name')
    parser.add_argument('country', nargs='?', default='Brazil', help='Country name')
    parser.add_argument('--country-code', default='BR', help='Country code (e.g., BR, US, FR)')
    parser.add_argument('--limit', type=int, default=None, help='Maximum events to return')
    parser.add_argument('--parallel', action='store_true', default=True, help='Use parallel fetching')
    parser.add_argument('--max-parallel', type=int, default=10, help='Max parallel requests')
    parser.add_argument('--dragons', action='store_true', help='Enable Dragons (DuckDuckGo + Wikipedia)')
    parser.add_argument('--serpents-only', action='store_true', help='Only use API Serpents (no Dragons)')
    parser.add_argument('--sources', nargs='+', default=['ticketmaster', 'sympla'], 
                        help='Sources to use (ticketmaster, sympla, duckduckgo, wikipedia)')
    
    args = parser.parse_args()
    
    # Determine which creatures to release
    country_code = args.country_code
    if not country_code and args.country:
        # Auto-detect country code
        country_codes = {
            'Brazil': 'BR', 'United States': 'US', 'Mexico': 'MX',
            'Argentina': 'AR', 'France': 'FR', 'Germany': 'DE',
            'Spain': 'ES', 'Italy': 'IT', 'Japan': 'JP',
            'United Kingdom': 'GB', 'Canada': 'CA', 'Australia': 'AU'
        }
        country_code = country_codes.get(args.country, 'BR')
    
    nest = SerpentNest(args.city, args.country, country_code)
    
    # Filter serpents based on sources
    if args.serpents_only:
        # Remove dragons
        nest.serpents = [s for s in nest.serpents if 'Dragon' not in s.name]
    elif not args.dragons:
        # Remove dragons by default unless --dragons is specified
        nest.serpents = [s for s in nest.serpents if 'Dragon' not in s.name]
    
    # Filter by specific sources
    if args.sources:
        source_filter = set(args.sources)
        filtered_serpents = []
        for serpent in nest.serpents:
            if 'ticketmaster' in source_filter and 'Viper' in serpent.name:
                filtered_serpents.append(serpent)
            elif 'sympla' in source_filter and 'Cobra' in serpent.name:
                filtered_serpents.append(serpent)
            elif 'duckduckgo' in source_filter and 'Feather' in serpent.name:
                filtered_serpents.append(serpent)
            elif 'wikipedia' in source_filter and 'Sage' in serpent.name:
                filtered_serpents.append(serpent)
        nest.serpents = filtered_serpents
    
    result = await nest.release_all_serpents()
    
    # Apply limit if specified
    if args.limit and args.limit > 0:
        result['events'] = result['events'][:args.limit]
        result['total'] = len(result['events'])
        result['limited'] = True
    
    print(f"📊 FINAL RESULT: {result['total']} events in {result['time_seconds']:.2f}s")
    
    # Show first 3 events as sample
    if result['events']:
        print("\n🎫 Sample Events:")
        for event in result['events'][:3]:
            print(f"   • {event['event_name']} - {event['venue_city']}")
    
    # Output JSON for Node.js bridge to parse
    print("\n===JSON_START===")
    print(json.dumps(result))
    print("===JSON_END===")


if __name__ == '__main__':
    asyncio.run(main())
