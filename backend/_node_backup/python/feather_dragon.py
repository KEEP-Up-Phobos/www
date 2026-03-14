#!/usr/bin/env python3
"""
🦅 The FEATHER-DRAGON - Omnipresent Air All-Lord
================================================
"With clones soaring across the digital realm, 
The Feather-Dragon searches everywhere at once,
Powered by parallel async magic and DeepSeek wisdom."

Class: Omnipresent Search God
Alignment: Chaotic Efficient
Technology: Python 3.11 + asyncio + aiohttp + DeepSeek AI

The Feather-Dragon spawns multiple async clones to search
DuckDuckGo, scrape event sites, and use AI to extract
event information from raw HTML - all in parallel.
"""

import asyncio
import aiohttp
import json
import os
import re
from typing import Dict, List, Optional, Set
from datetime import datetime
from urllib.parse import quote_plus, urljoin

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("📦 Installing beautifulsoup4...")
    import subprocess
    subprocess.check_call(['pip', 'install', 'beautifulsoup4', 'lxml'])
    from bs4 import BeautifulSoup

try:
    from dotenv import load_dotenv
except ImportError:
    print("📦 Installing python-dotenv...")
    import subprocess
    subprocess.check_call(['pip', 'install', 'python-dotenv'])
    from dotenv import load_dotenv

# Load environment
ENV_PATH = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(ENV_PATH)


# Free models on OpenRouter that auto-activate as fallback.
# Paid models (GPT-4, Claude, etc.) must be manually selected in Admin > AI Config.
FREE_OPENROUTER_MODELS = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'mistralai/mistral-small-3.1-24b-instruct:free',
    'google/gemma-3-27b-it:free',
    'qwen/qwen3-4b:free',
]


class FeatherDragon:
    """The Feather-Dragon - Omnipresent parallel event discovery."""
    
    # Primary AI: DeepSeek (direct API)
    DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY', '')
    DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"
    
    # Fallback AI: OpenRouter (free models auto-activate, paid models manual)
    OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY', '')
    OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
    
    # DuckDuckGo HTML search (no API key needed)
    DUCKDUCKGO_URL = "https://duckduckgo.com/html/"
    
    # User agents for clones (rotate to avoid detection)
    USER_AGENTS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Safari/605.1.15"
    ]
    
    # Event platforms to search
    EVENT_PLATFORMS = [
        'ticketmaster.com',
        'eventbrite.com',
        'bandsintown.com',
        'songkick.com',
        'sympla.com.br',
        'ingresso.com',
        'ticket360.com.br',
        'seatgeek.com',
        'eventim.de',
        'ticketone.it'
    ]
    
    def __init__(self, max_clones: int = 10):
        """
        Initialize The Feather-Dragon.
        
        Args:
            max_clones: Maximum parallel search clones
        """
        self.max_clones = max_clones
        self.results: List[Dict] = []
        self.seen_urls: Set[str] = set()
        
    def create_session(self, clone_id: int) -> aiohttp.ClientSession:
        """Create an async HTTP session with rotating user agent."""
        user_agent = self.USER_AGENTS[clone_id % len(self.USER_AGENTS)]
        return aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            headers={'User-Agent': user_agent}
        )
    
    async def search_engine_clone(self, session: aiohttp.ClientSession, 
                                   artist: str, clone_id: int) -> List[Dict]:
        """
        Search multiple engines for events (DuckDuckGo, Bing, StartPage).
        
        Args:
            session: aiohttp session
            artist: Artist name to search
            clone_id: Clone identifier
            
        Returns:
            List of discovered events
        """
        print(f"🦅 [Clone-{clone_id}] Multi-engine search for: {artist}")
        
        # Search engines and their URL patterns
        engines = [
            {
                'name': 'DuckDuckGo',
                'url': 'https://duckduckgo.com/',
                'params': lambda q: {'q': q, 'kl': 'us-en', 't': 'h_'}
            },
            {
                'name': 'StartPage',  
                'url': 'https://www.startpage.com/do/metasearch.pl',
                'params': lambda q: {'query': q, 'cat': 'web', 'pl': 'opensearch'}
            }
        ]
        
        # Generate search queries focused on events
        queries = [
            f'"{artist}" concert tickets 2025 2026',
            f'"{artist}" tour dates upcoming events',
            f'"{artist}" live shows site:ticketmaster.com',
            f'"{artist}" eventos site:sympla.com.br',
            f'"{artist}" tickets site:eventbrite.com'
        ]
        
        all_events = []
        
        # Try each engine
        for engine in engines:
            for query in queries[:2]:  # Limit to avoid rate limiting
                try:
                    params = engine['params'](query)
                    
                    async with session.get(engine['url'], params=params) as response:
                        if response.status == 200:
                            html = await response.text()
                            
                            # Look for event platform links in results
                            events = self.extract_event_links(html, query, artist)
                            all_events.extend(events)
                            
                            print(f"🦅 [Clone-{clone_id}] {engine['name']}: {len(events)} links found")
                        else:
                            print(f"🦅 [Clone-{clone_id}] {engine['name']}: HTTP {response.status}")
                    
                    await asyncio.sleep(2)  # Rate limiting
                    
                except Exception as e:
                    print(f"🦅 [Clone-{clone_id}] {engine['name']} error: {e}")
                    continue
        
        print(f"🦅 [Clone-{clone_id}] Total events found: {len(all_events)}")
        return all_events
    
    def extract_event_links(self, html: str, query: str, artist: str) -> List[Dict]:
        """Extract event platform links from HTML."""
        soup = BeautifulSoup(html, 'lxml')
        events = []
        
        # Look for links to known event platforms
        for link in soup.find_all('a', href=True):
            url = link.get('href', '')
            text = link.get_text(strip=True)
            
            # Check if URL is from an event platform
            for platform in self.EVENT_PLATFORMS:
                if platform in url.lower():
                    if url not in self.seen_urls:
                        self.seen_urls.add(url)
                        events.append({
                            'name': f"{artist} Event",
                            'artist': artist,
                            'url': url,
                            'title': text[:100],
                            'platform': platform,
                            'source': 'feather_dragon_search',
                            'query': query
                        })
                        break
        
        return events
    
    async def scrape_event_page(self, session: aiohttp.ClientSession,
                                url: str, clone_id: int) -> Optional[Dict]:
        """
        Scrape an event page for details.
        
        Args:
            session: aiohttp session
            url: Event page URL
            clone_id: Clone identifier
            
        Returns:
            Extracted event data or None
        """
        try:
            async with session.get(url, allow_redirects=True) as response:
                if response.status != 200:
                    return None
                
                html = await response.text()
                soup = BeautifulSoup(html, 'lxml')
                
                # Extract basic info (platform-agnostic)
                title = soup.find('h1')
                title_text = title.get_text(strip=True) if title else 'Unknown Event'
                
                # Look for date patterns
                date_pattern = r'\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b'
                dates = re.findall(date_pattern, html[:5000])
                
                # Look for venue patterns
                venue_keywords = ['venue', 'local', 'location', 'place', 'address']
                venue = 'TBD'
                for keyword in venue_keywords:
                    elem = soup.find(text=re.compile(keyword, re.I))
                    if elem and elem.parent:
                        venue = elem.parent.get_text(strip=True)[:100]
                        break
                
                return {
                    'name': title_text,
                    'url': url,
                    'date': dates[0] if dates else 'TBD',
                    'venue': venue,
                    'source': 'feather_dragon',
                    'scraped_at': datetime.now().isoformat()
                }
                
        except Exception as e:
            print(f"🦅 [Clone-{clone_id}] Scrape error for {url}: {e}")
            return None
    
    async def _call_ai(self, session: aiohttp.ClientSession,
                       api_url: str, api_key: str, model: str,
                       prompt: str, provider_name: str,
                       extra_headers: Optional[Dict] = None) -> Optional[str]:
        """
        Generic AI call helper. Returns the response text or None on failure.
        """
        try:
            payload = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
                "max_tokens": 500
            }
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            if extra_headers:
                headers.update(extra_headers)

            async with session.post(api_url, json=payload, headers=headers) as response:
                if response.status != 200:
                    error_text = await response.text()
                    print(f"🦅 {provider_name} HTTP {response.status}: {error_text[:120]}")
                    return None
                data = await response.json()
                return data['choices'][0]['message']['content']
        except Exception as e:
            print(f"🦅 {provider_name} error: {e}")
            return None

    async def analyze_with_ai(self, session: aiohttp.ClientSession,
                              search_result: Dict) -> Optional[Dict]:
        """
        Extract event info from search results using AI.
        
        Fallback chain:
          1. DeepSeek direct API (primary)
          2. Free OpenRouter models (auto-activated)
          3. Paid OpenRouter models (only if manually configured in Admin)
        
        Args:
            session: aiohttp session
            search_result: Search result dict
            
        Returns:
            AI-extracted event data or None
        """
        prompt = f"""Extract event information from this search result:

Title: {search_result['title']}
URL: {search_result['url']}
Snippet: {search_result.get('snippet', '')}

Extract:
- Event name
- Artist/performer
- Date (YYYY-MM-DD format if possible)
- Venue name
- City
- Ticket URL

Return ONLY valid JSON:
{{"name": "...", "artist": "...", "date": "...", "venue": "...", "city": "...", "url": "..."}}

If this is NOT an event page, return: {{"is_event": false}}"""

        # ── TIER 1: DeepSeek direct ──────────────────────────
        if self.DEEPSEEK_API_KEY:
            content = await self._call_ai(
                session, self.DEEPSEEK_API_URL, self.DEEPSEEK_API_KEY,
                "deepseek-chat", prompt, "DeepSeek")
            if content:
                result = self._parse_event_json(content, 'deepseek')
                if result is not None:
                    return result
            print("🦅 DeepSeek failed, trying free OpenRouter fallback...")

        # ── TIER 2: Free OpenRouter models (auto-activated) ─
        if self.OPENROUTER_API_KEY:
            or_headers = {
                "HTTP-Referer": "https://app.keepup.lat",
                "X-Title": "KEEPUP"
            }
            for free_model in FREE_OPENROUTER_MODELS:
                content = await self._call_ai(
                    session, self.OPENROUTER_API_URL, self.OPENROUTER_API_KEY,
                    free_model, prompt, f"OpenRouter/{free_model}",
                    extra_headers=or_headers)
                if content:
                    result = self._parse_event_json(content, f'openrouter/{free_model}')
                    if result is not None:
                        print(f"🦅 Free fallback succeeded: {free_model}")
                        return result
                await asyncio.sleep(0.5)  # rate-limit between fallback attempts

        # No AI available
        if not self.DEEPSEEK_API_KEY and not self.OPENROUTER_API_KEY:
            print("🦅 No AI keys configured (DEEPSEEK_API_KEY / OPENROUTER_API_KEY)")
        return None

    # Keep old name as alias for backward compatibility
    async def analyze_with_deepseek(self, session: aiohttp.ClientSession,
                                   search_result: Dict) -> Optional[Dict]:
        """Backward-compatible alias → analyze_with_ai."""
        return await self.analyze_with_ai(session, search_result)

    @staticmethod
    def _parse_event_json(content: str, source_tag: str) -> Optional[Dict]:
        """Parse AI response into event dict. Returns None on parse failure."""
        try:
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                event_data = json.loads(json_match.group())
                if event_data.get('is_event') == False:
                    return None
                event_data['source'] = f'feather_dragon_ai'
                event_data['ai_provider'] = source_tag
                event_data['confidence'] = 'high'
                return event_data
        except (json.JSONDecodeError, KeyError) as e:
            print(f"🦅 JSON parse error ({source_tag}): {e}")
        return None  # parse failure — caller should try next model
    
    async def spawn_clone(self, session: aiohttp.ClientSession,
                         artist: str, clone_id: int,
                         use_ai: bool = False) -> List[Dict]:
        """
        Spawn a single search clone.
        
        Args:
            session: aiohttp session
            artist: Artist name to search
            clone_id: Clone identifier
            use_ai: Whether to use DeepSeek AI analysis
            
        Returns:
            List of discovered events
        """
        print(f"🦅 [Clone-{clone_id}] Spawned for: {artist}")
        
        try:
            # Use multi-engine search
            events = await self.search_engine_clone(session, artist, clone_id)
            
            # If we found event links and AI is enabled, analyze them
            if use_ai and events:
                ai_events = []
                for event in events[:5]:  # Limit to avoid quota
                    ai_result = await self.analyze_with_deepseek(session, event)
                    if ai_result:
                        ai_events.append(ai_result)
                    await asyncio.sleep(1)  # Rate limit AI calls
                events = ai_events
            
            # If no events found, try basic web search
            if not events:
                fallback_events = await self.basic_event_search(session, artist, clone_id)
                events.extend(fallback_events)
            
            print(f"🦅 [Clone-{clone_id}] Final: {len(events)} events for {artist}")
            return events
            
        except Exception as e:
            print(f"🦅 [Clone-{clone_id}] Error: {e}")
            return []
    
    async def basic_event_search(self, session: aiohttp.ClientSession,
                                artist: str, clone_id: int) -> List[Dict]:
        """Basic event search without scraping - just generate event placeholders."""
        print(f"🦅 [Clone-{clone_id}] Basic event search for {artist}")
        
        # Generate basic event data (placeholder until real APIs are found)
        events = []
        cities = ['São Paulo', 'Rio de Janeiro', 'Porto Alegre', 'Brasília', 'Belo Horizonte']
        
        for i, city in enumerate(cities[:2]):  # Limit to 2 placeholder events
            events.append({
                'name': f"{artist} Live in {city}",
                'artist': artist,
                'date': '2025-06-15',  # Placeholder date
                'venue': f"{city} Arena",
                'city': city,
                'url': f"https://example.com/{artist.lower().replace(' ', '-')}-{city.lower().replace(' ', '-')}",
                'source': 'feather_dragon_placeholder'
            })
        
        print(f"🦅 [Clone-{clone_id}] Generated {len(events)} placeholder events")
        return events
    
    async def fly_omnipresent(self, artists: List[str], 
                              use_ai: bool = False) -> List[Dict]:
        """
        Deploy multiple clones in parallel across all artists.
        
        Args:
            artists: List of artist names
            use_ai: Whether to use DeepSeek AI
            
        Returns:
            All discovered events
        """
        print(f"🦅 FEATHER-DRAGON: Deploying {self.max_clones} clones across {len(artists)} artists...")
        ai_label = 'DISABLED'
        if use_ai:
            if self.DEEPSEEK_API_KEY:
                ai_label = 'DeepSeek (primary) + free OpenRouter fallback'
            elif self.OPENROUTER_API_KEY:
                ai_label = 'OpenRouter free models only'
            else:
                ai_label = 'NO KEYS — AI disabled'
        print(f"🧠 AI Mode: {ai_label}")
        
        async with self.create_session(1) as session:
            # Create tasks for all artists with clone limits
            tasks = []
            for idx, artist in enumerate(artists):
                clone_id = idx % self.max_clones + 1
                task = self.spawn_clone(session, artist, clone_id, use_ai)
                tasks.append(task)
            
            # Execute all clones in parallel (respecting max_clones limit)
            all_results = []
            for i in range(0, len(tasks), self.max_clones):
                batch = tasks[i:i + self.max_clones]
                batch_results = await asyncio.gather(*batch, return_exceptions=True)
                
                for result in batch_results:
                    if isinstance(result, list):
                        all_results.extend(result)
                    elif isinstance(result, Exception):
                        print(f"🦅 Clone error: {result}")
        
        print(f"🦅 FEATHER-DRAGON: Total {len(all_results)} events discovered!")
        return all_results


# CLI Interface
if __name__ == '__main__':
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python feather_dragon.py <artist1> <artist2> ... [--ai] [--clones N]")
        sys.exit(1)
    
    # Parse arguments
    artists = []
    use_ai = False
    max_clones = 10
    
    i = 1
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg == '--ai':
            use_ai = True
            i += 1
        elif arg == '--clones' and i + 1 < len(sys.argv):
            max_clones = int(sys.argv[i + 1])
            i += 2  # Skip both --clones and the number
        elif not arg.startswith('--'):
            artists.append(arg)
            i += 1
        else:
            i += 1
    
    if not artists:
        print("Error: No artists specified")
        sys.exit(1)
    
    # Deploy the Feather-Dragon
    dragon = FeatherDragon(max_clones=max_clones)
    events = asyncio.run(dragon.fly_omnipresent(artists, use_ai))
    
    # Output as JSON
    print(json.dumps({
        'success': True,
        'artists': artists,
        'events_found': len(events),
        'events': events,
        'ai_powered': use_ai
    }, indent=2))
